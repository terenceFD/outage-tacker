"use client";

import { useState } from "react";
import Link from "next/link";
import { useSessionContext } from "@/lib/useSession";
import { useTranslations } from "next-intl";

// "Me too (confirm)" — wired to POST /api/confirmations (complete.pdf §6-C).
// One confirmation per user per report, enforced server-side; optimistic
// UI with the fresh count echoed back from the API.
export default function ConfirmButton({
  activeReportId,
  initialCount,
}: {
  activeReportId: string | null;
  initialCount: number;
}) {
  const t = useTranslations("quartier");
  const { user, loading } = useSessionContext();
  const [count, setCount] = useState(initialCount);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!activeReportId || busy || done) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: activeReportId }),
      });
      if (res.status === 401) {
        setError(t("signInToConfirm"));
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Error");
        return;
      }
      const body = (await res.json()) as { count: number };
      setCount(body.count);
      setDone(true);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  if (!activeReportId) {
    // Nothing active to confirm right now
    return (
      <button
        type="button"
        disabled
        className="mt-4 min-h-11 w-full cursor-not-allowed rounded-lg bg-border px-6 py-3 text-base font-semibold text-muted"
      >
        👍 {t("nothingToConfirm")}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={confirm}
        disabled={busy || done || (!user && !loading)}
        className={`mt-4 min-h-11 w-full rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity ${
          done ? "bg-status-ok" : "bg-accent hover:opacity-90"
        } disabled:opacity-50`}
      >
        {done
          ? `✅ ${t("confirmedThanks")}`
          : busy
            ? "…"
            : `👍 ${t("confirm")}`}
        {count > 0 && (
          <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs tabular-nums">
            {count}
          </span>
        )}
      </button>
      {!user && !loading && (
        <p className="mt-1 text-center text-sm text-muted">
          {t("signInToConfirm")}{" "}
          <Link href="/login" className="text-accent hover:underline">
            {t("signInLink")}
          </Link>
        </p>
      )}
      {error && (
        <p className="mt-1 text-center text-sm text-status-out">{error}</p>
      )}
    </>
  );
}
