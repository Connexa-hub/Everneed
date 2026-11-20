-- FIN-02A campaign reservation payment/cancellation lifecycle regression.
begin;
set local role postgres;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('app.order_bypass','1',true);

do $$
declare
  v_uid uuid;
  v_offer text:=gen_random_uuid()::text;
  v_order_paid text:=gen_random_uuid()::text;
  v_order_cancel text:=gen_random_uuid()::text;
  v_res uuid;
  v_status text;
  v_reserved bigint;
  v_consumed bigint;
begin
  select id into v_uid from auth.users limit 1;
  if v_uid is null then raise exception 'Test requires auth fixture.'; end if;
  insert into public.offers(id,name,kind,value,scope,active)
  values(v_offer,'Lifecycle fixture','fixed',1,'all',true);
  insert into private.offer_campaign_budgets(offer_id,currency,approved_budget_minor,approved_by,approval_note)
  values(v_offer,'NGN',1000,v_uid,'Lifecycle test budget');

  insert into public.orders(id,user_id,items,total,country,pm,cust,status,payment_status,at,currency,delivery_fee)
  values(v_order_paid,v_uid,'[]'::jsonb,1,'NG','card','{}'::jsonb,'awaiting_payment','awaiting_payment',
    (extract(epoch from now())*1000)::bigint,'NGN',0);
  update private.offer_campaign_budgets set reserved_minor=500 where offer_id=v_offer and currency='NGN';
  insert into private.offer_budget_reservations(order_id,offer_id,currency,amount_minor,status)
  values(v_order_paid,v_offer,'NGN',500,'reserved') returning id into v_res;
  update public.orders set payment_status='paid' where id=v_order_paid;
  select status into v_status from private.offer_budget_reservations where id=v_res;
  select reserved_minor,consumed_minor into v_reserved,v_consumed from private.offer_campaign_budgets where offer_id=v_offer and currency='NGN';
  if v_status<>'consumed' or v_reserved<>0 or v_consumed<>500 then
    raise exception 'Payment transition did not consume campaign reservation atomically.';
  end if;

  insert into public.orders(id,user_id,items,total,country,pm,cust,status,payment_status,at,currency,delivery_fee)
  values(v_order_cancel,v_uid,'[]'::jsonb,1,'NG','card','{}'::jsonb,'awaiting_payment','awaiting_payment',
    (extract(epoch from now())*1000)::bigint,'NGN',0);
  update private.offer_campaign_budgets set reserved_minor=400 where offer_id=v_offer and currency='NGN';
  insert into private.offer_budget_reservations(order_id,offer_id,currency,amount_minor,status)
  values(v_order_cancel,v_offer,'NGN',400,'reserved') returning id into v_res;
  update public.orders set status='cancelled' where id=v_order_cancel;
  select status into v_status from private.offer_budget_reservations where id=v_res;
  select reserved_minor,consumed_minor into v_reserved,v_consumed from private.offer_campaign_budgets where offer_id=v_offer and currency='NGN';
  if v_status<>'released' or v_reserved<>0 or v_consumed<>500 then
    raise exception 'Cancellation did not release the active campaign reservation.';
  end if;
end
$$;
rollback;
