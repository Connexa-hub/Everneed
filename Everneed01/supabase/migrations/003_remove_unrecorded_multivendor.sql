-- 003: remove objects that two unrecorded migrations (multivendor_foundation,
-- multivendor_function_grants_hardening) had added to the Everneed01 database
-- without matching files in this repo. All of these tables were empty.
drop table if exists public.fulfilment_batches, public.seller_orders, public.order_items, public.store_members, public.stores cascade;
drop function if exists public.is_store_member(text);
drop function if exists public.owns_store(text);
drop index if exists public.products_store_id_idx;
alter table public.products drop column if exists store_id;
