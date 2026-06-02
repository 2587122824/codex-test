-- Codex Sleep account and sync schema.
-- Run this in the Supabase SQL editor before enabling account sync in the app.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  phone_bound boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_sleep_timer_minutes integer not null default 30,
  default_playback_mode text not null default 'repeat-all',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, track_id)
);

create table if not exists public.play_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null,
  last_played_at timestamptz not null default now(),
  play_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, track_id)
);

create table if not exists public.sleep_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  sleep_at timestamptz,
  wake_at timestamptz,
  duration_minutes integer,
  rating integer check (rating is null or rating between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_favorites enable row level security;
alter table public.play_history enable row level security;
alter table public.sleep_logs enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_favorites_select_own" on public.user_favorites
  for select using (auth.uid() = user_id);
create policy "user_favorites_insert_own" on public.user_favorites
  for insert with check (auth.uid() = user_id);
create policy "user_favorites_update_own" on public.user_favorites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "play_history_select_own" on public.play_history
  for select using (auth.uid() = user_id);
create policy "play_history_insert_own" on public.play_history
  for insert with check (auth.uid() = user_id);
create policy "play_history_update_own" on public.play_history
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sleep_logs_select_own" on public.sleep_logs
  for select using (auth.uid() = user_id);
create policy "sleep_logs_insert_own" on public.sleep_logs
  for insert with check (auth.uid() = user_id);
create policy "sleep_logs_update_own" on public.sleep_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
