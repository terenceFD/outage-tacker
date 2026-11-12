import { Router } from "express";
import { z } from "zod";
import { clientForUser } from "../db.js";

const router = Router();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * POST /api/auth/signup — email + password registration (final.pdf §2:
 * "Email + password (Supabase Auth), free").
 */
router.post("/signup", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation failed", details: parsed.error.flatten() });
  }
  const supabase = clientForUser(null);
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return res.status(400).json({ error: "signup_failed", message: error.message });
  }
  res.json({
    needsConfirmation: !data.session,
    user: data.user ? { id: data.user.id, email: data.user.email } : null,
  });
});

/**
 * POST /api/auth/login — email + password sign-in.
 */
router.post("/login", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation failed", details: parsed.error.flatten() });
  }

  // Sign-ins always go through the anon client (no user JWT yet).
  const supabase = clientForUser(null);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data?.session) {
    return res
      .status(401)
      .json({ error: "invalid_credentials", message: error?.message });
  }

  res.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email },
  });
});

/**
 * POST /api/auth/refresh — rotate an access token.
 */
router.post("/refresh", async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (typeof refreshToken !== "string" || !refreshToken) {
    return res.status(400).json({ error: "refreshToken required" });
  }

  const supabase = clientForUser(null);
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data?.session) {
    return res.status(401).json({ error: "invalid_refresh_token" });
  }

  res.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  });
});

/**
 * POST /api/auth/logout — invalidate the session server-side.
 */
router.post("/logout", async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (typeof refreshToken === "string" && refreshToken) {
    const supabase = clientForUser(null);
    await supabase.auth.signOut(refreshToken);
  }
  res.json({ ok: true });
});

export default router;
