-- FIN-02A human-facing funding RPC ACL regression.
begin;
do $$
begin
  if has_function_privilege('anon','public.set_offer_store_funding_consent(text,text,integer)','EXECUTE')
     or has_function_privilege('service_role','public.set_offer_store_funding_consent(text,text,integer)','EXECUTE')
     or has_function_privilege('anon','public.revoke_offer_store_funding_consent(text,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.revoke_offer_store_funding_consent(text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.approve_offer_campaign_budget(text,text,bigint,text)','EXECUTE')
     or has_function_privilege('service_role','public.approve_offer_campaign_budget(text,text,bigint,text)','EXECUTE') then
    raise exception 'Funding-consent or budget RPC is exposed to anon/service_role.';
  end if;
  if not has_function_privilege('authenticated','public.set_offer_store_funding_consent(text,text,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.revoke_offer_store_funding_consent(text,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.approve_offer_campaign_budget(text,text,bigint,text)','EXECUTE') then
    raise exception 'Authenticated execution grants missing.';
  end if;
end
$$;
rollback;
