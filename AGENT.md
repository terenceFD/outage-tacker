# AGENT.md — Outage Tracker

Guidance for AI coding agents working on this repository. Read this before making changes.

## Project overview

**Outage Tracker** — a web app for reporting and tracking electricity outages in Cameroon. Users report outages (optionally parsed by AI), view them on a map, get alerts per quartier, and admins moderate the report queue.

The repo root (`outage-tracker/`) contains two apps:

- **`/`** — Next.js 16 frontend (App Router, React 19, TypeScript, Tailwind CSS 4, next-intl for i18n, Supabase JS, Leaflet maps)
- **`/server`** — Express backend (Node ≥18, ESM, Supabase, Cerebras/Groq AI fallback for report parsing)

## Commands

Frontend (run from repo root):

```bash
npm install
npm run dev        # Next dev server
npm run build      # production build
npm run lint       # eslint
```

Backend (run from `server/`):

```bash
npm install
npm run dev        # node --watch src/index.js
npm start
```

## Environment

- `.env.local` (frontend): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (also accepts the new `sb_publishable_...` key format), `CEREBRAS_API_KEY`, `GROQ_API_KEY`.
- `server/.env` (backend): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CEREBRAS_API_KEY`, `GROQ_API_KEY`, `PORT`, `CORS_ORIGIN`.
- Never commit real keys; `.env.example` files document the shape.

## Database & auth

Supabase (Postgres). Migrations live in `supabase/migrations/`:

- `0001_initial_schema.sql` — base tables
- `0002_subscriptions.sql` — subscriptions + `handle_new_user` profile trigger
- `0003_seed_admin.sql` — seeds the default admin user and promotes its profile to `role = 'admin'`

**Important:** `0003` inserts directly into `auth.users`, so it will NOT run via normal migration tooling — it must be executed manually in the Supabase SQL Editor. Auth is email + password via Supabase (`POST /api/auth/login` on the Express server; frontend can also use `@supabase/ssr` directly). Admin authorization is driven by `profiles.role = 'admin'`.

## Architecture notes

- **Routing/i18n:** all user-facing pages live under `app/[locale]/` (en, fr via `messages/*.json`). Locale routing is configured in `src/i18n/routing.ts` and enforced by `middleware.ts`.
- **Supabase clients:** frontend helpers in `src/lib/supabase/` (`client.ts` browser, `server.ts` server components with SSR cookies, `middleware.ts` session refresh). Backend uses `clientForUser(jwt)` in `server/src/db.js`.
- **API routes:** Next.js route handlers under `app/api/` (health, reports, subscriptions, quartiers, ai-parse) and Express routes under `server/src/routes/` (auth, admin, reports, quartiers, stats, profile, ai). Keep the two consistent when changing payloads.
- **Admin area:** `app/[locale]/admin/` — `dashboard/` requires an admin session; queue moderation is in `queue/QueueClient.tsx`.
- **PWA:** `public/manifest.webmanifest`, `public/sw.js`, registered by `app/SWRegister.tsx`. Bump the SW cache version when changing cached assets.
- **Map:** Leaflet, dynamically imported in `app/[locale]/map/MapClient.tsx` (must stay client-only; Leaflet needs `window`).
- **Validation:** request bodies validated with zod on both frontend API routes and Express routes.

## Conventions

- TypeScript for the frontend with strict typing; plain modern JS (ESM) for `server/`.
- Use the existing file/folder layout — don't introduce alternative state/data patterns.
- All user-facing strings must exist in both `messages/en.json` and `messages/fr.json` (there's a `checkjson.js` helper to verify parity).
- Run `npm run lint` and `npm run build` before declaring frontend work done.
- Never expose service-role keys or secrets in client code; only `NEXT_PUBLIC_*` values reach the browser.

## Project skills (`.claude/skills/`)

This repo ships project-local skills under `.claude/skills/<name>/SKILL.md`. Read the relevant `SKILL.md` before doing work that matches it:

**Architecture & code quality**

- `senior-architect` — architecture decisions, dependency analysis, diagram generation
- `senior-fullstack` — fullstack scaffolding and workflow patterns
- `code-reviewer` — bug patterns and review checklist (has `references/bug-patterns.md`)
- `clean-code` — clean code conventions

**Frontend**

- `senior-frontend` — React/Next.js best practices, bundle and component helpers
- `react-best-practices` — detailed perf rules (rerenders, async, bundling) in `references/rules/`
- `react-component-performance` — component-level performance patterns
- `react-state-management` — state management guidance
- `tailwind-design-system` / `tailwind-patterns` — Tailwind styling conventions (Tailwind CSS 4 is used here)
- `ui-design-system` / `frontend-design` — design tokens and UI design guidance
- `web-performance-optimization` — web perf optimization
- `progressive-web-app` — PWA patterns (this app has `manifest.webmanifest` + `sw.js`)

**Backend & security**

- `senior-backend` — API design, DB optimization, security practices
- `senior-security` — security architecture, threat modeling, auditing
- `broken-authentication` — auth testing checklist (relevant to Supabase auth flows)
- `sql-injection-testing` / `xss-html-injection` — injection testing
- `zod-validation-expert` — zod schemas (used on both frontend API routes and Express routes)

**Testing & workflow**

- `webapp-testing` — headless browser testing scripts (`scripts/with_server.py`)
- `git-commit-helper` — commit message help

Skill files are reference material only — read them when the task matches, don't treat them as code to execute.

## Known gotchas

- `middleware.ts` and the `[locale]` segment are load-bearing: pages outside `app/[locale]/` won't get locale context.
- Supabase email confirmation settings can block seeded users; seed users must be auto-confirmed (the migration sets `email_confirmed_at`).
- PowerShell is the dev shell on this machine — no `&&` chaining; use `;`.
