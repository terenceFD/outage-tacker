import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents/partialPrefetching disabled for now: every page awaits
  // `params` (locale) outside Suspense, which triggers "URL data outside of
  // Suspense" dev warnings. Re-enable and add Suspense boundaries when we
  // wire Supabase streaming queries (build plan week 1-2).
  // cacheComponents: true,
  // partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
