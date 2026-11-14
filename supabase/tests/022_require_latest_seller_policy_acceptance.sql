-- 022 policy version freshness checks.
begin;
select ok(position('order by d.effective_at desc,d.version desc' in pg_get_functiondef('public.submit_store(text)'::regprocedure))>0,'seller submission resolves the latest effective regional policy version');
select ok(position('pa.policy_document_id=current_doc.id' in pg_get_functiondef('public.submit_store(text)'::regprocedure))>0,'seller submission requires acceptance of the current document id');
rollback;
