"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  createClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/client";

// final.pdf §3: "/login — Sign up / sign in" with Email + password
// (Supabase Auth, free tier). Wired to Supabase when configured.
export default function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || password.length < 6) {
      setError(t("invalidCredentials"));
      return;
    }
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (isSupabaseBrowserConfigured()) {
        const supabase = createClient();
        if (mode === "signup") {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) {
            setError(error.message);
            return;
          }
          setInfo(t("confirmEmail"));
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setError(error.message);
          return;
        }
        // Session cookies are set — refresh so server components see the user
        router.refresh();
      }
      router.push("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-card rounded-lg p-6">
      {/* Sign in / sign up toggle — both are in scope per final.pdf §3 */}
      <div role="tablist" className="mb-4 flex rounded-lg bg-bg p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
            className={`min-h-11 flex-1 rounded-md px-3 text-sm font-semibold transition-colors ${
              mode === m ? "bg-accent text-white shadow-sm" : "text-muted"
            }`}
          >
            {m === "signin" ? t("signInButton") : t("signUpButton")}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label htmlFor="email" className="text-sm font-semibold text-muted">
          {t("emailLabel")}
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
        />
        <label htmlFor="password" className="text-sm font-semibold text-muted">
          {t("passwordLabel")}
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-status-out">{error}</p>}
        {info && <p className="text-sm text-status-ok">{info}</p>}
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white disabled:opacity-40"
        >
          {busy
            ? "…"
            : mode === "signup"
              ? t("signUpButton")
              : t("signInButton")}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">{t("note")}</p>
    </div>
  );
}
