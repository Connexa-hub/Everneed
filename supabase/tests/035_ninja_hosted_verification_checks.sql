-- Ninja hosted verification schema and security regression checks.
-- Read-only assertions; safe to run after the Ninja staging migrations.
do $$
declare
  v_check_types text[];
  v_rls boolean;
begin
  if to_regclass('public.ninja_webhook_events') is null then
    raise exception 'FAIL: public.ninja_webhook_events is missing';
  end if;
  if to_regclass('private.ninja_webhook_events') is null then
    raise exception 'FAIL: private webhook audit table is missing';
  end if;

  select relrowsecurity into v_rls
  from pg_class where oid='public.ninja_webhook_events'::regclass;
  if not coalesce(v_rls,false) then
    raise exception 'FAIL: webhook event table RLS must be enabled';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='ninja_webhook_events'
  ) then
    raise exception 'FAIL: webhook event table must not expose client RLS policies';
  end if;

  if has_table_privilege('anon','public.ninja_webhook_events','SELECT')
    or has_table_privilege('authenticated','public.ninja_webhook_events','SELECT') then
    raise exception 'FAIL: anonymous/authenticated roles must not read webhook events';
  end if;
  if not has_table_privilege('service_role','public.ninja_webhook_events','INSERT')
    or not has_table_privilege('service_role','public.ninja_webhook_events','UPDATE') then
    raise exception 'FAIL: service_role webhook event privileges missing';
  end if;

  select array_agg(x) into v_check_types
  from unnest(array['phone','identity','face_liveness','business_address','business_registration']) x
  where exists (
    select 1 from pg_constraint c
    where c.conrelid='public.store_verification_checks'::regclass
      and c.conname='store_verification_checks_check_type_check'
      and pg_get_constraintdef(c.oid) like '%' || x || '%'
  );
  if cardinality(v_check_types) <> 5 then
    raise exception 'FAIL: verification check types are incomplete';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='store_verification_checks'
      and indexname='store_verification_checks_provider_verification_check_uidx'
  ) then
    raise exception 'FAIL: provider verification composite dedupe index missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='store_verification_checks'
      and cmd='SELECT' and qual like '%owns_store%'
  ) then
    raise exception 'FAIL: seller-owned verification status read policy missing';
  end if;
end
$$;

-- Ninja's review outcome must remain distinct from a failed/mismatched check.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.store_verification_checks'::regclass
      and conname='store_verification_checks_status_check'
      and pg_get_constraintdef(oid) like '%review%'
  ) then
    raise exception 'FAIL: verification status must preserve the distinct review state';
  end if;
end
$$;
