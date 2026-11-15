-- Everneed Payment Lifecycle 028 — trusted payment-attempt RPCs
-- Draft only. Requires 026 and the coordinated 027 checkout snapshot migration.
-- Do not apply until the matching Paystack Edge Function and acceptance tests are reviewed.

begin;

create or replace function public.create_payment_attempt(
  p_order_id text,
  p_user_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_existing private.payment_attempts%rowtype;
  v_attempt private.payment_attempts%rowtype;
  v_amount_minor bigint;
  v_currency text;
  v_exponent smallint;
  v_hash text;
  v_reference text;
begin
  if p_order_id is null or p_user_id is null
     or p_idempotency_key is null
     or length(trim(p_idempotency_key)) < 16
     or length(p_idempotency_key) > 128 then
    raise exception 'Invalid payment attempt request.';
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id
   for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.user_id is distinct from p_user_id then
    raise exception 'Order ownership mismatch.';
  end if;
  if v_order.pm <> 'card' or v_order.status in ('cancelled', 'paid')
     or v_order.payment_status = 'paid' then
    raise exception 'This order is not eligible for a new card payment attempt.';
  end if;
  if v_order.checkout_snapshot is null
     or v_order.checkout_snapshot_version is null
     or v_order.checkout_snapshot_hash is null then
    raise exception 'Order has no immutable checkout snapshot.';
  end if;

  v_hash := encode(
    extensions.digest(convert_to(v_order.checkout_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );
  if v_hash <> v_order.checkout_snapshot_hash then
    raise exception 'Checkout snapshot integrity check failed.';
  end if;

  v_amount_minor := nullif(v_order.checkout_snapshot #>> '{amounts,total_minor}', '')::bigint;
  v_currency := upper(v_order.checkout_snapshot->>'currency');
  v_exponent := nullif(v_order.checkout_snapshot->>'currency_exponent', '')::smallint;
  if coalesce(v_amount_minor, 0) <= 0
     or v_currency is distinct from upper(v_order.currency)
     or v_exponent is null then
    raise exception 'Checkout snapshot payment amount is invalid.';
  end if;

  select * into v_existing
    from private.payment_attempts
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.order_id <> p_order_id
       or v_existing.checkout_snapshot_hash <> v_hash
       or v_existing.amount_minor <> v_amount_minor
       or v_existing.currency <> v_currency then
      raise exception 'Idempotency key was already used for a different payment request.';
    end if;
    return jsonb_build_object(
      'attempt_id', v_existing.id,
      'reference', v_existing.provider_reference,
      'amount_minor', v_existing.amount_minor,
      'currency', v_existing.currency,
      'currency_exponent', v_existing.currency_exponent,
      'status', v_existing.status,
      'gateway_response', v_existing.gateway_response,
      'reused', true
    );
  end if;

  select * into v_existing
    from private.payment_attempts
   where order_id = p_order_id
     and status in ('initializing', 'pending', 'processing')
   order by created_at desc
   limit 1;
  if found then
    if v_existing.checkout_snapshot_hash <> v_hash
       or v_existing.amount_minor <> v_amount_minor
       or v_existing.currency <> v_currency then
      raise exception 'The active payment attempt does not match the current checkout snapshot.';
    end if;
    return jsonb_build_object(
      'attempt_id', v_existing.id,
      'reference', v_existing.provider_reference,
      'amount_minor', v_existing.amount_minor,
      'currency', v_existing.currency,
      'currency_exponent', v_existing.currency_exponent,
      'status', v_existing.status,
      'gateway_response', v_existing.gateway_response,
      'reused', true
    );
  end if;

  v_reference := 'en_' || replace(gen_random_uuid()::text, '-', '');
  insert into private.payment_attempts(
    order_id, user_id, provider, idempotency_key, provider_reference,
    amount_minor, currency, currency_exponent,
    checkout_snapshot_version, checkout_snapshot_hash, status
  ) values (
    p_order_id, p_user_id, 'paystack', p_idempotency_key, v_reference,
    v_amount_minor, v_currency, v_exponent,
    v_order.checkout_snapshot_version, v_hash, 'initializing'
  )
  returning * into v_attempt;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'reference', v_attempt.provider_reference,
    'amount_minor', v_attempt.amount_minor,
    'currency', v_attempt.currency,
    'currency_exponent', v_attempt.currency_exponent,
    'status', v_attempt.status,
    'gateway_response', v_attempt.gateway_response,
    'reused', false
  );
end
$$;

create or replace function public.record_payment_attempt_initialization(
  p_attempt_id uuid,
  p_initialized boolean,
  p_gateway_message text default null,
  p_failure_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt private.payment_attempts%rowtype;
begin
  select * into v_attempt
    from private.payment_attempts
   where id = p_attempt_id
   for update;
  if not found then raise exception 'Payment attempt not found.'; end if;

  if v_attempt.status in ('pending', 'failed') then
    return jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'reused', true);
  end if;
  if v_attempt.status <> 'initializing' then
    raise exception 'Payment attempt cannot accept an initialization result in its current state.';
  end if;

  update private.payment_attempts
     set status = case when p_initialized then 'pending' else 'failed' end,
         gateway_response = left(coalesce(p_gateway_message, ''), 240),
         failure_code = case when p_initialized then null else left(coalesce(p_failure_code, 'provider_init_failed'), 80) end,
         failure_message = case when p_initialized then null else left(coalesce(p_gateway_message, 'Provider initialization failed.'), 240) end,
         updated_at = now()
   where id = p_attempt_id
  returning * into v_attempt;

  return jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'reused', false);
end
$$;

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

  select * into v_event
    from private.provider_event_inbox
   where provider = 'paystack' and event_key = p_event_key;

  return jsonb_build_object(
    'event_id', v_event.id,
    'processing_status', v_event.processing_status,
    'duplicate', v_event.received_at < now() - interval '1 second'
  );
end
$$;

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

  if v_attempt.status not in ('pending', 'processing', 'initializing') then
    return jsonb_build_object('result', 'attempt_not_payable', 'status', v_attempt.status);
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
         next_attempt_at = case when p_processing_status = 'retry' then now() + interval '1 minute' else null end,
         last_error_code = left(p_error_code, 80),
         last_error_message = left(p_error_message, 240)
   where provider = 'paystack' and event_key = p_event_key;
end
$$;

revoke all on function public.create_payment_attempt(text,uuid,text) from public, anon, authenticated;
revoke all on function public.record_payment_attempt_initialization(uuid,boolean,text,text) from public, anon, authenticated;
revoke all on function public.record_verified_provider_event(text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.settle_verified_payment_attempt(text,text,bigint,text) from public, anon, authenticated;
revoke all on function public.mark_provider_event_processed(text,text,text,text) from public, anon, authenticated;

grant execute on function public.create_payment_attempt(text,uuid,text) to service_role;
grant execute on function public.record_payment_attempt_initialization(uuid,boolean,text,text) to service_role;
grant execute on function public.record_verified_provider_event(text,text,text,text,jsonb) to service_role;
grant execute on function public.settle_verified_payment_attempt(text,text,bigint,text) to service_role;
grant execute on function public.mark_provider_event_processed(text,text,text,text) to service_role;

comment on function public.create_payment_attempt(text,uuid,text) is
  'Service-only idempotent payment-attempt creation bound to immutable order snapshot and exact provider amount.';
comment on function public.settle_verified_payment_attempt(text,text,bigint,text) is
  'Service-only settlement for a transaction independently verified with Paystack; exact amount/currency and duplicate-charge checks are mandatory.';

commit;
