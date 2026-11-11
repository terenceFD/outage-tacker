"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// PDF: "Bottom navigation — Home, Map, Report (highlighted), Alerts, Stats.
// Colors: accent, status-unknown. Main action in the bottom navigation,
// thumb-friendly, at least 44px targets."
export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const strip = (p: string) => p.replace(/^\/(en|fr)/, "") || "/";

  const items = [
    { href: "/", label: t("home"), icon: "⌂" },
    { href: "/map", label: t("map"), icon: "◉" },
    { href: "/report", label: t("report"), icon: "＋", highlight: true },
    { href: "/alerts", label: t("alerts"), icon: "🔔" },
    { href: "/stats", label: t("stats"), icon: "▤" },
  ];

  return (
    <nav className="sticky bottom-0 border-t border-border bg-surface">
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const active = strip(pathname) === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={`/${item.href === "/" ? "" : item.href}`}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-sm min-w-[44px] ${
                  item.highlight
                    ? "text-white"
                    : active
                      ? "text-accent font-semibold"
                      : "text-status-unknown"
                }`}
                {...(item.highlight ? { "aria-label": t("report") } : {})}
              >
                {item.highlight ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-lg leading-none">
                    ＋
                  </span>
                ) : (
                  <span aria-hidden className="text-base leading-none">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
