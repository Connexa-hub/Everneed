begin;

-- Remove the previous provider's event store. The staging table was confirmed empty.
drop table if exists public.ninja_webhook_events;
drop table if exists private.ninja_webhook_events;

-- Remove any provider-specific verification rows, while preserving the provider-neutral
-- verification contract, history states, check types, and seller policy rules.
delete from public.store_verification_checks
where lower(coalesce(provider, '')) = 'ninja';

commit;
