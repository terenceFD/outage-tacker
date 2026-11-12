-- ===== FROM FILE: 0001_initial_schema.sql =====
-- Outage Tracker — initial schema
-- From "outage tracker.pdf" §4 (data model) and §5 (status & abuse rules),
-- refined by "complete.pdf" §8.
--
-- Tables: quartiers, profiles, reports, confirmations, incidents,
--         push_subscriptions, ai_usage
-- Derivation: quartier status is NEVER stored by hand — computed by
--             public.quartier_status (SQL view helper, see bottom).
-- Security: RLS enabled on every table. User emails never exposed.

-- ============================================================
-- quartiers — seeded by hand (15 to 20 to start, PDF §9)
-- ============================================================
create table public.quartiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  unique (name, city)
);

-- ============================================================
-- profiles — tied 1:1 to auth.users (id = auth user id)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,                       -- from auth; stored here for admin display masked
  language text not null default 'en' check (language in ('en', 'fr')),
  home_quartier_id uuid references public.quartiers(id),
  role text not null default 'user' check (role in ('user', 'admin')),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles readable by owner and admins"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "users update own profile (not role)"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

-- Auto-create a profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone);
  return new;
end;
$$;

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

-- ============================================================
-- reports — one-tap and AI-chat reports
-- ============================================================
create table public.reports (
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

create index reports_recent_idx on public.reports (quartier_id, type, created_at desc);

alter table public.reports enable row level security;

create policy "anyone reads reports"
  on public.reports for select using (true);

create policy "verified users insert own reports"
  on public.reports for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles where id = auth.uid() and is_blocked
    )
  );

-- ============================================================
-- RATE LIMIT (PDF §5): one report per user per quartier per type
-- every 30 minutes — enforced HERE, not only in the UI.
-- ============================================================
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

-- ============================================================
-- confirmations — "Me too" (unique per user per report, PDF §4)
-- ============================================================
create table public.confirmations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create index confirmations_report_idx on public.confirmations (report_id);

alter table public.confirmations enable row level security;

create policy "anyone reads confirmations"
  on public.confirmations for select using (true);

create policy "verified users insert own confirmations"
  on public.confirmations for insert
  with check (
    auth.uid() = user_id
    and not exists (select 1 from public.profiles where id = auth.uid() and is_blocked)
  );

-- ============================================================
-- incidents — one per quartier outage period; drives durations & stats
-- ============================================================
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  quartier_id uuid not null references public.quartiers(id) on delete cascade,
  type text not null check (type in ('light', 'water')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,             -- null while ongoing
  created_at timestamptz not null default now()
);

create index incidents_open_idx on public.incidents (quartier_id, type, started_at desc);

alter table public.incidents enable row level security;

create policy "anyone reads incidents"
  on public.incidents for select using (true);

-- ============================================================
-- push_subscriptions (PDF §4)
-- ============================================================
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quartier_id uuid not null references public.quartiers(id) on delete cascade,
  type text not null check (type in ('light', 'water')),
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "users manage own subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- ai_usage — per-user AI request counter (PDF §6: ~10/hour limit)
-- ============================================================
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

create policy "users insert own usage records"
  on public.ai_usage for insert
  with check (auth.uid() = user_id);

create policy "users read own usage count"
  on public.ai_usage for select
  using (auth.uid() = user_id or public.is_admin());

-- ============================================================
-- STATUS DERIVATION (PDF §5) — the heart of the app.
-- Settings kept configurable per the PDF ("keep as a setting").
-- Thresholds: OUT >= 3 distinct users / 30 min (2 for small quartiers),
-- RESTORED >= 2 "back on" OR 1 with a confirmation,
-- UNKNOWN: out status expires after 6 h without activity.
-- ============================================================
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
    -- no signals at all → unknown
    when (select at from latest_out) is null
     and (select at from latest_restore) is null
      then 'unknown'

    -- a restore is newer than the latest out → check the restore rules
    when coalesce((select at from latest_restore), '-infinity')
       > coalesce((select at from latest_out), '-infinity')
      then case
        when (select n from restored_with_confirm) >= 1
          or (select n from restore_wave) >= 2
          then 'ok'
        else 'unknown'
      end

    -- out is the latest signal
    when (select n from distinct_out_users) >= greatest(p_out_threshold, 2)
      then case
        when (select at from latest_out) < now() - (p_expire_hours || ' hours')::interval
          then 'unknown'   -- expired: no fresh activity for 6 h
        else 'out'
      end

    -- 1–2 recent out reports below threshold
    else 'unconfirmed'
  end;
$$;

-- Convenience view: status for every quartier/type pair
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
  (select count(*) from public.incidents i
    where i.quartier_id = q.id and i.type = t.type
      and i.started_at > now() - interval '30 days'
      and i.ended_at is not null
      and i.type = 'light') as outage_minutes_30d
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

create trigger report_after_insert
  after insert on public.reports
  for each row execute function public.sync_incident();

-- ============================================================
-- Seed quartiers (PDF pilot areas: Bonamoussadi/Douala, Molyko/Buea + more)
-- ============================================================
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

-- ===== FROM FILE: 0002_subscriptions.sql =====
-- Outage Tracker — migration 0002
-- Brings the schema to full parity with "complete.pdf" §8 (Data Model):
--
--   subscriptions  id, user_id, quartier_id, type, channel (whatsapp/sms)
--
-- The original schema shipped a `push_subscriptions` table keyed on a web
-- push endpoint, which only covered in-browser notifications. The PDF's
-- alerts model is WhatsApp/SMS-based, so we add the `subscriptions` table
-- exactly as specified: one row per user × quartier × type × channel.
--
-- `push_subscriptions` is kept untouched for in-app/web-push alerts.

-- ============================================================
-- subscriptions (PDF §8: WhatsApp/SMS alert subscriptions)
-- ============================================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quartier_id uuid not null references public.quartiers(id) on delete cascade,
  type text not null check (type in ('light', 'water')),
  channel text not null check (channel in ('whatsapp', 'sms')),
  created_at timestamptz not null default now(),
  -- A user subscribes once per quartier/type/channel combination
  unique (user_id, quartier_id, type, channel)
);

create index subscriptions_user_idx on public.subscriptions (user_id);
create index subscriptions_target_idx on public.subscriptions (quartier_id, type, channel);

alter table public.subscriptions enable row level security;

create policy "users manage own subscriptions"
  on public.subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- profiles: record the email used at signup (the app now signs in
-- with email + password; phone is no longer collected, but the
-- column stays for legacy/masked display).
-- ============================================================
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

alter table public.profiles add column if not exists email text;

-- ===== FROM FILE: 0003_seed_admin.sql =====
-- Outage Tracker — migration 0003
-- Seeds the default admin account (email + password sign-in, PDF §4).
--
--   email:    terencetimah3@gmail.com
--   password: mastering67
--
-- SECURITY NOTE: change this password after the first sign-in
-- (Auth → Users → … → Send password recovery / reset), and never
-- reuse it outside local development.
--
-- Supabase auth.users requires a bcrypt hash; crypt(..., gen_salt('bf'))
-- produces exactly that. The profile trigger (handle_new_user, migration
-- 0002) creates the matching profile row; we then promote it to admin.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'terencetimah3@gmail.com',
  crypt('mastering67', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  ''
)
on conflict (email) do update
  set encrypted_password = crypt('mastering67', gen_salt('bf')),
      email_confirmed_at = now();

-- Promote the profile created by the signup trigger to admin.
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'terencetimah3@gmail.com');

