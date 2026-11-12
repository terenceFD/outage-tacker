"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

// Review queue (design.pdf page 5) — redesigned as a card list + inspector.
// Filter chips + report cards with source pills, confidence meter and flag
// badges, side panel with raw text, AI JSON, neighbours and reporter trust.
// "The AI only suggests. Approving counts it toward the 3-report threshold."

interface QueueItem {
  id: number;
  text: string;
  quartier: string;
  source: "WhatsApp" | "App";
  conf: string;
  flag: string;
  age: string;
  rawJson: string;
  others30m: number;
  trust: string;
}

const ITEMS: QueueItem[] = [
  {
    id: 1,
    text: "No light Akwa (x5 in 2 min)",
    quartier: "Akwa",
    source: "WhatsApp",
    conf: "0.91",
    flag: "duplicate",
    age: "4 min",
    rawJson:
      '{ "type": "power", "quartier": "Akwa", "status": "out", "language": "english", "confidence": 0.91 }',
    others30m: 4,
    trust: "trusted",
  },
  {
    id: 2,
    text: "Pas de courant a Molyko depuis ce matin",
    quartier: "Molyko",
    source: "WhatsApp",
    conf: "0.64",
    flag: "medium",
    age: "12 min",
    rawJson:
      '{ "type": "power", "quartier": "Molyko", "status": "out", "language": "french", "confidence": 0.64 }',
    others30m: 1,
    trust: "normal",
  },
  {
    id: 3,
    text: "Out, Bepanda (power)",
    quartier: "Bepanda",
    source: "App",
    conf: "n/a",
    flag: "ratelimit",
    age: "25 min",
    rawJson: "—",
    others30m: 0,
    trust: "normal",
  },
  {
    id: 4,
    text: "Water out, location unknown",
    quartier: "Unknown",
    source: "WhatsApp",
    conf: "0.32",
    flag: "unknown",
    age: "41 min",
    rawJson:
      '{ "type": "water", "quartier": null, "status": "out", "language": "english", "confidence": 0.32 }',
    others30m: 0,
    trust: "normal",
  },
  {
    id: 5,
    text: "We no get light for Bastos",
    quartier: "Bastos",
    source: "WhatsApp",
    conf: "0.78",
    flag: "medium",
    age: "1h 05",
    rawJson:
      '{ "type": "power", "quartier": "Bastos", "status": "out", "language": "pidgin", "confidence": 0.78 }',
    others30m: 2,
    trust: "trusted",
  },
];

type Filter = "all" | "whatsapp" | "app" | "medium" | "ratelimit";

/** Flag → badge color */
const FLAG_STYLES: Record<string, string> = {
  duplicate: "bg-status-unconfirmed/15 text-status-unconfirmed",
  medium: "bg-accent/10 text-accent",
  ratelimit: "bg-status-out/10 text-status-out",
  unknown: "bg-status-unknown/15 text-muted",
};

/** Confidence as a filled bar width + tone */
function confMeter(conf: string) {
  if (conf === "n/a") return null;
  const pct = Math.round(parseFloat(conf) * 100);
  const tone =
    pct >= 80
      ? "bg-status-ok"
      : pct >= 50
        ? "bg-accent"
        : "bg-status-unconfirmed";
  return { pct, tone };
}

export default function QueueClient() {
  const t = useTranslations("admin");
  const [items, setItems] = useState(ITEMS);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(5);

  const filtered = useMemo(() => {
    switch (filter) {
      case "whatsapp":
        return items.filter((i) => i.source === "WhatsApp");
      case "app":
        return items.filter((i) => i.source === "App");
      case "medium":
        return items.filter((i) => i.flag === "medium");
      case "ratelimit":
        return items.filter((i) => i.flag === "ratelimit");
      default:
        return items;
    }
  }, [items, filter]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  const act = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const chip = (f: Filter, label: string, count?: number) => (
    <button
      key={f}
      type="button"
      onClick={() => setFilter(f)}
      aria-pressed={filter === f}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        filter === f
          ? "bg-primary text-white shadow-sm"
          : "border border-border bg-surface text-muted hover:border-primary/40"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 text-xs tabular-nums ${
            filter === f ? "bg-white/20" : "bg-bg"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Filters + count */}
      <div className="flex flex-wrap items-center gap-2">
        {chip("all", t("filterAll"), items.length)}
        {chip(
          "whatsapp",
          "WhatsApp",
          items.filter((i) => i.source === "WhatsApp").length,
        )}
        {chip("app", "App", items.filter((i) => i.source === "App").length)}
        {chip(
          "medium",
          t("filterMedium"),
          items.filter((i) => i.flag === "medium").length,
        )}
        {chip(
          "ratelimit",
          t("filterRateLimited"),
          items.filter((i) => i.flag === "ratelimit").length,
        )}
        <span className="ml-auto text-sm text-muted">
          {t("reportsInQueue", { count: filtered.length })}
        </span>
      </div>

      {/* Bulk actions */}
      <div className="flex gap-2">
        <button
          type="button"
          className="min-h-10 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          {t("approveSelected")}
        </button>
        <button
          type="button"
          className="min-h-10 rounded-xl border-2 border-status-out/40 px-4 py-2 text-sm font-semibold text-status-out transition-colors hover:bg-status-out/10"
        >
          {t("rejectSelected")}
        </button>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_22rem]">
        {/* Report cards */}
        <div className="flex flex-col gap-3">
          {filtered.map((r) => {
            const meter = confMeter(r.conf);
            const isSelected = selectedId === r.id;
            return (
              <article
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`surface-card cursor-pointer rounded-2xl border p-4 transition-all ${
                  isSelected
                    ? "border-accent shadow-md ring-1 ring-accent/30"
                    : "border-border shadow-sm hover:border-accent/50"
                }`}
              >
                {/* Top row: flag badge + age */}
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${FLAG_STYLES[r.flag] ?? FLAG_STYLES.unknown}`}
                  >
                    {t(`flag_${r.flag}`)}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-muted">
                    {r.age}
                  </span>
                </div>

                {/* Report text */}
                <p className="font-medium leading-snug">{r.text}</p>

                {/* Meta row: quartier, source, confidence, actions */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="flex items-center gap-1 text-muted">
                    📍 {r.quartier}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      r.source === "WhatsApp"
                        ? "bg-status-ok/10 text-status-ok"
                        : "bg-accent/10 text-accent"
                    }`}
                  >
                    {r.source}
                  </span>
                  {meter ? (
                    <span className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-16 overflow-hidden rounded-full bg-border"
                        role="img"
                        aria-label={`${t("confidence")}: ${r.conf}`}
                      >
                        <span
                          className={`block h-full rounded-full ${meter.tone}`}
                          style={{ width: `${meter.pct}%` }}
                        />
                      </span>
                      <span className="text-xs tabular-nums text-muted">
                        {r.conf}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted">
                      {t("naConfidence")}
                    </span>
                  )}
                  <span className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        act(r.id);
                      }}
                      className="min-h-9 rounded-lg border-2 border-status-ok/40 px-3 py-1 text-sm font-semibold text-status-ok transition-colors hover:bg-status-ok hover:text-white"
                    >
                      {t("approve")}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        act(r.id);
                      }}
                      className="min-h-9 rounded-lg border-2 border-status-out/40 px-3 py-1 text-sm font-semibold text-status-out transition-colors hover:bg-status-out hover:text-white"
                    >
                      {t("reject")}
                    </button>
                  </span>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && (
            <div className="surface-card rounded-2xl border border-border px-4 py-10 text-center text-sm text-muted">
              {t("empty")}
            </div>
          )}
        </div>

        {/* Selected report inspector */}
        <aside
          aria-label={t("selectedReport")}
          className="surface-card sticky top-4 rounded-2xl border border-border p-4 shadow-sm"
        >
          {selected ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  {t("selectedReport")}
                </h2>
                <p className="text-xs text-muted">{t("selectHint")}</p>
              </div>

              {/* Raw text */}
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("rawText")}
                </p>
                <blockquote className="rounded-xl bg-bg p-3 text-sm leading-relaxed">
                  {selected.text}
                </blockquote>
              </div>

              {/* AI JSON */}
              {selected.rawJson !== "—" && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    AI JSON
                  </p>
                  <pre className="overflow-x-auto rounded-xl bg-bg p-3 text-xs leading-relaxed">
                    {selected.rawJson}
                  </pre>
                </div>
              )}

              {/* Signals grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-bg p-3">
                  <p className="text-xs text-muted">{t("others30m")}</p>
                  <p className="font-heading text-2xl font-bold tabular-nums">
                    {selected.others30m}
                  </p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="text-xs text-muted">{t("reporterTrust")}</p>
                  <p
                    className={`font-semibold ${
                      selected.trust === "trusted" ? "text-status-ok" : ""
                    }`}
                  >
                    {selected.trust === "trusted" ? "✔ " : ""}
                    {t(`trust_${selected.trust}`)}
                  </p>
                </div>
              </div>

              <p className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs leading-relaxed text-muted">
                💡 {t("aiSuggestsNote")}
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => act(selected.id)}
                  className="min-h-11 flex-1 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  {t("approve")}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border-2 border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-bg"
                >
                  {t("edit")}
                </button>
                <button
                  type="button"
                  onClick={() => act(selected.id)}
                  className="min-h-11 flex-1 rounded-xl border-2 border-status-out/50 px-4 py-2 text-sm font-semibold text-status-out transition-colors hover:bg-status-out/10"
                >
                  {t("reject")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="text-3xl">🗂️</span>
              <p className="mt-3 text-sm text-muted">{t("nothingSelected")}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
