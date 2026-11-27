-- CX-04 regression: no exposed public table or future public table default grants
-- TRUNCATE, REFERENCES, TRIGGER or MAINTAIN to anon/authenticated/PUBLIC.
DO $$
DECLARE
  r record;
  priv text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    FOREACH priv IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege('anon', format('%I.%I',r.schemaname,r.tablename), priv)
         OR has_table_privilege('authenticated', format('%I.%I',r.schemaname,r.tablename), priv) THEN
        RAISE EXCEPTION 'FAIL: unsafe % privilege on public.%.% for anon/authenticated',priv,r.schemaname,r.tablename;
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    WHERE n.nspname = 'public'
      AND d.defaclobjtype = 'r'
      AND acl.grantee IN (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)
      AND acl.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
  ) THEN
    RAISE EXCEPTION 'FAIL: public table default ACL still grants unsafe privilege';
  END IF;
  RAISE NOTICE 'PASS: public table unsafe privileges and defaults are trimmed';
END
$$;
