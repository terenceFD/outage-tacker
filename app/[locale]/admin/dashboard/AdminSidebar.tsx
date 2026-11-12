"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar per design.pdf page 4: brand + section links, with a badge on
// "Review queue". Collapses to a horizontal chip bar on small screens.
export default function AdminSidebar() {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const [queueCount] = useState(7); // wired to the review queue API later

  const items: { href: string; label: string; badge?: number }[] = [
    { href: "/admin/dashboard", label: t("navOverview") },
    { href: "/admin/dashboard/queue", label: t("navQueue"), badge: queueCount },
    { href: "/admin/dashboard/quartiers", label: t("tabsQuartiers") },
    { href: "/admin/dashboard/users", label: t("tabsUsers") },
    { href: "/admin/dashboard/alerts", label: t("navAlerts") },
    { href: "/admin/dashboard/stats", label: t("navStats") },
    { href: "/admin/dashboard/settings", label: t("navSettings") },
  ];

  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="flex shrink-0 flex-col gap-1 bg-primary p-4 text-white lg:w-64 lg:p-6">
      <div className="mb-4 lg:mb-8">
        <p className="font-heading text-sm text-white/60">Outage Tracker</p>
        <p className="font-heading text-xl font-bold">{t("console")}</p>
      </div>

      <nav
        aria-label={t("console")}
        className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              active(item.href)
                ? "bg-white/15 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.label}
            {item.badge != null && item.badge > 0 && (
              <span className="ml-auto inline-flex min-w-6 justify-center rounded-full bg-power px-1.5 py-0.5 text-xs font-bold text-primary">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-auto hidden flex-col gap-2 pt-6 text-sm text-white/60 lg:flex">
        <p>{t("signedInAs")}</p>
        <p className="font-medium text-white">{t("cityAdmin")}</p>
        <Link
          href="/"
          className="mt-2 rounded-lg px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
        >
          ← {t("backToSite")}
        </Link>
      </div>
    </aside>
  );
}
