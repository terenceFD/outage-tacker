import { Router } from "express";
import { mapDbError } from "../db.js";

const router = Router();

/**
 * GET /api/stats — reliability stats (PDF §7) from the quartier_statuses
 * view (outage counts over the last 30 days, service-side aggregation).
 */
router.get("/", async (req, res) => {
  const { data, error } = await req.supabase
    .from("quartier_statuses")
    .select("quartier_id, name, city, type, status, outage_minutes_30d");

  if (error) {
    const mapped = mapDbError(error);
    return res
      .status(mapped.status)
      .json({ error: "db_error", message: mapped.msg });
  }

  // Aggregate per quartier.
  const byQuartier = new Map();
  for (const row of data) {
    if (!byQuartier.has(row.quartier_id)) {
      byQuartier.set(row.quartier_id, {
        quartierId: row.quartier_id,
        name: row.name,
        city: row.city,
        light: { status: null, outageMinutes30d: 0 },
        water: { status: null, outageMinutes30d: 0 },
      });
    }
    const entry = byQuartier.get(row.quartier_id);
    entry[row.type].status = row.status;
    entry[row.type].outageMinutes30d = Number(row.outage_minutes_30d) || 0;
  }

  const quartiers = [...byQuartier.values()];

  // City-level rollup.
  const byCity = new Map();
  for (const q of quartiers) {
    if (!byCity.has(q.city)) {
      byCity.set(q.city, { city: q.city, quartiers: 0, outageMinutes30d: 0 });
    }
    const c = byCity.get(q.city);
    c.quartiers += 1;
    c.outageMinutes30d += q.light.outageMinutes30d + q.water.outageMinutes30d;
  }

  res.json({
    quartiers,
    cities: [...byCity.values()],
    updatedAt: new Date().toISOString(),
  });
});

export default router;
