-- Everneed Payment Lifecycle 029 — durable provider-event recovery leases
-- Source-only preparation on web-portal. Do not apply until CI, review and explicit staging approval.
-- Migration 028 is historical and must not be edited or reapplied.

begin;

alter table private.provider_event_inbox
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists dead_lettered_at timestamptz;

alter table private.provider_event_inbox
  drop constraint if exists provider_event_inbox_processing_status_check;

alter table private.provider_event_inbox
  add constraint provider_event_inbox_processing_status_check
  check (processing_status = any (array[
    'received'::text, 'processing'::text, 'processed'::text,
    'retry'::text, 'quarantined'::text, 'dead_lettered'::text
  ]));

create index if not exists provider_event_inbox_recovery_due_idx
  on private.provider_event_inbox (next_attempt_at, received_at)
  where processing_status in ('received', 'retry');

create index if not exists provider_event_inbox_recovery_lease_idx
  on private.provider_event_inbox (lease_expires_at)
  where processing_status = 'processing';

-- Correct the live duplicate-detection behavior: only the insert that actually
-- inserted the event is new. No time-window heuristic is used.
create or replace function public.record_verified_provider_event(
  p_event_key text,
  p_event_type text,
  p_provider_reference text,
  p_provider_transaction_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event private.provider_event_inbox%rowtype;
  v_inserted integer;
begin
  if p_event_key is null or length(p_event_key) not between 1 and 180
     or p_event_type is null or length(p_event_type) > 100
     or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid provider event.';
  end if;

  insert into private.provider_event_inbox(
    provider, event_key, event_type, provider_reference,
    provider_transaction_id, signature_verified, payload
  ) values (
    'paystack', p_event_key, p_event_type, p_provider_reference,
    p_provider_transaction_id, true, p_payload
  )
  on conflict (provider, event_key) do nothing;
  get diagnostics v_inserted = row_count;

  select * into v_event
    from private.provider_event_inbox
   where provider = 'paystack' and event_key = p_event_key;

  return jsonb_build_object(
    'event_id', v_event.id,
    'processing_status', v_event.processing_status,
    'duplicate', v_inserted = 0
  );
end
$$;

-- Reconcile live settlement against the immutable snapshot, not just the
-- mutable order row. Provider verification remains the caller's responsibility.
create or replace function public.settle_verified_payment_attempt(
  p_provider_reference text,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt private.payment_attempts%rowtype;
  v_order public.orders%rowtype;
  v_result text;
  v_snapshot_hash text;
  v_snapshot_amount bigint;
  v_snapshot_exponent smallint;
begin
  if p_provider_reference is null or p_provider_transaction_id is null
     or p_amount_minor is null or p_amount_minor <= 0
     or p_currency is null then
    raise exception 'Verified transaction details are incomplete.';
  end if;

  select * into v_attempt
    from private.payment_attempts
   where provider = 'paystack' and provider_reference = p_provider_reference
   for update;
  if not found then
    return jsonb_build_object('result', 'unknown_reference');
  end if;

  select * into v_order
    from public.orders
   where id = v_attempt.order_id
   for update;
  if not found then
    update private.payment_attempts
       set status = 'reconciliation_required',
           failure_code = 'order_missing',
           failure_message = 'Payment attempt references a missing order.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required');
  end if;

  if v_order.checkout_snapshot is null
     or v_order.checkout_snapshot_version is null
     or v_order.checkout_snapshot_hash is null then
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'snapshot_missing',
           failure_message = 'The order has no complete immutable checkout snapshot.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'snapshot_missing');
  end if;

  v_snapshot_hash := encode(
    extensions.digest(convert_to(v_order.checkout_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );
  v_snapshot_amount := nullif(v_order.checkout_snapshot #>> '{amounts,total_minor}', '')::bigint;
  v_snapshot_exponent := nullif(v_order.checkout_snapshot->>'currency_exponent', '')::smallint;

  if v_attempt.user_id is distinct from v_order.user_id
     or v_order.checkout_snapshot_hash is distinct from v_attempt.checkout_snapshot_hash
     or v_order.checkout_snapshot_version is distinct from v_attempt.checkout_snapshot_version
     or v_snapshot_hash is distinct from v_attempt.checkout_snapshot_hash
     or v_order.checkout_snapshot->>'order_id' is distinct from v_order.id
     or v_order.checkout_snapshot->>'user_id' is distinct from v_order.user_id::text
     or upper(v_order.currency) is distinct from v_attempt.currency
     or upper(v_order.checkout_snapshot->>'currency') is distinct from v_attempt.currency
     or v_snapshot_amount is distinct from v_attempt.amount_minor
     or v_snapshot_exponent is distinct from v_attempt.currency_exponent then
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'order_attempt_integrity_mismatch',
           failure_message = 'Order ownership, snapshot integrity, amount, currency or exponent no longer matches the payment attempt.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'order_attempt_integrity_mismatch');
  end if;

  if p_amount_minor <> v_attempt.amount_minor
     or upper(p_currency) <> v_attempt.currency then
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'amount_or_currency_mismatch',
           failure_message = 'Provider transaction did not exactly match the immutable payment attempt.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'amount_or_currency_mismatch');
  end if;

  if v_attempt.status = 'succeeded' then
    if v_attempt.provider_transaction_id = p_provider_transaction_id then
      return jsonb_build_object('result', 'already_settled', 'order_id', v_order.id);
    end if;
    update private.payment_attempts
       set status = 'reconciliation_required',
           failure_code = 'transaction_id_conflict',
           failure_message = 'A different provider transaction ID was reported for a settled attempt.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'order_id', v_order.id);
  end if;

  if v_attempt.status in ('failed', 'cancelled') then
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'success_after_terminal_attempt',
           failure_message = 'Provider reported a successful charge for a terminal payment attempt.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'success_after_terminal_attempt');
  end if;
  if v_attempt.status not in ('pending', 'processing', 'initializing') then
    return jsonb_build_object('result', 'attempt_not_payable', 'status', v_attempt.status);
  end if;

  if v_order.payment_status = 'paid' or v_order.paid_at is not null then
    if v_order.ref = v_attempt.provider_reference then
      update private.payment_attempts
         set status = 'succeeded',
             provider_transaction_id = p_provider_transaction_id,
             verified_at = now(), succeeded_at = now(), updated_at = now()
       where id = v_attempt.id;
      return jsonb_build_object('result', 'already_settled', 'order_id', v_order.id);
    end if;
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'second_successful_charge',
           failure_message = 'Order was already paid using a different payment reference.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'second_successful_charge');
  end if;

  if v_order.status = 'cancelled' then
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'paid_after_cancellation',
           failure_message = 'Provider reported a successful charge after order cancellation.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'paid_after_cancellation');
  end if;

  update private.payment_attempts
     set status = 'succeeded',
         provider_transaction_id = p_provider_transaction_id,
         verified_at = now(), succeeded_at = now(), updated_at = now()
   where id = v_attempt.id;

  v_result := private.confirm_payment_core(v_order.id, v_attempt.provider_reference, null);
  return jsonb_build_object('result', v_result, 'order_id', v_order.id, 'attempt_id', v_attempt.id);
end
$$;

-- The claim RPC is created with its final return shape in migration 030.

-- A worker may finish only the lease it owns. A late worker cannot overwrite
-- a newer worker's result after the lease expires and is reclaimed.
create or replace function public.finish_provider_event_recovery(
  p_event_id uuid,
  p_lease_token uuid,
  p_processing_status text,
  p_error_code text default null,
  p_error_message text default null,
  p_max_attempts integer default 8
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_event_id is null or p_lease_token is null
     or p_processing_status not in ('processed', 'retry', 'quarantined')
     or p_max_attempts not between 1 and 20 then
    raise exception 'Invalid provider-event recovery completion.';
  end if;

  update private.provider_event_inbox
     set processing_status = case
           when p_processing_status = 'retry' and attempts >= p_max_attempts then 'dead_lettered'
           else p_processing_status
         end,
         processed_at = case when p_processing_status = 'processed' then now() else processed_at end,
         dead_lettered_at = case
           when p_processing_status = 'retry' and attempts >= p_max_attempts then now()
           else null
         end,
         next_attempt_at = case
           when p_processing_status = 'retry' and attempts < p_max_attempts
             then now() + make_interval(mins => least(360, power(2, least(attempts, 8))::integer))
           else null
         end,
         lease_token = null,
         lease_expires_at = null,
         last_error_code = left(p_error_code, 80),
         last_error_message = left(p_error_message, 240)
   where id = p_event_id
     and processing_status = 'processing'
     and lease_token = p_lease_token;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end
$$;

-- Keep the inline webhook path compatible while ensuring it releases any lease
-- it supersedes. A worker completion with that old token will then fail closed.
create or replace function public.mark_provider_event_processed(
  p_event_key text,
  p_processing_status text,
  p_error_code text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_processing_status not in ('processed', 'retry', 'quarantined') then
    raise exception 'Invalid provider event status.';
  end if;
  update private.provider_event_inbox
     set processing_status = p_processing_status,
         attempts = attempts + 1,
         processed_at = case when p_processing_status = 'processed' then now() else processed_at end,
         next_attempt_at = case
           when p_processing_status = 'retry'
             then now() + make_interval(mins => least(360, power(2, least(attempts + 1, 8))::integer))
           else null
         end,
         lease_token = null,
         lease_expires_at = null,
         last_error_code = left(p_error_code, 80),
         last_error_message = left(p_error_message, 240)
   where provider = 'paystack' and event_key = p_event_key;
end
$$;

revoke all on function public.claim_provider_event_recovery(integer,integer,integer) from public, anon, authenticated;
revoke all on function public.finish_provider_event_recovery(uuid,uuid,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.finish_provider_event_recovery(uuid,uuid,text,text,text,integer) to service_role;

comment on function public.finish_provider_event_recovery(uuid,uuid,text,text,text,integer) is
  'Service-only lease-token guarded completion with exponential retry backoff and dead-lettering.';

commit;
