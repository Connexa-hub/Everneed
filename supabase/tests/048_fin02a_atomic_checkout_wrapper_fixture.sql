-- FIN-02A end-to-end atomic card checkout wrapper fixture. Everything rolls back.
begin;
set local role postgres;
select set_config('request.jwt.claim.role','service_role',true);

do $$
declare
  v_uid uuid;
  v_offer text:=gen_random_uuid()::text;
  v_product text:=gen_random_uuid()::text;
  v_order jsonb;
  v_order_id text;
  v_snapshot jsonb;
  v_reservation bigint;
begin
  select id into v_uid from auth.users limit 1;
  if v_uid is null then raise exception 'Test requires auth fixture.'; end if;

  insert into public.offers(id,name,kind,value,scope,active)
  values(v_offer,'Atomic wrapper fixture','fixed',20,'all',true);
  insert into private.offer_campaign_budgets(offer_id,currency,approved_budget_minor,approved_by,approval_note)
  values(v_offer,'NGN',3000,gen_random_uuid(),'Approved rollback fixture budget');

  insert into public.products(id,name,col,price,store_id,status,stock,track_stock)
  values(v_product,'FIN02A Atomic Test Product','other',100,'382b84b5-5bd9-4448-bd07-b0bada0121ca','published',null,false);

  v_order := public.create_order_with_financial_snapshot_v2(
    v_uid,
    jsonb_build_array(jsonb_build_object('id',v_product,'size','','qty',1)),
    'NG','card',
    jsonb_build_object('name','Test Buyer','phone','0000000000','street','Test Road','city','Test City','state','Test State'),
    1,'NGN',20,
    jsonb_build_object('id',v_offer,'code',null,'name','Atomic wrapper fixture','kind','fixed','value',20),
    0,null,
    jsonb_build_object('fx_rate',1,'fx_source','test fixture','fx_fetched_at',now(),'markup_percent',0,'currency_exponent',2,'pricing_policy_version','test-pricing-v1')
  );
  v_order_id:=v_order->>'id';
  v_snapshot:=v_order->'financial_snapshot_v2';
  if v_order_id is null or v_snapshot->>'schema_version'<>'2' then
    raise exception 'Atomic wrapper did not return the v2 snapshot.';
  end if;
  if (v_snapshot->'amounts'->>'gross_merchandise_minor')::bigint<>10000
     or (v_snapshot->'amounts'->>'net_merchandise_minor')::bigint<>8000
     or (v_snapshot->'amounts'->>'platform_funded_discount_minor')::bigint<>2000
     or (v_snapshot->'amounts'->>'seller_payable_minor')::bigint<>9000
     or (v_snapshot->'amounts'->>'commission_minor')::bigint<>1000 then
    raise exception 'Atomic wrapper allocation values are incorrect.';
  end if;
  if not exists(select 1 from private.order_financial_snapshots_v2 where order_id=v_order_id)
     or not exists(select 1 from public.orders where id=v_order_id and financial_offer_id=v_offer and checkout_snapshot_version=1) then
    raise exception 'Order quote, promotion identity or immutable v2 snapshot not persisted.';
  end if;
  select amount_minor into v_reservation from private.offer_budget_reservations where order_id=v_order_id;
  if v_reservation<>2000 then raise exception 'Platform campaign budget hold is not exact.'; end if;
end
$$;
rollback;
