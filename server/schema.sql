create extension if not exists pgcrypto;

create type user_role as enum ('master', 'supervisor', 'consultant');
create type spk_status as enum ('open', 'closed', 'cancelled');
create type payment_method as enum ('cash', 'credit', 'cop');
create type prospect_status as enum ('pending', 'berhasil', 'gagal');

create table app_user (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  role user_role not null,
  supervisor_id uuid references app_user(id),
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  check ((role = 'consultant' and supervisor_id is not null) or role <> 'consultant')
);

create table spk (
  id uuid primary key default gen_random_uuid(),
  spk_number text not null unique,
  spk_date date not null,
  customer_name text not null,
  consultant_id uuid not null references app_user(id),
  supervisor_id uuid not null references app_user(id),
  client_type text not null check (client_type in ('retail', 'fleet')),
  phone text not null,
  car_type text not null,
  color text not null,
  quantity integer not null check (quantity > 0),
  deal_price numeric(18,2),
  same_as_otr boolean not null default false,
  payment payment_method not null,
  tenor_months integer,
  tdp numeric(18,2),
  insurance text,
  description text,
  bonus text not null,
  promise_from date not null,
  promise_to date not null,
  status spk_status not null default 'open',
  crm_done boolean not null default false,
  vin text,
  vin_allocated date,
  delivered boolean not null default false,
  delivered_date date,
  fully_paid boolean not null default false,
  delivery_planned boolean not null default false,
  refund_credit boolean not null default false,
  incentive_dms boolean not null default false,
  incentive_csi boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (promise_to >= promise_from),
  check (payment <> 'credit' or (tenor_months is not null and tdp is not null))
);

create table spk_document (
  id uuid primary key default gen_random_uuid(),
  spk_id uuid not null references spk(id) on delete cascade,
  kind text not null,
  private_object_key text not null unique,
  mime_type text not null,
  uploaded_at timestamptz not null default now()
);

create table prospect (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references app_user(id),
  name text not null,
  want text not null,
  stage text not null,
  status prospect_status not null default 'pending',
  created_by uuid not null references app_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table prospect_history (
  id bigserial primary key,
  prospect_id uuid not null references prospect(id) on delete cascade,
  want text not null,
  stage text not null,
  actor_id uuid not null references app_user(id),
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigserial primary key,
  actor_id uuid references app_user(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index spk_consultant_date_idx on spk (consultant_id, spk_date desc);
create index spk_supervisor_status_idx on spk (supervisor_id, status, spk_date desc);
create index prospect_consultant_status_idx on prospect (consultant_id, status, updated_at desc);
