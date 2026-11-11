import { Router } from "express";
import { z } from "zod";
import { mapDbError } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

const updateSchema = z.object({
  language: z.enum(["en", "fr"]).optional(),
  homeQuartierId: z.string().uuid().nullable().optional(),
});

const pushSchema = z.object({
  quartierId: z.string().uuid(),
  type: z.enum(["light", "water"]),
  endpoint: z.string().url(),
  keys: z.record(z.string()),
});

/** GET /api/profile — own profile (RLS: owner or admin only). */
router.get("/", requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from("profiles")
    .select("*")
    .eq("id", req.user.id)
    .single();

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  res.json({ profile: data });
});

/** PATCH /api/profile — update language / home quartier (role immutable by RLS). */
router.patch("/", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation failed", details: parsed.error.flatten() });
  }

  const update = {};
  if (parsed.data.language !== undefined)
    update.language = parsed.data.language;
  if (parsed.data.homeQuartierId !== undefined)
    update.home_quartier_id = parsed.data.homeQuartierId;

  const { data, error } = await req.supabase
    .from("profiles")
    .update(update)
    .eq("id", req.user.id)
    .select()
    .single();

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  res.json({ profile: data });
});

/** GET /api/profile/subscriptions — my push subscriptions. */
router.get("/subscriptions", requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", req.user.id);

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  res.json({ subscriptions: data });
});

/** POST /api/profile/subscriptions — upsert a push subscription (unique endpoint). */
router.post("/subscriptions", requireAuth, async (req, res) => {
  const parsed = pushSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation failed", details: parsed.error.flatten() });
  }
  const b = parsed.data;

  const { error } = await req.supabase.from("push_subscriptions").upsert(
    {
      user_id: req.user.id,
      quartier_id: b.quartierId,
      type: b.type,
      endpoint: b.endpoint,
      keys: b.keys,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  res.status(201).json({ ok: true });
});

/** DELETE /api/profile/subscriptions — remove by endpoint. */
router.delete("/subscriptions", requireAuth, async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== "string" || !endpoint) {
    return res.status(400).json({ error: "endpoint required" });
  }

  const { error } = await req.supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", req.user.id)
    .eq("endpoint", endpoint);

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  res.json({ ok: true });
});

export default router;
