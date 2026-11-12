"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { QuartierOption } from "../report/ReportForm";

interface AiDraft {
  type: "light" | "water";
  status: "out" | "restored";
  quartierId: string | null;
  quartierName: string | null;
  since: string | null;
  language: string;
  confidence: number;
}

type ChatTurn =
  | { role: "user"; text: string }
  | { role: "bot"; text: string }
  | { role: "confirm"; draft: AiDraft }
  | { role: "saved"; draft: AiDraft };

export interface AiStatusRow {
  name: string;
  city: string;
  type: "light" | "water";
  status: string;
  reports30m: number;
  confirmedCount: number;
}

export default function AssistantChat({
  quartiers,
  statuses,
}: {
  quartiers: QuartierOption[];
  statuses: AiStatusRow[];
}) {
  const t = useTranslations("report");
  const router = useRouter();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [chatText, setChatText] = useState("");
  const [pendingText, setPendingText] = useState(""); // text behind the current confirm card
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** Shared submit used by the confirm card and auto-save. */
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

  const resetChat = () => {
    setTurns([]);
    setChatText("");
    setDraft(null);
    setPendingText("");
  };

  /** Parse free text and route to the right confidence tier (final.pdf §6 step 5). */
  const parseWithAi = async () => {
    const text = chatText.trim();
    if (text.length < 3 || busy) return;
    setTurns((prev) => [...prev, { role: "user", text }]);
    setChatText("");
    setBusy(true);
    try {
      const res = await fetch("/api/parse-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          quartiers: quartiers.map((q) => q.name),
          statuses,
        }),
      });

      if (res.status === 429) {
        // Per-user AI limit reached → point at the 3-tap form
        setTurns((prev) => [
          ...prev,
          { role: "bot", text: t("aiRateLimited") },
        ]);
        return;
      }
      if (!res.ok) {
        // AI slow or down → fall back to the 3-tap form (guardrail, §6)
        setTurns((prev) => [
          ...prev,
          { role: "bot", text: t("aiUnavailable") },
        ]);
        return;
      }
      const ai = (await res.json()) as {
        intent?: "report" | "question";
        type: "light" | "water";
        status: "out" | "restored";
        quartierName: string | null;
        since: string | null;
        language: string;
        confidence: number;
        answer?: string | null;
      };

      // Question intent — the bot answers from the live status snapshot,
      // grounded server-side: it can only cite what was in the snapshot.
      if (ai.intent === "question") {
        setTurns((prev) => [
          ...prev,
          {
            role: "bot",
            text: ai.answer && ai.confidence >= 0.5 ? ai.answer : t("aiNoData"),
          },
        ]);
        return;
      }

      const match = quartiers.find(
        (q) =>
          ai.quartierName &&
          q.name.toLowerCase() === ai.quartierName.toLowerCase(),
      );
      const d: AiDraft = {
        type: ai.type,
        status: ai.status,
        quartierId: match?.id ?? null,
        quartierName: match?.name ?? ai.quartierName,
        since: ai.since,
        language: ai.language,
        confidence: ai.confidence,
      };

      if (!match) {
        // Invented/unknown quartier name → reject politely, offer 3-tap form
        setTurns((prev) => [
          ...prev,
          { role: "bot", text: t("unknownQuartier") },
        ]);
        return;
      }

      if (ai.confidence >= 0.8) {
        // High: create the report automatically, then confirm to the user
        const ok = await sendReport({
          quartierId: d.quartierId,
          type: d.type,
          status: d.status,
          source: "chat",
          rawText: text,
          aiConfidence: d.confidence,
        });
        setTurns((prev) => [
          ...prev,
          ok
            ? { role: "saved", draft: d }
            : { role: "bot", text: errorMsg ?? "Error" },
        ]);
      } else if (ai.confidence >= 0.5) {
        // Medium: ask before saving anything
        setPendingText(text);
        setDraft(d);
        setTurns((prev) => [...prev, { role: "confirm", draft: d }]);
      } else {
        // Low: unclear text or spam — politely decline, offer the 3-tap form
        setTurns((prev) => [
          ...prev,
          { role: "bot", text: t("lowConfidence") },
        ]);
      }
    } catch {
      setTurns((prev) => [...prev, { role: "bot", text: t("aiUnavailable") }]);
    } finally {
      setBusy(false);
    }
  };

  /** User taps "Yes, send" on the medium-confidence confirm card. */
  const confirmDraft = async () => {
    if (!draft || busy) return;
    setBusy(true);
    try {
      const ok = await sendReport({
        quartierId: draft.quartierId,
        type: draft.type,
        status: draft.status,
        source: "chat",
        rawText: pendingText,
        aiConfidence: draft.confidence,
      });
      setTurns((prev) => [
        ...prev.filter((turn) => turn.role !== "confirm"),
        ok
          ? { role: "saved", draft }
          : { role: "bot", text: errorMsg ?? "Error" },
      ]);
      setDraft(null);
      setPendingText("");
    } finally {
      setBusy(false);
    }
  };

  /** User taps "Change" → hand off to the 3-tap form prefilled on /report. */
  const changeDraft = () => {
    // The 3-tap form lives on /report — it reads the prefill from
    // sessionStorage so nothing is lost by leaving the assistant.
    if (draft) {
      sessionStorage.setItem(
        "reportPrefill",
        JSON.stringify({
          type: draft.type === "light" ? "power" : "water",
          quartierId: draft.quartierId,
          status: draft.status,
        }),
      );
    }
    router.push("/report");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-lg">
          🤖
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{t("botName")}</span>
          <span className="flex items-center gap-1.5 text-xs text-status-ok">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-ok opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-status-ok" />
            </span>
            {t("botOnline")}
          </span>
        </div>
      </div>

      {/* Conversation log (static = lowest data cost) */}
      <div className="flex flex-col gap-2">
        <div className="max-w-[85%] self-start rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2.5 text-sm shadow-sm">
          {t("botGreeting")}
        </div>
        {turns.map((turn, i) => {
          if (turn.role === "user") {
            return (
              <div
                key={i}
                className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-accent px-4 py-2 text-sm text-white"
              >
                {turn.text}
              </div>
            );
          }
          if (turn.role === "bot") {
            return (
              <div
                key={i}
                className="max-w-[85%] self-start rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2.5 text-sm shadow-sm"
              >
                {turn.text}
              </div>
            );
          }
          if (turn.role === "confirm") {
            return (
              <div
                key={i}
                className="max-w-[90%] self-start rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 shadow-sm"
              >
                {/* "Got it: power outage in Bonamoussadi, Douala" */}
                <p className="text-sm font-medium">
                  {t("gotIt", {
                    service:
                      turn.draft.type === "light"
                        ? t("servicePower")
                        : t("serviceWater"),
                    status:
                      turn.draft.status === "out"
                        ? t("statusOut")
                        : t("statusBack"),
                    quartier: turn.draft.quartierName ?? "?",
                  })}
                </p>
                {turn.draft.since && (
                  <p className="mt-1 text-xs text-muted">
                    {t("since", { since: turn.draft.since })}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted">
                  {t("confidenceAsk")} (
                  {Math.round(turn.draft.confidence * 100)}%)
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={confirmDraft}
                    disabled={busy}
                    className="min-h-11 flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {t("yes")}
                  </button>
                  <button
                    type="button"
                    onClick={changeDraft}
                    className="min-h-11 flex-1 rounded-lg border-2 border-border px-4 py-2 text-sm font-semibold"
                  >
                    {t("change")}
                  </button>
                </div>
              </div>
            );
          }
          // saved (high confidence, auto-created)
          return (
            <div
              key={i}
              className="self-start rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2 text-sm shadow-sm"
            >
              <p className="font-medium text-status-ok">✅ {t("sent")}</p>
              <p className="mt-1 text-xs text-muted">
                {t("savedDetail", {
                  service:
                    turn.draft.type === "light"
                      ? t("servicePower")
                      : t("serviceWater"),
                  quartier: turn.draft.quartierName ?? "?",
                  confidence: Math.round(turn.draft.confidence * 100),
                })}
              </p>
              <button
                type="button"
                onClick={resetChat}
                className="mt-2 text-xs font-semibold text-accent hover:underline"
              >
                {t("newReport")}
              </button>
            </div>
          );
        })}
        {busy && (
          <div className="self-start rounded-2xl rounded-bl-sm bg-surface px-4 py-2 text-sm text-muted">
            …
          </div>
        )}
      </div>

      {/* Message composer — type a message… (PDF wireframe) */}
      <div className="flex gap-2">
        <input
          type="text"
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          maxLength={280}
          placeholder={t("describePlaceholder")}
          className="min-h-11 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-base shadow-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={parseWithAi}
          disabled={busy || chatText.trim().length < 3}
          aria-label={t("describeSend")}
          className="min-h-11 w-11 shrink-0 rounded-full bg-accent text-lg font-semibold text-white disabled:opacity-40"
        >
          ➤
        </button>
      </div>
      <p className="text-center text-xs text-muted">{t("chatNote")}</p>

      {errorMsg && (
        <p className="text-center text-sm text-status-out">{errorMsg}</p>
      )}
    </div>
  );
}
