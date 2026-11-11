import Link from "next/link";
import StatusBadge, { type Status } from "./StatusBadge";

// PDF: "Quartier row — dot, quartier name, service type and a status badge.
// Opens the detail page."
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
  return (
    <Link
      href={`/quartier/${encodeURIComponent(name)}`}
      className="flex items-center gap-3 py-3 px-4 rounded-lg hover:bg-surface active:bg-surface transition-colors"
    >
      <span
        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
          type === "power" ? "bg-power" : "bg-water"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{name}</p>
        <p className="text-sm text-muted">
          {duration ? `${duration} · ` : ""}
          {type === "power" ? "ENEO" : "Camwater"}
        </p>
      </div>
      <StatusBadge status={status} label={statusLabel} />
    </Link>
  );
}
