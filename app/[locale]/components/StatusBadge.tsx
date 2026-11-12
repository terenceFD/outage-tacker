export type Status = "out" | "unconfirmed" | "ok" | "unknown";

const STYLES: Record<Status, string> = {
  out: "bg-status-out/10 text-status-out ring-1 ring-status-out/30",
  unconfirmed: "bg-status-unconfirmed/20 text-[#8a6d1f] ring-1 ring-status-unconfirmed/40",
  ok: "bg-status-ok/10 text-status-ok ring-1 ring-status-ok/30",
  unknown: "bg-status-unknown/10 text-muted ring-1 ring-status-unknown/30",
};

const DOT: Record<Status, string> = {
  out: "bg-status-out",
  unconfirmed: "bg-status-unconfirmed",
  ok: "bg-status-ok",
  unknown: "bg-status-unknown",
};

// PDF rule: never use color alone — every status is paired with a label.
export default function StatusBadge({
  status,
  label,
}: {
  status: Status;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {label}
    </span>
  );
}
