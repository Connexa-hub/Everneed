-- Seller onboarding, plan catalogue and quota regression checks.
-- Read-only assertions; safe to run after the staging migrations.
do $$
declare
  v_free_active boolean;
  v_free_active_limit integer;
  v_free_daily_limit integer;
  v_starter_limit integer;
  v_growth_limit integer;
  v_pro_unlimited boolean;
  v_submit_def text;
  v_guard_def text;
  v_approval_def text;
  v_catalog_def text;
  v_guard_security_definer boolean;
  v_catalog_count integer;
  v_catalog_result text;
begin
  if to_regclass('public.seller_plan_entitlements') is null
    or to_regclass('public.seller_product_listing_events') is null then
    raise exception 'FAIL: seller entitlement/quota tables missing';
  end if;

  select active into v_free_active from public.store_plans where id='plan-free';
  select active_product_limit,daily_new_product_limit
    into v_free_active_limit,v_free_daily_limit
    from public.seller_plan_entitlements where plan_id='plan-free';
  if not coalesce(v_free_active,false) or v_free_active_limit<>5 or v_free_daily_limit<>2 then
    raise exception 'FAIL: Free plan must be active with 5 active products and 2 daily listings';
  end if;

  select active_product_limit into v_starter_limit from public.seller_plan_entitlements where plan_id='plan-starter';
  select active_product_limit into v_growth_limit from public.seller_plan_entitlements where plan_id='plan-growth';
  select active_products_unlimited into v_pro_unlimited from public.seller_plan_entitlements where plan_id='plan-pro';
  if v_starter_limit<>25 or v_growth_limit<>200 or not coalesce(v_pro_unlimited,false) then
    raise exception 'FAIL: existing paid-tier product limits were not preserved';
  end if;

  if exists (
    select 1 from public.seller_plan_entitlements
    where plan_id='plan-free'
      and (active_products_unlimited or daily_new_products_unlimited
        or verification_included or verification_required_to_activate)
  ) then
    raise exception 'FAIL: Free must remain bounded and must not require commercial verification';
  end if;

  if exists (
    select 1 from public.seller_plan_entitlements
    where plan_id in ('plan-growth','plan-pro')
      and (not verification_included or not verification_required_to_activate)
  ) then
    raise exception 'FAIL: Growth and Pro must retain included/required commercial verification';
  end if;

  select pg_get_functiondef('public.submit_store(text)'::regprocedure) into v_submit_def;
  if position('account_number' in v_submit_def)>0
    or position('bank_name' in v_submit_def)>0
    or position('account_name' in v_submit_def)>0 then
    raise exception 'FAIL: seller application still depends on payout bank fields';
  end if;

  select pg_get_functiondef('private.products_guard()'::regprocedure) into v_guard_def;
  select prosecdef into v_guard_security_definer
    from pg_proc where oid='private.products_guard()'::regprocedure;
  if not coalesce(v_guard_security_definer,false) then
    raise exception 'FAIL: product guard must execute with trusted access to private entitlement/event rows';
  end if;
  if position('seller_product_listing_events' in v_guard_def)=0
    or position('daily_new_product_limit' in v_guard_def)=0 then
    raise exception 'FAIL: product trigger does not enforce daily listing quota';
  end if;

  select pg_get_functiondef('public.approve_store(text,text)'::regprocedure) into v_approval_def;
  if position('a.plan_id' in v_approval_def)=0
    or position('must choose a plan' in lower(v_approval_def))=0 then
    raise exception 'FAIL: approve_store does not require and assign the seller-selected plan';
  end if;

  if to_regprocedure('public.seller_plan_catalog()') is null then
    raise exception 'FAIL: seller_plan_catalog RPC missing';
  end if;
  select pg_get_functiondef('public.seller_plan_catalog()'::regprocedure) into v_catalog_def;
  select pg_get_function_result('public.seller_plan_catalog()'::regprocedure) into v_catalog_result;
  if position('seller_plan_entitlements' in v_catalog_def)=0
    or position('verification_required_to_activate' in v_catalog_result)=0
    or position('daily_new_product_limit' in v_catalog_result)=0 then
    raise exception 'FAIL: seller plan catalogue is missing quota or verification fields';
  end if;
  if not has_function_privilege('anon','public.seller_plan_catalog()','EXECUTE')
    or not has_function_privilege('authenticated','public.seller_plan_catalog()','EXECUTE') then
    raise exception 'FAIL: seller plan catalogue read grants missing';
  end if;
  select count(*) into v_catalog_count from public.seller_plan_catalog();
  if v_catalog_count<4 then
    raise exception 'FAIL: seller plan catalogue should return all four active tiers';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='seller_plan_entitlements'
      and policyname='seller_plan_entitlements_admin_read'
      and qual like '%is_admin%'
  ) then
    raise exception 'FAIL: direct entitlement-table reads are not restricted to admins by RLS';
  end if;

  if has_function_privilege('anon',
    'public.admin_set_plan_entitlements(text,integer,boolean,integer,boolean,boolean,text)','EXECUTE') then
    raise exception 'FAIL: anon can execute admin entitlement mutation';
  end if;
  if not has_function_privilege('authenticated',
    'public.admin_set_plan_entitlements(text,integer,boolean,integer,boolean,boolean,text)','EXECUTE') then
    raise exception 'FAIL: authenticated admin RPC grant missing';
  end if;
  if not has_function_privilege('authenticated','public.my_store_entitlements()','EXECUTE') then
    raise exception 'FAIL: seller entitlement read RPC grant missing';
  end if;
end
$$;
