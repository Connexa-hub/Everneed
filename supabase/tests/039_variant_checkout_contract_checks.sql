-- Variant-aware checkout contract and privilege regression checks. Run after migration 20261119042700.
begin;
do $$
declare
  col text;
  checkout_def text;
  snapshot_def text;
  cancel_def text;
  restore_def text;
begin
  foreach col in array array['variant_id','variant_sku','variant_options','inventory_reserved','inventory_restored'] loop
    if not exists(select 1 from information_schema.columns c where table_schema='public' and table_name='order_items' and c.column_name=col) then
      raise exception 'FAIL: order_items.% missing',col;
    end if;
  end loop;

  checkout_def:=pg_get_functiondef('public.create_order(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text)'::regprocedure);
  if checkout_def not ilike '%product_variants%' or checkout_def not ilike '%variant_id%'
     or checkout_def not ilike '%sale_price%' or checkout_def not ilike '%checkout_reservation%'
     or checkout_def not ilike '%allow_backorder%' or checkout_def not ilike '%min_order_qty%'
     or checkout_def not ilike '%max_order_qty%' then
    raise exception 'FAIL: checkout is missing variant validation, pricing, quantity rules or audited reservation';
  end if;
  if checkout_def not ilike '%Choose an option%' or checkout_def not ilike '%selected product option%' then
    raise exception 'FAIL: checkout does not reject missing/invalid variant selections';
  end if;
  if not has_function_privilege('service_role','public.create_order(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text)','EXECUTE')
    or has_function_privilege('anon','public.create_order(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text)','EXECUTE')
    or has_function_privilege('authenticated','public.create_order(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text)','EXECUTE') then
    raise exception 'FAIL: checkout RPC grants do not remain service-role-only';
  end if;

  snapshot_def:=pg_get_functiondef('public.create_order_with_snapshot(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)'::regprocedure);
  if snapshot_def not ilike '%variant_id%' or snapshot_def not ilike '%variant_options%' or snapshot_def not ilike '%variant_sku%' then
    raise exception 'FAIL: immutable payment snapshot omits variant identity/options/SKU';
  end if;

  cancel_def:=pg_get_functiondef('private.cancel_so(text,text,uuid,text)'::regprocedure);
  if cancel_def not ilike '%restore_variant_order_item%' or cancel_def not ilike '%stock_add%' then
    raise exception 'FAIL: cancellation must restore variant reservations and retain legacy restoration';
  end if;

  restore_def:=pg_get_functiondef('private.restore_variant_order_item(text)'::regprocedure);
  if restore_def not ilike '%for update%' or restore_def not ilike '%inventory_reserved%'
     or restore_def not ilike '%inventory_restored%' or restore_def not ilike '%cancellation_restoration%' then
    raise exception 'FAIL: variant restoration is not locked, audited and idempotent';
  end if;
  if has_function_privilege('anon','private.restore_variant_order_item(text)','EXECUTE')
    or has_function_privilege('authenticated','private.restore_variant_order_item(text)','EXECUTE') then
    raise exception 'FAIL: variant restore helper is callable by client roles';
  end if;
end $$;
rollback;
