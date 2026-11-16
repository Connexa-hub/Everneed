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
     or position('lease_expires_at' in lower(v_def)) = 0 then
    raise exception 'Recovery claim must retain SKIP LOCKED and expiring leases';
  end if;

  select pg_get_functiondef(v_context::oid) into v_def;
  if position('private.payment_attempts' in lower(v_def)) = 0
     or position('public.orders' in lower(v_def)) = 0
     or position('amount_minor' in lower(v_def)) = 0 then
    raise exception 'Recovery context must derive trusted attempt/order details from the database';
  end if;
end
$$;
