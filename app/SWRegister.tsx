"use client";

import { useEffect } from "react";

// Register the service worker only in production builds.
// In dev, SW caching serves stale pages and masks hot-reload updates.
export default function SWRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // Dev: actively clean up any previously-registered SW + caches
      navigator.serviceWorker?.getRegistrations?.().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
