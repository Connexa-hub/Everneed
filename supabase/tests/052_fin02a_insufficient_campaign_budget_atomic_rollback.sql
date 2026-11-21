-- FIN-02A insufficient platform campaign budget must abort the entire checkout transaction.
begin;
set local role postgres;
select set_config('request.jwt.claim.role','service_role',true);
do $$
declare
  v_uid uuid:=gen_random_uuid();
  v_offer text:=gen_random_uuid()::text;
  v_product text:=gen_random_uuid()::text;
  v_result jsonb;
  v_err text;
  v_order_count integer;
  v_reservation_count integer;
  v_reserved bigint;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_uid,'authenticated','authenticated','fin02a-budget-fail-'||v_uid::text||'@example.test','',
    '{}'::jsonb,'{}'::jsonb,now(),now());
  insert into public.offers(id,name,kind,value,scope,active)
  values(v_offer,'Insufficient budget rollback fixture','fixed',20,'all',true);
  insert into private.offer_campaign_budgets(offer_id,currency,approved_budget_minor,reserved_minor,consumed_minor,approved_by,approval_note)
  values(v_offer,'NGN',1000,0,0,v_uid,'Insufficient-budget rollback fixture');
  insert into public.products(id,name,col,price,store_id,status,stock,track_stock)
  values(v_product,'FIN02A budget rollback product','other',100,'everneed-official','published',null,false);

  begin
    v_result:=public.create_order_with_financial_snapshot_v2(
      v_uid,jsonb_build_array(jsonb_build_object('id',v_product,'size','','qty',1)),
      'NG','card',
      jsonb_build_object('name','Budget Test Buyer','phone','0000000000','street','Test Road','city','Test City','state','Test State'),
      1,'NGN',20,
      jsonb_build_object('id',v_offer,'code',null,'name','Insufficient budget rollback fixture','kind','fixed','value',20),
      0,null,
      jsonb_build_object('fx_rate',1,'fx_source','test fixture','fx_fetched_at',now(),'markup_percent',0,'currency_exponent',2,'pricing_policy_version','test-pricing-v1')
    );
    raise exception 'Checkout unexpectedly succeeded with insufficient approved campaign budget.';
  exception when others then
    v_err:=sqlerrm;
  end;
  if v_err not like '%Campaign budget would be exceeded%' then
    raise exception 'Expected budget-exceeded rejection, got: %',v_err;
  end if;
  select count(*) into v_order_count from public.orders where user_id=v_uid;
  select count(*) into v_reservation_count from private.offer_budget_reservations where offer_id=v_offer;
  select reserved_minor into v_reserved from private.offer_campaign_budgets where offer_id=v_offer and currency='NGN';
  if v_order_count<>0 or v_reservation_count<>0 or v_reserved<>0 then
    raise exception 'Failed checkout leaked order/reservation/budget mutations: orders %, reservations %, reserved %',
      v_order_count,v_reservation_count,v_reserved;
  end if;
end
$$;
rollback;
