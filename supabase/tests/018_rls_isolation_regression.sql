-- WEB-Q01: real JWT/RLS negative-access regression tests.
-- Test fixtures are isolated in this transaction and rolled back.
begin;

create function public.zz_q01_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
end $$;

create function public.zz_q01_svc() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role service_role';
end $$;

create function public.zz_q01_back() returns void
language plpgsql as $$ begin execute 'reset role'; end $$;

create function public.zz_q01_try(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return 'ERR: ' || sqlerrm;
end $$;

do $test$
declare
  v_buyer_a uuid := gen_random_uuid();
  v_buyer_b uuid := gen_random_uuid();
  v_seller_a uuid := gen_random_uuid();
  v_seller_b uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_store_a text;
  v_store_b text;
  v_product_a text;
  v_product_b text;
  v_draft_b text;
  v_order_a jsonb;
  v_order_b jsonb;
  v_order_a_id text;
  v_order_b_id text;
  v_seller_order_a text;
  v_seller_order_b text;
  v_chat_id uuid;
  v_result text;
  v_count integer;
  v_status text;
  v_customer_a jsonb := '{"name":"Q01 Buyer A","phone":"08000000001","street":"1 Test Road","city":"Ikeja","state":"Lagos","email":"q01-a@test.local"}';
  v_customer_b jsonb := '{"name":"Q01 Buyer B","phone":"08000000002","street":"2 Test Road","city":"Ikeja","state":"Lagos","email":"q01-b@test.local"}';
begin
  insert into auth.users(id,email,aud,role)
  values
    (v_buyer_a,'q01-buyer-a-'||v_buyer_a||'@test.local','authenticated','authenticated'),
    (v_buyer_b,'q01-buyer-b-'||v_buyer_b||'@test.local','authenticated','authenticated'),
    (v_seller_a,'q01-seller-a-'||v_seller_a||'@test.local','authenticated','authenticated'),
    (v_seller_b,'q01-seller-b-'||v_seller_b||'@test.local','authenticated','authenticated'),
    (v_admin,'q01-admin-'||v_admin||'@test.local','authenticated','authenticated');

  update public.profiles set role='admin' where id=v_admin;

  -- Create the two stores first; products cannot enter review until their store is approved.
  perform public.zz_q01_as(v_seller_a);
  insert into public.stores(owner_id,name,about,status,country,state,city)
  values(v_seller_a,'Q01 Store A','Isolation fixture','draft','NG','Lagos','Ikeja')
  returning id into v_store_a;
  v_result := public.zz_q01_try(format('update public.stores set status=%L where id=%L','approved',v_store_a));
  if v_result='ok' and exists(select 1 from public.stores where id=v_store_a and status='approved') then
    raise exception 'Seller approved own store';
  end if;
  if (select status from public.stores where id=v_store_a)<>'draft' then
    raise exception 'Seller A store status changed before admin approval';
  end if;
  perform public.zz_q01_back();

  perform public.zz_q01_as(v_seller_b);
  insert into public.stores(owner_id,name,about,status,country,state,city)
  values(v_seller_b,'Q01 Store B','Isolation fixture','draft','NG','Lagos','Ikeja')
  returning id into v_store_b;
  perform public.zz_q01_back();

  perform public.zz_q01_as(v_admin);
  perform public.approve_store(v_store_a,'Q01 fixture');
  perform public.approve_store(v_store_b,'Q01 fixture');
  perform public.zz_q01_back();

  perform public.zz_q01_as(v_seller_a);
  update public.store_private set pickup_address='Q01 private address A',phone='08000000011' where store_id=v_store_a;
  insert into public.products(name,col,price,stock,store_id,status)
  values('Q01 Product A','Test',1200,5,v_store_a,'draft')
  returning id into v_product_a;
  update public.products set status='pending_review' where id=v_product_a;
  insert into public.product_private(product_id,compliance_ref)
  values(v_product_a,'Q01-PRIVATE-A');
  perform public.zz_q01_back();

  perform public.zz_q01_as(v_seller_b);
  update public.store_private set pickup_address='Q01 private address B',phone='08000000022' where store_id=v_store_b;
  insert into public.products(name,col,price,stock,store_id,status)
  values('Q01 Product B','Test',2400,5,v_store_b,'draft')
  returning id into v_product_b;
  update public.products set status='pending_review' where id=v_product_b;
  insert into public.product_private(product_id,compliance_ref)
  values(v_product_b,'Q01-PRIVATE-B');
  insert into public.products(name,col,price,stock,store_id,status)
  values('Q01 Draft B','Test',900,2,v_store_b,'draft')
  returning id into v_draft_b;
  perform public.zz_q01_back();

  perform public.zz_q01_as(v_admin);
  perform public.review_product(v_product_a,'publish');
  perform public.review_product(v_product_b,'publish');
  perform public.zz_q01_back();

  -- Create one buyer-owned order per buyer through the server-side order path.
  perform public.zz_q01_svc();
  v_order_a := public.create_order(
    v_buyer_a,jsonb_build_array(jsonb_build_object('id',v_product_a,'size','','qty',1)),
    'NG','bank',v_customer_a,1,'NGN',0,null,0,null
  );
  v_order_a_id := v_order_a->>'id';
  perform public.confirm_payment(v_order_a_id,'Q01-REF-A');

  v_order_b := public.create_order(
    v_buyer_b,jsonb_build_array(jsonb_build_object('id',v_product_b,'size','','qty',1)),
    'NG','bank',v_customer_b,1,'NGN',0,null,0,null
  );
  v_order_b_id := v_order_b->>'id';
  perform public.confirm_payment(v_order_b_id,'Q01-REF-B');

  select id into v_seller_order_a from public.seller_orders where order_id=v_order_a_id and store_id=v_store_a;
  select id into v_seller_order_b from public.seller_orders where order_id=v_order_b_id and store_id=v_store_b;
  update public.seller_orders set released=true where id in (v_seller_order_a,v_seller_order_b);

  -- Service-owned financial fixtures; clients only receive scoped SELECT access.
  -- confirm_payment creates the sale and commission ledger entries for each seller order.
  insert into public.payouts(store_id,amount,currency,reference,method)
  values(v_store_a,100,'NGN','Q01-PAYOUT-A','bank_transfer'),
        (v_store_b,200,'NGN','Q01-PAYOUT-B','bank_transfer');
  perform public.zz_q01_back();

  -- Buyer A starts a private support conversation. Buyer B is not a member.
  perform public.zz_q01_as(v_buyer_a);
  v_chat_id := public.chat_start('support',null,null,'Q01 private support',null,null);
  perform public.zz_q01_back();

  -- Buyer isolation: order, order items and delivery secrets must not cross buyer boundaries.
  perform public.zz_q01_as(v_buyer_a);
  select count(*) into v_count from public.orders where id=v_order_b_id;
  if v_count<>0 then raise exception 'Buyer A can read Buyer B order'; end if;
  select count(*) into v_count from public.order_items where order_id=v_order_b_id;
  if v_count<>0 then raise exception 'Buyer A can read Buyer B order items'; end if;
  select count(*) into v_count from public.order_secrets where order_id=v_order_b_id;
  if v_count<>0 then raise exception 'Buyer A can read Buyer B delivery secret'; end if;
  v_result := public.zz_q01_try(format('update public.orders set status=%L where id=%L','cancelled',v_order_b_id));
  perform public.zz_q01_back();
  select status into v_status from public.orders where id=v_order_b_id;
  if v_status<>'paid' then raise exception 'Buyer A changed Buyer B order status'; end if;

  -- Seller A may see only released seller-order and financial rows for Store A.
  perform public.zz_q01_as(v_seller_a);
  select count(*) into v_count from public.seller_orders where id=v_seller_order_a;
  if v_count<>1 then raise exception 'Seller A cannot read own released seller order'; end if;
  select count(*) into v_count from public.seller_orders where id=v_seller_order_b;
  if v_count<>0 then raise exception 'Seller A can read Seller B seller order'; end if;
  select count(*) into v_count from public.ledger_entries where store_id=v_store_b;
  if v_count<>0 then raise exception 'Seller A can read Seller B ledger'; end if;
  select count(*) into v_count from public.payouts where store_id=v_store_b;
  if v_count<>0 then raise exception 'Seller A can read Seller B payouts'; end if;
  select count(*) into v_count from public.store_private where store_id=v_store_b;
  if v_count<>0 then raise exception 'Seller A can read Seller B private store data'; end if;
  select count(*) into v_count from public.product_private where product_id=v_product_b;
  if v_count<>0 then raise exception 'Seller A can read Seller B private product data'; end if;

  -- Public product rows are intentionally public after review; unpublished rows must remain hidden.
  select count(*) into v_count from public.products where id=v_product_b;
  if v_count<>1 then raise exception 'Published catalogue product should be public'; end if;
  select count(*) into v_count from public.products where id=v_draft_b;
  if v_count<>0 then raise exception 'Seller A can read Seller B draft product'; end if;

  v_result := public.zz_q01_try(format('update public.stores set status=%L where id=%L','suspended',v_store_b));
  select status into v_status from public.stores where id=v_store_b;
  if v_status<>'approved' then raise exception 'Seller A changed Seller B store status'; end if;
  v_result := public.zz_q01_try(format('update public.products set status=%L where id=%L','draft',v_product_b));
  select status into v_status from public.products where id=v_product_b;
  if v_status<>'published' then raise exception 'Seller A changed Seller B product status'; end if;
  v_result := public.zz_q01_try(format('update public.products set store_id=%L where id=%L',v_store_a,v_product_b));
  select store_id into v_status from public.products where id=v_product_b;
  if v_status<>v_store_b then raise exception 'Seller A reassigned Seller B product ownership'; end if;

  -- Seller cannot read admin support queue or escalate their own profile role.
  select count(*) into v_count from public.support_queue;
  if v_count<>0 then raise exception 'Seller can read admin support queue'; end if;
  v_result := public.zz_q01_try(format('update public.profiles set role=%L where id=%L','admin',v_seller_a));
  if v_result='ok' and exists(select 1 from public.profiles where id=v_seller_a and role='admin') then
    raise exception 'Seller escalated own profile to admin';
  end if;
  perform public.zz_q01_back();

  -- Buyer B cannot read Buyer A's private support conversation or messages.
  perform public.zz_q01_as(v_buyer_b);
  select count(*) into v_count from public.conversations where id=v_chat_id;
  if v_count<>0 then raise exception 'Non-member can read private support conversation'; end if;
  select count(*) into v_count from public.messages where conversation_id=v_chat_id;
  if v_count<>0 then raise exception 'Non-member can read private support messages'; end if;
  perform public.zz_q01_back();

  -- A non-admin cannot read admin-only support data; admin can read both stores and orders.
  perform public.zz_q01_as(v_admin);
  select count(*) into v_count from public.orders where id in (v_order_a_id,v_order_b_id);
  if v_count<>2 then raise exception 'Admin cannot read both buyer orders'; end if;
  select count(*) into v_count from public.store_private where store_id in (v_store_a,v_store_b);
  if v_count<>2 then raise exception 'Admin cannot read both stores private data'; end if;
  perform public.zz_q01_back();

  -- Anonymous clients see only the approved public catalogue, never private product data.
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  select count(*) into v_count from public.public_products where id=v_product_b;
  if v_count<>1 then raise exception 'Anonymous public catalogue read unexpectedly failed'; end if;
  select count(*) into v_count from public.public_products where id=v_draft_b;
  if v_count<>0 then raise exception 'Anonymous user can read draft product'; end if;
  perform public.zz_q01_back();
end
$test$;

rollback;
