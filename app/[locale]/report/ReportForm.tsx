"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export interface QuartierOption {
  id: string;
  name: string;
  city: string;
}

export default function ReportForm({
  quartiers,
}: {
  quartiers: QuartierOption[];
}) {
  const t = useTranslations("report");
  const [type, setType] = useState<"power" | "water" | null>(null);
  const [quartier, setQuartier] = useState<string | null>(null);
  const [status, setStatus] = useState<"out" | "restored" | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI describe tab (PDF §6 — source=chat)
  const [mode, setMode] = useState<"buttons" | "chat">("buttons");
  const [chatText, setChatText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [aiDraft, setAiDraft] = useState<{
    type: "light" | "water";
    status: "out" | "restored";
    quartierId: string | null;
    quartierName: string | null;
    confidence: number;
  } | null>(null);

  if (sent) {
    return (
      <div className="mt-10 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-3 text-lg font-semibold text-status-ok">{t("sent")}</p>
      </div>
    );
  }

  const stepClass = (selected: boolean) =>
    selected
      ? "border-accent bg-accent text-white font-semibold"
      : "border-border bg-surface";

  /** Shared submit used by both the 3-tap flow and the AI confirm flow. */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !quartier || !status) return;
    setSending(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quartierId: quartier,
          type: type === "power" ? "light" : "water",
          status: status === "out" ? "out" : "restored",
          ...(mode === "chat"
            ? { source: "chat", rawText: chatText, aiConfidence: aiDraft?.confidence }
            : {}),
        }),
      });
      if (res.status === 201) {
        setSent(true);
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
    } finally {
      setSending(false);
    }
  };

  /** Ask Gemini to parse free text → prefill the 3-step draft. */
  const parseWithAi = async () => {
    if (chatText.trim().length < 3) return;
    setParsing(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: chatText,
          quartiers: quartiers.map((q) => q.name),
        }),
      });
      if (!res.ok) {
        setErrorMsg(res.status === 503 ? "AI not configured" : "AI error");
        return;
      }
      const ai = (await res.json()) as {
        type: "light" | "water";
        status: "out" | "restored";
        quartierName: string | null;
        confidence: number;
      };
      const match = quartiers.find(
        (q) => ai.quartierName && q.name.toLowerCase() === ai.quartierName.toLowerCase()
      );
      setAiDraft({
        type: ai.type,
        status: ai.status,
        quartierId: match?.id ?? null,
        quartierName: match?.name ?? ai.quartierName,
        confidence: ai.confidence,
      });
    } catch {
      setErrorMsg("Network error");
    } finally {
      setParsing(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* Mode tabs: buttons vs describe-it (wireframe screen 2) */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("buttons")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
            mode === "buttons" ? "bg-accent text-white" : "surface-card text-muted"
          }`}
        >
          {t("step1")}
        </button>
        <button
          type="button"
          onClick={() => setMode("chat")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
            mode === "chat" ? "bg-accent text-white" : "surface-card text-muted"
          }`}
        >
          💬 {t("describeTab")}
        </button>
      </div>

      {mode === "chat" && !aiDraft && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("describeIntro")}</p>
          <textarea
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder={t("describePlaceholder")}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={parseWithAi}
            disabled={parsing || chatText.trim().length < 3}
            className="min-h-11 w-full rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white disabled:opacity-40"
          >
            {parsing ? "…" : `🤖 ${t("describeSend")}`}
          </button>
        </div>
      )}

      {mode === "chat" && aiDraft && (
        <div className="surface-card rounded-lg p-4">
          <p className="text-sm font-semibold text-status-ok">{t("confidenceOk")}</p>
          <p className="mt-2 text-base">
            {aiDraft.type === "light" ? "⚡ Power" : "💧 Water"} ·{" "}
            {aiDraft.status === "out" ? t("statusOut") : t("statusBack")} ·{" "}
            {aiDraft.quartierName ?? "?"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {Math.round(aiDraft.confidence * 100)}%
          </p>
          <p className="mt-3 font-medium">{t("confidenceAsk")}</p>
          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              disabled={!aiDraft.quartierId || sending}
              className="min-h-11 flex-1 rounded-lg bg-accent px-4 py-3 text-base font-semibold text-white disabled:opacity-40"
            >
              {sending ? "…" : t("yes")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAiDraft(null);
                setChatText("");
              }}
              className="min-h-11 flex-1 rounded-lg border-2 border-border px-4 py-3 text-base font-semibold"
            >
              {t("change")}
            </button>
          </div>
          {!aiDraft.quartierId && (
            <p className="mt-2 text-xs text-status-out">
              Quartier not recognized — use the buttons tab to pick it manually.
            </p>
          )}
        </div>
      )}

      {/* 3-tap flow (hidden while the AI draft confirm card is shown) */}
      <div className={mode === "chat" && aiDraft ? "hidden" : "contents"}>
      {/* Step 1: type */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("step1")}
        </legend>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setType("power")}
            className={`min-h-11 flex-1 rounded-lg border-2 px-4 py-3 text-base ${stepClass(type === "power")}`}
            style={type === "power" ? undefined : { color: "var(--power)" }}
          >
            ⚡ Power
          </button>
          <button
            type="button"
            onClick={() => setType("water")}
            className={`min-h-11 flex-1 rounded-lg border-2 px-4 py-3 text-base ${stepClass(type === "water")}`}
            style={type === "water" ? undefined : { color: "var(--water)" }}
          >
            💧 Water
          </button>
        </div>
      </fieldset>

      {/* Step 2: quartier */}
      <fieldset disabled={!type}>
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("step2")}
        </legend>
        <select
          value={quartier ?? ""}
          onChange={(e) => setQuartier(e.target.value || null)}
          className={`w-full rounded-lg border-2 px-4 py-3 text-base ${stepClass(!!quartier)}`}
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
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("step3")}
        </legend>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStatus("out")}
            className={`min-h-11 flex-1 rounded-lg border-2 px-4 py-3 text-base ${stepClass(status === "out")}`}
          >
            🔌 {t("statusOut")}
          </button>
          <button
            type="button"
            onClick={() => setStatus("restored")}
            className={`min-h-11 flex-1 rounded-lg border-2 px-4 py-3 text-base ${stepClass(status === "restored")}`}
          >
            ✅ {t("statusBack")}
          </button>
        </div>
      </fieldset>

      {/* Send — full-width rounded primary button per PDF */}
      <button
        type="submit"
        disabled={!type || !quartier || !status || sending}
        className="min-h-11 w-full rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white disabled:opacity-40"
      >
        {sending ? "…" : t("send")}
      </button>
      {errorMsg && <p className="text-center text-sm text-status-out">{errorMsg}</p>}

      <p className="text-center text-sm text-muted">
        {t("rateLimitNote")}
        <br />
        {t("otpNote")}
      </p>
      </div>
    </form>
  );
}
