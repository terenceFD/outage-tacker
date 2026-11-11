"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";

// Phone OTP flow per the PDFs: enter number → receive code → verify.
// Wired to Supabase Auth when configured; demo mode otherwise.
export default function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const digits = phone.replace(/\D/g, "");
  // E.164 for Cameroon (+237) — Supabase requires the full format
  const e164 = digits.startsWith("237") ? `+${digits}` : `+237${digits}`;
  const phoneValid = digits.length >= 9; // Cameroon numbers: 9 digits

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneValid) {
      setError(t("phoneLabel"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (isSupabaseBrowserConfigured()) {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
        if (error) {
          setError(error.message);
          return;
        }
      }
      // Demo mode (no env): jump straight to the code step
      setStep("code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.replace(/\D/g, "").length !== 6) {
      setError(t("codePlaceholder"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (isSupabaseBrowserConfigured()) {
        const supabase = createClient();
        const { error } = await supabase.auth.verifyOtp({
          phone: e164,
          token: code,
          type: "sms",
        });
        if (error) {
          setError(error.message);
          return;
        }
        // Session cookies are set — refresh so server components see the user
        router.refresh();
        router.push("/");
      } else {
        // Demo mode: pretend success
        router.push("/");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-card rounded-lg p-6">
      {step === "phone" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          <label htmlFor="phone" className="text-sm font-semibold text-muted">
            {t("phoneLabel")}
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("phonePlaceholder")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-status-out">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white disabled:opacity-40"
          >
            {busy ? "…" : t("sendCode")}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <label htmlFor="code" className="text-sm font-semibold text-muted">
            {t("codeLabel")}
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder={t("codePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-status-out">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white disabled:opacity-40"
          >
            {busy ? "…" : t("verify")}
          </button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="text-muted hover:underline"
            >
              ← {t("changeNumber")}
            </button>
            <button
              type="button"
              onClick={() => setCode("")}
              className="text-accent hover:underline"
            >
              {t("resend")}
            </button>
          </div>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-muted">{t("note")}</p>
    </div>
  );
}
