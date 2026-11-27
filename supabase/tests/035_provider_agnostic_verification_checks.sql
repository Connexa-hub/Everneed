-- Provider-neutral seller verification regression checks.
-- Read-only assertions after provider decommissioning.
do $$
begin
  if to_regclass('public.ninja_webhook_events') is not null then
    raise exception 'FAIL: legacy provider webhook table must be absent';
  end if;
  if to_regclass('private.ninja_webhook_events') is not null then
    raise exception 'FAIL: legacy private webhook table must be absent';
  end if;
  if to_regclass('public.store_verification_checks') is null then
    raise exception 'FAIL: provider-neutral verification checks table is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='store_verification_checks'
      and column_name='provider'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='store_verification_checks'
      and column_name='provider_verification_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='store_verification_checks'
      and column_name='provider_outcome'
  ) then
    raise exception 'FAIL: generic provider reference fields are missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.store_verification_checks'::regclass
      and conname='store_verification_checks_status_check'
      and pg_get_constraintdef(oid) like '%review%'
  ) then
    raise exception 'FAIL: distinct human-review state must remain available';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='store_verification_checks'
      and indexname='store_verification_checks_provider_verification_check_uidx'
  ) then
    raise exception 'FAIL: provider-neutral deduplication index is missing';
  end if;
end
$$;
