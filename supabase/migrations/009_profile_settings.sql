-- 009: appearance (and later, other personal settings) follow the customer across devices.
alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_settings_size;
alter table public.profiles add constraint profiles_settings_size check (pg_column_size(settings) <= 2000);
