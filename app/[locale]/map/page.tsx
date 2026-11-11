import { getTranslations, setRequestLocale } from "next-intl/server";
import MapWrapper from "./MapWrapper";
import BottomNav from "../components/BottomNav";
import { getQuartierStatuses } from "@/lib/data/quartiers";

export default async function MapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("map");
  const { rows } = await getQuartierStatuses();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-primary">{t("heading")}</h1>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">
        <MapWrapper quartiers={rows} />
      </main>
      <BottomNav />
    </div>
  );
}
