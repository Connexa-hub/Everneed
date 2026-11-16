-- Read-only structural and privilege checks for migration 030.
-- Run only after 030 is explicitly applied to Everneed-staging.

do $$
declare
  v_claim regprocedure;
  v_context regprocedure;
  v_oid oid;
  v_def text;
begin
  v_claim := to_regprocedure('public.claim_provider_event_recovery(integer,integer,integer)');
  v_context := to_regprocedure('public.get_payment_attempt_recovery_context(text)');

  if v_claim is null or v_context is null then
    raise exception 'Migration 030 recovery RPC is missing';
  end if;

  foreach v_oid in array array[v_claim::oid,v_context::oid]
  loop
    if not (select prosecdef from pg_proc where oid=v_oid) then
      raise exception 'A recovery RPC is not SECURITY DEFINER';
    end if;
    if not (select coalesce(array_to_string(proconfig, ','), '') like '%search_path=%' from pg_proc where oid=v_oid) then
      raise exception 'A recovery RPC lacks an explicit search_path';
    end if;
    if has_function_privilege('anon', v_oid, 'EXECUTE')
       or has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'A client role can execute a service-only recovery RPC';
    end if;
    if not has_function_privilege('service_role', v_oid, 'EXECUTE') then
      raise exception 'service_role cannot execute a recovery RPC';
    end if;
  end loop;

  if position('signature_verified boolean' in lower(pg_get_function_result(v_claim::oid))) = 0 then
    raise exception 'Recovery claim must return the stored signature verification flag';
  end if;

  select pg_get_functiondef(v_claim::oid) into v_def;
  if position('skip locked' in lower(v_def)) = 0
     or position('lease_expires_at' in lower(v_def)) = 0
     or position('p_batch_size is null' in lower(v_def)) = 0 then
    raise exception 'Recovery claim must retain SKIP LOCKED and expiring leases';
  end if;

  select pg_get_functiondef(to_regprocedure('public.finish_provider_event_recovery(uuid,uuid,text,text,text,integer)')) into v_def;
  if position('p_processing_status is null' in lower(v_def)) = 0 then
    raise exception 'Recovery completion must reject null status values';
  end if;

  select pg_get_functiondef(v_context::oid) into v_def;
  if position('private.payment_attempts' in lower(v_def)) = 0
     or position('public.orders' in lower(v_def)) = 0
     or position('amount_minor' in lower(v_def)) = 0 then
    raise exception 'Recovery context must derive trusted attempt/order details from the database';
  end if;
end
$$;


-- Exercise claim exclusivity and lease-token fencing with a disposable signed event.
begin;
do $$
declare
  v_event_id uuid;
  v_lease_token uuid;
  v_second_id uuid;
  v_second_token uuid;
  v_signature_verified boolean;
  v_finished boolean;
  v_key text := 'ci-030-' || gen_random_uuid()::text;
begin
  insert into private.provider_event_inbox(
    provider, event_key, event_type, signature_verified, payload, processing_status
  ) values ('paystack', v_key, 'charge.success', true, '{}'::jsonb, 'received');

  select event_id, lease_token, signature_verified
    into v_event_id, v_lease_token, v_signature_verified
    from public.claim_provider_event_recovery(1, 180, 8);

  if v_event_id is null or v_lease_token is null or v_signature_verified is distinct from true then
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
