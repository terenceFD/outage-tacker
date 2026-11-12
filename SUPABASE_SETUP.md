# Supabase Setup — Outage Tracker

Free-tier backend per the build plan (week 1). Everything below costs nothing.

## 1. Create the project

1. Go to https://supabase.com → Sign up → **New project** (free plan)
2. Pick a name (e.g. `outage-tracker`), a region close to Cameroon
   (e.g. `eu-west-2` London or `eu-central-1`), and set a DB password
3. Wait ~2 min for provisioning

## 2. Apply the schema

Open **SQL Editor** in the Supabase dashboard, paste the entire contents of
[`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql)
and click **Run**.

This creates (see PDF §4/§5):

| Object                      | Purpose                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `quartiers`                 | official quartier list, pre-seeded with 16 pilot quartiers                                                 |
| `profiles`                  | 1:1 with auth users, `role` (user/admin), `is_blocked`                                                     |
| `reports`                   | one-tap + AI reports (`source`, `raw_text`, `ai_confidence`)                                               |
| `confirmations`             | "Me too", unique per user per report                                                                       |
| `incidents`                 | outage periods — drives durations & stats                                                                  |
| `push_subscriptions`        | web push endpoints per saved quartier                                                                      |
| `ai_usage`                  | per-user AI request counter (~10/hour limit)                                                               |
| `insert_report()`           | **RPC with the 30-minute rate limit + block check enforced in the DB**                                     |
| `compute_quartier_status()` | status derivation: ≥3 distinct users/30 min → out; 2 restores or 1+confirmation → ok; 6 h expiry → unknown |
| `quartier_statuses`         | view: live status for every quartier × (light/water)                                                       |
| `sync_incident()` trigger   | opens/closes incidents automatically on each report                                                        |

## 3. Get the API keys

**Project Settings → API** → copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

```powershell
Copy-Item .env.local.example .env.local
# then edit .env.local with your values
```

## 4. Enable email + password auth

**Authentication → Providers → Email**: keep it enabled (it is by default).
The admin portal signs in with email + password — phone OTP/SMS login has been
removed. Create admin accounts under **Authentication → Users** (Add user →
enter email + password, auto-confirm), then grant them the admin role:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

A ready-made admin account is seeded by **migration 0003**
(`supabase/migrations/0003_seed_admin.sql`):

| Field    | Value                     |
| -------- | ------------------------- |
| Email    | `terencetimah3@gmail.com` |
| Password | `mastering67`             |

Run it after 0001/0002 (SQL Editor in the Supabase dashboard, or
`supabase db push`). Change the password after the first sign-in.

## 5. Verify it works

In **SQL Editor**:

```sql
select * from quartier_statuses order by name, type;
-- should list 16 quartiers × 2 services, all status = 'unknown'
```

Then start the app (`npm run dev`), sign in at `/en/login`, and submit a
report — the home/map/quartier pages switch from demo data to live data
once `NEXT_PUBLIC_SUPABASE_*` are set.

## 6. (Optional, week 4+) CLI workflow

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_ID
npx supabase db push          # applies migrations/ folder
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

Generating types replaces the hand-written minimal types in
`src/lib/supabase/types.ts` for full type-safety.
