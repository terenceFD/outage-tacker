import { Router } from "express";
import { z } from "zod";
import { clientForUser } from "../db.js";

const router = Router();

const otpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[0-9]{8,15}$/, "phone must be E.164-ish, e.g. +237670000000"),
});
const verifySchema = otpSchema.extend({ token: z.string().min(6).max(6) });

/**
 * POST /api/auth/otp — send a 6-digit login code by SMS.
 */
router.post("/otp", async (req, res) => {
  const parsed = otpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation failed", details: parsed.error.flatten() });
  }

  // Signups always go through the anon client (no user JWT yet).
  const supabase = clientForUser(null);
  const { error } = await supabase.auth.signInWithOtp({
    phone: parsed.data.phone,
  });

  if (error) {
    return res
      .status(400)
      .json({ error: "otp_failed", message: error.message });
  }
  res.json({ ok: true, message: "code sent" });
});

/**
 * POST /api/auth/verify — exchange the SMS code for a session.
 */
router.post("/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "validation failed", details: parsed.error.flatten() });
  }

  const supabase = clientForUser(null);
  const { data, error } = await supabase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: "sms",
  });

  if (error || !data?.session) {
    return res
      .status(401)
      .json({ error: "invalid_code", message: error?.message });
  }

  res.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: { id: data.user.id, phone: data.user.phone },
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
