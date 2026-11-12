import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge, { type Status } from "../../components/StatusBadge";
import BottomNav from "../../components/BottomNav";
import ShareButton from "../../components/ShareButton";
import {
  getQuartierDetail,
  getRecentReports,
  getWeeklyOutageHours,
} from "@/lib/data/quartiers";
import ConfirmButton from "./ConfirmButton";

// Wireframe screen 4 (complete.pdf §2-D): live status, "Me too", real recent
// reports and a real 7-day outage-hours chart from the incidents table.

export default async function QuartierPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const name = decodeURIComponent(id);
  const [{ summary: q, live }, { reports, activeReportId }, { days: week }] =
    await Promise.all([
      getQuartierDetail(name),
      getRecentReports(name),
      getWeeklyOutageHours(name),
    ]);
  if (!q) notFound();

  const t = await getTranslations();
  const isPower = q.type === "light";
  const status = q.status as Status;
  const totalConfirmations = reports.reduce((n, r) => n + r.confirmations, 0);

  // Outage duration for a live "out" status, from the last signal time.
  // Computed server-side once per request, not during render (React purity rule).
  const duration =
    status === "out" && q.latestAt ? formatDuration(q.latestAt) : "—";

  const MAX_HOURS = Math.max(...week.map((d) => d.hours), 1);

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
          <p className="mt-1 text-2xl font-bold text-status-out">{duration}</p>
          <div className="mt-3 flex items-center gap-3">
            <StatusBadge status={status} label={t(`status.${status}`)} />
            <span className="text-sm text-muted">
              {t("quartier.reports", { count: q.reports30m })} ·{" "}
              {t("quartier.confirmations", { count: totalConfirmations })}
            </span>
          </div>
        </div>

        {/* Me too — POSTs to /api/confirmations (complete.pdf §6-C) */}
        <ConfirmButton
          activeReportId={activeReportId}
          initialCount={
            reports.find((r) => r.id === activeReportId)?.confirmations ?? 0
          }
        />

        {/* Recent reports feed — real rows from the reports table */}
        <section aria-labelledby="recent-heading" className="mt-6">
          <h2
            id="recent-heading"
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
          >
            {t("quartier.recentReports")}
          </h2>
          <ul className="surface-card divide-y divide-border rounded-lg px-4">
            {reports.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <span
                  className={`font-medium ${r.status === "out" ? "text-status-out" : "text-status-ok"}`}
                >
                  {r.status === "out" ? t("status.out") : t("status.ok")}
                </span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  {r.confirmations > 0 && (
                    <span className="rounded-full bg-status-ok/10 px-2 py-0.5 text-xs font-semibold text-status-ok">
                      👍 {r.confirmations}
                    </span>
                  )}
                  {formatMinutes(r.minutesAgo)}
                </span>
              </li>
            ))}
            {reports.length === 0 && (
              <li className="py-4 text-center text-sm text-muted">
                {t("quartier.noReports")}
              </li>
            )}
          </ul>
        </section>

        {/* 7-day bar chart — real incident history when available */}
        <section aria-labelledby="week-heading" className="mt-6">
          <h2
            id="week-heading"
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
          >
            {t("quartier.last7days")}
          </h2>
          <div className="surface-card rounded-lg p-4">
            <div className="flex h-24 items-end justify-between gap-2">
              {week.map((d, i) => (
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
                  <span className="text-xs text-muted">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Share via WhatsApp (final.pdf §1 MVP: wa.me link, free) */}
        <ShareButton
          text={`${name}: ${isPower ? "No power" : "No water"}, ${q.reports30m} reports, ${duration}`}
        />

        <p className="mt-4 text-center text-sm text-muted">{t("disclaimer")}</p>
      </main>

      <BottomNav />
    </div>
  );
}

/** "3h05m" style duration from a timestamp, computed once per request. */
function formatDuration(sinceIso: string): string {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(sinceIso).getTime()) / 60000),
  );
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

/** Human "2 min" / "1 h 05" label from a minutes count. */
function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}
