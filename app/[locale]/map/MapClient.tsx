"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type Status } from "../components/StatusBadge";
import type { QuartierSummary } from "@/lib/data/quartiers";

// Quartiers come from the server page (live when Supabase is configured).

const STATUS_BG: Record<Status, string> = {
  out: "bg-status-out text-white",
  unconfirmed: "bg-status-unconfirmed text-text",
  ok: "bg-status-ok text-white",
  unknown: "bg-status-unknown text-white",
};

const DOT_BG: Record<Status, string> = {
  out: "bg-status-out",
  unconfirmed: "bg-status-unconfirmed",
  ok: "bg-status-ok",
  unknown: "bg-status-unknown",
};

const MARKER_COLOR: Record<Status, string> = {
  out: "#d93025",
  unconfirmed: "#f2c94c",
  ok: "#1e9e5a",
  unknown: "#9aa5b1",
};

type Filter = "all" | "power" | "water";

export default function MapClient({
  quartiers,
}: {
  quartiers: QuartierSummary[];
}) {
  const t = useTranslations();
  const [filter, setFilter] = useState<Filter>("all");
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const divRef = useRef<HTMLDivElement | null>(null);

  // Map rows to the legacy shape used by markers/list (power ↔ light)
  const QUARTIERS = useMemo(
    () =>
      quartiers.map((r) => ({
        name: r.name,
        city: r.city,
        lat: r.lat ?? 0,
        lng: r.lng ?? 0,
        type: (r.type === "light" ? "power" : "water") as "power" | "water",
        status: r.status as Status,
        reports: r.reports30m,
        duration: r.latestAt
          ? (() => {
              const mins = Math.max(0, Math.floor((Date.now() - new Date(r.latestAt!).getTime()) / 60000));
              return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
            })()
          : "—",
      })),
    [quartiers],
  );

  const visible = useMemo(
    () => QUARTIERS.filter((q) => filter === "all" || q.type === filter),
    [QUARTIERS, filter],
  );

  // Init map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { scrollWheelZoom: false }).setView(
      [4.1, 9.5],
      11,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Redraw markers when the filter changes
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    visible.forEach((q) => {
      L.circleMarker([q.lat, q.lng], {
        radius: 14,
        color: MARKER_COLOR[q.status],
        fillColor: MARKER_COLOR[q.status],
        fillOpacity: 0.65,
        weight: 2,
      })
        .bindTooltip(`${q.name} — ${t(`status.${q.status}`)}`)
        .addTo(layer);
    });
  }, [visible, t]);

  return (
    <div className="flex flex-col gap-3">
      {/* Filter chips: Power / Water (PDF: Toggle and chips — accent/power/water) */}
      <div className="flex gap-2" role="group" aria-label={t("map.filterAll")}>
        {(["all", "power", "water"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-11 flex-1 rounded-full border-2 px-4 py-2 text-sm font-semibold ${
              filter === f
                ? "border-accent bg-accent text-white"
                : f === "power"
                  ? "border-border bg-surface text-power"
                  : f === "water"
                    ? "border-border bg-surface text-water"
                    : "border-border bg-surface text-muted"
            }`}
          >
            {f === "all"
              ? t("map.all")
              : f === "power"
                ? `⚡ ${t("serviceType.power")}`
                : `💧 ${t("serviceType.water")}`}
          </button>
        ))}
      </div>

      {/* The map itself */}
      <div ref={divRef} className="h-[45vh] w-full rounded-lg" />

      {/* Color-coded quartier list (wireframe: legend + tappable rows) */}
      <div className="flex items-center gap-3 text-xs text-muted">
        {(["out", "unconfirmed", "ok", "unknown"] as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_BG[s]}`}
            />
            {t(`status.${s}`)}
          </span>
        ))}
      </div>

      <ul className="surface-card divide-y divide-border rounded-lg px-4">
        {visible.map((q) => (
          <li key={`${q.name}-${q.type}`}>
            <Link
              href={`/quartier/${encodeURIComponent(q.name)}`}
              className="flex items-center gap-3 py-3"
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${q.type === "power" ? "bg-power" : "bg-water"}`}
              />
              <span className="flex-1 font-medium">{q.name}</span>
              <span className="text-sm text-muted">{q.duration}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${STATUS_BG[q.status]}`}
              >
                {t(`status.${q.status}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-center text-sm text-muted">{t("disclaimer")}</p>
    </div>
  );
}
