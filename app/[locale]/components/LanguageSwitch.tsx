"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLocale } from "next-intl";

// PDF: "visible EN | FR switch in the header on every screen"
// Note: no useSearchParams here — reading URL data outside Suspense
// breaks instant navigation under cacheComponents.
export default function LanguageSwitch() {
  const pathname = usePathname();
  const locale = useLocale();
  const stripLocale = pathname.replace(/^\/(en|fr)/, "") || "/";
  const to = (l: string) => `/${l}${stripLocale === "/" ? "" : stripLocale}`;

  return (
    <div className="flex items-center gap-1 text-sm font-medium">
      <Link
        href={to("en")}
        className={
          locale === "en"
            ? "text-primary underline underline-offset-4"
            : "text-muted"
        }
      >
        EN
      </Link>
      <span className="text-muted">|</span>
      <Link
        href={to("fr")}
        className={
          locale === "fr"
            ? "text-primary underline underline-offset-4"
            : "text-muted"
        }
      >
        FR
      </Link>
    </div>
  );
}
