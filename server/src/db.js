import { createClient } from "@supabase/supabase-js";

// One admin-shape factory: every request builds a client carrying the
// caller's JWT, so Supabase RLS enforces authorization exactly as it
// does for the frontend (PDF §5).
export function clientForUser(jwt) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function mapDbError(error, fallbackStatus = 500) {
  const msg = error?.message ?? "unknown error";
  if (msg.includes("rate limit")) return { status: 429, msg };
  if (msg.includes("not authenticated") || msg.includes("JWT"))
    return { status: 401, msg };
  if (msg.includes("account blocked")) return { status: 403, msg };
  return { status: fallbackStatus, msg };
}
