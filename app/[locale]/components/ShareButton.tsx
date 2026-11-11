"use client";

import { useTranslations } from "next-intl";

// PDF: "share status card (image + short text) optimized for WhatsApp"
// — for now, native share / clipboard fallback.
export default function ShareButton() {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={async () => {
        const text =
          "Outage Tracker — most outage hours this month: Bonamoussadi 42h, Akwa 35h, Bepanda 28h";
        if (navigator.share) {
          await navigator
            .share({ title: "Outage Tracker", text })
            .catch(() => {});
        } else {
          await navigator.clipboard.writeText(text).catch(() => {});
        }
      }}
      className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg border-2 border-accent px-6 py-3 text-base font-semibold text-accent"
    >
      ↗ {t("stats.share")}
    </button>
  );
}
