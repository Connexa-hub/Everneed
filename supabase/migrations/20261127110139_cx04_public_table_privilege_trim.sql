-- CX-04 staging privilege trim, matching PR branch migration.
do $$
declare r record;
begin
  for r in select format('%I.%I',schemaname,tablename) object_name from pg_tables where schemaname='public'
  loop
    execute format('revoke truncate, trigger, references on table %s from anon, authenticated',r.object_name);
  end loop;
end $$;
