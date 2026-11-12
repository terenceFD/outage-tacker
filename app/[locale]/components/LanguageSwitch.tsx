"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLocale } from "next-intl";

// Segmented pill language switch (EN | FR) shown in the header.
// Designed to sit on the dark hero: frosted track, solid active segment
// with primary-colored text so the selected language reads instantly.
//
// Note: no useSearchParams here — reading URL data outside Suspense
// breaks instant navigation under cacheComponents.

const LOCALES = ["en", "fr"] as const;

export default function LanguageSwitch() {
  const pathname = usePathname();
  const locale = useLocale();
  const stripLocale = pathname.replace(/^\/(en|fr)/, "") || "/";
  const to = (l: string) => `/${l}${stripLocale === "/" ? "" : stripLocale}`;

  return (
    <nav
      aria-label="Language"
      className="flex shrink-0 items-center rounded-full bg-white/10 p-0.5 ring-1 ring-white/15 backdrop-blur-sm"
    >
      {LOCALES.map((l) => {
        const active = locale === l;
        return (
          <Link
            key={l}
            href={to(l)}
            aria-current={active ? "true" : undefined}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all duration-200 ${
              active
                ? "bg-white text-primary shadow-sm"
                : "text-white/70 hover:text-white"
            }`}
          >
            {l}
          </Link>
        );
      })}
    </nav>
  );
}
