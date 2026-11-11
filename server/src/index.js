import "dotenv/config";
import express from "express";
import cors from "cors";

import { optionalAuth } from "./auth.js";
import authRoutes from "./routes/auth.js";
import reportRoutes from "./routes/reports.js";
import quartierRoutes from "./routes/quartiers.js";
import statsRoutes from "./routes/stats.js";
import aiRoutes from "./routes/ai.js";
import profileRoutes from "./routes/profile.js";
import adminRoutes from "./routes/admin.js";

const app = express();

// Express 4 does not catch rejected promises in async handlers; wrap
// every router so async errors land in the central error handler.
function wrap(router) {
  const orig = {
    get: router.get.bind(router),
    post: router.post.bind(router),
    patch: router.patch.bind(router),
    put: router.put.bind(router),
    delete: router.delete.bind(router),
  };
  const catchFn = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
  for (const [method, fn] of Object.entries(orig)) {
    router[method] = (...args) =>
      fn(...args.map((a) => (typeof a === "function" ? catchFn(a) : a)));
  }
  return router;
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? "*",
  }),
);
app.use(express.json({ limit: "64kb" }));

// Attach an authenticated user when a Bearer token is present (public
// reads stay anonymous; Supabase RLS enforces row visibility).
app.use("/api", optionalAuth);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use("/api/auth", wrap(authRoutes));
app.use("/api/reports", wrap(reportRoutes));
app.use("/api/quartiers", wrap(quartierRoutes));
app.use("/api/stats", wrap(statsRoutes));
app.use("/api/ai", wrap(aiRoutes));
app.use("/api/profile", wrap(profileRoutes));
app.use("/api/admin", wrap(adminRoutes));

// 404 for unknown API routes
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found" });
});

// Central error handler — never leak stack traces to clients.
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "invalid json" });
  }
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

const port = parseInt(process.env.PORT, 10) || 4000;
app.listen(port, () => {
  console.log(`Outage Tracker API listening on http://localhost:${port}`);
});
