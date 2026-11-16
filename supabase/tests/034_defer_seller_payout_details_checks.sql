-- 034 regression: store application submission must not require external payout bank details.
-- Structural test is safe to run after the migration replay.

do $test$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.submit_store(text)'::regprocedure)
    into v_definition;

  if v_definition is null then
    raise exception 'FAIL: public.submit_store(text) is missing.';
  end if;

  if position('a.bank_name' in v_definition) > 0
     or position('a.account_number' in v_definition) > 0
     or position('a.account_name' in v_definition) > 0 then
    raise exception 'FAIL: submit_store still references payout bank fields as submission prerequisites.';
  end if;

  if position('a.business_name' in v_definition) = 0 then
    raise exception 'FAIL: submit_store no longer requires business_name.';
  end if;

  if position('seller_terms' in v_definition) = 0
     or position('seller_privacy' in v_definition) = 0
     or position('marketplace_rules' in v_definition) = 0
     or position('returns_refunds' in v_definition) = 0 then
    raise exception 'FAIL: submit_store no longer checks the seller policy pack.';
  end if;

  if not has_function_privilege('authenticated', 'public.submit_store(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.submit_store(text)', 'EXECUTE')
 then
    raise exception 'FAIL: submit_store execute grants are not restricted to authenticated users.';
  end if;

  raise notice 'PASS: migration 034 defers payout details and preserves business/policy requirements and RPC ACL.';
end
$test$;
