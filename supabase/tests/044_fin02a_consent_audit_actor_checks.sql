-- FIN-02A consent audit actor attribution regression.
begin;
do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='audit_offer_funding_consent';
  if v_def is null or v_def not like '%coalesce(auth.uid(), new.consented_by)%' then
    raise exception 'Consent audit trigger does not capture the acting authenticated user.';
  end if;
  if has_function_privilege('anon','private.audit_offer_funding_consent()','EXECUTE')
     or has_function_privilege('authenticated','private.audit_offer_funding_consent()','EXECUTE')
     or has_function_privilege('service_role','private.audit_offer_funding_consent()','EXECUTE') then
    raise exception 'Consent audit trigger function is executable by API roles.';
  end if;
end
$$;
rollback;
