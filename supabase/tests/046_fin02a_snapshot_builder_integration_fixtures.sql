-- FIN-02A deterministic snapshot builder integration tests. All fixture rows roll back.
begin;
set local role postgres;
select set_config('request.jwt.claim.role','service_role',true);

do $$
declare
  v_uid uuid;
  v_store text := 'everneed-official';
  v_offer text := gen_random_uuid()::text;
  v_order text;
  v_item text;
  v_so text;
  v_snapshot jsonb;
  v_v1 jsonb;
  v_res uuid;
  v_amount bigint;
begin
  select id into v_uid from auth.users limit 1;
  if v_uid is null then raise exception 'Test requires an auth user fixture.'; end if;

  insert into public.offers(id,name,kind,value,scope,code,active)
  values(v_offer,'Snapshot test promotion','fixed',20,'all','FIN02A_TEST_'||substr(v_offer,1,8),true);

  insert into private.offer_campaign_budgets(offer_id,currency,approved_budget_minor,reserved_minor,consumed_minor,approved_by,approval_note)
  values(v_offer,'NGN',5000,0,0,v_uid,'Test fixture approved budget');

  -- Scenario A: no seller opt-in => platform funded, budget hold required.
  v_order := gen_random_uuid()::text;
  v_so := gen_random_uuid()::text;
  v_item := gen_random_uuid()::text;
  v_v1 := jsonb_build_object('schema_version',1,'order_id',v_order,'currency','NGN','currency_exponent',2,
      'pricing',jsonb_build_object('fx_rate',1,'fx_source','test','fx_fetched_at',now(),'markup_percent',0,'effective_rate',1,'pricing_policy_version','test-pricing-v1'),
      'amounts',jsonb_build_object('gross_merchandise_minor',10000,'net_merchandise_minor',8000,'allocated_discount_minor',2000,
        'delivery_fee_minor',0,'total_minor',8000),
      'items',jsonb_build_array(jsonb_build_object('order_item_id',v_item,'gross_minor',10000,'net_refundable_minor',8000)));
  insert into public.orders(id,user_id,items,total,country,pm,cust,status,payment_status,at,currency,discount,offer,delivery_fee,financial_offer_id,checkout_snapshot_version,checkout_snapshot,checkout_snapshot_hash)
  values(v_order,v_uid,'[]'::jsonb,80,'NG','card','{}'::jsonb,'awaiting_payment','awaiting_payment',
    (extract(epoch from now())*1000)::bigint,'NGN',20,jsonb_build_object('name','Snapshot test promotion','kind','fixed','value',20),0,v_offer,
    1,v_v1,encode(extensions.digest(convert_to(v_v1::text,'UTF8'),'sha256'),'hex'));
  insert into public.seller_orders(id,order_id,store_id,subtotal)
  values(v_so,v_order,v_store,100);
  insert into public.order_items(id,order_id,seller_order_id,store_id,name,size,unit_price,qty,line_total)
  values(v_item,v_order,v_so,v_store,'Test allocation item',null,100,1,100);
  insert into public.order_item_fees(order_item_id,commission_rate,commission_amount) values(v_item,10,10);

  v_snapshot := private.build_order_financial_snapshot_v2(v_order);
  if (v_snapshot->'amounts'->>'platform_funded_discount_minor')::bigint<>2000
     or (v_snapshot->'amounts'->>'seller_funded_discount_minor')::bigint<>0
     or (v_snapshot->'amounts'->>'seller_payable_minor')::bigint<>9000
     or (v_snapshot->'amounts'->>'commission_minor')::bigint<>1000 then
    raise exception 'Platform-funded scenario failed allocation reconciliation.';
  end if;
  select id,amount_minor into v_res,v_amount from private.offer_budget_reservations where order_id=v_order;
  if v_res is null or v_amount<>2000 then raise exception 'Campaign budget reservation was not created at the exact subsidy amount.'; end if;
  if not exists(select 1 from private.order_financial_snapshots_v2 where order_id=v_order) then
    raise exception 'Immutable v2 snapshot was not persisted.';
  end if;

  -- Scenario B: explicit 100% seller consent => no platform budget reservation.
  insert into private.offer_store_funding_consent(offer_id,store_id,seller_funding_bps,consented_by)
  values(v_offer,v_store,10000,v_uid);
  v_order := gen_random_uuid()::text;
  v_so := gen_random_uuid()::text;
  v_item := gen_random_uuid()::text;
  v_v1 := jsonb_build_object('schema_version',1,'order_id',v_order,'currency','NGN','currency_exponent',2,
      'pricing',jsonb_build_object('fx_rate',1,'fx_source','test','fx_fetched_at',now(),'markup_percent',0,'effective_rate',1,'pricing_policy_version','test-pricing-v1'),
      'amounts',jsonb_build_object('gross_merchandise_minor',10000,'net_merchandise_minor',8000,'allocated_discount_minor',2000,
        'delivery_fee_minor',0,'total_minor',8000),
      'items',jsonb_build_array(jsonb_build_object('order_item_id',v_item,'gross_minor',10000,'net_refundable_minor',8000)));
  insert into public.orders(id,user_id,items,total,country,pm,cust,status,payment_status,at,currency,discount,offer,delivery_fee,financial_offer_id,checkout_snapshot_version,checkout_snapshot,checkout_snapshot_hash)
  values(v_order,v_uid,'[]'::jsonb,80,'NG','card','{}'::jsonb,'awaiting_payment','awaiting_payment',
    (extract(epoch from now())*1000)::bigint,'NGN',20,jsonb_build_object('name','Snapshot test promotion','kind','fixed','value',20),0,v_offer,
    1,v_v1,encode(extensions.digest(convert_to(v_v1::text,'UTF8'),'sha256'),'hex'));
  insert into public.seller_orders(id,order_id,store_id,subtotal) values(v_so,v_order,v_store,100);
  insert into public.order_items(id,order_id,seller_order_id,store_id,name,size,unit_price,qty,line_total)
  values(v_item,v_order,v_so,v_store,'Test allocation item',null,100,1,100);
  insert into public.order_item_fees(order_item_id,commission_rate,commission_amount) values(v_item,10,10);
  v_snapshot := private.build_order_financial_snapshot_v2(v_order);
  if (v_snapshot->'amounts'->>'seller_funded_discount_minor')::bigint<>2000
     or (v_snapshot->'amounts'->>'platform_funded_discount_minor')::bigint<>0
     or (v_snapshot->'amounts'->>'seller_payable_minor')::bigint<>7200
     or (v_snapshot->'amounts'->>'commission_minor')::bigint<>800 then
    raise exception 'Seller-funded scenario failed allocation reconciliation.';
  end if;
  if exists(select 1 from private.offer_budget_reservations where order_id=v_order) then
    raise exception 'Seller-funded discount unexpectedly reserved platform campaign budget.';
  end if;
end
$$;
rollback;
