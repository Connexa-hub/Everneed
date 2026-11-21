create table if not exists public.ninja_webhook_events (
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

alter table public.ninja_webhook_events enable row level security;
revoke all on public.ninja_webhook_events from public, anon, authenticated;
grant select, insert, update on public.ninja_webhook_events to service_role;

create index if not exists ninja_webhook_events_store_received_idx
  on public.ninja_webhook_events(store_id, received_at desc);

create index if not exists ninja_webhook_events_unprocessed_idx
  on public.ninja_webhook_events(received_at)
  where processing_status in ('received','failed');
