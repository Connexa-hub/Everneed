begin;

alter table public.store_verification_checks
  drop constraint if exists store_verification_checks_check_type_check;

alter table public.store_verification_checks
  add constraint store_verification_checks_check_type_check
  check (check_type = any (array[
    'phone'::text,
    'identity'::text,
    'face_liveness'::text,
    'business_address'::text,
    'business_registration'::text
  ]));

alter table public.store_verification_checks
  add column if not exists provider_verification_id text,
  add column if not exists provider_outcome text,
  add column if not exists is_sandbox boolean not null default false,
  add column if not exists completed_at timestamptz;

create unique index if not exists store_verification_checks_provider_verification_uidx
  on public.store_verification_checks(provider, provider_verification_id)
  where provider is not null and provider_verification_id is not null;

create table if not exists private.ninja_webhook_events (
  event_id text primary key,
  event_type text not null,
  delivery_id text,
  verification_id text,
  check_type text not null check (check_type in ('identity','face_liveness','business_registration')),
  store_id text not null references public.stores(id) on delete cascade,
  payload_sha256 text not null,
  is_sandbox boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','ignored','failed')),
  safe_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists ninja_webhook_events_store_received_idx
  on private.ninja_webhook_events(store_id, received_at desc);

create index if not exists ninja_webhook_events_unprocessed_idx
  on private.ninja_webhook_events(received_at)
  where processing_status in ('received','failed');

revoke all on private.ninja_webhook_events from public, anon, authenticated;
grant select, insert, update on private.ninja_webhook_events to service_role;

commit;