"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { type Status } from "../components/StatusBadge";

// Demo moderation queues — Supabase queries gated by profiles.role
// replace this in week 4 of the build plan.
const REPORTS = [
  {
    id: 1,
    quartier: "Bonamoussadi",
    type: "power",
    status: "out",
    user: "+237 6** *** **1",
    text: "No light since morning",
  },
  {
    id: 2,
    quartier: "Akwa",
    type: "water",
    status: "restored",
    user: "+237 6** *** **2",
    text: "Water is back on Akwa",
  },
] as const;

const USERS = [
  { id: 1, phone: "+237 6** *** **1", reports: 14, blocked: false },
  { id: 2, phone: "+237 6** *** **2", reports: 9, blocked: false },
  { id: 3, phone: "+237 6** *** **3", reports: 31, blocked: true },
];

const QUARTIERS = [
  { name: "Bonamoussadi", city: "Douala" },
  { name: "Akwa", city: "Douala" },
  { name: "Bepanda", city: "Douala" },
  { name: "Deido", city: "Douala" },
  { name: "Molyko", city: "Buea" },
  { name: "Mile 16", city: "Buea" },
];

type Tab = "reports" | "quartiers" | "users";

export default function AdminTabs() {
  const t = useTranslations("admin");
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState(REPORTS.filter(() => true));
  const [users, setUsers] = useState(USERS);
  const [quartiers, setQuartiers] = useState(QUARTIERS);
  const [newQ, setNewQ] = useState("");

  const tabs: { id: Tab; label: string }[] = [
    { id: "reports", label: t("tabsReports") },
    { id: "quartiers", label: t("tabsQuartiers") },
    { id: "users", label: t("tabsUsers") },
  ];

  const btnSm =
    "min-h-11 px-3 py-1.5 rounded-lg border-2 text-sm font-semibold";

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-2" role="tablist">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === x.id ? "bg-accent text-white" : "surface-card text-muted"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {/* Reports queue */}
      {tab === "reports" && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("flagged")}
          </h2>
          {reports.length === 0 ? (
            <p className="surface-card rounded-lg p-4 text-center text-sm text-muted">
              {t("empty")}
            </p>
          ) : (
            <ul className="surface-card divide-y divide-border rounded-lg px-4">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.text}</p>
                    <p className="text-sm text-muted">
                      {r.quartier} · {r.user}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setReports((p) => p.filter((x) => x.id !== r.id))
                    }
                    className={`${btnSm} border-status-ok text-status-ok`}
                  >
                    ✓ {t("approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReports((p) => p.filter((x) => x.id !== r.id))
                    }
                    className={`${btnSm} border-status-out text-status-out`}
                  >
                    ✕ {t("remove")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Quartier management */}
      {tab === "quartiers" && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("quartierList")}
          </h2>
          <ul className="surface-card divide-y divide-border rounded-lg px-4">
            {quartiers.map((q) => (
              <li key={q.name} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="font-medium">{q.name}</p>
                  <p className="text-sm text-muted">{q.city}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setQuartiers((p) => p.filter((x) => x.name !== q.name))
                  }
                  className={`${btnSm} border-status-out text-status-out`}
                >
                  ✕ {t("remove")}
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newQ.trim()) return;
              setQuartiers((p) => [...p, { name: newQ.trim(), city: "—" }]);
              setNewQ("");
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              placeholder="Quartier name"
              className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white"
            >
              +
            </button>
          </form>
        </section>
      )}

      {/* Users */}
      {tab === "users" && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("blockedUsers")}
          </h2>
          <ul className="surface-card divide-y divide-border rounded-lg px-4">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="font-medium">{u.phone}</p>
                  <p className="text-sm text-muted">{u.reports} reports</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setUsers((p) =>
                      p.map((x) =>
                        x.id === u.id ? { ...x, blocked: !x.blocked } : x,
                      ),
                    )
                  }
                  className={
                    u.blocked
                      ? `${btnSm} border-status-ok text-status-ok`
                      : `${btnSm} border-status-out text-status-out`
                  }
                >
                  {u.blocked ? t("unblock") : t("block")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
