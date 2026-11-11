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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Link
          href="/"
          className="p-2 -m-2 text-primary text-lg"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="text-lg font-bold text-primary">{t("heading")}</h1>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">
        <ReportForm quartiers={quartiers} />
      </main>

      <BottomNav />
    </div>
  );
}
