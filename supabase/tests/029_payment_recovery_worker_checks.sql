-- Read-only structural and privilege checks for migration 029.
-- Run only after 029 is explicitly applied to Everneed-staging.

do $$
declare
  v_claim regprocedure;
  v_finish regprocedure;
  v_settle regprocedure;
  v_event regprocedure;
  v_oid oid;
  v_def text;
  v_event_id uuid;
  v_lease_token uuid;
  v_second_id uuid;
  v_second_token uuid;
  v_finished boolean;
  v_key text;
begin
  v_claim := to_regprocedure('public.claim_provider_event_recovery(integer,integer,integer)');
  v_finish := to_regprocedure('public.finish_provider_event_recovery(uuid,uuid,text,text,text,integer)');
  v_settle := to_regprocedure('public.settle_verified_payment_attempt(text,text,bigint,text)');
  v_event := to_regprocedure('public.record_verified_provider_event(text,text,text,text,jsonb)');

  if v_claim is null or v_finish is null or v_settle is null or v_event is null then
    raise exception 'Migration 029 recovery or corrected payment RPC is missing';
  end if;

  foreach v_oid in array array[v_claim::oid,v_finish::oid,v_settle::oid,v_event::oid]
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
 then
    raise exception 'Recovery claim must issue expiring leases';
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
