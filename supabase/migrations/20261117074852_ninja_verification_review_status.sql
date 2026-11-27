alter table public.store_verification_checks
  drop constraint if exists store_verification_checks_status_check;

alter table public.store_verification_checks
  add constraint store_verification_checks_status_check
  check (status = any (array[
    'not_started'::text,
    'pending'::text,
    'verified'::text,
    'review'::text,
    'needs_attention'::text,
    'skipped'::text,
    'expired'::text
  ]));
