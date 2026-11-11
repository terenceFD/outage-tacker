import { getTranslations, setRequestLocale } from "next-intl/server";
import BottomNav from "../components/BottomNav";

// PDF (both docs): /about — "Short explanation, privacy notice, how
// credibility is calculated, contact." Not in the bottom nav; linked from
// home footer + disclaimer contexts.
export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const tRoot = await getTranslations(); // root namespace (disclaimer lives there)
  const steps = t.raw("howSteps") as string[];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-primary">{t("heading")}</h1>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">
        {/* Intro */}
        <p className="mt-1 text-base leading-relaxed">{t("intro")}</p>

        {/* How a status is decided */}
        <section aria-labelledby="how-heading" className="mt-6">
          <h2
            id="how-heading"
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
          >
            {t("howTitle")}
          </h2>
          <ul className="surface-card space-y-3 rounded-lg p-4">
            {steps.map((s, i) => {
              // Split "Label: rest" to bold the status word and color it
              const idx = s.indexOf(":");
              const label = idx > -1 ? s.slice(0, idx) : "";
              const rest = idx > -1 ? s.slice(idx + 1) : s;
              const color =
                i === 0
                  ? "text-status-out"
                  : i === 1
                    ? "text-status-unconfirmed"
                    : i === 2
                      ? "text-status-ok"
                      : "text-status-unknown";
              return (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span aria-hidden>•</span>
                  <span>
                    {idx > -1 && <strong className={color}>{label}: </strong>}
                    {rest.trim()}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Credibility */}
        <section aria-labelledby="cred-heading" className="mt-6">
          <h2
            id="cred-heading"
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
          >
            {t("credibilityTitle")}
          </h2>
          <p className="surface-card rounded-lg p-4 text-sm leading-relaxed">
            {t("credibilityBody")}
          </p>
        </section>

        {/* Privacy */}
        <section aria-labelledby="priv-heading" className="mt-6">
          <h2
            id="priv-heading"
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
          >
            {t("privacyTitle")}
          </h2>
          <p className="surface-card rounded-lg p-4 text-sm leading-relaxed">
            {t("privacyBody")}
          </p>
        </section>

        {/* The disclaimer the PDF mandates on every status view, expanded here */}
        <section aria-labelledby="disc-heading" className="mt-6">
          <h2
            id="disc-heading"
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-status-unconfirmed"
          >
            {t("disclaimerHeading")}
          </h2>
          <p className="surface-card rounded-lg border-l-4 border-status-unconfirmed p-4 text-sm leading-relaxed">
            {t("disclaimerBody")}
          </p>
        </section>

        {/* Contact — mailto for the pilot */}
        <p className="mt-6 text-center text-sm text-muted">
          {t("contact")}:{" "}
          <a
            href="mailto:hello@outagetracker.example"
            className="text-accent hover:underline"
          >
            hello@outagetracker.example
          </a>
        </p>

        <p className="mt-2 text-center text-sm text-muted">
          {tRoot("disclaimer")}
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
