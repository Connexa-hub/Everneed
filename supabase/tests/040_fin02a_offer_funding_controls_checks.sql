-- FIN-02A promotion funding controls contract tests. Roll back all fixtures.
begin;

do $$
declare
  v_offer text := 'fin02a-budget-test-' || gen_random_uuid()::text;
  v_order text := 'fin02a-order-' || gen_random_uuid()::text;
  v_res uuid;
  v_failed boolean := false;
  v_uid uuid := gen_random_uuid();
begin
  insert into public.offers(id,name,kind,value,scope,active)
  values(v_offer,'Test funding offer','percent',5,'all',true);

  insert into private.offer_campaign_budgets(
    offer_id,currency,approved_budget_minor,approved_by,approval_note
  ) values(v_offer,'NGN',10000,v_uid,'Test-only approval');

  v_res := private.reserve_offer_campaign_budget(v_order,v_offer,'NGN',4000);
  if v_res is null then raise exception 'Reservation returned no ID'; end if;
  if private.reserve_offer_campaign_budget(v_order,v_offer,'NGN',4000) <> v_res then
    raise exception 'Same-key reservation retry did not return original reservation';
  end if;

  if not exists(select 1 from private.offer_campaign_budgets
    where offer_id=v_offer and currency='NGN' and reserved_minor=4000 and consumed_minor=0) then
    raise exception 'Budget hold was not reflected correctly';
  end if;

  v_failed := false;
  begin
    perform private.reserve_offer_campaign_budget(v_order || '-over',v_offer,'NGN',7000);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Budget overspend reservation was accepted'; end;

  perform private.consume_offer_campaign_reservation(v_res);
  perform private.consume_offer_campaign_reservation(v_res);
  if not exists(select 1 from private.offer_campaign_budgets
    where offer_id=v_offer and currency='NGN' and reserved_minor=0 and consumed_minor=4000) then
    raise exception 'Consumption or idempotent consume did not reconcile';
  end;

  v_res := private.reserve_offer_campaign_budget(v_order || '-release',v_offer,'NGN',3000);
  perform private.release_offer_campaign_reservation(v_res,'test cancellation');
  perform private.release_offer_campaign_reservation(v_res,'retry release');
  if not exists(select 1 from private.offer_campaign_budgets
    where offer_id=v_offer and currency='NGN' and reserved_minor=0 and consumed_minor=4000) then
    raise exception 'Release did not restore reserved budget';
  end;

  v_failed := false;
  begin
    perform private.release_offer_campaign_reservation(v_res,'cannot release consumed');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Terminal reservation transition was accepted'; end;

  if has_function_privilege('anon','public.set_offer_store_funding_consent(text,text,integer)','EXECUTE')
     or has_function_privilege('anon','public.revoke_offer_store_funding_consent(text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.approve_offer_campaign_budget(text,text,bigint,text)','EXECUTE')
     or has_function_privilege('service_role','private.reserve_offer_campaign_budget(text,text,text,bigint)','EXECUTE')
     or has_function_privilege('authenticated','private.reserve_offer_campaign_budget(text,text,text,bigint)','EXECUTE') then
    raise exception 'Unexpected API role can execute funding controls';
  end if;
  if not has_function_privilege('authenticated','public.set_offer_store_funding_consent(text,text,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.revoke_offer_store_funding_consent(text,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.approve_offer_campaign_budget(text,text,bigint,text)','EXECUTE') then
    raise exception 'Authenticated grant missing from intended RPCs';
  end if;
end
$$;

rollback;
