-- FIN-02A checkout integration boundary regression checks.
begin;
do $$
declare v_rejected boolean := false; v_result jsonb;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='orders' and column_name='financial_offer_id') then
    raise exception 'Offer identity column is missing.';
  end if;
  if not has_function_privilege('service_role',
    'public.create_order_with_financial_snapshot_v2(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)','EXECUTE')
     or has_function_privilege('anon',
    'public.create_order_with_financial_snapshot_v2(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated',
    'public.create_order_with_financial_snapshot_v2(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)','EXECUTE') then
    raise exception 'New checkout wrapper permissions are incorrect.';
  end if;
  if has_function_privilege('service_role','private.build_order_financial_snapshot_v2(text)','EXECUTE')
     or has_function_privilege('authenticated','private.build_order_financial_snapshot_v2(text)','EXECUTE') then
    raise exception 'Internal v2 builder is directly callable by API roles.';
  end if;

  v_rejected := false;
  begin
    perform private.build_order_financial_snapshot_v2('missing-order-fixture');
  exception when no_data_found then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Builder unexpectedly accepted a missing order.'; end if;

  v_result := private.allocate_order_financial_items_v2(
    jsonb_build_array(jsonb_build_object(
      'order_item_id','item-1','store_id','store-1','gross_minor',10000,
      'commission_rate',10,'seller_funding_bps',0,'platform_funding_bps',10000
    )),8000);
  if (v_result->>'platform_funded_discount_minor')::bigint <> 2000
     or (v_result->>'seller_payable_minor')::bigint <> 9000
     or (v_result->>'commission_minor')::bigint <> 1000 then
    raise exception 'Platform-funded discount allocation did not reconcile.';
  end if;
end
$$;
rollback;
