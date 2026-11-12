import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Service tile — summary for power or water. A tinted gradient panel per
// service, big tabular numeral top-right, icon chip top-left and an
// "open map" affordance at the bottom so each tile is its own color story.
const KIND = {
  power: {
    label: "services.power",
    panel:
      "bg-gradient-to-br from-power/15 via-power/5 to-transparent ring-power/25 hover:ring-power/50",
    chip: "bg-power text-white shadow-sm shadow-power/30",
    text: "text-power",
  },
  water: {
    label: "services.water",
    panel:
      "bg-gradient-to-br from-water/15 via-water/5 to-transparent ring-water/25 hover:ring-water/50",
    chip: "bg-water text-white shadow-sm shadow-water/30",
    text: "text-water",
  },
} as const;

export default async function ServiceCard({
  kind,
  count,
  href = "/map",
}: {
  kind: "power" | "water";
  count: number;
  href?: string;
}) {
  const t = await getTranslations();
  const detail =
    kind === "power"
      ? t("services.quartiersOut", { count })
      : t("services.quartiersDry", { count });
  const k = KIND[kind];

  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-2xl p-4 ring-1 shadow-[0_1px_2px_rgba(20,54,93,0.05),0_6px_16px_-6px_rgba(20,54,93,0.10)] outline-none transition-all hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(20,54,93,0.06),0_10px_24px_-8px_rgba(20,54,93,0.16)] focus-visible:ring-2 focus-visible:ring-accent ${k.panel}`}
    >
      <div className="flex items-start justify-between">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-base leading-none ${k.chip}`}
          aria-hidden
        >
          {kind === "power" ? "⚡" : "💧"}
        </span>
        <p className="font-heading text-3xl leading-none font-extrabold tabular-nums text-text">
          {count}
        </p>
      </div>
      <p className="mt-3 font-heading text-sm font-bold text-text">
        {t(k.label)}
      </p>
      <p className="mt-0.5 text-xs text-muted">{detail}</p>
      <span
        className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${k.text}`}
      >
        {t("home.viewMap")}
        <span
          aria-hidden
          className="transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </span>
    </Link>
  );
}
