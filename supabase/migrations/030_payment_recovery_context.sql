-- Everneed Payment Lifecycle 030 — recovery worker context and signed-event claim shape
-- 029 is already recorded in Everneed-staging. This migration adds only the follow-up
-- worker contract; never edit or replay migration 029.

begin;

-- The 029 claim RPC did not return the persisted signature-verification flag.
-- Drop/recreate is required because PostgreSQL cannot change a function's TABLE return type.
drop function public.claim_provider_event_recovery(integer,integer,integer);

create function public.claim_provider_event_recovery(
  p_batch_size integer default 20,
  p_lease_seconds integer default 180,
  p_max_attempts integer default 8
)
returns table (
  event_id uuid,
  event_key text,
  event_type text,
  provider_reference text,
  provider_transaction_id text,
  signature_verified boolean,
  payload jsonb,
  lease_token uuid,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_batch_size not between 1 and 50
     or p_lease_seconds not between 30 and 900
     or p_max_attempts not between 1 and 20 then
    raise exception 'Invalid provider-event recovery limits.';
  end if;

  update private.provider_event_inbox as e
     set processing_status = 'dead_lettered',
         dead_lettered_at = now(),
         lease_token = null,
         lease_expires_at = null,
         next_attempt_at = null,
         last_error_code = 'retry_limit_exhausted',
         last_error_message = 'Provider event exhausted its bounded recovery attempts.'
   where e.attempts >= p_max_attempts
     and e.processing_status in ('received', 'retry', 'processing')
     and (e.processing_status <> 'processing' or e.lease_expires_at is null or e.lease_expires_at <= now())
     and (e.next_attempt_at is null or e.next_attempt_at <= now());

  return query
  with due as (
    select e.id
      from private.provider_event_inbox e
     where e.attempts < p_max_attempts
       and e.processing_status in ('received', 'retry', 'processing')
       and (e.next_attempt_at is null or e.next_attempt_at <= now())
       and (e.processing_status <> 'processing' or e.lease_expires_at is null or e.lease_expires_at <= now())
     order by coalesce(e.next_attempt_at, e.received_at), e.received_at
     for update skip locked
     limit p_batch_size
  ),
  claimed as (
    update private.provider_event_inbox e
       set processing_status = 'processing',
           attempts = e.attempts + 1,
           lease_token = gen_random_uuid(),
           lease_expires_at = now() + make_interval(secs => p_lease_seconds),
           dead_lettered_at = null
      from due
     where e.id = due.id
    returning e.id, e.event_key, e.event_type, e.provider_reference,
              e.provider_transaction_id, e.signature_verified, e.payload,
              e.lease_token, e.attempts
  )
  select c.id, c.event_key, c.event_type, c.provider_reference,
         c.provider_transaction_id, c.signature_verified, c.payload,
         c.lease_token, c.attempts
    from claimed c;
end
$$;

revoke all on function public.claim_provider_event_recovery(integer,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_provider_event_recovery(integer,integer,integer) to service_role;

-- The worker derives the expected order/customer/amount from the persisted attempt.
-- Paystack's server-verified metadata is compared against this result before settlement.
create or replace function public.get_payment_attempt_recovery_context(
  p_provider_reference text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'order_id', a.order_id,
    'user_id', a.user_id,
    'amount_minor', a.amount_minor,
    'currency', a.currency,
    'currency_exponent', a.currency_exponent,
    'attempt_status', a.status,
    'order_status', o.status,
    'payment_status', o.payment_status
  )
  from private.payment_attempts a
  join public.orders o on o.id = a.order_id
  where a.provider = 'paystack'
    and a.provider_reference = p_provider_reference
  limit 1
$$;

revoke all on function public.get_payment_attempt_recovery_context(text) from public, anon, authenticated;
grant execute on function public.get_payment_attempt_recovery_context(text) to service_role;

comment on function public.get_payment_attempt_recovery_context(text) is
  'Service-only lookup of persisted payment attempt and order context for provider-verified recovery.';

commit;
