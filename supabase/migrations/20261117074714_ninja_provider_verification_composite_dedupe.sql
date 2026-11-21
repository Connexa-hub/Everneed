drop index if exists public.store_verification_checks_provider_verification_uidx;

create unique index store_verification_checks_provider_verification_check_uidx
  on public.store_verification_checks(provider, provider_verification_id, check_type)
  where provider is not null and provider_verification_id is not null;
