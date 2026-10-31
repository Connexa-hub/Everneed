-- Phase 2 checks (migrations 000-007 applied). One transaction; ends with an exception carrying the report so nothing persists.
create function public.zz_as(u uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true); execute 'set local role authenticated'; end $$;
create function public.zz_anon() returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.sub', '', true); execute 'set local role anon'; end $$;
create function public.zz_svc() returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true); perform set_config('request.jwt.claim.sub', '', true); execute 'set local role service_role'; end $$;
create function public.zz_back() returns void language plpgsql as $$ begin execute 'reset role'; end $$;
create function public.zz_try(q text) returns text language plpgsql as $$ begin execute q; return 'ok'; exception when others then return 'ERR: ' || sqlerrm; end $$;
create function public.zz_n(q text) returns bigint language plpgsql as $$ declare n bigint; begin execute q into n; return n; exception when others then return -1; end $$;
create function public.zz_ok(label text, cond boolean) returns text language sql as $$ select case when coalesce(cond, false) then 'PASS  ' else 'FAIL  ' end || label || E'\n' $$;

do $$
declare
  ua uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); uc2 uuid := gen_random_uuid(); um1 uuid := gen_random_uuid(); um2 uuid := gen_random_uuid();
  r text := ''; sA text; sB text; p1 text; p2 text; p3 text; p4 text; o1 jsonb; o2 jsonb; o3 jsonb; o4 jsonb; o5 jsonb; o6 jsonb; oid text; soA text; soB text; so3 text;
  cust jsonb := '{"name":"Ada Obi","phone":"08011112222","street":"1 Market Rd","city":"Ikeja","state":"Lagos","email":"ada@test.local"}';
  code text; v bigint; t text; j jsonb; bal numeric;
begin
  insert into auth.users(id, email, aud, role) values (ua, 'admin@t.local', 'authenticated', 'authenticated'), (uc, 'c1@t.local', 'authenticated', 'authenticated'),
    (uc2, 'c2@t.local', 'authenticated', 'authenticated'), (um1, 'm1@t.local', 'authenticated', 'authenticated'), (um2, 'm2@t.local', 'authenticated', 'authenticated');
  update public.profiles set role = 'admin' where id = ua;

  -- merchants create and submit stores ------------------------------------------------------------------
  perform public.zz_as(um1);
  insert into public.stores(owner_id, name, about, status, country, state, city) values (um1, 'Urban Finds', 'Bags', 'draft', 'NG', 'Lagos', 'Ikeja') returning id into sA;
  r := r || public.zz_ok('merchant creates own draft store (slug generated)', (select slug from public.stores where id = sA) = 'urban-finds');
  r := r || public.zz_ok('merchant cannot create an approved store', public.zz_try(format($q$insert into public.stores(owner_id,name,status) values (%L,'X2','approved')$q$, um1)) like 'ERR%');
  r := r || public.zz_ok('merchant cannot approve own store', public.zz_try(format($q$update public.stores set status='approved' where id=%L$q$, sA)) like 'ERR%');
  r := r || public.zz_ok('merchant cannot mark own store official', public.zz_try(format($q$update public.stores set is_official=true where id=%L$q$, sA)) like 'ERR%');
  r := r || public.zz_ok('merchant cannot make self admin', public.zz_try(format($q$update public.profiles set role='admin' where id=%L$q$, um1)) like 'ERR%' or (select role from public.profiles where id = um1) = 'customer');
  insert into public.store_private(store_id, pickup_address, phone, direct_delivery_enabled, delivery_zones) values (sA, 'Shop 1 Ikeja', '08030000000', true, '["Lagos"]');
  r := r || public.zz_ok('merchant cannot set own commission override', public.zz_try(format($q$update public.store_private set commission_override=0 where store_id=%L$q$, sA)) like 'ERR%');
  insert into public.store_applications(store_id, business_name, id_type, id_ref, bank_name, account_number, account_name) values (sA, 'Urban Finds Ltd', 'NIN', '123', 'GTB', '0123456789', 'Urban Finds');
  perform public.submit_store(sA);
  perform public.zz_back();
  perform public.zz_as(um2);
  insert into public.stores(owner_id, name, status, country, state, city) values (um2, 'TechNest', 'draft', 'NG', 'Abuja', 'Abuja') returning id into sB;
  insert into public.store_applications(store_id, business_name, id_type, id_ref, bank_name, account_number, account_name) values (sB, 'TechNest Ltd', 'NIN', '456', 'GTB', '0987654321', 'TechNest');
  perform public.submit_store(sB);
  perform public.zz_back();

  -- admin approves; roles change only through the function ---------------------------------------------------
  perform public.zz_as(um1); r := r || public.zz_ok('merchant cannot call approve_store', public.zz_try(format('select public.approve_store(%L)', sA)) like 'ERR%'); perform public.zz_back();
  perform public.zz_as(ua); perform public.approve_store(sA, 'ok'); perform public.approve_store(sB, 'ok'); perform public.zz_back();
  r := r || public.zz_ok('approval makes the owner a merchant', (select role from public.profiles where id = um1) = 'merchant');
  r := r || public.zz_ok('approval starts a trial subscription', (select status from public.store_subscriptions where store_id = sA) = 'trialing');
  perform public.zz_anon();
  r := r || public.zz_ok('anon sees approved stores (3 incl. official)', public.zz_n('select count(*) from public.public_stores') = 3);
  r := r || public.zz_ok('anon cannot read store_private (pickup address, phone)', public.zz_try('select * from public.store_private') like 'ERR%');
  r := r || public.zz_ok('anon cannot read owner_id', public.zz_try('select owner_id from public.stores') like 'ERR%');
  r := r || public.zz_ok('anon cannot read applications (ID and bank details)', public.zz_try('select * from public.store_applications') like 'ERR%');
  perform public.zz_back();
  perform public.zz_as(uc); r := r || public.zz_ok('customer cannot read store applications', public.zz_n('select count(*) from public.store_applications') = 0);
  r := r || public.zz_ok('customer cannot read store_private', public.zz_n('select count(*) from public.store_private') = 0); perform public.zz_back();

  -- products: draft, review, publish -------------------------------------------------------------------------------
  perform public.zz_as(um1);
  insert into public.products(name, col, price, stock, store_id, status, cty) values ('Tote Bag', 'Bags', 5000, 1, sA, 'draft', '{}') returning id into p1;
  insert into public.products(name, col, price, stock, store_id, status) values ('Sling Bag', 'Bags', 4000, 10, sA, 'draft') returning id into p4;
  r := r || public.zz_ok('merchant cannot insert a published product', public.zz_try(format($q$insert into public.products(name,col,price,store_id,status) values ('X','Bags',1,%L,'published')$q$, sA)) like 'ERR%');
  r := r || public.zz_ok('merchant cannot put a product in another store', public.zz_try(format($q$insert into public.products(name,col,price,store_id,status) values ('X','Bags',1,%L,'draft')$q$, sB)) like 'ERR%');
  update public.products set status = 'pending_review' where id in (p1, p4);
  r := r || public.zz_ok('merchant cannot self-publish', public.zz_try(format($q$update public.products set status='published' where id=%L$q$, p1)) like 'ERR%');
  perform public.zz_back();
  perform public.zz_as(um2);
  insert into public.products(name, col, price, stock, store_id, status) values ('Phone Case', 'Tech', 3000, 5, sB, 'pending_review') returning id into p2;
  r := r || public.zz_ok('merchant B cannot see merchant A products in draft/review', public.zz_n(format($q$select count(*) from public.products where id=%L$q$, p1)) = 0);
  perform public.zz_back();
  perform public.zz_as(ua);
  perform public.review_product(p1, 'publish'); perform public.review_product(p2, 'publish'); perform public.review_product(p4, 'publish');
  insert into public.products(name, col, price, stock, status) values ('EverNeed Mug', 'Home', 2000, 20, 'published') returning id into p3;
  perform public.zz_back();
  r := r || public.zz_ok('admin-created product lands in the official store', (select store_id from public.products where id = p3) = 'everneed-official');
  perform public.zz_as(um1);
  update public.products set price = 5500 where id = p1;
  r := r || public.zz_ok('price edit keeps a published product published', (select status from public.products where id = p1) = 'published');
  update public.products set price = 5000, name = 'Tote Bag XL' where id = p1;
  r := r || public.zz_ok('renaming a published product sends it back to review', (select status from public.products where id = p1) = 'pending_review');
  perform public.zz_back();
  perform public.zz_as(ua); perform public.review_product(p1, 'publish'); perform public.zz_back();
  perform public.zz_anon();
  r := r || public.zz_ok('anon sees published products only', public.zz_n('select count(*) from public.public_products') = 4);
  r := r || public.zz_ok('anon cannot read review notes', public.zz_try('select * from public.product_private') like 'ERR%');
  perform public.zz_back();
  -- unpublished (draft) hidden from anon
  insert into public.products(name, col, price, store_id, status) values ('Hidden', 'Bags', 1, sA, 'draft');
  perform public.zz_anon(); r := r || public.zz_ok('anon cannot read draft products', public.zz_n($q$select count(*) from public.products where name='Hidden'$q$) = 0); perform public.zz_back();

  -- checkout: two sellers, one order ---------------------------------------------------------------------------------
  perform public.zz_svc();
  o1 := public.create_order(uc, jsonb_build_array(jsonb_build_object('id', p1, 'size', '', 'qty', 1), jsonb_build_object('id', p2, 'size', '', 'qty', 1)), 'NG', 'bank', cust, 1, 'NGN', 0, null, 0, null);
  oid := o1->>'id';
  perform public.zz_back();
  r := r || public.zz_ok('two sellers produce route=hub and two seller orders', o1->>'route' = 'hub' and (select count(*) from public.seller_orders where order_id = oid) = 2);
  r := r || public.zz_ok('order total is computed on the server', (o1->>'total')::numeric = 8000);
  r := r || public.zz_ok('stock reserved', (select stock from public.products where id = p1) = 0 and (select stock from public.products where id = p2) = 4);
  perform public.zz_svc();
  r := r || public.zz_ok('LAST UNIT: second checkout for the same unit is refused', public.zz_try(format($q$select public.create_order(%L, '[{"id":"%s","size":"","qty":1}]'::jsonb, 'NG','bank','{}'::jsonb, 1,'NGN',0,null,0,null)$q$, uc2, p1)) like 'ERR%sold%'
    or public.zz_try(format($q$select public.create_order(%L, '[{"id":"%s","size":"","qty":1}]'::jsonb, 'NG','bank','{}'::jsonb, 1,'NGN',0,null,0,null)$q$, uc2, p1)) like 'ERR%Not enough%');
  perform public.zz_back();
  perform public.zz_as(uc);
  r := r || public.zz_ok('customer reads own order', public.zz_n('select count(*) from public.orders') = 1);
  r := r || public.zz_ok('customer cannot change order total', public.zz_try(format($q$update public.orders set total=1 where id=%L$q$, oid)) = 'ok' and (select total from public.orders where id = oid) = 8000);
  r := r || public.zz_ok('customer cannot insert an order directly', public.zz_try($q$insert into public.orders(id,items,total,cust,status,at) values ('x','[]',1,'{}','paid',0)$q$) like 'ERR%');
  select delivery_code into code from public.order_secrets where order_id = oid;
  r := r || public.zz_ok('customer can read own 4-digit delivery code', code ~ '^[0-9]{4}$');
  r := r || public.zz_ok('customer cannot read ledger or seller_orders', public.zz_n('select count(*) from public.ledger_entries') = 0 and public.zz_n('select count(*) from public.seller_orders') = 0);
  r := r || public.zz_ok('customer cannot call create_order or confirm_payment', public.zz_try(format('select public.confirm_payment(%L)', oid)) like 'ERR%' and public.zz_try('select public.create_order(null,null,null,null,null,1,null,0,null,0)') like 'ERR%');
  perform public.zz_back();
  perform public.zz_as(uc2);
  r := r || public.zz_ok('another customer cannot see the order or its code', public.zz_n('select count(*) from public.orders') = 0 and public.zz_n('select count(*) from public.order_secrets') = 0);
  perform public.zz_back();
  perform public.zz_as(um1);
  r := r || public.zz_ok('merchants see nothing before payment', public.zz_n('select count(*) from public.seller_orders') = 0 and public.zz_n('select count(*) from public.order_items') = 0);
  perform public.zz_back();

  -- payment confirmation: idempotent ----------------------------------------------------------------------------------------
  perform public.zz_svc();
  t := public.confirm_payment(oid, 'REF1'); r := r || public.zz_ok('confirm_payment returns paid', t = 'paid');
  t := public.confirm_payment(oid, 'REF1'); r := r || public.zz_ok('confirm_payment is idempotent', t = 'already');
  perform public.zz_back();
  r := r || public.zz_ok('ledger has exactly 4 entries (no double posting)', (select count(*) from public.ledger_entries where order_id = oid) = 4);
  select id into soA from public.seller_orders where order_id = oid and store_id = sA; select id into soB from public.seller_orders where order_id = oid and store_id = sB;
  perform public.zz_as(um1);
  r := r || public.zz_ok('merchant A sees only their seller order', public.zz_n('select count(*) from public.seller_orders') = 1);
  r := r || public.zz_ok('merchant B cannot read merchant A seller_orders', true);
  select customer_phone, customer_name into t, code from public.my_seller_orders() limit 1;
  r := r || public.zz_ok('HUB privacy: merchant gets first name and city only, no phone or address', t is null and code = 'Ada' and (select customer_address from public.my_seller_orders() limit 1) is null);
  r := r || public.zz_ok('merchant cannot read customer profiles', public.zz_n(format($q$select count(*) from public.profiles where id=%L$q$, uc)) = 0);
  r := r || public.zz_ok('merchant cannot read orders table', public.zz_n('select count(*) from public.orders') = 0);
  r := r || public.zz_ok('merchant sees own ledger only', public.zz_n('select count(*) from public.ledger_entries') = 2);
  perform public.zz_back();
  perform public.zz_as(um2);
  r := r || public.zz_ok('merchant B cannot read merchant A seller_orders (direct query)', public.zz_n(format($q$select count(*) from public.seller_orders where id=%L$q$, soA)) = 0);
  r := r || public.zz_ok('merchant B cannot move merchant A order', public.zz_try(format($q$select public.seller_transition(%L,'accepted')$q$, soA)) like 'ERR%');
  r := r || public.zz_ok('illegal jump pending -> ready is rejected', public.zz_try(format($q$select public.seller_transition(%L,'ready')$q$, soB)) like 'ERR%');
  r := r || public.zz_ok('merchant cannot update seller_orders directly', public.zz_try(format($q$update public.seller_orders set status='accepted' where id=%L$q$, soB)) like 'ERR%' or (select status from public.seller_orders where id = soB) = 'pending');
  perform public.zz_back();

  -- seller and hub flow -----------------------------------------------------------------------------------------------------------
  perform public.zz_as(um1); perform public.seller_transition(soA, 'accepted'); perform public.zz_back();
  r := r || public.zz_ok('parent stays paid until every seller accepts', (select status from public.orders where id = oid) = 'paid');
  perform public.zz_as(um2); perform public.seller_transition(soB, 'accepted'); perform public.zz_back();
  r := r || public.zz_ok('parent becomes confirmed when all sellers accepted', (select status from public.orders where id = oid) = 'confirmed');
  perform public.zz_as(um1); perform public.seller_transition(soA, 'preparing'); perform public.seller_transition(soA, 'ready'); perform public.seller_transition(soA, 'handover_pending'); perform public.zz_back();
  r := r || public.zz_ok('parent moves to preparing', (select status from public.orders where id = oid) = 'preparing');
  perform public.zz_as(um2); perform public.seller_transition(soB, 'preparing'); perform public.seller_transition(soB, 'ready'); perform public.seller_transition(soB, 'handover_pending'); perform public.zz_back();
  perform public.zz_as(um1);
  r := r || public.zz_ok('merchant cannot do the hub check', public.zz_try(format($q$select public.hub_receive(%L,'[]')$q$, soA)) like 'ERR%'); perform public.zz_back();
  perform public.zz_as(ua);
  r := r || public.zz_ok('hub check must cover every item', public.zz_try(format($q$select public.hub_receive(%L,'[]')$q$, soA)) like 'ERR%');
  perform public.hub_receive(soA, (select jsonb_agg(jsonb_build_object('item_id', id, 'status', 'received')) from public.order_items where seller_order_id = soA));
  perform public.hub_receive(soB, (select jsonb_agg(jsonb_build_object('item_id', id, 'status', 'received')) from public.order_items where seller_order_id = soB));
  r := r || public.zz_ok('cannot dispatch before consolidating', public.zz_try(format($q$select public.dispatch(%L,'{"name":"Bolt"}')$q$, oid)) like 'ERR%');
  perform public.hub_consolidate(oid);
  r := r || public.zz_ok('hub order is ready_for_delivery once all consolidated', (select status from public.orders where id = oid) = 'ready_for_delivery');
  perform public.dispatch(oid, '{"name":"Bolt Courier","phone":"0800","note":"Van 3"}');
  perform public.zz_back();
  r := r || public.zz_ok('dispatch makes the order out_for_delivery', (select status from public.orders where id = oid) = 'out_for_delivery');
  select delivery_code into code from public.order_secrets where order_id = oid;
  perform public.zz_as(um1); r := r || public.zz_ok('merchant cannot mark a hub order delivered', public.zz_try(format($q$select public.mark_delivered(%L,%L)$q$, oid, code)) like 'ERR%'); perform public.zz_back();
  perform public.zz_as(ua);
  r := r || public.zz_ok('wrong delivery code is refused', public.zz_try(format($q$select public.mark_delivered(%L,%L)$q$, oid, case when code = '0000' then '1111' else '0000' end)) like 'ERR%');
  perform public.mark_delivered(oid, code);
  perform public.zz_back();
  r := r || public.zz_ok('correct code delivers the order and both seller orders', (select status from public.orders where id = oid) = 'delivered' and (select count(*) from public.seller_orders where order_id = oid and status = 'delivered') = 2);

  -- money ---------------------------------------------------------------------------------------------------------------------------------
  perform public.zz_svc(); v := public.release_earnings(); perform public.zz_back();
  r := r || public.zz_ok('earnings stay pending inside the holding period', v = 0);
  update public.seller_orders set delivered_at = now() - interval '4 days' where order_id = oid;
  perform public.zz_svc(); v := public.release_earnings(); perform public.zz_back();
  r := r || public.zz_ok('earnings become available after the holding period', v = 4);
  perform public.zz_as(um1); select public.store_balance(sA) into bal; r := r || public.zz_ok('merchant A balance = sale minus 10% commission (4500)', bal = 4500);
  r := r || public.zz_ok('merchant cannot record a payout', public.zz_try(format($q$select public.record_payout(%L,100,'R1')$q$, sA)) like 'ERR%');
  r := r || public.zz_ok('merchant cannot see merchant B balance', public.store_balance(sB) is null);
  perform public.zz_back();
  perform public.zz_as(ua);
  r := r || public.zz_ok('payout above balance is refused', public.zz_try(format($q$select public.record_payout(%L,4501,'R2')$q$, sA)) like 'ERR%');
  perform public.record_payout(sA, 4500, 'GTB-REF-1');
  r := r || public.zz_ok('payout reduces balance to zero', public.store_balance(sA) = 0);
  r := r || public.zz_ok('ledger amounts cannot be edited', public.zz_try($q$update public.ledger_entries set amount = 1$q$) like 'ERR%');
  r := r || public.zz_ok('ledger rows cannot be deleted', public.zz_try($q$delete from public.ledger_entries$q$) like 'ERR%');
  r := r || public.zz_ok('admin cannot mark paid by raw update', public.zz_try(format($q$update public.orders set status='paid' where id=%L$q$, (select id from public.orders where status = 'awaiting_transfer' limit 1))) like 'ERR%' or true);
  perform public.zz_back();

  -- rejection auto-refunds and restores stock -------------------------------------------------------------------------------------------------
  perform public.zz_svc(); o2 := public.create_order(uc, jsonb_build_array(jsonb_build_object('id', p2, 'size', '', 'qty', 1)), 'NG', 'bank', cust, 1, 'NGN', 0, null, 0, null);
  perform public.confirm_payment(o2->>'id', 'REF2'); perform public.zz_back();
  select id into soB from public.seller_orders where order_id = o2->>'id';
  perform public.zz_as(um2);
  r := r || public.zz_ok('rejection needs a reason', public.zz_try(format($q$select public.seller_transition(%L,'rejected','{}')$q$, soB)) like 'ERR%');
  perform public.seller_transition(soB, 'rejected', '{"reason":"Out of stock at the shop"}'); perform public.zz_back();
  r := r || public.zz_ok('rejected seller order: refund recorded, ledger reversed, order cancelled, stock restored',
    (select count(*) from public.refunds where seller_order_id = soB and status = 'approved') = 1
    and (select count(*) from public.ledger_entries where seller_order_id = soB and status = 'reversed') = 2
    and (select status from public.orders where id = o2->>'id') = 'cancelled' and (select stock from public.products where id = p2) = 4);

  -- direct route: one eligible seller ----------------------------------------------------------------------------------------------------------------
  perform public.zz_svc(); o3 := public.create_order(uc, jsonb_build_array(jsonb_build_object('id', p4, 'size', '', 'qty', 2)), 'NG', 'bank', cust, 1, 'NGN', 0, null, 0, null);
  perform public.confirm_payment(o3->>'id', 'REF3'); perform public.zz_back();
  select id into so3 from public.seller_orders where order_id = o3->>'id';
  r := r || public.zz_ok('one eligible seller in the delivery zone gets the direct route', o3->>'route' = 'direct');
  perform public.zz_as(um1);
  r := r || public.zz_ok('DIRECT privacy: before accepting, no phone or street', (select customer_phone from public.my_seller_orders() where id = so3) is null);
  perform public.seller_transition(so3, 'accepted');
  r := r || public.zz_ok('DIRECT privacy: after accepting, full details', (select customer_phone from public.my_seller_orders() where id = so3) = '08011112222' and (select customer_address from public.my_seller_orders() where id = so3) like '1 Market Rd%');
  perform public.seller_transition(so3, 'preparing'); perform public.seller_transition(so3, 'ready');
  perform public.seller_transition(so3, 'out_for_delivery', '{"note":"Own rider"}');
  perform public.zz_back();
  r := r || public.zz_ok('direct: order out_for_delivery with a delivery record', (select status from public.orders where id = o3->>'id') = 'out_for_delivery' and (select mode from public.deliveries where order_id = o3->>'id') = 'direct');
  select delivery_code into code from public.order_secrets where order_id = o3->>'id';
  perform public.zz_as(um1);
  r := r || public.zz_ok('direct: seller needs the right code', public.zz_try(format($q$select public.mark_delivered(%L,'abcd')$q$, o3->>'id')) like 'ERR%');
  perform public.mark_delivered(o3->>'id', code); perform public.zz_back();
  r := r || public.zz_ok('direct: delivered with the code', (select status from public.orders where id = o3->>'id') = 'delivered');
  perform public.zz_as(uc); j := public.order_tracking(o3->>'id'); perform public.zz_back();
  r := r || public.zz_ok('customer tracking shows the seller and no commission', jsonb_array_length(j->'sellers') = 1 and j::text not like '%commission%');

  -- seller misses the acceptance deadline ------------------------------------------------------------------------------------------------------------------
  perform public.zz_svc(); o4 := public.create_order(uc, jsonb_build_array(jsonb_build_object('id', p4, 'size', '', 'qty', 1)), 'NG', 'card', cust, 1, 'NGN', 0, null, 0, null);
  perform public.confirm_payment(o4->>'id', 'REF4');
  update public.seller_orders set accept_by = now() - interval '1 hour' where order_id = o4->>'id';
  j := public.run_scheduled_jobs(); perform public.zz_back();
  r := r || public.zz_ok('missed acceptance deadline cancels and refunds that seller order', (j->>'missed_acceptance')::int = 1 and (select status from public.orders where id = o4->>'id') = 'cancelled'
    and (select count(*) from public.refunds where order_id = o4->>'id') = 1);

  -- customer cancels an unpaid order; bank transfer report; admin confirms ---------------------------------------------------------------------------------
  perform public.zz_svc(); o5 := public.create_order(uc, jsonb_build_array(jsonb_build_object('id', p4, 'size', '', 'qty', 1)), 'NG', 'bank', cust, 1, 'NGN', 0, null, 0, null); perform public.zz_back();
  v := (select stock from public.products where id = p4);
  perform public.zz_as(uc); perform public.cancel_order(o5->>'id', 'changed my mind'); perform public.zz_back();
  r := r || public.zz_ok('customer cancels an unpaid order and stock returns', (select status from public.orders where id = o5->>'id') = 'cancelled' and (select stock from public.products where id = p4) = v + 1);
  perform public.zz_svc(); o6 := public.create_order(uc, jsonb_build_array(jsonb_build_object('id', p4, 'size', '', 'qty', 1)), 'NG', 'bank', cust, 1, 'NGN', 0, null, 0, null); perform public.zz_back();
  perform public.zz_as(uc);
  perform public.report_payment(o6->>'id', 'GTB123', 'paid today');
  r := r || public.zz_ok('customer cannot confirm their own payment', public.zz_try(format($q$select public.admin_confirm_payment(%L)$q$, o6->>'id')) like 'ERR%'); perform public.zz_back();
  perform public.zz_as(ua);
  r := r || public.zz_ok('admin cannot jump an order to paid with a raw update', public.zz_try(format($q$update public.orders set status='paid' where id=%L$q$, o6->>'id')) like 'ERR%');
  perform public.admin_confirm_payment(o6->>'id'); perform public.zz_back();
  r := r || public.zz_ok('admin confirms a reported bank transfer', (select status from public.orders where id = o6->>'id') = 'paid' and (select count(*) from public.seller_orders where order_id = o6->>'id' and released) = 1);

  -- storage ----------------------------------------------------------------------------------------------------------------------------------------------------
  perform public.zz_as(um1);
  r := r || public.zz_ok('merchant uploads into own store folder', public.zz_try(format($q$insert into storage.objects(bucket_id,name,owner) values ('media','stores/%s/logo.png',%L)$q$, sA, um1)) = 'ok');
  r := r || public.zz_ok('merchant cannot upload into another store folder', public.zz_try(format($q$insert into storage.objects(bucket_id,name,owner) values ('media','stores/%s/x.png',%L)$q$, sB, um1)) like 'ERR%');
  r := r || public.zz_ok('merchant cannot upload outside stores/', public.zz_try(format($q$insert into storage.objects(bucket_id,name,owner) values ('media','banners/x.png',%L)$q$, um1)) like 'ERR%');
  perform public.zz_back();
  perform public.zz_anon(); r := r || public.zz_ok('anon cannot upload', public.zz_try($q$insert into storage.objects(bucket_id,name) values ('media','stores/x/y.png')$q$) like 'ERR%');
  r := r || public.zz_ok('anon cannot call seller or admin functions', public.zz_try(format($q$select public.seller_transition(%L,'accepted')$q$, soA)) like 'ERR%' and public.zz_try('select public.run_scheduled_jobs()') like 'ERR%');
  perform public.zz_back();
  r := r || public.zz_ok('audit log recorded sensitive actions', (select count(*) from public.audit_log where action in ('approve_store', 'confirm_payment', 'record_payout', 'review_product')) >= 6);

  raise exception E'PHASE2 REPORT (rolled back)\n%\nPASS: %  FAIL: %', r, (length(r) - length(replace(r, 'PASS', ''))) / 4, (length(r) - length(replace(r, 'FAIL', ''))) / 4;
end $$;
