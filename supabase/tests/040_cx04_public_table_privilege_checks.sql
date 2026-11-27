-- CX-04 regression: anon/authenticated may not hold TRUNCATE, TRIGGER or REFERENCES
-- on any public base table. Run after migrations.
do $$
declare
  v record;
  v_priv text;
begin
  for v in
    select c.oid, format('%I.%I', n.nspname, c.relname) as table_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
  loop
    foreach v_priv in array array['TRUNCATE','TRIGGER','REFERENCES'] loop
      if has_table_privilege('anon', v.oid, v_priv) then
        raise exception 'CX04: anon still has % on %', v_priv, v.table_name;
      end if;
      if has_table_privilege('authenticated', v.oid, v_priv) then
        raise exception 'CX04: authenticated still has % on %', v_priv, v.table_name;
      end if;
    end loop;
  end loop;
end $$;
