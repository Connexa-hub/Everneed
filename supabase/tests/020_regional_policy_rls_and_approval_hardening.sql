-- 020: RLS and approval/activation regression checks (staging).
begin;
select ok((select count(*)=2 from pg_policies where schemaname='public' and tablename='policy_documents' and policyname in ('policy documents public read','policy documents signed-in read')),'policy documents have separate anon and authenticated read policies');
select ok((select count(*)=1 from pg_policies where schemaname='public' and tablename='seller_verification_rules' and policyname='seller verification rules read'),'verification rules have one unified read policy');
select ok(not has_column_privilege('authenticated','public.stores','activation_status','UPDATE'),'authenticated sellers cannot directly set activation state');
select ok((select position('verification_required' in pg_get_functiondef('public.approve_store(text,text)'::regprocedure))>0),'admin approval always resets activation to verification required');
select ok((select position('Complete the required seller verification' in pg_get_functiondef('public.approve_store(text,text)'::regprocedure))>0),'approval notification explains the verification gate');
rollback;
