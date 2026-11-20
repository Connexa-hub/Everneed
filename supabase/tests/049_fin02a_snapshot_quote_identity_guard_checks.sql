-- FIN-02A snapshot identity guard contract checks.
begin;
do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='guard_snapshot_v2_store_totals';
  if v_def is null or v_def not like '%financial_offer_id%'
     or v_def not like '%checkout_snapshot%'
     or v_def not like '%budget_reservation_ids%' then
    raise exception 'Snapshot guard does not validate quote/offer/reservation identity.';
  end if;
  if has_function_privilege('anon','private.guard_snapshot_v2_store_totals()','EXECUTE')
     or has_function_privilege('authenticated','private.guard_snapshot_v2_store_totals()','EXECUTE')
     or has_function_privilege('service_role','private.guard_snapshot_v2_store_totals()','EXECUTE') then
    raise exception 'Snapshot guard function is exposed to API roles.';
  end if;
  if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'
    and c.relname='order_financial_snapshots_v2' and t.tgname='order_financial_snapshot_v2_store_totals'
    and not t.tgisinternal) then
    raise exception 'Snapshot identity guard trigger missing.';
  end if;
end
$$;
rollback;
