import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  // Don't auto-detect the browser language — always start in English
  // and let the user switch via the EN | FR header switch.
  localeDetection: false,
});
