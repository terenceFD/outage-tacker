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
