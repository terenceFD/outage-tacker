"use client";

import { useTranslations } from "next-intl";

// final.pdf §1 MVP scope: "Share status via WhatsApp link (wa.me, free)."
// Opens WhatsApp with a pre-filled message — no paid API involved.
export default function ShareButton({
  text,
}: {
  /** Share text, e.g. "Bonamoussadi: No power, 14 reports, 3h20m" */
  text?: string;
}) {
  const t = useTranslations();
  const message =
    text ??
    "Outage Tracker — most outage hours this month: Bonamoussadi 42h, Akwa 35h, Bepanda 28h";
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg border-2 border-accent px-6 py-3 text-base font-semibold text-accent"
    >
      🟢 {t("stats.share")}
    </a>
  );
}
