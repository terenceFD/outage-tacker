// AI parsing service — ported from app/api/ai-parse/route.ts.
// Cerebras first (fast, free tier), Groq as fallback. Server-side only:
// keys are never exposed. Hard 8 s timeout per provider for bad networks.

const SYSTEM_PROMPT = `You parse citizen outage reports for Cameroon (ENEO = electricity, Camwater = water).
The user message may be in English, French, or Cameroonian Pidgin.

Classify it and reply with ONLY compact JSON (no markdown fences):
{"type":"light"|"water","quartierName":string|null,"status":"out"|"restored","since":string|null,"language":"english"|"french"|"pidgin"|"other","confidence":0.0-1.0}

Rules:
- "light", "current", "lumiere", "courant", "no light", "pas de courant", "blackout" -> type "light"
- "water", "eau", "no water", "pas d'eau", "robinet" -> type "water"
- status "restored" if they say power/water is back ("back", "revenu", "don don", "don comeback")
- quartierName: the neighborhood mentioned, or null if none. Must sound like a real place.
- since: when the outage started, as written ("6am", "morning", "depuis 2h"), or null.
- language: the language the user wrote in.
- confidence: your certainty 0-1. Low if the message is ambiguous.`;

function providers() {
  const list = [];
  if (process.env.CEREBRAS_API_KEY)
    list.push({
      name: "cerebras",
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: process.env.CEREBRAS_API_KEY,
      model: "gpt-oss-120b",
    });
  if (process.env.GROQ_API_KEY)
    list.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
    });
  return list;
}

export function confidenceTier(confidence) {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

/**
 * Parse free text into a structured report draft.
 * @param {string} text
 * @param {string[]} quartiers official quartier names for fuzzy matching
 */
export async function parseReport(text, quartiers) {
  let lastError = null;

  for (const p of providers()) {
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
          // gpt-oss-120b emits hidden reasoning before the JSON answer;
          // a tight budget truncates the JSON mid-object.
          max_tokens: 512,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        lastError = `${p.name}:${res.status}`;
        continue;
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content ?? "";

      // Tolerant JSON extraction (models sometimes add prose/fences).
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        lastError = `${p.name}:unparseable`;
        continue;
      }

      const ai = JSON.parse(match[0]);

      // Validate + clamp — never trust model output blindly.
      const type = ai.type === "water" ? "water" : "light";
      const status = ai.status === "restored" ? "restored" : "out";
      const confidence = Math.min(1, Math.max(0, Number(ai.confidence) || 0));
      const since =
        typeof ai.since === "string" && ai.since.trim().length <= 40
          ? ai.since.trim()
          : null;
      const language = ["english", "french", "pidgin"].includes(
        String(ai.language),
      )
        ? ai.language
        : "other";

      // Fuzzy-match the quartier against the OFFICIAL list only.
      const lower = String(ai.quartierName ?? "").toLowerCase();
      const quartierName =
        quartiers.find((q) => q.toLowerCase() === lower) ??
        quartiers.find((q) => lower.includes(q.toLowerCase())) ??
        null;

      return { type, quartierName, status, since, language, confidence };
    } catch {
      lastError = `${p.name}:network`;
      continue;
    }
  }

  const err = new Error(lastError || "ai_unavailable");
  err.code = "ai_unavailable";
  throw err;
}
