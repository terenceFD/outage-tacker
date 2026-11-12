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
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  // Map rows to the legacy shape used by markers/list (power ↔ light)
  const QUARTIERS = useMemo(
    () =>
      quartiers.map((r) => ({
        id: `${r.name}-${r.type}`,
        name: r.name,
        city: r.city,
        lat: r.lat ?? 0,
        lng: r.lng ?? 0,
        type: (r.type === "light" ? "power" : "water") as "power" | "water",
        status: r.status as Status,
        reports: r.reports30m,
        duration: r.latestAt
          ? (() => {
              const mins = Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(r.latestAt!).getTime()) / 60000,
                ),
              );
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

  // Counts drive the filter pills and the summary strip
  const counts = useMemo(() => {
    const by = (f: Filter) =>
      QUARTIERS.filter((q) => f === "all" || q.type === f);
    return {
      all: by("all"),
      power: by("power"),
      water: by("water"),
    };
  }, [QUARTIERS]);

  const outCount = useMemo(
    () => visible.filter((q) => q.status === "out").length,
    [visible],
  );
  const affectedCount = useMemo(
    () =>
      visible.filter((q) => q.status === "out" || q.status === "unconfirmed")
        .length,
    [visible],
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
    // Enable wheel zoom only after the first interaction so the page still scrolls
    map.on("click", () => map.scrollWheelZoom.enable());
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
    markersRef.current.clear();
    visible.forEach((q) => {
      const marker = L.circleMarker([q.lat, q.lng], {
        radius: q.status === "out" ? 16 : 12,
        color: "#ffffff",
        fillColor: MARKER_COLOR[q.status],
        fillOpacity: 0.8,
        weight: 2.5,
      });
      marker.bindPopup(
        `<div class="ot-popup">
           <strong>${q.name}</strong>
           <span class="ot-popup-status ot-popup-${q.status}">${t(`status.${q.status}`)}</span>
           <span>${t(`serviceType.${q.type}`)} · ${q.duration}</span>
           <a href="/quartier/${encodeURIComponent(q.name)}">${t("map.details")}</a>
         </div>`,
      );
      marker.addTo(layer);
      markersRef.current.set(q.id, marker);
    });
  }, [visible, t]);

  // From the list, fly the map to that quartier and open its popup
  const focusQuartier = (id: string) => {
    const marker = markersRef.current.get(id);
    const map = mapRef.current;
    if (marker && map) {
      map.flyTo(marker.getLatLng(), 14, { duration: 0.6 });
      marker.openPopup();
    }
  };

  const FILTER_OPTIONS: { key: Filter; icon: string; tone: string }[] = [
    { key: "all", icon: "🗺️", tone: "text-text" },
    { key: "power", icon: "⚡", tone: "text-power" },
    { key: "water", icon: "💧", tone: "text-water" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip: what matters at a glance */}
      <div className="grid grid-cols-2 gap-3">
        <div className="surface-card rounded-xl border border-border p-3">
          <p className="text-2xl font-bold leading-none text-status-out">
            {outCount}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t("services.quartiersOut", { count: outCount })}
          </p>
        </div>
        <div className="surface-card rounded-xl border border-border p-3">
          <p className="text-2xl font-bold leading-none text-status-unconfirmed">
            {affectedCount}
          </p>
          <p className="mt-1 text-sm text-muted">{t("home.affected")}</p>
        </div>
      </div>

      {/* Segmented filter with live counts */}
      <div
        className="flex gap-1 rounded-full border border-border bg-surface p-1"
        role="group"
        aria-label={t("map.filterAll")}
      >
        {FILTER_OPTIONS.map(({ key, icon, tone }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={active}
              className={`min-h-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${
                active
                  ? "bg-accent text-white shadow-sm"
                  : `${tone} hover:bg-bg`
              }`}
            >
              <span aria-hidden>{icon}</span>
              {key === "all" ? t("map.all") : t(`serviceType.${key}`)}
              <span
                className={`ml-0.5 rounded-full px-1.5 text-xs font-bold tabular-nums ${
                  active ? "bg-white/20" : "bg-bg text-muted"
                }`}
              >
                {counts[key].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* The map itself, framed like a card with an overlaid legend */}
      <div className="relative overflow-hidden rounded-2xl border border-border shadow-sm">
        <div ref={divRef} className="h-[55vh] w-full z-0" />

        {/* Floating legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap gap-x-3 gap-y-1 rounded-full bg-surface/90 px-3 py-2 text-xs text-text shadow-md backdrop-blur">
          {(["out", "unconfirmed", "ok", "unknown"] as Status[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: MARKER_COLOR[s] }}
              />
              {t(`status.${s}`)}
            </span>
          ))}
        </div>
      </div>

      {/* Affected quartier list — tappable rows that fly the map */}
      <section aria-label={t("map.heading")}>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-base font-bold">{t("home.affected")}</h2>
          <span className="text-xs text-muted tabular-nums">
            {visible.length}
          </span>
        </div>
        <ul className="surface-card divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {visible.map((q) => (
            <li key={q.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status rail */}
                <span
                  className="h-9 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: MARKER_COLOR[q.status] }}
                />
                <span
                  className={`h-8 w-8 shrink-0 rounded-lg ${q.type === "power" ? "bg-power/15" : "bg-water/15"} flex items-center justify-center text-sm`}
                  aria-hidden
                >
                  {q.type === "power" ? "⚡" : "💧"}
                </span>
                <Link
                  href={`/quartier/${encodeURIComponent(q.name)}`}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate font-medium">{q.name}</span>
                  <span className="block text-sm text-muted">{q.duration}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => focusQuartier(q.id)}
                  aria-label={`${q.name} — ${t("map.locate")}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:bg-bg hover:text-accent"
                >
                  📍
                </button>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium ${STATUS_BG[q.status]}`}
                >
                  {t(`status.${q.status}`)}
                </span>
              </div>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted">
              {t("home.allClear")}
            </li>
          )}
        </ul>
      </section>

      <p className="text-center text-sm text-muted">{t("disclaimer")}</p>
    </div>
  );
}
