import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import ServiceCard from "./components/ServiceCard";
import QuartierRow from "./components/QuartierRow";
import LanguageSwitch from "./components/LanguageSwitch";
import BottomNav from "./components/BottomNav";
import { getQuartierStatuses, type QuartierSummary } from "@/lib/data/quartiers";

// Home page: live quartier statuses when Supabase is configured,
// demo data otherwise (PDF wireframe screen 1).

// Page content reads the locale, so it streams inside Suspense to keep
// navigation instant.
async function HomeContent({ locale }: { locale: string }) {
  const t = await getTranslations();
  const { rows } = await getQuartierStatuses();

  // Only show non-unknown statuses in "Affected now", most urgent first
  const affected = rows
    .filter((r) => r.status !== "unknown")
    .sort((a, b) => {
      const order: Record<string, number> = { out: 0, unconfirmed: 1, ok: 2, unknown: 3 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    })
    .slice(0, 8);

  const powerOut = rows.filter(
    (r) => r.type === "light" && (r.status === "out" || r.status === "unconfirmed")
  ).length;
  const waterOut = rows.filter(
    (r) => r.type === "water" && (r.status === "out" || r.status === "unconfirmed")
  ).length;

  return (
    <>
      {/* Header: title + EN | FR switch */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-primary">{t("home.heading")}</h1>
        <LanguageSwitch />
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">
        {/* Search */}
        <form action="/map" className="mb-4">
          <input
            type="search"
            name="q"
            placeholder={t("home.searchPlaceholder")}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
          />
        </form>

        {/* Service cards: POWER / WATER — live counts */}
        <div className="mb-6 flex gap-3">
          <ServiceCard kind="power" count={powerOut} />
          <ServiceCard kind="water" count={waterOut} />
        </div>

        {/* Main action */}
        <Link
          href="/report"
          className="mb-6 flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-6 py-3 text-center text-base font-semibold text-white"
        >
          {t("home.reportButton")}
        </Link>

        {/* Affected now */}
        <section aria-labelledby="affected-heading">
          <h2
            id="affected-heading"
            className="mb-1 px-4 text-sm font-semibold uppercase tracking-wide text-muted"
          >
            {t("home.affected")}
          </h2>
          <ul>
            {affected.map((q: QuartierSummary) => (
              <li key={`${q.name}-${q.type}`}>
                <QuartierRow
                  name={q.name}
                  type={q.type === "light" ? "power" : "water"}
                  status={q.status}
                  statusLabel={t(`status.${q.status}`)}
                  duration={
                    q.status === "out" && q.latestAt
                      ? `Out ${formatDuration(q.latestAt)}`
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Citizen-sourced disclaimer required by the PDF on every status view,
            linked to /about per its /about-page spec */}
        <Link
          href="/about"
          className="mt-4 block text-center text-sm text-muted hover:underline"
        >
          {t("disclaimer")}
        </Link>

        {/* Floating AI chat assistant — opens the report page AI describe tab */}
        <Link
          href="/report"
          aria-label={t("home.chatAssistant")}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          💬
        </Link>
      </main>
    </>
  );
}

export default function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<div className="h-dvh" />}>
        <HomeInner params={params} />
      </Suspense>
      <BottomNav />
    </div>
  );
}

async function HomeInner({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <HomeContent locale={locale} />;
}

/** "Out 3h20" style duration from a timestamp, per the wireframe. */
function formatDuration(sinceIso: string): string {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(sinceIso).getTime()) / 60000)
  );
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}
