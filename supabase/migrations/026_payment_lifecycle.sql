-- Everneed Payment Lifecycle 026 — additive schema foundation
-- Target: web-portal -> Everneed-staging after review and explicit approval.
-- This migration is intentionally additive. It does NOT replace payment settlement,
-- cancellation, refund, or Paystack Edge Function behavior. Those changes must ship
-- together in a separately reviewed integration step.
--
-- Historical orders/refunds are not backfilled: missing quote/provider facts must
-- remain unknown rather than being reconstructed from mutable current data.

begin;

-- 1. Immutable quote snapshot columns for newly created orders.
alter table public.orders
  add column if not exists checkout_snapshot_version integer,
  add column if not exists checkout_snapshot jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_checkout_snapshot_pair_ck'
  ) then
    alter table public.orders
      add constraint orders_checkout_snapshot_pair_ck
      check (
        (checkout_snapshot_version is null and checkout_snapshot is null)
        or
        (
          checkout_snapshot_version is not null
          and checkout_snapshot_version > 0
          and checkout_snapshot is not null
          and jsonb_typeof(checkout_snapshot) = 'object'
        )
      );
  end if;
end
$$;

create or replace function private.guard_order_checkout_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Existing snapshots are write-once. Do not allow clearing, replacing or
  -- changing the version, even through an elevated application role.
  if old.checkout_snapshot is not null
     and (
       new.checkout_snapshot is distinct from old.checkout_snapshot
       or new.checkout_snapshot_version is distinct from old.checkout_snapshot_version
     ) then
    raise exception 'Checkout snapshot is immutable.';
  end if;

  -- A first snapshot must be attached as a complete versioned object.
  if old.checkout_snapshot is null
     and (
       (new.checkout_snapshot is null) <> (new.checkout_snapshot_version is null)
       or (
         new.checkout_snapshot is not null
         and (
           jsonb_typeof(new.checkout_snapshot) <> 'object'
           or new.checkout_snapshot_version is null
           or new.checkout_snapshot_version <= 0
         )
       )
     ) then
    raise exception 'A checkout snapshot requires a positive version and JSON object.';
  end if;

  return new;
end
$$;

drop trigger if exists orders_checkout_snapshot_immutable
  on public.orders;

create trigger orders_checkout_snapshot_immutable
before update of checkout_snapshot, checkout_snapshot_version
on public.orders
for each row
execute function private.guard_order_checkout_snapshot();

comment on column public.orders.checkout_snapshot_version is
  'Immutable checkout quote schema version. NULL for legacy orders not backed by a frozen quote.';
comment on column public.orders.checkout_snapshot is
  'Immutable server-calculated checkout quote and item-level refundable allocation snapshot. NULL for legacy orders.';

-- 2. Private Paystack/provider payment attempts.
create table if not exists private.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on update restrict on delete restrict,
  user_id uuid not null references auth.users(id) on update restrict on delete restrict,
  provider text not null check (provider in ('paystack')),
  idempotency_key text not null,
  provider_reference text not null,
  provider_transaction_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  currency_exponent smallint not null check (currency_exponent between 0 and 4),
  checkout_snapshot_version integer not null check (checkout_snapshot_version > 0),
  checkout_snapshot_hash text not null check (length(checkout_snapshot_hash) between 32 and 128),
  status text not null default 'initializing'
    check (status in (
      'initializing',
      'pending',
      'processing',
      'succeeded',
      'failed',
      'cancelled',
      'reconciliation_required'
    )),
  gateway_response text,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  succeeded_at timestamptz,
  constraint payment_attempts_provider_reference_uq unique (provider, provider_reference),
  constraint payment_attempts_idempotency_uq unique (user_id, idempotency_key)
);

create unique index if not exists payment_attempts_provider_transaction_uq
  on private.payment_attempts(provider, provider_transaction_id)
  where provider_transaction_id is not null;

create unique index if not exists payment_attempts_one_active_per_order_uq
  on private.payment_attempts(order_id)
  where status in ('initializing', 'pending', 'processing');

create index if not exists payment_attempts_order_created_idx
  on private.payment_attempts(order_id, created_at desc);

create index if not exists payment_attempts_user_created_idx
  on private.payment_attempts(user_id, created_at desc);

create index if not exists payment_attempts_status_created_idx
  on private.payment_attempts(status, created_at);

comment on table private.payment_attempts is
  'Private provider-independent payment attempt ledger. Provider references and amounts are immutable after initialization; state changes are server-controlled.';
comment on column private.payment_attempts.amount_minor is
  'Exact provider charge amount in integer minor units; never recompute from current catalog prices.';
comment on column private.payment_attempts.checkout_snapshot_hash is
  'SHA-256 (hex) digest of the canonical immutable order checkout snapshot used to price this attempt.';

-- 3. Durable provider event inbox. event_key is derived deterministically by the
-- trusted webhook handler (e.g. provider + event type + provider transaction ID).
create table if not exists private.provider_event_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack')),
  event_key text not null,
  event_type text not null,
  provider_reference text,
  provider_transaction_id text,
  signature_verified boolean not null default false,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  processing_status text not null default 'received'
    check (processing_status in (
      'received',
      'processing',
      'processed',
      'retry',
      'quarantined'
    )),
  attempts integer not null default 0 check (attempts >= 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  next_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  constraint provider_event_inbox_provider_event_uq unique (provider, event_key)
);

create index if not exists provider_event_inbox_work_idx
  on private.provider_event_inbox(processing_status, next_attempt_at, received_at);

create index if not exists provider_event_inbox_reference_idx
  on private.provider_event_inbox(provider, provider_reference)
  where provider_reference is not null;

comment on table private.provider_event_inbox is
  'Durable idempotent inbox for verified provider webhooks. Store only sanitized payload fields required for reconciliation; never treat receipt as settlement.';

-- 4. Provider refund execution is separate from the legacy public.refunds record.
create table if not exists private.provider_refunds (
  id uuid primary key default gen_random_uuid(),
  refund_id text not null references public.refunds(id) on update restrict on delete restrict,
  payment_attempt_id uuid references private.payment_attempts(id) on update restrict on delete restrict,
  provider text not null check (provider in ('paystack')),
  idempotency_key text not null,
  provider_refund_reference text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  currency_exponent smallint not null check (currency_exponent between 0 and 4),
  status text not null default 'eligible'
    check (status in (
      'eligible',
      'awaiting_approval',
      'submitting',
      'pending_provider',
      'succeeded',
      'failed',
      'reconciliation_required'
    )),
  provider_response jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provider_response) = 'object'),
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  constraint provider_refunds_provider_idempotency_uq unique (provider, idempotency_key)
);

create unique index if not exists provider_refunds_provider_reference_uq
  on private.provider_refunds(provider, provider_refund_reference)
  where provider_refund_reference is not null;

create index if not exists provider_refunds_refund_idx
  on private.provider_refunds(refund_id, created_at);

create index if not exists provider_refunds_status_idx
  on private.provider_refunds(status, created_at);

comment on table private.provider_refunds is
  'Provider execution/confirmation lifecycle for a legacy refund request. A legacy refunds.status value of approved or processed is not proof of provider payment.';

-- 5. Private-only access. Edge Functions should use narrowly scoped RPCs in the
-- integration migration; do not expose these tables through client CRUD.
alter table private.payment_attempts enable row level security;
alter table private.provider_event_inbox enable row level security;
alter table private.provider_refunds enable row level security;

revoke all on table private.payment_attempts from public, anon, authenticated;
revoke all on table private.provider_event_inbox from public, anon, authenticated;
revoke all on table private.provider_refunds from public, anon, authenticated;

revoke all on table private.payment_attempts from service_role;
revoke all on table private.provider_event_inbox from service_role;
revoke all on table private.provider_refunds from service_role;

-- No direct REST table access is granted, including to service_role. Trusted
-- SECURITY DEFINER RPCs owned by postgres will be the only application interface.


-- Immutable provider identity/quote fields. Trusted RPCs may advance lifecycle
-- state, but must not rewrite the order, amount, currency, reference or snapshot.
create or replace function private.guard_payment_attempt_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.order_id, new.user_id, new.provider, new.idempotency_key,
    new.provider_reference, new.amount_minor, new.currency,
    new.currency_exponent, new.checkout_snapshot_version,
    new.checkout_snapshot_hash
  ) is distinct from row(
    old.order_id, old.user_id, old.provider, old.idempotency_key,
    old.provider_reference, old.amount_minor, old.currency,
    old.currency_exponent, old.checkout_snapshot_version,
    old.checkout_snapshot_hash
  ) then
    raise exception 'Payment attempt identity and quote fields are immutable.';
  end if;
  return new;
end
$$;

drop trigger if exists payment_attempts_immutable_fields
  on private.payment_attempts;
create trigger payment_attempts_immutable_fields
before update on private.payment_attempts
for each row execute function private.guard_payment_attempt_immutable();

-- Provider event identity, signature result and sanitized payload are immutable.
-- Only processing/retry bookkeeping may change after initial receipt.
create or replace function private.guard_provider_event_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.provider, new.event_key, new.event_type, new.provider_reference,
    new.provider_transaction_id, new.signature_verified, new.payload,
    new.received_at
  ) is distinct from row(
    old.provider, old.event_key, old.event_type, old.provider_reference,
    old.provider_transaction_id, old.signature_verified, old.payload,
    old.received_at
  ) then
    raise exception 'Provider event evidence is immutable.';
  end if;
  return new;
end
$$;

drop trigger if exists provider_event_inbox_immutable_evidence
  on private.provider_event_inbox;
create trigger provider_event_inbox_immutable_evidence
before update on private.provider_event_inbox
for each row execute function private.guard_provider_event_immutable();

create or replace function private.guard_provider_refund_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.refund_id, new.payment_attempt_id, new.provider, new.idempotency_key,
    new.amount_minor, new.currency, new.currency_exponent
  ) is distinct from row(
    old.refund_id, old.payment_attempt_id, old.provider, old.idempotency_key,
    old.amount_minor, old.currency, old.currency_exponent
  ) then
    raise exception 'Provider refund identity and amount fields are immutable.';
  end if;
  return new;
end
$$;

drop trigger if exists provider_refunds_immutable_fields
  on private.provider_refunds;
create trigger provider_refunds_immutable_fields
before update on private.provider_refunds
for each row execute function private.guard_provider_refund_immutable();


commit;
