-- 019 regression checklist. Run on staging with separate customer, seller and admin JWTs.
-- This suite is intentionally explicit about the external-provider setup required for positive verification.
begin;
select has_table('public','policy_documents','regional policy catalogue exists');
select has_table('public','policy_acceptances','immutable policy acceptance records exist');
select has_table('public','seller_verification_rules','country-specific seller verification rules exist');
select has_table('public','store_verification_checks','seller verification status records exist');
select has_function('public','accept_policy',array['text','text'],'users can accept a published regional policy');
select has_function('public','request_store_activation',array['text'],'seller activation RPC exists');
select has_function('private','store_verification_complete',array['text'],'server-side verification predicate exists');
select has_column('public','stores','activation_status','store activation state is separate from admin approval');
select ok((select count(*)=4 from public.seller_verification_rules where country='NG' and enabled and required),'Nigeria activation requires phone, identity, face/liveness and business-address checks');
select ok(not has_table_privilege('authenticated','public.store_verification_checks','INSERT'),'seller cannot forge verification records');
select ok(not has_table_privilege('authenticated','public.policy_acceptances','INSERT'),'policy acceptance is RPC-only');
select ok(not has_column_privilege('authenticated','public.stores','activation_status','UPDATE'),'seller cannot directly set store live state');
rollback;
