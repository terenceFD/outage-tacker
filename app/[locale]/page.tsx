import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import ServiceCard from "./components/ServiceCard";
import QuartierRow from "./components/QuartierRow";
import LanguageSwitch from "./components/LanguageSwitch";
import BottomNav from "./components/BottomNav";
import {
  getQuartierStatuses,
  type QuartierSummary,
} from "@/lib/data/quartiers";

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
      const order: Record<string, number> = {
        out: 0,
        unconfirmed: 1,
        ok: 2,
        unknown: 3,
      };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    })
    .slice(0, 8);

  const powerOut = rows.filter(
    (r) =>
      r.type === "light" && (r.status === "out" || r.status === "unconfirmed"),
  ).length;
  const waterOut = rows.filter(
    (r) =>
      r.type === "water" && (r.status === "out" || r.status === "unconfirmed"),
  ).length;

  return (
    <>
      {/* Hero: the one bold element. Deep navy with a subtle radial glow
          and a grid texture, top bar with logo mark + language switch,
          then the tagline, a live city pulse summary and the search. */}
      <header className="relative overflow-hidden bg-primary text-white">
        {/* Decorative background layers (radial glow + dot grid) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_-10%,rgba(27,127,121,0.55),transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:22px_22px]"
        />

        <div className="relative mx-auto w-full max-w-lg px-4">
          {/* Top bar: logo mark, app name, language switch */}
          <div className="flex items-center justify-between pt-5 pb-8">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg ring-1 ring-white/20"
              >
                ⚡
              </span>
              <p className="font-heading text-base font-bold leading-tight tracking-tight">
                {t("home.heading")}
              </p>
            </div>
            <LanguageSwitch />
          </div>

          {/* Tagline + live status card */}
          <div className="pb-7">
            <h1 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white">
              {t("home.tagline")}
            </h1>

            {/* Live strip: pulsing LIVE badge + summary line, sitting on a
                frosted-glass card with the current outage count and the
                split between power and water */}
            <div
              aria-label={t("home.summaryNote")}
              className="mt-4 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 px-4 pt-3.5">
                {/* Live badge with a soft pulsing ring */}
                <span
                  aria-hidden
                  className="relative flex h-2.5 w-2.5 shrink-0"
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-ok opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-ok ring-2 ring-status-ok/30" />
                </span>
                <span className="rounded-md bg-status-ok/15 px-1.5 py-0.5 font-heading text-[11px] font-bold tracking-widest text-emerald-100 ring-1 ring-status-ok/40">
                  {t("home.live")}
                </span>
                <p className="min-w-0 truncate text-sm text-white/80">
                  {t("home.summaryNote")}
                </p>
              </div>

              <div className="flex items-center gap-2.5 px-4 pt-3 pb-3.5">
                {/* City-wide outage count */}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-out/20 px-3 py-1 text-xs font-bold tabular-nums text-white ring-1 ring-status-out/40">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-status-out"
                  />
                  {powerOut + waterOut > 0
                    ? t("home.outagesNow", {
                        count: powerOut + waterOut,
                      })
                    : t("home.allClear")}
                </span>
                {/* Per-service mini counters, only when non-zero */}
                {powerOut > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-power/20 px-2.5 py-1 text-xs font-semibold tabular-nums text-power ring-1 ring-power/40">
                    ⚡ {powerOut}
                  </span>
                )}
                {waterOut > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-water/20 px-2.5 py-1 text-xs font-semibold tabular-nums text-water ring-1 ring-water/40">
                    💧 {waterOut}
                  </span>
                )}
                <span
                  aria-hidden
                  className="ml-auto hidden shrink-0 text-xs text-white/50 sm:inline"
                >
                  {t("home.updatedNow")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-8">
        {/* Search overlaps the masthead — a floating pill with a submit
            button inside, visually connects the summary above with the
            live list below */}
        <form action="/map" className="group relative z-10 -mt-8 mb-5">
          <label htmlFor="home-search" className="sr-only">
            {t("home.searchPlaceholder")}
          </label>
          {/* Magnifier icon baked into the field */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-muted transition-colors group-focus-within:text-accent"
          >
            🔍
          </span>
          <input
            id="home-search"
            type="search"
            name="q"
            placeholder={t("home.searchPlaceholder")}
            className="w-full rounded-2xl border-0 bg-surface py-4 pr-14 pl-12 text-base font-medium shadow-[0_4px_16px_-2px_rgba(20,54,93,0.14),0_1px_3px_rgba(20,54,93,0.08)] ring-1 ring-border outline-none placeholder:font-normal placeholder:text-muted focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            aria-label={t("home.searchPlaceholder")}
            className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-accent text-base text-white shadow-sm transition-all hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M5 10h10" />
              <path d="m11 6 4 4-4 4" />
            </svg>
          </button>
        </form>

        {/* Service tiles: live power / water counts */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <ServiceCard kind="power" count={powerOut} />
          <ServiceCard kind="water" count={waterOut} />
        </div>

        {/* Main action */}
        <Link
          href="/report"
          className="mb-7 flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-6 py-3 text-center text-base font-semibold text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {t("home.reportButton")}
        </Link>

        {/* Affected now — elevated card with a tinted header bar and
            chip-styled rows, most urgent first */}
        <section aria-labelledby="affected-heading" className="mb-4">
          <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgba(20,54,93,0.06),0_8px_24px_-8px_rgba(20,54,93,0.12)] ring-1 ring-border">
            {/* Header bar: title + live count chip + view map action */}
            <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-primary/[0.04] to-transparent px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <h2
                  id="affected-heading"
                  className="font-heading text-base font-bold text-text"
                >
                  {t("home.affected")}
                </h2>
                {affected.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-status-out/10 px-2 py-0.5 text-xs font-bold tabular-nums text-status-out ring-1 ring-status-out/25">
                    {affected.length}
                  </span>
                )}
              </div>
              <Link
                href="/map"
                className="group inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t("home.viewMap")}
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </div>

            {affected.length > 0 ? (
              <ul className="divide-y divide-border/70">
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
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {t("home.allClear")}
              </p>
            )}
          </div>
        </section>

        {/* Citizen-sourced disclaimer required by the PDF on every status view,
            linked to /about per its /about-page spec */}
        <Link
          href="/about"
          className="block pb-2 text-center text-sm text-muted hover:underline"
        >
          {t("disclaimer")}
        </Link>

        {/* Floating AI chat assistant — opens the dedicated assistant page */}
        <Link
          href="/assistant"
          aria-label={t("home.chatAssistant")}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
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
      <Suspense fallback={<div className="min-h-dvh bg-primary" />}>
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
    Math.floor((Date.now() - new Date(sinceIso).getTime()) / 60000),
  );
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}
