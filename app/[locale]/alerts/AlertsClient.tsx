"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

// Wireframe screen 5: "Notify me by [WhatsApp] [SMS]" chips + saved quartiers
// with Power/Water toggles + "+ Add quartier". Demo data — Supabase later.
const SAVED = [
  { name: "Bonamoussadi", city: "Douala", power: true, water: false },
  { name: "Akwa", city: "Douala", power: false, water: true },
  { name: "Molyko", city: "Buea", power: true, water: true },
];

function Toggle({
  on,
  color,
  label,
  onChange,
}: {
  on: boolean;
  color: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors`}
      style={{ backgroundColor: on ? color : "var(--status-unknown)" }}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export default function AlertsClient() {
  const t = useTranslations();
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [items, setItems] = useState(SAVED);

  const flip = (name: string, key: "power" | "water") =>
    setItems((prev) =>
      prev.map((q) => (q.name === name ? { ...q, [key]: !q[key] } : q)),
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Notify channel chips */}
      <section aria-labelledby="channel-heading">
        <h2
          id="channel-heading"
          className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
        >
          {t("alerts.notify")}
        </h2>
        <div className="flex gap-3">
          {(["whatsapp", "sms"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={`min-h-11 flex-1 rounded-lg border-2 px-4 py-3 text-base font-semibold ${
                channel === c
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-muted"
              }`}
            >
              {c === "whatsapp" ? "🟢 WhatsApp" : "✉️ SMS"}
            </button>
          ))}
        </div>
      </section>

      {/* Saved quartiers with per-service toggles */}
      <section aria-labelledby="saved-heading">
        <h2
          id="saved-heading"
          className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
        >
          {t("alerts.saved")}
        </h2>
        <ul className="surface-card divide-y divide-border rounded-lg px-4">
          {items.map((q) => (
            <li key={q.name} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/quartier/${encodeURIComponent(q.name)}`}
                  className="font-medium hover:underline"
                >
                  {q.name}
                </Link>
                <p className="text-sm text-muted">{q.city}</p>
              </div>
              <Toggle
                on={q.power}
                color="var(--power)"
                label={`${q.name} power`}
                onChange={() => flip(q.name, "power")}
              />
              <Toggle
                on={q.water}
                color="var(--water)"
                label={`${q.name} water`}
                onChange={() => flip(q.name, "water")}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Add quartier — opens /map with search focus in a later iteration */}
      <Link
        href="/map"
        className="flex min-h-11 items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-3 text-base font-semibold text-accent"
      >
        {t("alerts.add")}
      </Link>

      <p className="text-center text-sm text-muted">{t("disclaimer")}</p>
    </div>
  );
}
