"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

export interface QuartierOption {
  id: string;
  name: string;
  city: string;
}

interface Prefill {
  type?: "power" | "water";
  quartierId?: string | null;
  status?: "out" | "restored";
}

/** Read + clear the assistant's handoff draft (client-side only). */
function readPrefill(): Prefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("reportPrefill");
    if (!raw) return null;
    sessionStorage.removeItem("reportPrefill");
    return JSON.parse(raw) as Prefill;
  } catch {
    return null; // malformed prefill — ignore, form stays empty
  }
}

/**
 * The 3-tap report form (final.pdf §3): pick type (light / water),
 * quartier, status (out / back on), send. Target: 3 taps, under 10
 * seconds. This form never calls the AI — the assistant lives on
 * /assistant (final.pdf: "The one-tap form from the MVP stays as the
 * main flow").
 *
 * Prefill: the assistant page stores a draft in sessionStorage
 * ("reportPrefill") when the user taps "Change" — it is picked up here
 * so the user never has to re-enter what was already understood.
 */
function StepLabel({ num, children }: { num: number; children: ReactNode }) {
  return (
    <legend className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
        {num}
      </span>
      <span className="text-sm font-semibold tracking-wide">{children}</span>
    </legend>
  );
}

export default function ReportForm({
  quartiers,
}: {
  quartiers: QuartierOption[];
}) {
  const t = useTranslations("report");

  // Prefill handed over from the AI assistant ("Change" → 3-tap form).
  // Read lazily in the state initializer — mounted once per client visit.
  const prefill = readPrefill();
  const [type, setType] = useState<"power" | "water" | null>(
    prefill?.type ?? null,
  );
  const [quartier, setQuartier] = useState<string | null>(
    prefill?.quartierId ?? null,
  );
  const [status, setStatus] = useState<"out" | "restored" | null>(
    prefill?.status ?? null,
  );
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="surface-card mt-6 flex flex-col items-center rounded-2xl border border-border px-6 py-12 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-ok/10 text-3xl">
          ✅
        </div>
        <p className="mt-4 text-xl font-bold text-status-ok">{t("sent")}</p>
        <p className="mt-2 max-w-xs text-sm text-muted">{t("sentSub")}</p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setType(null);
            setQuartier(null);
            setStatus(null);
          }}
          className="min-h-11 mt-6 w-full max-w-xs rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white"
        >
          {t("reportAnother")}
        </button>
      </div>
    );
  }

  /** Shared submit used by the 3-tap flow. */
  const sendReport = async (payload: {
    quartierId: string | null;
    type: "light" | "water";
    status: "out" | "restored";
    source: "app" | "chat";
    rawText: string | null;
    aiConfidence: number | null;
  }): Promise<boolean> => {
    setErrorMsg(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 201) {
        return true;
      } else if (res.status === 429) {
        setErrorMsg(t("rateLimitNote"));
      } else if (res.status === 401) {
        setErrorMsg(t("otpNote")); // sign-in required
      } else {
        const body = await res.json().catch(() => null);
        setErrorMsg(body?.message ?? "Error");
      }
    } catch {
      setErrorMsg("Network error");
    }
    return false;
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          if (!type || !quartier || !status) return;
          setSending(true);
          const ok = await sendReport({
            quartierId: quartier,
            type: type === "power" ? "light" : "water",
            status: status === "out" ? "out" : "restored",
            source: "app",
            rawText: null,
            aiConfidence: null,
          });
          if (ok) setSent(true);
          setSending(false);
        })();
      }}
      className="flex flex-col gap-6"
    >
      {/* Step 1: type */}
      <fieldset>
        <StepLabel num={1}>{t("step1")}</StepLabel>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setType("power")}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-4 py-4 transition-all ${
              type === "power"
                ? "border-accent bg-accent text-white shadow-md"
                : "border-border bg-surface hover:border-accent/50"
            }`}
            style={type === "power" ? undefined : { color: "var(--power)" }}
          >
            <span className="text-2xl">⚡</span>
            <span className="text-sm font-semibold">{t("servicePower")}</span>
          </button>
          <button
            type="button"
            onClick={() => setType("water")}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-4 py-4 transition-all ${
              type === "water"
                ? "border-accent bg-accent text-white shadow-md"
                : "border-border bg-surface hover:border-accent/50"
            }`}
            style={type === "water" ? undefined : { color: "var(--water)" }}
          >
            <span className="text-2xl">💧</span>
            <span className="text-sm font-semibold">{t("serviceWater")}</span>
          </button>
        </div>
      </fieldset>

      {/* Step 2: quartier */}
      <fieldset disabled={!type}>
        <StepLabel num={2}>{t("step2")}</StepLabel>
        <select
          value={quartier ?? ""}
          onChange={(e) => setQuartier(e.target.value || null)}
          className={`min-h-12 w-full rounded-xl border-2 px-4 py-3 text-base shadow-sm transition-colors ${
            quartier
              ? "border-accent bg-accent/5 font-medium"
              : "border-border bg-surface"
          } ${!type ? "opacity-50" : ""}`}
        >
          <option value="">{t("chooseQuartier")}</option>
          {quartiers.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}, {q.city}
            </option>
          ))}
        </select>
      </fieldset>

      {/* Step 3: status */}
      <fieldset disabled={!quartier}>
        <StepLabel num={3}>{t("step3")}</StepLabel>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setStatus("out")}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
              status === "out"
                ? "border-status-out bg-status-out/10 text-status-out shadow-sm"
                : "border-border bg-surface hover:border-status-out/50"
            } ${!quartier ? "opacity-50" : ""}`}
          >
            🔌 {t("statusOut")}
          </button>
          <button
            type="button"
            onClick={() => setStatus("restored")}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
              status === "restored"
                ? "border-status-ok bg-status-ok/10 text-status-ok shadow-sm"
                : "border-border bg-surface hover:border-status-ok/50"
            } ${!quartier ? "opacity-50" : ""}`}
          >
            ✅ {t("statusBack")}
          </button>
        </div>
      </fieldset>

      {/* Send — full-width rounded primary button per PDF */}
      <button
        type="submit"
        disabled={!type || !quartier || !status || sending}
        className="min-h-12 w-full rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sending ? "…" : t("send")}
      </button>

      {errorMsg && (
        <p className="text-center text-sm text-status-out">{errorMsg}</p>
      )}

      <p className="text-center text-sm text-muted">
        {t("rateLimitNote")}
        <br />
        {t("otpNote")}
      </p>
    </form>
  );
}
