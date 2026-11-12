# Outage Tracker — Express Backend

Node.js + Express REST API for Outage Tracker. Wraps the existing
Supabase schema (`supabase/migrations/0001_initial_schema.sql`) —
all authorization stays in Postgres RLS: every request carries the
caller's JWT, and anonymous requests use the anon key.

## Run

```powershell
cd outage-tracker/server
copy .env.example .env   # fill in SUPABASE_URL / SUPABASE_ANON_KEY
npm install
npm run dev              # or: npm start
```

Serves on `http://localhost:4000` (configurable via `PORT`).

## Endpoints

| Method          | Path                          | Auth           | Description                                                   |
| --------------- | ----------------------------- | -------------- | ------------------------------------------------------------- |
| GET             | `/api/health`                 | —              | liveness check                                                |
| POST            | `/api/auth/login`             | —              | email + password sign-in, returns session tokens              |
| POST            | `/api/auth/refresh`           | —              | rotate access token                                           |
| POST            | `/api/auth/logout`            | —              | invalidate a session                                          |
| GET             | `/api/quartiers`              | —              | official quartier list (`?city=`)                             |
| GET             | `/api/quartiers/statuses`     | —              | live derived status per quartier × type (`?city=&type=`)      |
| GET             | `/api/quartiers/:id/statuses` | —              | statuses for one quartier                                     |
| GET             | `/api/reports`                | —              | recent reports (`?quartierId=&type=&since=&limit=`)           |
| POST            | `/api/reports`                | Bearer         | create report — 30-min rate limit via DB RPC                  |
| POST            | `/api/reports/:id/confirm`    | Bearer         | "Me too" (unique per user)                                    |
| GET             | `/api/stats`                  | —              | 30-day outage minutes, city + quartier rollup                 |
| POST            | `/api/ai/parse`               | Bearer         | free text → report draft (Cerebras → Groq fallback, 10 req/h) |
| GET             | `/api/profile`                | Bearer         | own profile                                                   |
| PATCH           | `/api/profile`                | Bearer         | update language / home quartier                               |
| GET/POST/DELETE | `/api/profile/subscriptions`  | Bearer         | push subscription management                                  |
| GET             | `/api/admin/users`            | Bearer (admin) | user list (phones masked)                                     |
| PATCH           | `/api/admin/users/:id`        | Bearer (admin) | block / unblock                                               |
| GET             | `/api/admin/reports`          | Bearer (admin) | moderation view                                               |

## Design notes

- **No secrets escalation**: the server never uses a service-role key
  for user-facing routes — it forwards the caller's JWT, so policies in
  `0001_initial_schema.sql` (blocked accounts, admin-only reads, etc.)
  remain the single source of truth.
- **Status is never computed in the server** — it comes from the
  `quartier_statuses` view, derived by `compute_quartier_status` in SQL.
- **Input validation** everywhere with `zod`; quartier IDs must exist in
  the official list.
- **Errors**: rate limit → 429, blocked → 403, bad token → 401, invalid
  body → 400, upstream AI failure → 502.
