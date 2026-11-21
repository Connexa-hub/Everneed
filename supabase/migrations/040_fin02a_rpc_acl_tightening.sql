-- FIN-02A: tighten human-facing promotion control RPCs to authenticated users only.
begin;
revoke all on function public.set_offer_store_funding_consent(text,text,integer) from service_role;
revoke all on function public.revoke_offer_store_funding_consent(text,text,text) from service_role;
revoke all on function public.approve_offer_campaign_budget(text,text,bigint,text) from service_role;
commit;
