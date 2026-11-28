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
    IF NOT (SELECT rowsecurity FROM pg_tables WHERE schemaname=r.schemaname AND tablename=r.tablename) THEN
      RAISE EXCEPTION 'FAIL: RLS disabled on public.%.%',r.schemaname,r.tablename;
    END IF;
    FOREACH priv IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege('anon', format('%I.%I',r.schemaname,r.tablename), priv)
         OR has_table_privilege('authenticated', format('%I.%I',r.schemaname,r.tablename), priv) THEN
        RAISE EXCEPTION 'FAIL: unsafe % privilege on public.%.% for anon/authenticated',priv,r.schemaname,r.tablename;
      END IF;
    END LOOP;
  END LOOP;

  -- Verify defaults owned by the current migration role (postgres).
  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid=d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    WHERE n.nspname='public'
      AND d.defaclobjtype='r'
      AND d.defaclrole='postgres'::regrole
      AND acl.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid)
      AND acl.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
  ) THEN
    RAISE EXCEPTION 'FAIL: postgres public table defaults still grant unsafe privileges';
  END IF;

  -- supabase_admin is a superuser role, but postgres in this environment is not a member.
  -- Enforce this part when the runner has authority; otherwise report it explicitly.
  IF pg_has_role(current_user,'supabase_admin','member') THEN
    IF EXISTS (
      SELECT 1
      FROM pg_default_acl d
      JOIN pg_namespace n ON n.oid=d.defaclnamespace
      CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
      WHERE n.nspname='public'
        AND d.defaclobjtype='r'
        AND d.defaclrole='supabase_admin'::regrole
        AND acl.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid)
        AND acl.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
    ) THEN
      RAISE EXCEPTION 'FAIL: supabase_admin public table defaults still grant unsafe privileges';
    END IF;
  ELSE
    RAISE NOTICE 'CX-04 partial: supabase_admin defaults require a privileged follow-up';
  END IF;
  RAISE NOTICE 'PASS: current public table privileges and postgres defaults are trimmed';
END
$$;
