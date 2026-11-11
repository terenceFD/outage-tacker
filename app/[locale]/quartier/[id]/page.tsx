import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge, { type Status } from "../../components/StatusBadge";
import BottomNav from "../../components/BottomNav";
import { getQuartierDetail } from "@/lib/data/quartiers";

// Wireframe screen 4: bars for the last 7 days (hours without power) — demo
// values until incident history accumulates in the DB.
const WEEK = [
  { day: "M", hours: 5 },
  { day: "T", hours: 3 },
  { day: "W", hours: 6 },
  { day: "T2", hours: 2 },
  { day: "F", hours: 4 },
  { day: "S", hours: 1 },
  { day: "S2", hours: 0 },
];
const MAX_HOURS = 6;

export default async function QuartierPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const name = decodeURIComponent(id);
  const { summary: q, live } = await getQuartierDetail(name);
  if (!q) notFound();

  const t = await getTranslations();
  const isPower = q.type === "light";
  const status = q.status as Status;

  // Outage duration for a live "out" status, from the last signal time
  const duration =
    status === "out" && q.latestAt
      ? (() => {
          const mins = Math.max(
            0,
            Math.floor((Date.now() - new Date(q.latestAt).getTime()) / 60000),
          );
          return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
        })()
      : "—";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Link
          href="/"
          className="p-2 -m-2 text-lg text-primary"
          aria-label={t("quartier.back")}
        >
          ←
        </Link>
        <h1 className="text-lg font-bold text-primary">{name}</h1>
        <span className="ml-auto text-sm text-muted">{q.city}</span>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">
        {/* Status headline — big badge + label, never color alone */}
        <div className="surface-card mt-2 rounded-lg p-4">
          <p
            className={`text-xl font-extrabold tracking-wide ${isPower ? "text-power" : "text-water"}`}
          >
            {isPower ? t("quartier.noPower") : t("quartier.noWater")}
          </p>
          <p className="mt-1 text-2xl font-bold text-status-out">
            {duration}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <StatusBadge status={status} label={t(`status.${status}`)} />
            <span className="text-sm text-muted">
              {t("quartier.reports", { count: q.reports30m })} ·{" "}
              {t("quartier.confirmations", { count: q.confirmedCount })}
            </span>
          </div>
          {!live && (
            <p className="mt-2 text-xs text-muted">
              demo data — connect Supabase for live status
            </p>
          )}
        </div>

        {/* Me too */}
        <button
          type="button"
          className="mt-4 min-h-11 w-full rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white"
        >
          👍 {t("quartier.confirm")}
        </button>

        {/* Recent reports feed */}
        <section aria-labelledby="recent-heading" className="mt-6">
          <h2
            id="recent-heading"
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
          >
            {t("quartier.recentReports")}
          </h2>
          <ul className="surface-card divide-y divide-border rounded-lg px-4">
            <li className="flex items-center justify-between py-3">
              <span className="font-medium text-status-out">
                {t("status.out")}
              </span>
              <span className="text-sm text-muted">2 min</span>
            </li>
            <li className="flex items-center justify-between py-3">
              <span className="font-medium text-status-out">
                {t("status.out")}
              </span>
              <span className="text-sm text-muted">18 min</span>
            </li>
          </ul>
        </section>

        {/* 7-day bar chart */}
        <section aria-labelledby="week-heading" className="mt-6">
          <h2
            id="week-heading"
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
          >
            {t("quartier.last7days")}
          </h2>
          <div className="surface-card rounded-lg p-4">
            <div className="flex h-24 items-end justify-between gap-2">
              {WEEK.map((d, i) => (
                <div
                  key={i}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div
                    className="w-full rounded-t bg-power"
                    style={{
                      height: `${(d.hours / MAX_HOURS) * 72}px`,
                      minHeight: d.hours ? "6px" : "2px",
                      opacity: d.hours ? 1 : 0.2,
                    }}
                    role="img"
                    aria-label={`${d.day}: ${d.hours}h`}
                  />
                  <span className="text-xs text-muted">
                    {d.day.replace(/[0-9]/g, "")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <p className="mt-4 text-center text-sm text-muted">{t("disclaimer")}</p>
      </main>

      <BottomNav />
    </div>
  );
}
