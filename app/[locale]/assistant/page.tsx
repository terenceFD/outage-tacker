import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import BottomNav from "../components/BottomNav";
import AssistantChat from "./AssistantChat";
import { getQuartierList, getQuartierStatuses } from "@/lib/data/quartiers";

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("report");
  const { items: quartiers } = await getQuartierList();
  const { rows: statuses } = await getQuartierStatuses();


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
        <h1 className="text-xl font-bold text-primary">
          {t("assistantHeading")}
        </h1>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">
        <p className="mb-4 text-sm text-muted">{t("assistantIntro")}</p>
        <AssistantChat
          quartiers={quartiers}
          statuses={statuses.map((s) => ({
            name: s.name,
            city: s.city,
            type: s.type,
            status: s.status,
            reports30m: s.reports30m,
            confirmedCount: s.confirmedCount,
          }))}
        />
      </main>

      <BottomNav />
    </div>
  );
}
