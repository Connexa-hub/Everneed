-- CX-04 follow-up: remove unsafe table privileges from current public tables and defaults.
-- The staging audit after 20261127110139 still found TRUNCATE/REFERENCES/TRIGGER grants.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I', schemaname, tablename) AS object_name
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE %s FROM PUBLIC, anon, authenticated',
      r.object_name
    );
  END LOOP;
END
$$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM PUBLIC, anon, authenticated;
DO $
BEGIN
  IF pg_has_role(current_user, 'supabase_admin', 'member') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM PUBLIC, anon, authenticated';
  ELSE
    RAISE NOTICE 'CX-04: current migration role cannot alter supabase_admin defaults; privileged follow-up required';
  END IF;
END
$;
