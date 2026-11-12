-- 024: structured public details for each seller storefront.
-- These fields are intentionally public-facing; identity evidence and private contact data
-- remain in store_private / verification tables and must never be placed here.
alter table public.stores
  add column if not exists storefront_details jsonb not null default '{}'::jsonb;

alter table public.stores
  drop constraint if exists stores_storefront_details_size;

alter table public.stores
  add constraint stores_storefront_details_size
  check (pg_column_size(storefront_details) <= 8192);
