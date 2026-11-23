-- Final authenticated RPC ACL pass after every feature migration has created its functions.
-- PostgreSQL grants EXECUTE to PUBLIC by default; migrations after 017 can add new
-- SECURITY DEFINER routines, so the earlier boundary pass alone is not sufficient.
-- Explicit grants to anon/authenticated/service_role are preserved by this revoke.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  loop
    execute format('alter function %s set search_path = ''''', f.signature);
    execute format('revoke execute on function %s from public', f.signature);
  end loop;
end
$$;
