-- Keep historical users as tombstones so SPKs, prospects, and audits retain their links.
alter table app_user add column if not exists deleted_at timestamptz;
alter table app_user drop constraint if exists app_user_check;
alter table spk alter column supervisor_id drop not null;
alter table spk add column if not exists plan_do_date date;
