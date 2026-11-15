-- Read-only structural checks for migration 028.
-- Run only after 026, 027 and 028 are explicitly applied to Everneed-staging.
do $$
declare
  v_create regprocedure;
  v_init regprocedure;
  v_event regprocedure;
  v_settle regprocedure;
  v_mark regprocedure;
  v_oid oid;
begin
  v_create := to_regprocedure('public.create_payment_attempt(text,uuid,text)');
  v_init := to_regprocedure('public.record_payment_attempt_initialization(uuid,boolean,text,text)');
  v_event := to_regprocedure('public.record_verified_provider_event(text,text,text,text,jsonb)');
  v_settle := to_regprocedure('public.settle_verified_payment_attempt(text,text,bigint,text)');
  v_mark := to_regprocedure('public.mark_provider_event_processed(text,text,text,text)');

  if v_create is null or v_init is null or v_event is null or v_settle is null or v_mark is null then
    raise exception 'One or more payment-attempt RPCs are missing';
  end if;

  foreach v_oid in array array[v_create::oid,v_init::oid,v_event::oid,v_settle::oid,v_mark::oid]
  loop
    if not (select prosecdef from pg_proc where oid=v_oid) then
      raise exception 'A payment-attempt RPC is not SECURITY DEFINER';
    end if;
    if not (select coalesce(array_to_string(proconfig, ','), '') like '%search_path=%' from pg_proc where oid=v_oid) then
      raise exception 'A payment-attempt RPC lacks an explicit search_path';
    end if;
    if has_function_privilege('anon', v_oid, 'EXECUTE')
       or has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'A client role can execute a service-only payment RPC';
    end if;
    if not has_function_privilege('service_role', v_oid, 'EXECUTE') then
      raise exception 'service_role cannot execute a payment RPC';
    end if;
  end loop;
end
$$;

select
  (select count(*) from private.payment_attempts where status='succeeded') as succeeded_attempts,
  (select count(*) from private.payment_attempts where status='reconciliation_required') as reconciliation_attempts,
  (select count(*) from private.provider_event_inbox where signature_verified) as verified_events,
  (select count(*) from private.provider_event_inbox where processing_status in ('received','retry')) as pending_events;
