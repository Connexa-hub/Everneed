-- Read-only structural and privilege checks for migration 029.
-- Run only after 029 is explicitly applied to Everneed-staging.

do $$
declare
  v_claim regprocedure;
  v_finish regprocedure;
  v_settle regprocedure;
  v_event regprocedure;
  v_context regprocedure;
  v_oid oid;
  v_def text;
  v_event_id uuid;
  v_lease_token uuid;
  v_second_id uuid;
  v_second_token uuid;
  v_claimed_signature boolean;
  v_finished boolean;
  v_key text;
begin
  v_claim := to_regprocedure('public.claim_provider_event_recovery(integer,integer,integer)');
  v_finish := to_regprocedure('public.finish_provider_event_recovery(uuid,uuid,text,text,text,integer)');
  v_settle := to_regprocedure('public.settle_verified_payment_attempt(text,text,bigint,text)');
  v_event := to_regprocedure('public.record_verified_provider_event(text,text,text,text,jsonb)');
  v_context := to_regprocedure('public.get_payment_attempt_recovery_context(text)');

  if v_claim is null or v_finish is null or v_settle is null or v_event is null or v_context is null then
    raise exception 'Migration 029 recovery or corrected payment RPC is missing';
  end if;

  foreach v_oid in array array[v_claim::oid,v_finish::oid,v_settle::oid,v_event::oid,v_context::oid]
  loop
    if not (select prosecdef from pg_proc where oid=v_oid) then
      raise exception 'A recovery/payment RPC is not SECURITY DEFINER';
    end if;
    if not (select coalesce(array_to_string(proconfig, ','), '') like '%search_path=%' from pg_proc where oid=v_oid) then
      raise exception 'A recovery/payment RPC lacks an explicit search_path';
    end if;
    if has_function_privilege('anon', v_oid, 'EXECUTE')
       or has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'A client role can execute a service-only recovery/payment RPC';
    end if;
    if not has_function_privilege('service_role', v_oid, 'EXECUTE') then
      raise exception 'service_role cannot execute a recovery/payment RPC';
    end if;
  end loop;

  select pg_get_functiondef(v_claim::oid) into v_def;
  if position('skip locked' in lower(v_def)) = 0 then
    raise exception 'Recovery claim must use FOR UPDATE SKIP LOCKED';
  end if;
  if position('lease_expires_at' in lower(v_def)) = 0
     or position('signature_verified' in lower(v_def)) = 0 then
    raise exception 'Recovery claim must issue expiring leases and return signature verification state';
  end if;

  select pg_get_functiondef(v_finish::oid) into v_def;
  if position('lease_token = p_lease_token' in lower(v_def)) = 0 then
    raise exception 'Recovery completion must require the active lease token';
  end if;
  if position('dead_lettered' in lower(v_def)) = 0
     or position('power(2' in lower(v_def)) = 0 then
    raise exception 'Recovery completion must bound retries and use exponential backoff';
  end if;

  select pg_get_functiondef(v_settle::oid) into v_def;
  if position('extensions.digest' in lower(v_def)) = 0
     or position('total_minor' in lower(v_def)) = 0
     or position('paid_after_cancellation' in lower(v_def)) = 0 then
    raise exception 'Settlement must validate the immutable snapshot and cancellation state';
  end if;

  select pg_get_functiondef(v_event::oid) into v_def;
  if position('get diagnostics v_inserted = row_count' in lower(v_def)) = 0 then
    raise exception 'Provider event duplicate detection must use insert row count';
  end if;
end
$$;

select
  (select count(*) from private.provider_event_inbox where processing_status='dead_lettered') as dead_lettered_events,
  (select count(*) from private.provider_event_inbox where processing_status='processing' and lease_expires_at > now()) as actively_leased_events;

-- Exercise claim exclusivity and lease-token fencing with a disposable inbox row.
begin;
do $$
declare
  v_event_id uuid;
  v_lease_token uuid;
  v_second_id uuid;
  v_second_token uuid;
  v_claimed_signature boolean;
  v_finished boolean;
  v_key text := 'ci-029-' || gen_random_uuid()::text;
begin
  insert into private.provider_event_inbox(
    provider, event_key, event_type, signature_verified, payload, processing_status
  ) values ('paystack', v_key, 'charge.success', true, '{}'::jsonb, 'received');

  select event_id, lease_token, signature_verified
    into v_event_id, v_lease_token, v_claimed_signature
    from public.claim_provider_event_recovery(1, 180, 8);

  if v_event_id is null or v_lease_token is null or v_claimed_signature is distinct from true then
    raise exception 'First recovery claim did not return a signed event with a lease';
  end if;

  select event_id, lease_token
    into v_second_id, v_second_token
    from public.claim_provider_event_recovery(1, 180, 8);

  if v_second_id is not null or v_second_token is not null then
    raise exception 'A second worker claimed an event that still had an active lease';
  end if;

  select public.finish_provider_event_recovery(
    v_event_id, gen_random_uuid(), 'processed', null, null, 8
  ) into v_finished;
  if v_finished is distinct from false then
    raise exception 'A worker with the wrong lease token was allowed to finish an event';
  end if;

  select public.finish_provider_event_recovery(
    v_event_id, v_lease_token, 'processed', null, null, 8
  ) into v_finished;
  if v_finished is distinct from true then
    raise exception 'The owner of an active recovery lease could not finish its event';
  end if;
end
$$;
rollback;
