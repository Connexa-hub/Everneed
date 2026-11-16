-- Security checks for legacy payment RPC wrappers after migration 032.

do $$
declare
  v_oid oid;
  v_def text;
  v_fn regprocedure;
begin
  foreach v_oid in array array[
    to_regprocedure('public.confirm_payment(text,text,uuid)')::oid,
    to_regprocedure('public.confirm_received_for(text,uuid)')::oid,
    to_regprocedure('public.cancel_order_for(text,uuid,text,boolean)')::oid,
    to_regprocedure('public.apply_rental_payment_for(text,text,numeric,text)')::oid
  ]
  loop
    if v_oid is null then
      raise exception 'A legacy payment wrapper is missing';
    end if;
    if not (select prosecdef from pg_proc where oid=v_oid) then
      raise exception 'A legacy payment wrapper lost SECURITY DEFINER';
    end if;
    if not (select coalesce(array_to_string(proconfig, ','), '') like '%search_path=""%' from pg_proc where oid=v_oid) then
      raise exception 'A legacy payment wrapper does not use an empty search_path';
    end if;
    if has_function_privilege('anon', v_oid, 'EXECUTE')
       or has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'A service-only legacy payment wrapper is exposed to client roles';
    end if;
    if not has_function_privilege('service_role', v_oid, 'EXECUTE') then
      raise exception 'service_role cannot execute a legacy payment wrapper';
    end if;
  end loop;

  v_fn := to_regprocedure('public.admin_confirm_payment(text)');
  if v_fn is null or not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
    raise exception 'Admin payment confirmation must remain callable through its admin-gated RPC';
  end if;
  select pg_get_functiondef(v_fn::oid) into v_def;
  if position('need_admin' in lower(v_def)) = 0 then
    raise exception 'Admin payment confirmation is missing its server-side admin gate';
  end if;

  v_fn := to_regprocedure('public.report_payment(text,text,text)');
  if v_fn is null or not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
    raise exception 'Customer bank-transfer reporting must remain available to authenticated users';
  end if;
  select pg_get_functiondef(v_fn::oid) into v_def;
  if position('auth.uid()' in lower(v_def)) = 0
     or position('user_id' in lower(v_def)) = 0 then
    raise exception 'Customer bank-transfer reporting must enforce order ownership';
  end if;
end
$$;
