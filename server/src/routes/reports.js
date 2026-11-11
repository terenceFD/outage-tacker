import { Router } from "express";
import { z } from "zod";
import { mapDbError } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

const reportSchema = z.object({
  quartierId: z.string().uuid(),
  type: z.enum(["light", "water"]),
  status: z.enum(["out", "restored"]),
  source: z.enum(["app", "chat"]).default("app"),
  rawText: z.string().max(500).nullable().optional(),
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
});

/**
 * GET /api/reports?quartierId=&type=&limit=
 * Recent reports, newest first (public — anyone reads reports, PDF §4).
 */
router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

  let query = req.supabase
    .from("reports")
    .select("id, user_id, quartier_id, type, status, created_at, source")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (req.query.quartierId)
    query = query.eq("quartier_id", req.query.quartierId);
  if (req.query.type) query = query.eq("type", req.query.type);
  if (req.query.since) query = query.gt("created_at", String(req.query.since));

  const { data, error } = await query;
  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  res.json({ reports: data });
});

/**
 * POST /api/reports — create a report via the DB rate-limit RPC.
 * Mirrors the Next.js route: validate, verify quartier exists, then
 * call public.insert_report which enforces 1 report / 30 min / type (PDF §5).
 */
router.post("/", requireAuth, async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation failed", details: parsed.error.flatten() });
  }
  const b = parsed.data;

  // Quartier must exist in the official list — never accept invented names.
  const { data: quartier } = await req.supabase
    .from("quartiers")
    .select("id")
    .eq("id", b.quartierId)
    .single();
  if (!quartier) {
    return res.status(400).json({ error: "unknown quartier" });
  }

  const { data, error } = await req.supabase.rpc("insert_report", {
    p_quartier_id: b.quartierId,
    p_type: b.type,
    p_status: b.status,
    p_source: b.source,
    p_raw_text: b.rawText ?? null,
    p_ai_confidence: b.aiConfidence ?? null,
  });

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({
        error: mapped.status === 429 ? "rate_limited" : "db_error",
        message: mapped.msg,
      });
  }

  res.status(201).json({ report: data });
});

/**
 * POST /api/reports/:id/confirm — "Me too" (unique per user per report).
 */
router.post("/:id/confirm", requireAuth, async (req, res) => {
  const reportId = req.params.id;

  // Report must exist (and be recent enough to matter).
  const { data: report } = await req.supabase
    .from("reports")
    .select("id, created_at")
    .eq("id", reportId)
    .single();
  if (!report) {
    return res.status(404).json({ error: "report not found" });
  }

  // unique(report_id, user_id) in the schema prevents duplicates;
  // check first so we can return a clean 409 instead of a DB error.
  const { data: existing } = await req.supabase
    .from("confirmations")
    .select("id")
    .eq("report_id", reportId)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (existing) {
    return res.status(409).json({ error: "already_confirmed" });
  }

  const { error } = await req.supabase
    .from("confirmations")
    .insert({ report_id: reportId, user_id: req.user.id });

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  res.status(201).json({ ok: true });
});

export default router;
