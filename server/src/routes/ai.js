import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { parseReport } from "../services/ai.js";

const router = Router();

const bodySchema = z.object({
  text: z.string().min(3).max(280),
});

/**
 * POST /api/ai/parse — AI turns free text (EN/FR/Pidgin) into a report
 * draft. Authenticated: PDF §6 allows ~10 AI requests / hour / user,
 * recorded in ai_usage and enforced here.
 */
router.post("/parse", requireAuth, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation failed", details: parsed.error.flatten() });
  }

  if (!process.env.CEREBRAS_API_KEY && !process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: "ai_not_configured" });
  }

  // Rate limit: 10 AI requests per user per rolling hour (PDF §6).
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await req.supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", req.user.id)
    .gte("created_at", oneHourAgo);

  if (countError) {
    return res
      .status(500)
      .json({ error: "db_error", message: countError.message });
  }
  if ((count ?? 0) >= 10) {
    return res
      .status(429)
      .json({
        error: "ai_rate_limited",
        message: "max 10 AI requests per hour",
      });
  }

  // Official quartier list for fuzzy matching (never accept invented names).
  const { data: quartierRows } = await req.supabase
    .from("quartiers")
    .select("name");
  const names = (quartierRows ?? []).map((r) => r.name);

  try {
    const result = await parseReport(parsed.data.text, names);

    // Record usage — best effort, never blocks the response.
    await req.supabase.from("ai_usage").insert({ user_id: req.user.id });

    res.json(result);
  } catch (err) {
    res
      .status(502)
      .json({ error: err.code ?? "ai_unavailable", detail: err.message });
  }
});

export default router;
