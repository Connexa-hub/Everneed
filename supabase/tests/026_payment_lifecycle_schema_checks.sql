-- Payment Lifecycle 026 schema checks.
-- Run only after 026_payment_lifecycle.sql has been reviewed and applied to a
-- disposable database or Everneed-staging. This test is read-only.
do $$
declare
  t text;
  v boolean;
begin
  foreach t in array array[
    'private.payment_attempts',
    'private.provider_event_inbox',
    'private.provider_refunds'
  ] loop
    if to_regclass(t) is null then
      raise exception 'FAIL: required relation % is missing', t;
    end if;
    select c.relrowsecurity into v
      from pg_class c where c.oid = to_regclass(t);
    if not coalesce(v, false) then
      raise exception 'FAIL: RLS is not enabled on %', t;
    end if;
    if has_table_privilege('anon', t, 'SELECT')
       or has_table_privilege('authenticated', t, 'SELECT')
       or has_table_privilege('service_role', t, 'SELECT') then
      raise exception 'FAIL: direct SELECT grant exists on %', t;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='orders'
      and column_name='checkout_snapshot'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='orders'
      and column_name='checkout_snapshot_version'
  ) then
    raise exception 'FAIL: checkout snapshot columns are missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.orders'::regclass
      and tgname='orders_checkout_snapshot_immutable'
      and not tgisinternal
  ) then
    raise exception 'FAIL: checkout snapshot immutability trigger is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='private' and indexname='payment_attempts_one_active_per_order_uq'
  ) then
    raise exception 'FAIL: one-active-attempt-per-order index is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='private.payment_attempts'::regclass
      and conname='payment_attempts_provider_reference_uq'
  ) then
    raise exception 'FAIL: provider reference uniqueness is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='private.provider_event_inbox'::regclass
      and conname='provider_event_inbox_provider_event_uq'
  ) then
    raise exception 'FAIL: provider event idempotency constraint is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='private.provider_refunds'::regclass
      and conname='provider_refunds_provider_idempotency_uq'
  ) then
    raise exception 'FAIL: provider refund idempotency constraint is missing';
  end if;
end
$$;

select 'PASS: Payment Lifecycle 026 schema structure, RLS and access checks' as result;
