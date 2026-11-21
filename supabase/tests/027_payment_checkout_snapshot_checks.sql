-- Read-only structural checks for migration 027.
-- Run only after 027 is explicitly applied to Everneed-staging.
do $$
declare
  v_fn regprocedure;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='orders'
      and column_name='checkout_snapshot_hash' and data_type='text'
  ) then
    raise exception 'Missing orders.checkout_snapshot_hash';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.orders'::regclass
      and tgname='orders_checkout_snapshot_immutable' and not tgisinternal
  ) then
    raise exception 'Missing checkout snapshot immutability trigger';
  end if;

  v_fn := to_regprocedure(
    'public.create_order_with_snapshot(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)'
  );
  if v_fn is null then
    raise exception 'Missing public.create_order_with_snapshot';
  end if;

  if has_function_privilege('anon', v_fn, 'EXECUTE')
     or has_function_privilege('authenticated', v_fn, 'EXECUTE') then
    raise exception 'Client role can execute service-only snapshot order creation';
  end if;

  if not has_function_privilege('service_role', v_fn, 'EXECUTE') then
    raise exception 'service_role cannot execute snapshot order creation';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.oid=v_fn and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
  ) then
    raise exception 'Snapshot order wrapper is not SECURITY DEFINER with explicit search_path';
  end if;
end
$$;

select
  (select count(*) from public.orders
    where checkout_snapshot is not null
      and checkout_snapshot_hash is not null) as orders_with_snapshot_and_hash,
  (select count(*) from public.orders
    where (checkout_snapshot is null) <> (checkout_snapshot_hash is null)) as incomplete_snapshot_hash_pairs;
