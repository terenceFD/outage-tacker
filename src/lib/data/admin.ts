import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./quartiers";

// Server-side admin gate shared by /admin and the admin console
// (design.pdf pages 4–10: "Admin (role: admin)").
export async function isAdminUser(): Promise<boolean> {
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
