-- Final SECURITY DEFINER ACL pass after every feature migration has created its functions.
-- PostgreSQL grants EXECUTE to PUBLIC by default. Later migrations can introduce
-- anon-only or authenticated RPCs after the earlier boundary migrations have run.
-- Remove only the blanket PUBLIC grant; preserve deliberate role-specific grants.
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
  loop
    execute format('alter function %s set search_path = ''''', f.signature);
    execute format('revoke execute on function %s from public', f.signature);
  end loop;
end
$$;
