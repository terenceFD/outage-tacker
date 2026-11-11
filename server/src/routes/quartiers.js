import { Router } from "express";
import { mapDbError } from "../db.js";

const router = Router();

/**
 * GET /api/quartiers — the official quartier list (public).
 * Optional ?city=Douala filter.
 */
router.get("/", async (req, res) => {
  let query = req.supabase
    .from("quartiers")
    .select("*")
    .order("city")
    .order("name");

  if (req.query.city) query = query.eq("city", String(req.query.city));

  const { data, error } = await query;
  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  res.json({ quartiers: data });
});

/**
 * GET /api/quartiers/statuses — live derived status for every
 * quartier × type pair, straight from the quartier_statuses view
 * (status is computed by the DB, never stored by hand — PDF §5).
 */
router.get("/statuses", async (req, res) => {
  let query = req.supabase.from("quartier_statuses").select("*");

  if (req.query.city) query = query.eq("city", String(req.query.city));
  if (req.query.type && ["light", "water"].includes(String(req.query.type))) {
    query = query.eq("type", String(req.query.type));
  }

  const { data, error } = await query;
  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  res.json({ statuses: data });
});

/**
 * GET /api/quartiers/:id/statuses — status rows for one quartier.
 */
router.get("/:id/statuses", async (req, res) => {
  const { data, error } = await req.supabase
    .from("quartier_statuses")
    .select("*")
    .eq("quartier_id", req.params.id);

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }
  if (!data.length) {
    return res.status(404).json({ error: "unknown quartier" });
  }
  res.json({ statuses: data });
});

export default router;
