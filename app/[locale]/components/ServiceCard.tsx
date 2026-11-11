import Link from "next/link";
import { getTranslations } from "next-intl/server";

// PDF: "Service card — summary tile for power or water with a left color
// stripe and a count." Colors: power / water on surface.
export default async function ServiceCard({
  kind,
  count,
  href = "/map",
}: {
  kind: "power" | "water";
  count: number;
  href?: string;
}) {
  const t = await getTranslations();
  const label = kind === "power" ? t("services.power") : t("services.water");
  const detail =
    kind === "power"
      ? t("services.quartiersOut", { count })
      : t("services.quartiersDry", { count });

  return (
    <Link
      href={href}
      className={`surface-card flex-1 rounded-lg py-3 px-4 border-l-4 ${
        kind === "power" ? "border-power" : "border-water"
      }`}
    >
      <p
        className={`text-sm font-bold tracking-wide ${kind === "power" ? "text-power" : "text-water"}`}
      >
        {label}
      </p>
      <p className="text-lg font-bold mt-1">{count}</p>
      <p className="text-sm text-muted">{detail}</p>
    </Link>
  );
}
