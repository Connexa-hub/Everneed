-- FIN-02A immutable v2 snapshot storage boundary checks. No order fixtures.
begin;

do $$
declare v_failed boolean := false;
begin
  if to_regclass('private.order_financial_snapshots_v2') is null then
    raise exception 'Financial snapshot v2 storage table missing.';
  end if;
  if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname='order_financial_snapshots_v2'
      and t.tgname='order_financial_snapshot_v2_immutable' and not t.tgisinternal) then
    raise exception 'Immutable snapshot trigger missing.';
  end if;
  if has_table_privilege('anon','private.order_financial_snapshots_v2','SELECT')
     or has_table_privilege('authenticated','private.order_financial_snapshots_v2','SELECT')
     or has_table_privilege('service_role','private.order_financial_snapshots_v2','SELECT')
     or has_table_privilege('authenticated','private.order_financial_snapshots_v2','INSERT') then
    raise exception 'Snapshot table is exposed to API roles.';
  end if;
  if has_function_privilege('anon','public.persist_order_financial_snapshot_v2(text,jsonb,uuid[])','EXECUTE')
     or has_function_privilege('authenticated','public.persist_order_financial_snapshot_v2(text,jsonb,uuid[])','EXECUTE')
     or not has_function_privilege('service_role','public.persist_order_financial_snapshot_v2(text,jsonb,uuid[])','EXECUTE') then
    raise exception 'Snapshot persistence RPC ACL is incorrect.';
  end if;

  perform set_config('request.jwt.claim.role','service_role',true);
  v_failed := false;
  begin
    perform public.persist_order_financial_snapshot_v2(
      'no-such-order',
      jsonb_build_object('schema_version',1,'order_id','no-such-order','currency','NGN',
        'currency_exponent',2,'amounts',jsonb_build_object(),'items',jsonb_build_array(),
        'pricing',jsonb_build_object(),'policy',jsonb_build_object(),'store_allocations',jsonb_build_array()),
      '{}'
    );
  exception when others then
    if sqlerrm not like 'Snapshot v2 structure is incomplete.%' then raise; end if;
    v_failed := true;
  end;
  if not v_failed then raise exception 'Invalid snapshot structure was accepted.'; end if;
end
$$;

rollback;
