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
