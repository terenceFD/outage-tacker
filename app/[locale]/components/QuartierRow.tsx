import Link from "next/link";
import StatusBadge, { type Status } from "./StatusBadge";

// PDF: "Quartier row — dot, quartier name, service type and a status badge.
// Opens the detail page."
// Redesigned: colored service-icon chip, bold name, secondary meta line
// (duration · provider), and a subtle chevron to signal navigation.
const KIND = {
  power: { chip: "bg-power/15 text-power", icon: "⚡", provider: "ENEO" },
  water: { chip: "bg-water/15 text-water", icon: "💧", provider: "Camwater" },
} as const;

export default function QuartierRow({
  name,
  type,
  status,
  statusLabel,
  duration,
}: {
  name: string;
  type: "power" | "water";
  status: Status;
  statusLabel: string;
  duration?: string;
}) {
  const kind = KIND[type];
  return (
    <Link
      href={`/quartier/${encodeURIComponent(name)}`}
      className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-bg/70 focus-visible:outline-none focus-visible:bg-bg/70"
    >
      {/* Service chip: power / water identity carried by icon + tint */}
      <span
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm leading-none transition-transform group-hover:scale-105 ${kind.chip}`}
      >
        {kind.icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-sm font-bold text-text">
          {name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {duration ? `${duration} · ` : ""}
          {kind.provider}
        </p>
      </div>

      <StatusBadge status={status} label={statusLabel} />

      <span
        aria-hidden
        className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text"
      >
        ›
      </span>
    </Link>
  );
}
