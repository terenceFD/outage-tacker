import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";

// Admin console — Overview (design.pdf page 4).
// KPI cards, reports-per-hour chart, most-affected quartiers, review
// queue preview and system health. Sample data until live queries are
// wired to /api/admin/* (guarded by profiles.role = 'admin').
const KPIS = [
  { key: "reportsToday", value: "184", delta: "+12%" },
  { key: "activeOutages", value: "19", detail: "12 power, 7 water" },
  { key: "awaitingReview", value: "7", detail: "2 older than 1 hour" },
  { key: "alertsSent", value: "1,240", detail: "WhatsApp and SMS" },
] as const;

// Reports per hour, 00–23 bucketed into 3-hour columns like the wireframe
const HOURS = [
  { label: "00", v: 2 },
  { label: "03", v: 1 },
  { label: "06", v: 4 },
  { label: "09", v: 9 },
  { label: "12", v: 14 },
  { label: "15", v: 11 },
  { label: "18", v: 7 },
  { label: "21", v: 3 },
];
const MAX_V = 14;

const TOP_QUARTIERS = [
  { name: "Bonamoussadi", hours: 42 },
  { name: "Akwa", hours: 35 },
  { name: "Bepanda", hours: 28 },
  { name: "Molyko", hours: 22 },
  { name: "Bastos", hours: 15 },
];

const QUEUE_PREVIEW = [
  {
    text: "No light Akwa (x5 in 2 min)",
    quartier: "Akwa",
    source: "WhatsApp",
    conf: "0.91",
    flag: "duplicate",
    age: "4 min",
  },
  {
    text: "Pas de courant a Molyko depuis ce matin",
    quartier: "Molyko",
    source: "WhatsApp",
    conf: "0.64",
    flag: "medium",
    age: "12 min",
  },
  {
    text: "Out, Bepanda (power)",
    quartier: "Bepanda",
    source: "App",
    conf: "n/a",
    flag: "ratelimit",
    age: "25 min",
  },
];

const FLAG_TONES: Record<string, string> = {
  duplicate: "bg-status-unconfirmed/15 text-status-unconfirmed",
  medium: "bg-accent/10 text-accent",
  ratelimit: "bg-status-out/10 text-status-out",
};

const SOURCE_TONES: Record<string, string> = {
  WhatsApp: "bg-status-ok/10 text-status-ok",
  App: "bg-accent/10 text-accent",
};

const HEALTH = [
  { name: "Supabase Realtime", ok: true },
  { name: "AI parsing route", ok: true },
  { name: "WhatsApp Cloud API", ok: true },
  { name: "SMS aggregator", ok: false },
];

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-6">
      {/* Header row: title + context controls (design p4) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">
            {t("overview")}
          </h1>
          <p className="text-sm text-muted">{t("overviewSubtitle")}</p>
        </div>
        <div className="flex gap-2">
          <span className="surface-card rounded-lg border border-border px-4 py-2 text-sm">
            Douala
          </span>
          <span className="surface-card rounded-lg border border-border px-4 py-2 text-sm">
            {t("last24h")}
          </span>
          <button
            type="button"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            {t("exportCsv")}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <section
        aria-label={t("metricsHeading")}
        className="grid grid-cols-2 gap-4 xl:grid-cols-4"
      >
        {KPIS.map((k) => (
          <div
            key={k.key}
            className="surface-card rounded-lg border border-border p-4"
          >
            <p className="text-sm text-muted">{t(k.key)}</p>
            <p className="font-heading text-3xl font-bold text-text">
              {k.value}
            </p>
            {"delta" in k && k.delta && (
              <p className="text-sm font-medium text-status-ok">{k.delta}</p>
            )}
            {"detail" in k && k.detail && (
              <p className="text-sm text-muted">{k.detail}</p>
            )}
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Reports per hour — simple bar chart, low-data (no JS chart lib) */}
        <section className="surface-card rounded-lg border border-border p-4">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {t("reportsPerHour")}
          </h2>
          <div className="flex h-40 items-end justify-between gap-2">
            {HOURS.map((h) => (
              <div
                key={h.label}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-t bg-accent"
                  style={{
                    height: `${(h.v / MAX_V) * 128}px`,
                    minHeight: h.v ? "6px" : "2px",
                  }}
                  role="img"
                  aria-label={`${h.label}: ${h.v}`}
                />
                <span className="text-xs text-muted">{h.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Most outage hours this month */}
        <section className="surface-card rounded-lg border border-border p-4">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            {t("mostOutageHours")}
          </h2>
          <ul className="flex flex-col gap-3">
            {TOP_QUARTIERS.map((q) => (
              <li key={q.name} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm font-medium">
                  {q.name}
                </span>
                <div className="h-2.5 flex-1 rounded-full bg-surface ring-1 ring-border">
                  <div
                    className="h-2.5 rounded-full bg-status-out"
                    style={{ width: `${(q.hours / 42) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm tabular-nums">
                  {q.hours}h
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Review queue preview */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            {t("reviewQueue")}
          </h2>
          <Link
            href="/admin/dashboard/queue"
            className="text-sm font-semibold text-accent hover:underline"
          >
            {t("viewAll")}
          </Link>
        </div>
        <div className="surface-card divide-y divide-border rounded-lg border border-border">
          {QUEUE_PREVIEW.map((r) => (
            <div
              key={r.text}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm"
            >
              <p className="w-full font-medium leading-snug sm:w-auto sm:min-w-0 sm:flex-1 sm:truncate">
                {r.text}
              </p>
              <span className="text-xs text-muted">📍 {r.quartier}</span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  SOURCE_TONES[r.source] ?? ""
                }`}
              >
                {r.source}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  FLAG_TONES[r.flag] ?? "bg-status-unknown/15 text-muted"
                }`}
              >
                {t(`flag_${r.flag}`)}
              </span>
              <span className="ml-auto text-xs tabular-nums text-muted">
                {r.age}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* System health */}
      <section className="surface-card rounded-lg border border-border p-4">
        <h2 className="mb-4 font-heading text-lg font-semibold">
          {t("systemHealth")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {HEALTH.map((h) => (
            <li key={h.name} className="flex items-center gap-2 text-sm">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  h.ok ? "bg-status-ok" : "bg-status-unconfirmed"
                }`}
                aria-hidden
              />
              <span>{h.name}</span>
              <span
                className={`ml-auto font-medium ${
                  h.ok ? "text-status-ok" : "text-status-unconfirmed"
                }`}
              >
                {h.ok ? t("operational") : t("degraded")}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-border pt-3 text-sm">
          <span className="text-muted">{t("aiSpendToday")}</span>{" "}
          <span className="font-semibold tabular-nums">$1.40 / $5.00</span>
        </p>
      </section>
    </div>
  );
}
