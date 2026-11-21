-- Everneed Payment Lifecycle 031 — stale payment-attempt recovery leases
-- Source-only preparation. Do not apply to staging until explicit manual APPLY approval.

begin;

alter table private.payment_attempts
  add column if not exists recovery_attempts integer not null default 0,
  add column if not exists recovery_next_at timestamptz,
  add column if not exists recovery_lease_token uuid,
  add column if not exists recovery_lease_expires_at timestamptz,
  add column if not exists recovery_last_checked_at timestamptz,
  add column if not exists recovery_dead_lettered_at timestamptz,
  add column if not exists recovery_last_error_code text,
  add column if not exists recovery_last_error_message text;

do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.payment_attempts'::regclass
      and conname = 'payment_attempts_recovery_attempts_nonnegative'
  ) then
    alter table private.payment_attempts
      add constraint payment_attempts_recovery_attempts_nonnegative
      check (recovery_attempts >= 0);
  end if;
end
$guard$;

-- Do not permit a fresh charge while an earlier attempt for the same order
-- remains unresolved. A reconciliation_required attempt blocks new attempts
-- until an explicit reconciliation process moves it to a resolved state.
create or replace function private.block_new_attempt_after_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status in ('initializing', 'pending', 'processing')
     and exists (
       select 1
         from private.payment_attempts as prior
        where prior.order_id = new.order_id
          and prior.status in ('succeeded', 'reconciliation_required')
     ) then
    raise exception 'A previous payment attempt is settled or requires reconciliation before another charge can be created.';
  end if;
  return new;
end
$function$;

revoke all on function private.block_new_attempt_after_reconciliation() from public, anon, authenticated;
drop trigger if exists payment_attempts_block_new_after_reconciliation on private.payment_attempts;
create trigger payment_attempts_block_new_after_reconciliation
before insert on private.payment_attempts
for each row execute function private.block_new_attempt_after_reconciliation();

create index if not exists payment_attempts_stale_recovery_due_idx
  on private.payment_attempts (coalesce(recovery_next_at, updated_at), created_at)
  where status in ('initializing', 'pending', 'processing');

create index if not exists payment_attempts_recovery_lease_idx
  on private.payment_attempts (recovery_lease_expires_at)
  where recovery_lease_token is not null;

create or replace function public.claim_stale_payment_attempt_recovery(
  p_stale_seconds integer default 180,
  p_batch_size integer default 20,
  p_lease_seconds integer default 180,
  p_max_attempts integer default 12
)
returns table (
  attempt_id uuid,
  provider_reference text,
  provider_transaction_id text,
  amount_minor bigint,
  currency text,
  lease_token uuid,
  recovery_attempts integer
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_stale_seconds is null or p_stale_seconds not between 60 and 3600
     or p_batch_size is null or p_batch_size not between 1 and 50
     or p_lease_seconds is null or p_lease_seconds not between 30 and 900
     or p_max_attempts is null or p_max_attempts not between 1 and 20 then
    raise exception 'Invalid stale payment-attempt recovery limits.';
  end if;

  update private.payment_attempts as a
     set status = 'reconciliation_required',
         failure_code = 'recovery_attempt_limit_exhausted',
         failure_message = 'The provider reference could not be conclusively resolved within the bounded recovery window.',
         recovery_dead_lettered_at = now(),
         recovery_lease_token = null,
         recovery_lease_expires_at = null,
         recovery_next_at = null,
         updated_at = now()
   where a.status in ('initializing', 'pending', 'processing')
     and a.recovery_attempts >= p_max_attempts
     and a.updated_at <= now() - make_interval(secs => p_stale_seconds)
     and (a.recovery_next_at is null or a.recovery_next_at <= now())
     and (a.recovery_lease_expires_at is null or a.recovery_lease_expires_at <= now());

  return query
  with due as (
    select a.id
      from private.payment_attempts as a
     where a.status in ('initializing', 'pending', 'processing')
       and a.recovery_attempts < p_max_attempts
       and a.updated_at <= now() - make_interval(secs => p_stale_seconds)
       and (a.recovery_next_at is null or a.recovery_next_at <= now())
       and (a.recovery_lease_expires_at is null or a.recovery_lease_expires_at <= now())
     order by coalesce(a.recovery_next_at, a.updated_at), a.created_at
     for update skip locked
     limit p_batch_size
  ),
  claimed as (
    update private.payment_attempts as a
       set recovery_attempts = a.recovery_attempts + 1,
           recovery_lease_token = gen_random_uuid(),
           recovery_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
           recovery_dead_lettered_at = null
      from due
     where a.id = due.id
    returning a.id, a.provider_reference, a.provider_transaction_id,
              a.amount_minor, a.currency, a.recovery_lease_token, a.recovery_attempts
  )
  select c.id, c.provider_reference, c.provider_transaction_id,
         c.amount_minor, c.currency, c.recovery_lease_token, c.recovery_attempts
    from claimed as c;
end
$function$;

create or replace function public.finish_stale_payment_attempt_recovery(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_error_code text default null,
  p_error_message text default null,
  p_max_attempts integer default 12
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows integer;
begin
  if p_attempt_id is null
     or p_lease_token is null
     or p_outcome is null
     or p_outcome not in ('pending', 'failed', 'reconciliation_required', 'settled')
     or p_max_attempts is null
     or p_max_attempts not between 1 and 20 then
    raise exception 'Invalid stale payment-attempt recovery completion.';
  end if;

  update private.payment_attempts as a
     set status = case
           when p_outcome = 'failed' and a.status in ('initializing', 'pending', 'processing') then 'failed'
           when p_outcome = 'failed' and a.status = 'succeeded' then 'reconciliation_required'
           when p_outcome = 'reconciliation_required' and a.status in ('initializing', 'pending', 'processing', 'succeeded') then 'reconciliation_required'
           when p_outcome = 'pending' and a.status in ('initializing', 'pending', 'processing')
                and a.recovery_attempts >= p_max_attempts then 'reconciliation_required'
           else a.status
         end,
         failure_code = case
           when p_outcome = 'failed' and a.status in ('initializing', 'pending', 'processing')
             then coalesce(p_error_code, 'provider_verified_failed')
           when p_outcome = 'failed' and a.status = 'succeeded' then 'provider_status_conflict'
           when p_outcome = 'reconciliation_required' then coalesce(p_error_code, 'provider_reconciliation_required')
           when p_outcome = 'pending' and a.status in ('initializing', 'pending', 'processing')
                and a.recovery_attempts >= p_max_attempts then 'recovery_attempt_limit_exhausted'
           else a.failure_code
         end,
         failure_message = case
           when p_outcome = 'failed' and a.status = 'succeeded'
             then 'Paystack verification conflicts with an already-settled attempt; manual review is required.'
           when p_outcome in ('failed', 'reconciliation_required') then left(p_error_message, 240)
           when p_outcome = 'pending' and a.status in ('initializing', 'pending', 'processing')
                and a.recovery_attempts >= p_max_attempts
             then 'The provider reference could not be conclusively resolved within the bounded recovery window.'
           else a.failure_message
         end,
         recovery_next_at = case
           when p_outcome = 'pending'
                and a.status in ('initializing', 'pending', 'processing')
                and a.recovery_attempts < p_max_attempts
             then now() + make_interval(mins => least(360, power(2, least(a.recovery_attempts, 8))::integer))
           else null
         end,
         recovery_dead_lettered_at = case
           when p_outcome = 'pending'
                and a.status in ('initializing', 'pending', 'processing')
                and a.recovery_attempts >= p_max_attempts then now()
           else a.recovery_dead_lettered_at
         end,
         recovery_last_checked_at = now(),
         recovery_last_error_code = left(p_error_code, 80),
         recovery_last_error_message = left(p_error_message, 240),
         recovery_lease_token = null,
         recovery_lease_expires_at = null,
         updated_at = now()
   where a.id = p_attempt_id
     and a.recovery_lease_token = p_lease_token
     and (p_outcome <> 'settled' or a.status = 'succeeded');

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end
$function$;

revoke all on function public.claim_stale_payment_attempt_recovery(integer,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.finish_stale_payment_attempt_recovery(uuid,uuid,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.claim_stale_payment_attempt_recovery(integer,integer,integer,integer) to service_role;
grant execute on function public.finish_stale_payment_attempt_recovery(uuid,uuid,text,text,text,integer) to service_role;

comment on function public.claim_stale_payment_attempt_recovery(integer,integer,integer,integer) is
  'Service-only atomic claim of stale Paystack payment attempts; never creates a new provider charge.';
comment on function public.finish_stale_payment_attempt_recovery(uuid,uuid,text,text,text,integer) is
  'Service-only lease-token fenced completion for stale payment-attempt verification.';

commit;
