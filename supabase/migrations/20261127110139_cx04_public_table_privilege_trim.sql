-- CX-04: remove non-API table privileges from public API roles.
-- Staging-first. Does not remove SELECT/DML grants needed by existing clients.
-- TRUNCATE bypasses RLS; TRIGGER and REFERENCES are not exposed through PostgREST.
do $$
declare r record;
begin
  for r in
    select format('%I.%I', schemaname, tablename) as object_name
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('revoke truncate, trigger, references on table %s from anon, authenticated', r.object_name);
  end loop;
end $$;

-- CI/test invariant: public base tables must not grant these privileges to API roles.
