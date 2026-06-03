-- Alibaba Cloud RDS PostgreSQL schema for 古德眠 account sync.
-- Run this in the app database before deploying Function Compute handlers.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  nickname text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists auth_sms_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  request_id text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_sms_codes_phone_created_idx
  on auth_sms_codes (phone, created_at desc);

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  access_token_hash text not null unique,
  refresh_token_hash text unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_sessions_user_idx
  on auth_sessions (user_id, created_at desc);

create table if not exists user_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  default_sleep_timer_minutes integer not null default 0,
  theme_mode text not null default 'system' check (theme_mode in ('system', 'dark', 'light')),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists user_favorites (
  user_id uuid not null references profiles(id) on delete cascade,
  track_id text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, track_id)
);

create index if not exists user_favorites_user_updated_idx
  on user_favorites (user_id, updated_at desc);

create table if not exists play_history (
  user_id uuid not null references profiles(id) on delete cascade,
  track_id text not null,
  last_played_at timestamptz not null default now(),
  play_count integer not null default 1,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, track_id)
);

create index if not exists play_history_user_last_played_idx
  on play_history (user_id, last_played_at desc);

create table if not exists sleep_logs (
  id text not null,
  user_id uuid not null references profiles(id) on delete cascade,
  sleep_at timestamptz,
  wake_at timestamptz,
  duration_minutes integer,
  rating integer check (rating between 1 and 5),
  note text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create index if not exists sleep_logs_user_wake_idx
  on sleep_logs (user_id, wake_at desc);
