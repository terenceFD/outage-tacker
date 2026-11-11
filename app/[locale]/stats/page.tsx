import { getTranslations, setRequestLocale } from "next-intl/server";
import BottomNav from "../components/BottomNav";
import ShareButton from "../components/ShareButton";
import { getMonthlyOutageRanking } from "@/lib/data/quartiers";

export default async function StatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { ranking: RANKING, totalReports, quartiersAffected } =
    await getMonthlyOutageRanking();
  const MAX = Math.max(...RANKING.map((r) => r.hours), 1);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-primary">{t("stats.heading")}</h1>
        <span className="text-sm font-medium text-muted">
          {t("stats.month")}
        </span>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">
        {/* Big counters: reports / quartiers affected */}
        <div className="mb-6 flex gap-3">
          <div className="surface-card flex-1 rounded-lg p-4 text-center">
            <p className="text-power">⚡</p>
            <p className="text-2xl font-bold text-power">{totalReports}</p>
            <p className="text-sm text-muted">
              {t("stats.reports", { count: totalReports })}
            </p>
          </div>
          <div className="surface-card flex-1 rounded-lg p-4 text-center">
            <p className="text-water">💧</p>
            <p className="text-2xl font-bold text-water">{quartiersAffected}</p>
            <p className="text-sm text-muted">
              {t("stats.quartiers", { count: quartiersAffected })}
            </p>
          </div>
        </div>

        {/* Ranking: most outage hours — horizontal bars (Inter tabular numbers) */}
        <section aria-labelledby="rank-heading">
          <h2
            id="rank-heading"
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
          >
            {t("stats.topHours")}
          </h2>
          <ol className="surface-card rounded-lg p-4">
            {RANKING.map((r, i) => (
              <li key={r.name} className="mb-3 last:mb-0">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-medium">
                    <span className="mr-2 text-sm text-muted">{i + 1}.</span>
                    {r.name}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-status-out">
                    {t("stats.hours", { hours: r.hours })}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-power"
                    style={{ width: `${(r.hours / MAX) * 100}%` }}
                    role="img"
                    aria-label={`${r.name}: ${r.hours} hours`}
                  />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <ShareButton />

        <p className="mt-4 text-center text-sm text-muted">{t("disclaimer")}</p>
      </main>

      <BottomNav />
    </div>
  );
}
