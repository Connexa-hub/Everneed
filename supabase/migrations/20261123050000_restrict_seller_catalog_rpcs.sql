-- The plan catalogue is intentionally public: shoppers and prospective sellers can
-- compare published tiers before signing in. The category editor schema is seller-only.
-- Keep the plan catalogue inside the explicit public SECURITY DEFINER allowlist.
grant execute on function public.seller_plan_catalog() to anon;
revoke execute on function public.seller_product_category_schema(text) from anon;

grant execute on function public.seller_plan_catalog() to authenticated;
grant execute on function public.seller_product_category_schema(text) to authenticated;
