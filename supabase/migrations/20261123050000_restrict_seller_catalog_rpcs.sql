-- Seller plan and category catalogues are seller-workspace RPCs, not anonymous APIs.
-- Preserve authenticated access while removing the explicit anon grants that bypass
-- the six-function public SECURITY DEFINER allowlist in test 017.
revoke execute on function public.seller_plan_catalog() from anon;
revoke execute on function public.seller_product_category_schema(text) from anon;

grant execute on function public.seller_plan_catalog() to authenticated;
grant execute on function public.seller_product_category_schema(text) to authenticated;
