-- FIN-02A campaign budget holds must reject aggregate over-reservation.
begin;
set local role postgres;
do $$
declare
  v_offer text:=gen_random_uuid()::text;
  v_order1 text:=gen_random_uuid()::text;
  v_order2 text:=gen_random_uuid()::text;
  v_uid uuid:=gen_random_uuid();
  v_res1 uuid;
  v_err text;
  v_reserved bigint;
  v_count integer;
begin
  insert into public.offers(id,name,kind,value,scope,active)
  values(v_offer,'Budget hold boundary fixture','fixed',0,'all',true);
  insert into private.offer_campaign_budgets(offer_id,currency,approved_budget_minor,reserved_minor,consumed_minor,approved_by,approval_note)
  values(v_offer,'NGN',1000,0,0,v_uid,'Budget hold boundary fixture');

  v_res1:=private.reserve_offer_campaign_budget(v_order1,v_offer,'NGN',600);
  begin
    perform private.reserve_offer_campaign_budget(v_order2,v_offer,'NGN',600);
    raise exception 'Second reservation unexpectedly exceeded budget.';
  exception when others then
    v_err:=sqlerrm;
  end;
  if v_err not like '%Campaign budget would be exceeded%' then
    raise exception 'Expected aggregate budget rejection, got: %',v_err;
  end if;
  select reserved_minor into v_reserved from private.offer_campaign_budgets where offer_id=v_offer and currency='NGN';
  select count(*) into v_count from private.offer_budget_reservations where offer_id=v_offer and status='reserved';
  if v_reserved<>600 or v_count<>1 then
    raise exception 'Budget over-reservation guard failed: reserved %, active holds %',v_reserved,v_count;
  end if;
  if not exists(select 1 from private.offer_budget_reservations where id=v_res1 and amount_minor=600 and status='reserved') then
    raise exception 'First reservation was not persisted correctly.';
  end if;
end
$$;
rollback;
