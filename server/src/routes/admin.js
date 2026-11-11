import { Router } from "express";
import { z } from "zod";
import { mapDbError } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

/** Verify the caller's profile has role=admin and is not blocked. */
async function requireAdmin(req, res, next) {
  const { data: profile, error } = await req.supabase
    .from("profiles")
    .select("role, is_blocked")
    .eq("id", req.user.id)
    .single();

  if (error || !profile) {
    return res.status(403).json({ error: "profile not found" });
  }
  if (profile.role !== "admin" || profile.is_blocked) {
    return res.status(403).json({ error: "admin only" });
  }
  next();
}

router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/users — list profiles (email/phone hidden: the schema
 * only stores phone here; mask it per PDF §5 "emails never exposed").
 */
router.get("/users", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
  const { data, error } = await req.supabase
    .from("profiles")
    .select("id, phone, role, is_blocked, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }

  // Mask phone numbers: show only last 4 digits.
  res.json({
    users: data.map((u) => ({
      ...u,
      phone: u.phone ? `••••${u.phone.slice(-4)}` : null,
    })),
  });
});

const blockSchema = z.object({ isBlocked: z.boolean() });

/** PATCH /api/admin/users/:id — block or unblock an account (abuse, PDF §5). */
router.patch("/users/:id", async (req, res) => {
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation failed", details: parsed.error.flatten() });
  }

  const { data, error } = await req.supabase
    .from("profiles")
    .update({ is_blocked: parsed.data.isBlocked })
    .eq("id", req.params.id)
    .select("id, is_blocked")
    .single();

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  res.json({ user: data });
});

/**
 * GET /api/admin/reports?quartierId=&since= — moderation view of raw
 * reports (admins read all rows via RLS).
 */
router.get("/reports", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);

  let query = req.supabase
    .from("reports")
    .select(
      "id, user_id, quartier_id, type, status, source, raw_text, ai_confidence, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (req.query.quartierId)
    query = query.eq("quartier_id", req.query.quartierId);
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

export default router;
