import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { QuartierStatusRow } from "@/lib/supabase/types";

// Aggregated quartier state shown in lists/map/cards.
export interface QuartierSummary {
  quartierId: string;
  name: string;
  city: string;
  lat: number | null;
  lng: number | null;
  type: "light" | "water";
  status: "out" | "unconfirmed" | "ok" | "unknown";
  reports30m: number;
  confirmedCount: number;
  latestAt: string | null;
}

// Demo data mirroring the PDF wireframes — used while Supabase is not
// configured (no .env.local), so the app always works.
export const DEMO_STATUSES: QuartierSummary[] = [
  {
    quartierId: "demo-1",
    name: "Bonamoussadi",
    city: "Douala",
    lat: 4.0943,
    lng: 9.7419,
    type: "light",
    status: "out",
    reports30m: 14,
    confirmedCount: 9,
    latestAt: null,
  },
  {
    quartierId: "demo-2",
    name: "Akwa",
    city: "Douala",
    lat: 4.0483,
    lng: 9.7047,
    type: "water",
    status: "out",
    reports30m: 6,
    confirmedCount: 3,
    latestAt: null,
  },
  {
    quartierId: "demo-3",
    name: "Molyko",
    city: "Buea",
    lat: 4.1554,
    lng: 9.2411,
    type: "light",
    status: "unconfirmed",
    reports30m: 2,
    confirmedCount: 0,
    latestAt: null,
  },
  {
    quartierId: "demo-4",
    name: "Bepanda",
    city: "Douala",
    lat: 4.0728,
    lng: 9.7322,
    type: "light",
    status: "unknown",
    reports30m: 0,
    confirmedCount: 0,
    latestAt: null,
  },
  {
    quartierId: "demo-5",
    name: "Great Soppo",
    city: "Buea",
    lat: 4.1417,
    lng: 9.2569,
    type: "water",
    status: "ok",
    reports30m: 1,
    confirmedCount: 1,
    latestAt: null,
  },
];

export const DEMO_QUARTIER_LIST = [
  "Bonamoussadi",
  "Akwa",
  "Bepanda",
  "Deido",
  "Bonabéri",
  "Logbaba",
  "Makepe",
  "Bonapriso",
  "Molyko",
  "Mile 16",
  "Bomaka",
  "Great Soppo",
  "Muea",
  "Bastos",
  "Odza",
  "Biyem-Assi",
];

export function isSupabaseConfigured(): boolean {
  // Treat .env.example placeholders as "not configured" — otherwise the app
  // would attempt to fetch a fake URL (YOUR_PROJECT_ID) and crash with
  // "TypeError: fetch failed" instead of falling back to demo data.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    url.startsWith("https://") &&
    key.length > 20 &&
    !/YOUR_PROJECT_ID|your-anon/.test(url + key)
  );
}

/** Live statuses per quartier × type, falling back to demo data. */
export async function getQuartierStatuses(): Promise<{
  rows: QuartierSummary[];
  live: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { rows: DEMO_STATUSES, live: false };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quartier_statuses")
      .select("*")
      .order("name");

    if (error || !data) {
      console.error("quartier_statuses query failed:", error?.message);
      return { rows: DEMO_STATUSES, live: false };
    }

    return { rows: (data as QuartierStatusRow[]).map(mapRow), live: true };
  } catch (e) {
    console.error("supabase unavailable:", e);
    return { rows: DEMO_STATUSES, live: false };
  }
}

/** Latest report per (quartier × type) wins — the freshest signal. */
function mapRow(r: QuartierStatusRow): QuartierSummary {
  return {
    quartierId: r.quartier_id,
    name: r.name,
    city: r.city,
    lat: r.lat,
    lng: r.lng,
    type: r.type,
    status: r.status,
    reports30m: r.reports_30m ?? 0,
    confirmedCount: r.confirmed_count ?? 0,
    latestAt: r.latest_at,
  };
}

/** All quartiers (for dropdowns / add-alert lists). */
export async function getQuartierList(): Promise<{
  items: { id: string; name: string; city: string }[];
  live: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return {
      items: DEMO_QUARTIER_LIST.map((name, i) => ({
        id: `demo-${i}`,
        name,
        city: name.includes("Buea") ? "Buea" : "Douala",
      })),
      live: false,
    };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quartiers")
      .select("id, name, city")
      .order("name");

    if (error || !data) return { items: [], live: false };
    return { items: data, live: true };
  } catch {
    return { items: [], live: false };
  }
}

/** Outage hours per quartier over the last 30 days, for /stats. */
export async function getMonthlyOutageRanking(): Promise<{
  ranking: { name: string; hours: number }[];
  totalReports: number;
  quartiersAffected: number;
  live: boolean;
}> {
  // Demo ranking mirrors the wireframe (complete.pdf screen 6)
  const demo = {
    ranking: [
      { name: "Bonamoussadi", hours: 42 },
      { name: "Akwa", hours: 35 },
      { name: "Bepanda", hours: 28 },
      { name: "Molyko", hours: 22 },
      { name: "Bastos", hours: 15 },
    ],
    totalReports: 184,
    quartiersAffected: 42,
    live: false as const,
  };

  if (!isSupabaseConfigured()) return demo;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quartier_statuses")
      .select("name, outage_minutes_30d, reports_30m")
      .neq("outage_minutes_30d", 0)
      .order("outage_minutes_30d", { ascending: false })
      .limit(5);

    if (error || !data || data.length === 0) return demo;

    const ranking = (data as { name: string; outage_minutes_30d: number }[])
      .map((r) => ({
        name: r.name,
        hours: Math.round(r.outage_minutes_30d / 60),
      }))
      .filter((r) => r.hours > 0);

    if (ranking.length === 0) return demo;

    // Total reports in last 30 days
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);

    const { count: affected } = await supabase
      .from("quartier_statuses")
      .select("quartier_id", { count: "exact", head: true })
      .neq("status", "unknown");

    return {
      ranking,
      totalReports: count ?? 0,
      quartiersAffected: affected ?? 0,
      live: true,
    };
  } catch {
    return demo;
  }
}

/** One quartier × one service, for the detail page. */
export async function getQuartierDetail(
  name: string,
): Promise<{ summary: QuartierSummary | null; live: boolean }> {
  const { rows, live } = await getQuartierStatuses();
  const summary =
    rows.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? null;
  return { summary, live };
}
