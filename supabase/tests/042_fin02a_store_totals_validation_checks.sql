-- FIN-02A store-summary validator tests.
begin;

do $$
declare v_good jsonb; v_stores jsonb; v_bad boolean := false;
begin
  v_good := jsonb_build_array(
    jsonb_build_object('store_id','store-1','gross_minor',1000,'seller_discount_minor',100,
      'platform_discount_minor',50,'commission_minor',90,'seller_payable_minor',810),
    jsonb_build_object('store_id','store-1','gross_minor',500,'seller_discount_minor',0,
      'platform_discount_minor',0,'commission_minor',50,'seller_payable_minor',450),
    jsonb_build_object('store_id','store-2','gross_minor',2000,'seller_discount_minor',0,
      'platform_discount_minor',200,'commission_minor',200,'seller_payable_minor',1800)
  );
  v_stores := jsonb_build_array(
    jsonb_build_object('store_id','store-1','gross_minor',1500,'seller_funded_discount_minor',100,
      'platform_funded_discount_minor',50,'commission_minor',140,'seller_payable_minor',1260),
    jsonb_build_object('store_id','store-2','gross_minor',2000,'seller_funded_discount_minor',0,
      'platform_funded_discount_minor',200,'commission_minor',200,'seller_payable_minor',1800)
  );
  if not private.validate_snapshot_v2_store_totals(v_good,v_stores) then
    raise exception 'Valid store totals were rejected.';
  end if;
  v_bad := false;
  begin
    perform private.validate_snapshot_v2_store_totals(v_good,
      jsonb_set(v_stores,'{0,gross_minor}','999'::jsonb));
  exception when others then v_bad := true;
  end;
  if not v_bad then raise exception 'Mismatched store totals were accepted.'; end if;
  if has_function_privilege('anon','private.validate_snapshot_v2_store_totals(jsonb,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','private.validate_snapshot_v2_store_totals(jsonb,jsonb)','EXECUTE')
     or has_function_privilege('service_role','private.validate_snapshot_v2_store_totals(jsonb,jsonb)','EXECUTE') then
    raise exception 'Internal store validator is executable by API roles.';
  end if;
  if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname='order_financial_snapshots_v2'
      and t.tgname='order_financial_snapshot_v2_store_totals' and not t.tgisinternal) then
    raise exception 'Store totals trigger missing.';
  end if;
end
$$;

rollback;
