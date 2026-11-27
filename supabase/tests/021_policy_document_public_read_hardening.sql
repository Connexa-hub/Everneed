-- 021 regression checks.
begin;
select ok((select count(*)=2 from pg_policies where schemaname='public' and tablename='policy_documents'
  and policyname in ('policy documents public read','policy documents signed-in read')),'public and authenticated policy reads are separate');
select ok(not has_function_privilege('anon','public.is_admin()','EXECUTE'),'anonymous policy reads do not require the admin RPC');
select ok(has_function_privilege('authenticated','public.is_admin()','EXECUTE'),'signed-in policy read may check admin access');
rollback;
