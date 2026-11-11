export type Status = "out" | "unconfirmed" | "ok" | "unknown";

const STYLES: Record<Status, string> = {
  out: "bg-status-out text-white",
  unconfirmed: "bg-status-unconfirmed text-text",
  ok: "bg-status-ok text-white",
  unknown: "bg-status-unknown text-white",
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${STYLES[status]}`}
    >
      {label}
    </span>
  );
}
