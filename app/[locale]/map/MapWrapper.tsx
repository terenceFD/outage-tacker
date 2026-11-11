"use client";

import dynamic from "next/dynamic";
import type { QuartierSummary } from "@/lib/data/quartiers";

// Leaflet requires `window` — load client-side only
const MapClient = dynamic(() => import("./MapClient"), { ssr: false });

export default function MapWrapper({
  quartiers,
}: {
  quartiers: QuartierSummary[];
}) {
  return <MapClient quartiers={quartiers} />;
}
