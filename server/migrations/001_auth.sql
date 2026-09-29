-- Run once after schema.sql. Do not run this against the Android demo data.
create table if not exists refresh_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists refresh_session_user_idx on refresh_session (user_id, expires_at);

create table if not exists login_attempt (
  key_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);

alter table audit_log add column if not exists source_ip text;
alter table audit_log add column if not exists user_agent text;

create unique index if not exists app_user_username_ci_idx on app_user (lower(username));
create unique index if not exists spk_number_ci_idx on spk (lower(spk_number));
