-- ============================================================
-- Outage Tracker — FULL SCHEMA (run once in Supabase SQL Editor)
-- Per "complete.pdf" §8 (Data Model) + §6 (Data Flows).
-- Idempotent: safe to run twice.
--
-- Tables: quartiers, profiles, reports, confirmations, incidents,
--         subscriptions, push_subscriptions, ai_usage
-- Functions: insert_report (rate-limited), compute_quartier_status,
--            sync_incident trigger, handle_new_user trigger
-- Views:    quartier_statuses (live status per quartier × service)
--
-- After running this, run 0003_seed_admin.sql separately (it touches
-- auth.users, which normal SQL editor runs CAN do when pasted manually).
-- ============================================================

-- ------------------------------------------------------------
-- quartiers — approved neighbourhood directory (PDF §8)
-- ------------------------------------------------------------
create table if not exists public.quartiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  unique (name, city)
);

alter table public.quartiers enable row level security;

-- Public directory: everyone can read, only admins can mutate
drop policy if exists "quartiers public read" on public.quartiers;
create policy "quartiers public read"
  on public.quartiers for select using (true);

drop policy if exists "quartiers admin write" on public.quartiers;
create policy "quartiers admin write"
  on public.quartiers for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  email text,
  language text not null default 'en' check (language in ('en', 'fr')),
  home_quartier_id uuid references public.quartiers(id),
  role text not null default 'user' check (role in ('user', 'admin')),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by owner and admins" on public.profiles;
create policy "profiles readable by owner and admins"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "users update own profile (not role)" on public.profiles;
create policy "users update own profile (not role)"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

-- Auto-create/update a profile row whenever an auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is the current user an active admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and not is_blocked
  );
$$;

-- ------------------------------------------------------------
-- reports — one-tap and AI-chat reports (PDF §8)
-- ------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quartier_id uuid not null references public.quartiers(id) on delete cascade,
  type text not null check (type in ('light', 'water')),
  status text not null check (status in ('out', 'restored')),
  created_at timestamptz not null default now(),
  source text not null default 'app' check (source in ('app', 'chat')),
  raw_text text,
  ai_confidence numeric(3, 2) check (ai_confidence between 0 and 1)
);

create index if not exists reports_recent_idx
  on public.reports (quartier_id, type, created_at desc);
create index if not exists reports_user_idx on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "anyone reads reports" on public.reports;
create policy "anyone reads reports"
  on public.reports for select using (true);

drop policy if exists "verified users insert own reports" on public.reports;
create policy "verified users insert own reports"
  on public.reports for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles where id = auth.uid() and is_blocked
    )
  );

-- ------------------------------------------------------------
-- RATE LIMIT (PDF §5 / complete.pdf §6-B step 4):
-- one report per user per quartier per type every 30 minutes,
-- enforced in the DATABASE, not only in the browser.
-- ------------------------------------------------------------
create or replace function public.insert_report(
  p_quartier_id uuid,
  p_type text,
  p_status text,
  p_source text default 'app',
  p_raw_text text default null,
  p_ai_confidence numeric default null
)
returns public.reports
language plpgsql
security definer set search_path = public
as $$
declare
  v_report public.reports;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and is_blocked) then
    raise exception 'account blocked' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.reports
    where user_id = auth.uid()
      and quartier_id = p_quartier_id
      and type = p_type
      and created_at > now() - interval '30 minutes'
  ) then
    raise exception 'rate limit: one report per quartier per type every 30 minutes'
      using errcode = 'P0001';
  end if;

  insert into public.reports (user_id, quartier_id, type, status, source, raw_text, ai_confidence)
  values (auth.uid(), p_quartier_id, p_type, p_status, p_source, p_raw_text, p_ai_confidence)
  returning * into v_report;

  return v_report;
end;
$$;

-- ------------------------------------------------------------
-- confirmations — "Me too" (unique per user per report, complete.pdf §8:
-- "Add a unique constraint on (report_id, user_id)")
-- ------------------------------------------------------------
create table if not exists public.confirmations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create index if not exists confirmations_report_idx on public.confirmations (report_id);

alter table public.confirmations enable row level security;

drop policy if exists "anyone reads confirmations" on public.confirmations;
create policy "anyone reads confirmations"
  on public.confirmations for select using (true);

drop policy if exists "verified users insert own confirmations" on public.confirmations;
create policy "verified users insert own confirmations"
  on public.confirmations for insert
  with check (
    auth.uid() = user_id
    and not exists (select 1 from public.profiles where id = auth.uid() and is_blocked)
  );

-- ------------------------------------------------------------
-- incidents — one per quartier outage period; drives durations & stats
-- ------------------------------------------------------------
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  quartier_id uuid not null references public.quartiers(id) on delete cascade,
  type text not null check (type in ('light', 'water')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists incidents_open_idx
  on public.incidents (quartier_id, type, started_at desc);

alter table public.incidents enable row level security;

drop policy if exists "anyone reads incidents" on public.incidents;
create policy "anyone reads incidents"
  on public.incidents for select using (true);

-- ------------------------------------------------------------
-- subscriptions — WhatsApp/SMS alerts (complete.pdf §8)
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quartier_id uuid not null references public.quartiers(id) on delete cascade,
  type text not null check (type in ('light', 'water')),
  channel text not null check (channel in ('whatsapp', 'sms')),
  created_at timestamptz not null default now(),
  unique (user_id, quartier_id, type, channel)
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists subscriptions_target_idx
  on public.subscriptions (quartier_id, type, channel);

alter table public.subscriptions enable row level security;

drop policy if exists "users manage own subscriptions" on public.subscriptions;
create policy "users manage own subscriptions"
  on public.subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- push_subscriptions — in-browser web push (kept alongside)
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quartier_id uuid not null references public.quartiers(id) on delete cascade,
  type text not null check (type in ('light', 'water')),
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- ai_usage — per-user AI request counter (PDF §6 cost guardrail)
-- ------------------------------------------------------------
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "users insert own usage records" on public.ai_usage;
create policy "users insert own usage records"
  on public.ai_usage for insert
  with check (auth.uid() = user_id);

drop policy if exists "users read own usage count" on public.ai_usage;
create policy "users read own usage count"
  on public.ai_usage for select
  using (auth.uid() = user_id or public.is_admin());

-- ------------------------------------------------------------
-- STATUS DERIVATION (PDF §5) — the heart of the app.
-- ≥3 distinct users / 30 min → out; 2 restores or 1 restore+confirmation → ok;
-- out expires after 6 h without activity → unknown.
-- ------------------------------------------------------------
create or replace function public.compute_quartier_status(
  p_quartier_id uuid,
  p_type text,
  p_out_threshold int default 3,
  p_expire_hours int default 6
)
returns text
language sql
stable
as $$
  with recent as (
    select r.*,
           (select count(*) from public.confirmations c where c.report_id = r.id) as confirmations
    from public.reports r
    where r.quartier_id = p_quartier_id
      and r.type = p_type
      and r.created_at > now() - interval '12 hours'
  ),
  latest_out as (
    select max(created_at) as at from recent where status = 'out'
  ),
  latest_restore as (
    select max(created_at) as at from recent where status = 'restored'
  ),
  distinct_out_users as (
    select count(distinct user_id) as n
    from recent
    where status = 'out'
      and created_at > now() - interval '30 minutes'
  ),
  restored_with_confirm as (
    select count(*) as n
    from recent
    where status = 'restored'
      and (created_at > now() - interval '30 minutes' or confirmations >= 1)
  ),
  restore_wave as (
    select count(*) as n
    from recent
    where status = 'restored'
      and created_at > coalesce((select at from latest_out), '-infinity')
  )
  select case
    when (select at from latest_out) is null
     and (select at from latest_restore) is null
      then 'unknown'

    when coalesce((select at from latest_restore), '-infinity')
       > coalesce((select at from latest_out), '-infinity')
      then case
        when (select n from restored_with_confirm) >= 1
          or (select n from restore_wave) >= 2
          then 'ok'
        else 'unknown'
      end

    when (select n from distinct_out_users) >= greatest(p_out_threshold, 2)
      then case
        when (select at from latest_out) < now() - (p_expire_hours || ' hours')::interval
          then 'unknown'
        else 'out'
      end

    else 'unconfirmed'
  end;
$$;

-- Convenience view: status for every quartier × service pair
create or replace view public.quartier_statuses as
select
  q.id as quartier_id,
  q.name,
  q.city,
  q.lat,
  q.lng,
  t.type,
  public.compute_quartier_status(q.id, t.type) as status,
  coalesce(o.reports_30m, 0) as reports_30m,
  coalesce(o.confirmed_count, 0) as confirmed_count,
  o.latest_at,
  (select coalesce(sum(extract(epoch from (i.ended_at - i.started_at))) / 60, 0)
     from public.incidents i
     where i.quartier_id = q.id and i.type = t.type
       and i.started_at > now() - interval '30 days'
       and i.ended_at is not null) as outage_minutes_30d
from public.quartiers q
cross join (values ('light'), ('water')) as t(type)
left join lateral (
  select
    count(*) filter (where r.created_at > now() - interval '30 minutes') as reports_30m,
    count(*) filter (where r.status = 'out') as confirmed_count,
    max(r.created_at) as latest_at
  from public.reports r
  where r.quartier_id = q.id and r.type = t.type
    and r.created_at > now() - interval '12 hours'
) o on true;

-- Open/close incidents automatically after each report
create or replace function public.sync_incident()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_status text;
  v_open uuid;
begin
  select compute_quartier_status(new.quartier_id, new.type) into v_status;

  select id into v_open from public.incidents
  where quartier_id = new.quartier_id and type = new.type and ended_at is null
  order by started_at desc limit 1;

  if v_status = 'out' and v_open is null then
    insert into public.incidents (quartier_id, type) values (new.quartier_id, new.type);
  elsif v_status in ('ok', 'unknown') and v_open is not null then
    update public.incidents set ended_at = now() where id = v_open;
  end if;

  return new;
end;
$$;

drop trigger if exists report_after_insert on public.reports;
create trigger report_after_insert
  after insert on public.reports
  for each row execute function public.sync_incident();

-- ------------------------------------------------------------
-- Seed quartiers (PDF pilot areas, 16 quartiers)
-- ------------------------------------------------------------
insert into public.quartiers (name, city, lat, lng) values
  ('Bonamoussadi', 'Douala', 4.0943, 9.7419),
  ('Akwa', 'Douala', 4.0483, 9.7047),
  ('Bepanda', 'Douala', 4.0728, 9.7322),
  ('Deido', 'Douala', 4.0661, 9.7157),
  ('Bonabéri', 'Douala', 4.0750, 9.6900),
  ('Logbaba', 'Douala', 4.0360, 9.7670),
  ('Makepe', 'Douala', 4.1080, 9.7460),
  ('Bonapriso', 'Douala', 4.0390, 9.6930),
  ('Molyko', 'Buea', 4.1554, 9.2411),
  ('Mile 16', 'Buea', 4.1470, 9.2330),
  ('Bomaka', 'Buea', 4.1440, 9.2550),
  ('Great Soppo', 'Buea', 4.1417, 9.2569),
  ('Muea', 'Buea', 4.1620, 9.2650),
  ('Bastos', 'Yaoundé', 3.8980, 11.5200),
  ('Odza', 'Yaoundé', 3.8410, 11.5230),
  ('Biyem-Assi', 'Yaoundé', 3.8440, 11.4940)
on conflict (name, city) do nothing;
