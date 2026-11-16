-- 034 regression checks. Read-only assertions; safe to run against staging after migration.
do $$
declare
  v_free_active boolean;
  v_starter_limit integer;
  v_growth_limit integer;
  v_pro_unlimited boolean;
  v_scope_count integer;
  v_submit_def text;
  v_guard_def text;\n  v_guard_security_definer boolean;
begin
  if to_regclass('public.seller_plan_entitlements') is null
    or to_regclass('public.seller_product_listing_events') is null then
    raise exception 'FAIL: seller entitlement/quota tables missing';
  end if;

  select active into v_free_active from public.store_plans where id='plan-free';
  if coalesce(v_free_active,true) then raise exception 'FAIL: Free plan must remain inactive until configured'; end if;

  select active_product_limit into v_starter_limit from public.seller_plan_entitlements where plan_id='plan-starter';
  select active_product_limit into v_growth_limit from public.seller_plan_entitlements where plan_id='plan-growth';
  select active_products_unlimited into v_pro_unlimited from public.seller_plan_entitlements where plan_id='plan-pro';
  if v_starter_limit<>25 or v_growth_limit<>200 or not coalesce(v_pro_unlimited,false) then
    raise exception 'FAIL: existing paid-tier limits were not preserved';
  end if;

  if exists(select 1 from public.seller_plan_entitlements where plan_id='plan-free'
    and (active_product_limit is not null or active_products_unlimited
      or daily_new_product_limit is not null or daily_new_products_unlimited)) then
    raise exception 'FAIL: Free limits must remain unconfigured';
  end if;

  select count(*) into v_scope_count from public.seller_verification_rules
    where requirement_scope='unclassified';
  if v_scope_count<1 then raise exception 'FAIL: existing verification rules should remain explicitly unclassified'; end if;

  select pg_get_functiondef('public.submit_store(text)'::regprocedure) into v_submit_def;
  if position('account_number' in v_submit_def)>0 or position('bank_name' in v_submit_def)>0
    or position('account_name' in v_submit_def)>0 then
    raise exception 'FAIL: seller application still depends on payout bank fields';
  end if;

  select pg_get_functiondef('private.products_guard()'::regprocedure) into v_guard_def;\n  select prosecdef into v_guard_security_definer from pg_proc where oid='private.products_guard()'::regprocedure;
  if not coalesce(v_guard_security_definer,false) then raise exception 'FAIL: product guard must execute with trusted access to private entitlement/event rows'; end if;\n  if position('seller_product_listing_events' in v_guard_def)=0
    or position('daily_new_product_limit' in v_guard_def)=0 then
    raise exception 'FAIL: product trigger does not enforce daily listing quota';
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
end $$;
