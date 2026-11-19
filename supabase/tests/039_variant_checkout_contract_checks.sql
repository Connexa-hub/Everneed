-- Variant checkout contract checks. Run after migration 039.
begin;
do $$
declare
  checkout_def text;
  snapshot_def text;
  cancel_def text;
begin
  foreach missing_message in array array['variant_id','variant_sku','variant_options','inventory_reserved','inventory_restored'] loop
    if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='order_items' and column_name=missing_message) then
      raise exception 'FAIL: order_items.% missing',missing_message;
    end if;
  end loop;
  checkout_def:=pg_get_functiondef('public.create_order(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text)'::regprocedure);
  if checkout_def not ilike '%product_variants%' or checkout_def not ilike '%variant_id%' or checkout_def not ilike '%sale_price%' or checkout_def not ilike '%inventory_reason%' then
    raise exception 'FAIL: checkout function is not variant-aware / audited';
  end if;
  snapshot_def:=pg_get_functiondef('public.create_order_with_snapshot(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)'::regprocedure);
  if snapshot_def not ilike '%variant_options%' or snapshot_def not ilike '%variant_sku%' then
    raise exception 'FAIL: immutable payment snapshot omits variant identity/options';
  end if;
  cancel_def:=pg_get_functiondef('private.cancel_so(text,text,uuid,text)'::regprocedure);
  if cancel_def not ilike '%restore_variant_order_item%' then
    raise exception 'FAIL: seller-order cancellation does not restore variant reservations';
  end if;
  if has_function_privilege('anon','private.restore_variant_order_item(text)','EXECUTE')
    or has_function_privilege('authenticated','private.restore_variant_order_item(text)','EXECUTE') then
    raise exception 'FAIL: variant restore helper is callable by client roles';
  end if;
end $$;
rollback;
