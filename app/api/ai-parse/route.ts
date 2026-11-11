import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// POST /api/ai-parse — AI turns free text (EN/FR/Pidgin) into a structured
// report draft (PDF §6: source=chat, low-data mode). Uses the Cerebras
// Inference API (free tier, OpenAI-compatible, ultra-fast — ideal for
// bad mobile networks), falling back to Groq when Cerebras fails.
// Server-side only: the key is never exposed.
//
// Input:  { text: "we no get light for Bonamoussadi since morning" }
// Output: { type, quartierName, status, confidence }

const bodySchema = z.object({
  text: z.string().min(3).max(280),
  quartiers: z.array(z.string()).max(100), // official list for matching
});

interface ParseResult {
  type: "light" | "water";
  quartierName: string | null;
  status: "out" | "restored";
  confidence: number;
}

const SYSTEM_PROMPT = `You parse citizen outage reports for Cameroon (ENEO = electricity, Camwater = water).
The user message may be in English, French, or Cameroonian Pidgin.

Classify it and reply with ONLY compact JSON (no markdown fences):
{"type":"light"|"water","quartierName":string|null,"status":"out"|"restored","confidence":0.0-1.0}

Rules:
- "light", "current", "lumiere", "courant", "no light", "pas de courant", "blackout" -> type "light"
- "water", "eau", "no water", "pas d'eau", "robinet" -> type "water"
- status "restored" if they say power/water is back ("back", "revenu", "don don", "don comeback")
- quartierName: the neighborhood mentioned, or null if none. Must sound like a real place.
- confidence: your certainty 0-1. Low if the message is ambiguous.`;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed" }, { status: 400 });
  }

  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!cerebrasKey && !groqKey) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }

  const { text, quartiers } = parsed.data;

  // Both providers expose the OpenAI-compatible /chat/completions shape.
  // Try Cerebras first; on any failure (rate limit, outage, timeout) fall
  // back to Groq.
  const providers: { name: string; url: string; key: string; model: string }[] =
    [];
  if (cerebrasKey)
    providers.push({
      name: "cerebras",
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: cerebrasKey,
      model: "gpt-oss-120b",
    });
  if (groqKey)
    providers.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: groqKey,
      model: "llama-3.3-70b-versatile",
    });

  let lastError: string | null = null;

  for (const p of providers) {
    try {
      const res = await fetch(p.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.key}`,
        },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
          temperature: 0,
          // gpt-oss-120b is a reasoning model: it emits ~50+ tokens of
          // hidden analysis before the JSON answer, so a tight budget
          // truncates the JSON mid-object. 512 covers thinking + answer.
          max_tokens: 512,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(8000), // hard 8s cap — bad networks, PDF rule
      });

      if (!res.ok) {
        lastError = `${p.name}:${res.status}`;
        continue; // try the next provider
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = data.choices?.[0]?.message?.content ?? "";

      // Tolerant JSON extraction (models sometimes add prose/fences)
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        lastError = `${p.name}:unparseable`;
        continue;
      }

      const ai = JSON.parse(match[0]) as Partial<ParseResult>;

      // Validate + clamp — never trust model output blindly
      const type = ai.type === "water" ? "water" : "light";
      const status = ai.status === "restored" ? "restored" : "out";
      const confidence = Math.min(1, Math.max(0, Number(ai.confidence) || 0));

      // Fuzzy-match the quartier against the OFFICIAL list only
      const lower = String(ai.quartierName ?? "").toLowerCase();
      const quartierName =
        quartiers.find((q) => q.toLowerCase() === lower) ??
        quartiers.find((q) => lower.includes(q.toLowerCase())) ??
        null;

      return NextResponse.json({ type, quartierName, status, confidence });
    } catch {
      lastError = `${p.name}:network`;
      continue;
    }
  }

  return NextResponse.json(
    { error: "ai_unavailable", detail: lastError },
    { status: 502 },
  );
}
