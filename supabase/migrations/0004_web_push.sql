-- ============================================================
-- Outage Tracker — migration 0004
-- Aligns the DB with "final.pdf" (Development Brief):
--   §2 "Alerts: Web Push (web-push library, VAPID keys)" — the paid
--   WhatsApp/SMS `subscriptions` table is retired; browser push lives
--   in `push_subscriptions` (already present in 0001's base schema).
--   §2/§6 "ai_usage — counts AI requests for the per-user limit"
--
-- Idempotent: safe to run twice.
-- ============================================================

-- The WhatsApp/SMS subscriptions model came from the earlier summary.pdf.
-- final.pdf puts WhatsApp/SMS alerts OUT of the MVP (paid channels), so the
-- table is dropped. Existing rows are removed with it — web push replaces
-- them. (Keep the statement guarded: only drop if it exists.)
drop table if exists public.subscriptions cascade;

-- Ensure the web-push table exists with the final.pdf §4 shape:
-- id, user_id, quartier_id, type, endpoint, keys
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quartier_id uuid not null references public.quartiers(id) on delete cascade,
  type text not null check (type in ('light', 'water')),
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_target_idx
  on public.push_subscriptions (quartier_id, type);

alter table public.push_subscriptions enable row level security;

drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ai_usage — per-user AI request counter (final.pdf §4 + §6 "Limit to about
-- 10 AI requests per user per hour")
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_idx on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;

drop policy if exists "users insert own ai usage" on public.ai_usage;
create policy "users insert own ai usage"
  on public.ai_usage for insert
  with check (auth.uid() = user_id);
