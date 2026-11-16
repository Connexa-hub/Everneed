-- Read-only structural and privilege checks for migration 031.
-- Run only after 031 is replayed in local CI or explicitly applied to staging.

do $$
declare
  v_claim regprocedure;
  v_finish regprocedure;
  v_oid oid;
  v_def text;
begin
  v_claim := to_regprocedure('public.claim_stale_payment_attempt_recovery(integer,integer,integer,integer)');
  v_finish := to_regprocedure('public.finish_stale_payment_attempt_recovery(uuid,uuid,text,text,text,integer)');

  if v_claim is null or v_finish is null then
    raise exception 'Migration 031 stale-attempt recovery RPC is missing';
  end if;

  foreach v_oid in array array[v_claim::oid,v_finish::oid]
  loop
    if not (select prosecdef from pg_proc where oid=v_oid) then
      raise exception 'A stale-attempt recovery RPC is not SECURITY DEFINER';
    end if;
    if not (select coalesce(array_to_string(proconfig, ','), '') like '%search_path=%' from pg_proc where oid=v_oid) then
      raise exception 'A stale-attempt recovery RPC lacks an explicit search_path';
    end if;
    if has_function_privilege('anon', v_oid, 'EXECUTE')
       or has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'A client role can execute a stale-attempt recovery RPC';
    end if;
    if not has_function_privilege('service_role', v_oid, 'EXECUTE') then
      raise exception 'service_role cannot execute a stale-attempt recovery RPC';
    end if;
  end loop;

  select pg_get_functiondef(v_claim::oid) into v_def;
  if position('skip locked' in lower(v_def)) = 0
     or position('recovery_lease_expires_at' in lower(v_def)) = 0
     or position('recovery_attempts < p_max_attempts' in lower(v_def)) = 0 then
    raise exception 'Stale-attempt claim must be bounded and use expiring SKIP LOCKED leases';
  end if;

  select pg_get_functiondef(v_finish::oid) into v_def;
  if position('recovery_lease_token = p_lease_token' in lower(v_def)) = 0
     or position('p_outcome is null' in lower(v_def)) = 0
     or position('reconciliation_required' in lower(v_def)) = 0 then
    raise exception 'Stale-attempt completion must be lease-token fenced and support reconciliation';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='private' and table_name='payment_attempts'
      and column_name='recovery_lease_token'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='private' and table_name='payment_attempts'
      and column_name='recovery_next_at'
  ) then
    raise exception 'Payment attempts are missing recovery lease fields';
  end if;
end
$$;
