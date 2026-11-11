import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import AdminTabs from "./AdminTabs";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/quartiers";

// PDF (both docs): /admin — "Moderate reports, manage quartier list,
// block abusive users." Real role check against profiles.role when
// Supabase is configured; locked card otherwise.
async function isAdminUser(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_blocked")
    .eq("id", user.id)
    .single<{ role: "user" | "admin"; is_blocked: boolean }>();
  return profile?.role === "admin" && !profile?.is_blocked;
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const isAdmin = await isAdminUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-primary">{t("heading")}</h1>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">
        {isAdmin ? (
          <AdminTabs />
        ) : (
          <div className="surface-card mt-6 rounded-lg p-6 text-center">
            <p className="text-2xl">🔒</p>
            <p className="mt-2 text-lg font-semibold">{t("locked")}</p>
            <p className="mt-1 text-sm text-muted">{t("lockedBody")}</p>
            <Link
              href="/login"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white"
            >
              {t("signIn")}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
