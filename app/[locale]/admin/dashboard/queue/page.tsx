import { getTranslations, setRequestLocale } from "next-intl/server";
import QueueClient from "./QueueClient";

// Admin console — Review queue (design.pdf page 5).
export default async function AdminQueuePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">
          {t("reviewQueue")}
        </h1>
        <p className="text-sm text-muted">{t("queueSubtitle")}</p>
      </div>
      <QueueClient />
    </div>
  );
}
