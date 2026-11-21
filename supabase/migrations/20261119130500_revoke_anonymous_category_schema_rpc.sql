-- Keep seller category schema available to authenticated sellers, not anonymous callers.
-- The RPC returns seller tooling metadata and is not part of the public storefront API.
revoke all on function public.seller_product_category_schema(text) from public, anon;
grant execute on function public.seller_product_category_schema(text) to authenticated, service_role;
