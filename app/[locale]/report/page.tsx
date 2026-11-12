import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import ReportForm from "./ReportForm";
import BottomNav from "../components/BottomNav";
import { getQuartierList } from "@/lib/data/quartiers";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("report");
  const { items: quartiers } = await getQuartierList();
  // Parse-only AI (final.pdf §6): the model gets the official quartier list
  // for matching — no live status snapshot needed in phase 1.

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="page-bg sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <Link
          href="/"
          className="p-2 -m-2 text-primary text-lg"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold text-primary">{t("heading")}</h1>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">
        <p className="mb-4 text-sm text-muted">{t("intro")}</p>
        <div className="surface-card rounded-2xl border border-border p-4 shadow-sm sm:p-6">
          <ReportForm quartiers={quartiers} />
        </div>
        {/* AI assistant lives on its own page (final.pdf §6) — linked,
            never embedded: the 3-tap form stays the main flow */}
        <Link
          href="/assistant"
          className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-accent px-6 py-3 text-base font-semibold text-accent"
        >
          🤖 {t("assistantLink")}
        </Link>
      </main>

      <BottomNav />
    </div>
  );
}
