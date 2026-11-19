-- Variant-aware checkout contract and privilege regression checks. Run after migration 20261119042700.
begin;
do $$
declare
  col text;
  checkout_def text;
  snapshot_def text;
  cancel_def text;
  restore_def text;
begin
  foreach col in array array['variant_id','variant_sku','variant_options','inventory_reserved','inventory_restored'] loop
    if not exists(select 1 from information_schema.columns c where table_schema='public' and table_name='order_items' and c.column_name=col) then
      raise exception 'FAIL: order_items.% missing',col;
    end if;
  end loop;

  checkout_def:=pg_get_functiondef('public.create_order(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text)'::regprocedure);
  if checkout_def not ilike '%product_variants%' or checkout_def not ilike '%variant_id%'
     or checkout_def not ilike '%sale_price%' or checkout_def not ilike '%checkout_reservation%'
     or checkout_def not ilike '%allow_backorder%' or checkout_def not ilike '%min_order_qty%'
     or checkout_def not ilike '%max_order_qty%' then
    raise exception 'FAIL: checkout is missing variant validation, pricing, quantity rules or audited reservation';
  end if;
  if checkout_def not ilike '%Choose an option%' or checkout_def not ilike '%selected product option%' then
    raise exception 'FAIL: checkout does not reject missing/invalid variant selections';
  end if;
  if not has_function_privilege('service_role','public.create_order(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text)','EXECUTE')
    or has_function_privilege('anon','public.create_order(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text)','EXECUTE')
    or has_function_privilege('authenticated','public.create_order(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text)','EXECUTE') then
    raise exception 'FAIL: checkout RPC grants do not remain service-role-only';
  end if;


  if not private.store_live('everneed-official') then raise exception 'FAIL: official Everneed store must remain publicly live without seller subscription'; end if;

  snapshot_def:=pg_get_functiondef('public.create_order_with_snapshot(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)'::regprocedure);
  if snapshot_def not ilike '%variant_id%' or snapshot_def not ilike '%variant_options%' or snapshot_def not ilike '%variant_sku%' then
    raise exception 'FAIL: immutable payment snapshot omits variant identity/options/SKU';
  end if;

  cancel_def:=pg_get_functiondef('private.cancel_so(text,text,uuid,text)'::regprocedure);
  if cancel_def not ilike '%restore_variant_order_item%' or cancel_def not ilike '%stock_add%' then
    raise exception 'FAIL: cancellation must restore variant reservations and retain legacy restoration';
  end if;

  restore_def:=pg_get_functiondef('private.restore_variant_order_item(text)'::regprocedure);
  if restore_def not ilike '%for update%' or restore_def not ilike '%inventory_reserved%'
     or restore_def not ilike '%inventory_restored%' or restore_def not ilike '%cancellation_restoration%' then
    raise exception 'FAIL: variant restoration is not locked, audited and idempotent';
  end if;
  if not has_function_privilege('service_role','private.restore_variant_order_item(text)','EXECUTE')
    or has_function_privilege('anon','private.restore_variant_order_item(text)','EXECUTE')
    or has_function_privilege('authenticated','private.restore_variant_order_item(text)','EXECUTE') then
    raise exception 'FAIL: variant restore helper is callable by client roles';
  end if;
end $$;
-- End-to-end smoke tests run as the local database owner/service caller and roll back all fixture rows.
do $$
declare
  buyer uuid:=gen_random_uuid();
  seller uuid:=gen_random_uuid();
  v_store_id text:=gen_random_uuid()::text;
  prod text:=gen_random_uuid()::text;
  other_prod text:=gen_random_uuid()::text;
  variant uuid;
  checkout jsonb;
  v_order_id text;
  seller_order_id text;
  stock_after integer;
  restored boolean;
  snapshot jsonb;
  caught boolean:=false;
  cust jsonb:=jsonb_build_object('name','CI buyer','phone','0000000000','city','Lokoja','state','Kogi','street','CI address');
  pricing jsonb:=jsonb_build_object('fx_rate',1,'markup_percent',0,'fx_source','ci-test','fx_fetched_at',now(),'pricing_policy_version','variant-ci','currency_exponent',2);
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_super_admin)
  values(buyer,'authenticated','authenticated','variant-ci-buyer-'||buyer||'@example.test','',now(),'{}'::jsonb,'{}'::jsonb,now(),now(),false),
        (seller,'authenticated','authenticated','variant-ci-seller-'||seller||'@example.test','',now(),'{}'::jsonb,'{}'::jsonb,now(),now(),false);
  insert into public.profiles(id,name,email,role) values(buyer,'Variant CI Buyer','variant-ci-buyer-'||buyer||'@example.test','customer'),
    (seller,'Variant CI Seller','variant-ci-seller-'||seller||'@example.test','merchant')
    on conflict(id) do update set name=excluded.name,email=excluded.email,role=excluded.role;
  insert into public.stores(id,owner_id,slug,name,status,activation_status,country,business_timezone)
  values(v_store_id,seller,'variant-ci-'||seller,'Variant CI Store','approved','live','NG','Africa/Lagos');
  insert into public.store_subscriptions(store_id,plan_id,status,current_period_start,current_period_end)
  values(v_store_id,'plan-starter','trialing',now(),now()+interval '30 days');
  insert into public.products(id,name,col,price,store_id,status,slug,stock)
  values(prod,'Variant checkout CI product',(select id from public.collections order by id limit 1),1000,v_store_id,'published',prod,99),
        (other_prod,'Variant mismatch CI product',(select id from public.collections order by id limit 1),1000,v_store_id,'published',other_prod,99);
  insert into public.product_variants(product_id,store_id,sku,option_values,price,sale_price,sale_starts_at,sale_ends_at,stock,track_stock,allow_backorder,active)
  values(prod,v_store_id,'VAR-CI-SKU',jsonb_build_object('Colour','Blue','Size','M'),1200,900,now()-interval '1 hour',now()+interval '1 day',5,true,false,true)
  returning id into variant;

  -- A product with active variants cannot be checked out without a selection.
  begin
    perform public.create_order(buyer,jsonb_build_array(jsonb_build_object('id',prod,'qty',1)),'NG','bank',cust,1,'NGN',0,null,0,null);
  exception when others then caught:=true;
  end;
  if not caught then raise exception 'FAIL: checkout accepted a variant-required product without a variant'; end if;
  caught:=false;

  -- Wrong product/variant pair is rejected before stock is touched.
  begin
    perform public.create_order(buyer,jsonb_build_array(jsonb_build_object('id',other_prod,'variant_id',variant,'qty',1)),'NG','bank',cust,1,'NGN',0,null,0,null);
  exception when others then caught:=true;
  end;
  if not caught then raise exception 'FAIL: checkout accepted a variant belonging to another product'; end if;
  select stock into stock_after from public.product_variants where id=variant;
  if stock_after<>5 then raise exception 'FAIL: rejected cart changed variant stock'; end if;

  -- Oversell attempt fails without changing tracked stock.
  begin
    perform public.create_order(buyer,jsonb_build_array(jsonb_build_object('id',prod,'variant_id',variant,'qty',6)),'NG','bank',cust,1,'NGN',0,null,0,null);
  exception when others then caught:=true;
  end;
  if not caught then raise exception 'FAIL: checkout allowed an oversell beyond tracked variant stock'; end if;
  caught:=false;
  select stock into stock_after from public.product_variants where id=variant;
  if stock_after<>5 then raise exception 'FAIL: oversell attempt changed inventory'; end if;

  -- Inactive variants are rejected even when the UUID belongs to this product.
  update public.product_variants set active=false where id=variant;
  begin
    perform public.create_order(buyer,jsonb_build_array(jsonb_build_object('id',prod,'variant_id',variant,'qty',2)),'NG','bank',cust,1,'NGN',0,null,0,null);
  exception when others then caught:=true;
  end;
  if not caught then raise exception 'FAIL: checkout accepted an inactive variant'; end if;
  caught:=false;
  update public.product_variants set active=true where id=variant;
  select stock into stock_after from public.product_variants where id=variant;
  if stock_after<>5 then raise exception 'FAIL: inactive variant rejection changed stock'; end if;

  -- Variant sale price is server-resolved, and stock is reserved/audited atomically.
  checkout:=public.create_order(buyer,jsonb_build_array(jsonb_build_object('id',prod,'variant_id',variant,'qty',2)),'NG','bank',cust,1,'NGN',0,null,0,null);
  v_order_id:=checkout->>'id';
  select so.id into seller_order_id from public.seller_orders so where so.order_id=v_order_id and so.store_id=v_store_id;
  select stock into stock_after from public.product_variants where id=variant;
  if stock_after<>3 then raise exception 'FAIL: variant stock was not reserved (expected 3, got %)',stock_after; end if;
  if not exists(select 1 from public.order_items oi where oi.order_id=v_order_id and oi.variant_id=variant and variant_sku='VAR-CI-SKU'
      and variant_options=jsonb_build_object('Colour','Blue','Size','M') and unit_price=900 and line_total=1800 and inventory_reserved and not inventory_restored) then
    raise exception 'FAIL: order item did not preserve authoritative variant price/SKU/options/reservation';
  end if;
  if not exists(select 1 from public.product_inventory_movements where variant_id=variant and reason='checkout_reservation' and delta=-2 and reference=v_order_id) then
    raise exception 'FAIL: checkout reservation movement was not audited with order reference';
  end if;

  -- Cancel/reject restores a reservation exactly once.
  perform private.cancel_so(seller_order_id,'CI cancellation',seller,'cancelled');
  perform private.cancel_so(seller_order_id,'CI duplicate cancellation',seller,'cancelled');
  select stock into stock_after from public.product_variants where id=variant;
  select oi.inventory_restored into restored from public.order_items oi where oi.order_id=v_order_id and oi.variant_id=variant;
  if stock_after<>5 or not restored then raise exception 'FAIL: cancellation did not restore stock exactly once'; end if;
  if (select count(*) from public.product_inventory_movements where variant_id=variant and reason='cancellation_restoration' and delta=2)<>1 then
    raise exception 'FAIL: duplicate cancellation produced duplicate restoration movement';
  end if;

  -- Sale price must stop applying after its configured end time.
  update public.product_variants set sale_ends_at=now()-interval '1 minute' where id=variant;
  checkout:=public.create_order(buyer,jsonb_build_array(jsonb_build_object('id',prod,'variant_id',variant,'qty',1)),'NG','bank',cust,1,'NGN',0,null,0,null);
  v_order_id:=checkout->>'id';
  select so.id into seller_order_id from public.seller_orders so where so.order_id=v_order_id and so.store_id=v_store_id;
  if not exists(select 1 from public.order_items oi where oi.order_id=v_order_id and oi.variant_id=variant and oi.unit_price=1200 and oi.line_total=1200) then
    raise exception 'FAIL: expired sale price was still used';
  end if;
  perform private.cancel_so(seller_order_id,'CI expired-sale test cleanup',seller,'cancelled');
  select stock into stock_after from public.product_variants where id=variant;
  if stock_after<>5 then raise exception 'FAIL: expired-sale test cleanup did not restore stock'; end if;
  update public.product_variants set sale_ends_at=now()+interval '1 day' where id=variant;

  -- Snapshot-backed card checkout retains variant identity and options.
  checkout:=public.create_order_with_snapshot(buyer,jsonb_build_array(jsonb_build_object('id',prod,'variant_id',variant,'qty',1)),'NG','card',cust,1,'NGN',0,null,0,null,pricing);
  v_order_id:=checkout->>'id';
  select checkout_snapshot into snapshot from public.orders where id=v_order_id;
  if snapshot->'items'->0->>'variant_id'<>variant::text
     or snapshot->'items'->0->>'variant_sku'<>'VAR-CI-SKU'
     or snapshot->'items'->0->'variant_options'<>jsonb_build_object('Colour','Blue','Size','M') then
    raise exception 'FAIL: immutable payment snapshot omitted variant selection';
  end if;
  select stock into stock_after from public.product_variants where id=variant;
  if stock_after<>4 then raise exception 'FAIL: snapshot checkout did not reserve one unit'; end if;

  -- Backorders may reserve below zero only when enabled; cancellation restores the prior quantity.
  update public.product_variants set stock=0,allow_backorder=true,track_stock=true where id=variant;
  checkout:=public.create_order(buyer,jsonb_build_array(jsonb_build_object('id',prod,'variant_id',variant,'qty',1)),'NG','bank',cust,1,'NGN',0,null,0,null);
  v_order_id:=checkout->>'id';
  select so.id into seller_order_id from public.seller_orders so where so.order_id=v_order_id and so.store_id=v_store_id;
  select stock into stock_after from public.product_variants where id=variant;
  if stock_after<>-1 then raise exception 'FAIL: permitted backorder was not recorded as -1'; end if;
  perform private.cancel_so(seller_order_id,'CI backorder cancellation',seller,'cancelled');
  select stock into stock_after from public.product_variants where id=variant;
  if stock_after<>0 then raise exception 'FAIL: backorder cancellation did not restore stock to zero'; end if;

  -- Untracked variants do not decrement or restore stock.
  update public.product_variants set stock=3,allow_backorder=false,track_stock=false where id=variant;
  checkout:=public.create_order(buyer,jsonb_build_array(jsonb_build_object('id',prod,'variant_id',variant,'qty',1)),'NG','bank',cust,1,'NGN',0,null,0,null);
  v_order_id:=checkout->>'id';
  select so.id into seller_order_id from public.seller_orders so where so.order_id=v_order_id and so.store_id=v_store_id;
  select stock into stock_after from public.product_variants where id=variant;
  if stock_after<>3 or exists(select 1 from public.order_items oi where oi.order_id=v_order_id and oi.variant_id=variant and inventory_reserved) then
    raise exception 'FAIL: untracked variant stock was decremented or marked reserved';
  end if;
  perform private.cancel_so(seller_order_id,'CI untracked cancellation',seller,'cancelled');
  select stock into stock_after from public.product_variants where id=variant;
  if stock_after<>3 then raise exception 'FAIL: cancellation changed untracked stock'; end if;
end $$;

rollback;
