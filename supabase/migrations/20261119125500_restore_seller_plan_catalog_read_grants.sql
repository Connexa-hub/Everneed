-- Restore the explicitly public seller-safe plan catalogue RPC grants.
-- The catalogue exposes only plan and entitlement fields intended for plan comparison.
begin;

revoke all on function public.seller_plan_catalog() from public;
grant execute on function public.seller_plan_catalog() to anon, authenticated;

commit;
