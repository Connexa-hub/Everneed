-- 025: let sellers save the public storefront details (opening hours, returns, delivery, contact links).
--
-- Migration 024 added stores.storefront_details and its size limit but never granted the column to signed-in users,
-- so every save from the seller setup screen ("Store page details") was refused with "permission denied".
--
-- Column-level grants, on purpose: sellers still cannot write status, slug, activation_status, is_official, approved_at
-- or any other column that was not already granted. Row-level security still decides which row an owner may change.
-- The 8 KB size limit from 024 still applies. These details are public, so nothing private belongs in them.

grant insert (storefront_details) on public.stores to authenticated;
grant update (storefront_details) on public.stores to authenticated;
