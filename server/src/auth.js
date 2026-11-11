// Phone-OTP auth middleware + endpoints.
// We verify the user's access token with Supabase auth.getUser() so a
// forged or expired JWT can never reach the database layer.
import { clientForUser } from "./db.js";

/** Extract Bearer token from the Authorization header. */
export function getToken(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

/** Require a valid user; attaches req.user and req.supabase. */
export async function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: "missing bearer token" });
  }

  const supabase = clientForUser(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return res.status(401).json({ error: "invalid or expired token" });
  }

  req.user = user;
  req.supabase = supabase;
  next();
}

/**
 * Optional auth: attach user if a valid token is present, but let
 * anonymous requests through (used by public read endpoints).
 * Always sets req.supabase — an anon client when there is no valid
 * token, so handlers can always build a query.
 */
export async function optionalAuth(req, _res, next) {
  const token = getToken(req);
  if (token) {
    const supabase = clientForUser(token);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      req.user = user;
      req.supabase = supabase;
    }
  }
  req.supabase ??= clientForUser(null);
  next();
}
