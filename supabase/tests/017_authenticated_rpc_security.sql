-- Authenticated SECURITY DEFINER boundary regression tests.
-- All fixtures and mutations are rolled back.
begin;

create function public.zz_f17_as(u uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  execute 'set local role authenticated';
end $$;

create function public.zz_f17_svc() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role service_role';
end $$;

create function public.zz_f17_auth_without_sub() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role authenticated';
end $$;

create function public.zz_f17_back() returns void
language plpgsql as $$ begin execute 'reset role'; end $$;

create function public.zz_f17_try(q text) returns text
language plpgsql as $$
begin
  execute q;
  return 'ok';
exception when others then
  return 'ERR: ' || sqlerrm;
end $$;

do $test$
declare
  v_buyer uuid := gen_random_uuid();
  v_seller_a uuid := gen_random_uuid();
  v_seller_b uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_store_a text;
  v_store_b text;
  v_product_a text;
  v_product_b text;
  v_order jsonb;
  v_chat_order jsonb;
  v_order_id text;
  v_chat_order_id text;
  v_so_b text;
  v_duplicate jsonb;
  v_result text;
  v_customer jsonb := '{"name":"F17 Test Buyer","phone":"08000000000","street":"1 Test Road","city":"Ikeja","state":"Lagos","email":"f17@test.local"}';
begin
  insert into auth.users(id, email, aud, role)
  values
    (v_buyer, 'buyer-' || v_buyer::text || '@f17.test', 'authenticated', 'authenticated'),
    (v_seller_a, 'seller-a-' || v_seller_a::text || '@f17.test', 'authenticated', 'authenticated'),
    (v_seller_b, 'seller-b-' || v_seller_b::text || '@f17.test', 'authenticated', 'authenticated'),
    (v_admin, 'admin-' || v_admin::text || '@f17.test', 'authenticated', 'authenticated');

  update public.profiles set role = 'admin' where id = v_admin;

  perform public.zz_f17_as(v_seller_a);
  insert into public.stores(owner_id, name, about, status, country, state, city)
  values (v_seller_a, 'F17 Store A', 'Security test', 'draft', 'NG', 'Lagos', 'Ikeja')
  returning id into v_store_a;
  insert into public.store_applications(store_id, business_name, id_type, id_ref, bank_name, account_number, account_name)
  values (v_store_a, 'F17 Store A Ltd', 'NIN', 'F17-A', 'Test Bank', '0000000001', 'F17 Store A');
  perform public.zz_f17_back();

  perform public.zz_f17_as(v_seller_b);
  insert into public.stores(owner_id, name, about, status, country, state, city)
  values (v_seller_b, 'F17 Store B', 'Security test', 'draft', 'NG', 'Lagos', 'Ikeja')
  returning id into v_store_b;
  insert into public.store_applications(store_id, business_name, id_type, id_ref, bank_name, account_number, account_name)
  values (v_store_b, 'F17 Store B Ltd', 'NIN', 'F17-B', 'Test Bank', '0000000002', 'F17 Store B');
  perform public.zz_f17_back();

  perform public.zz_f17_as(v_admin);
  perform public.approve_store(v_store_a, 'F17 fixture');
  perform public.approve_store(v_store_b, 'F17 fixture');
  perform public.zz_f17_back();

  perform public.zz_f17_as(v_seller_a);
  insert into public.products(name, col, price, stock, store_id, status)
  values ('F17 Product A', 'Test', 1000, 5, v_store_a, 'draft')
  returning id into v_product_a;
  update public.products set status = 'pending_review' where id = v_product_a;
  perform public.zz_f17_back();

  perform public.zz_f17_as(v_seller_b);
  insert into public.products(name, col, price, stock, store_id, status)
  values ('F17 Product B', 'Test', 2000, 5, v_store_b, 'draft')
  returning id into v_product_b;
  update public.products set status = 'pending_review' where id = v_product_b;
  perform public.zz_f17_back();

  perform public.zz_f17_as(v_admin);
  perform public.review_product(v_product_a, 'publish');
  perform public.review_product(v_product_b, 'publish');
  perform public.zz_f17_back();

  perform public.zz_f17_svc();
  v_order := public.create_order(
    v_buyer,
    jsonb_build_array(
      jsonb_build_object('id', v_product_a, 'size', '', 'qty', 1),
      jsonb_build_object('id', v_product_b, 'size', '', 'qty', 1)
    ),
    'NG', 'bank', v_customer, 1, 'NGN', 0, null, 0, null
  );
  v_order_id := v_order->>'id';
  perform public.confirm_payment(v_order_id, 'F17-REF');

  -- Use a separate one-seller order to prove that a buyer cannot attach it to another store's chat.
  v_chat_order := public.create_order(
    v_buyer,
    jsonb_build_array(jsonb_build_object('id', v_product_b, 'size', '', 'qty', 1)),
    'NG', 'bank', v_customer, 1, 'NGN', 0, null, 0, null
  );
  v_chat_order_id := v_chat_order->>'id';
  perform public.zz_f17_back();

  if v_order->>'route' <> 'hub'
     or (select count(distinct store_id) from public.seller_orders where order_id = v_order_id) <> 2 then
    raise exception 'F17 fixture expected a multi-seller hub order';
  end if;
  if not exists (select 1 from public.seller_orders where order_id = v_chat_order_id and store_id = v_store_b)
     or exists (select 1 from public.seller_orders where order_id = v_chat_order_id and store_id = v_store_a) then
    raise exception 'F17 chat fixture must belong only to Store B';
  end if;

  select id into v_so_b
  from public.seller_orders
  where order_id = v_order_id and store_id = v_store_b;

  -- A buyer may attach an order to a store chat only when that store is one of its sellers.
  perform public.zz_f17_as(v_buyer);
  v_result := public.zz_f17_try(format(
    'select public.chat_start(%L,%L,%L,%L,%L,%L)',
    'store', v_store_a, v_chat_order_id, 'Wrong store order', null, null
  ));
  if v_result not like 'ERR:%' then
    raise exception 'A buyer attached an order to a store that did not sell it';
  end if;

  v_result := public.zz_f17_try(format(
    'select public.chat_start(%L,%L,%L,%L,%L,%L)',
    'store', v_store_b, v_chat_order_id, 'Correct store order', null, null
  ));
  if v_result <> 'ok' then
    raise exception 'A valid store/order conversation was rejected: %', v_result;
  end if;

  v_result := public.zz_f17_try(format(
    'select public.chat_start(%L,%L,%L,%L,%L,%L)',
    'support', null, null, repeat('x', 121), null, null
  ));
  if v_result not like 'ERR:%' then
    raise exception 'An overlong chat subject was accepted';
  end if;
  perform public.zz_f17_back();

  -- Seller B moves its own order to the hub handover state.
  perform public.zz_f17_as(v_seller_b);
  perform public.seller_transition(v_so_b, 'accepted', '{}'::jsonb);
  perform public.seller_transition(v_so_b, 'preparing', '{}'::jsonb);
  perform public.seller_transition(v_so_b, 'ready', '{}'::jsonb);
  perform public.seller_transition(v_so_b, 'handover_pending', '{}'::jsonb);
  perform public.zz_f17_back();

  -- Duplicate item results must not satisfy a hub check.
  select jsonb_build_array(
    jsonb_build_object('item_id', i.id, 'status', 'received'),
    jsonb_build_object('item_id', i.id, 'status', 'received')
  ) into v_duplicate
  from public.order_items i
  where i.seller_order_id = v_so_b
  limit 1;

  perform public.zz_f17_as(v_admin);
  v_result := public.zz_f17_try(format(
    'select public.hub_receive(%L,%L::jsonb)',
    v_so_b, v_duplicate::text
  ));
  if v_result not like 'ERR:%' then
    raise exception 'Hub check accepted duplicate/extra item results';
  end if;
  perform public.zz_f17_back();

  -- Authenticated JWTs without a subject must not gain the service/cron bypass.
  perform public.zz_f17_auth_without_sub();
  if auth.uid() is not null or auth.role() <> 'authenticated' then
    raise exception 'Malformed-auth test context was not established';
  end if;
  v_result := public.zz_f17_try('select public.support_sla_sweep()');
  if v_result not like 'ERR:%' then
    raise exception 'Authenticated request without a subject bypassed the SLA admin guard';
  end if;
  perform public.zz_f17_back();

  perform public.zz_f17_as(v_seller_a);
  v_result := public.zz_f17_try(format(
    'select public.record_payout(%L,1,%L)',
    v_store_a, 'F17-NOT-ADMIN'
  ));
  if v_result not like 'ERR:%' then
    raise exception 'A seller called the admin-only payout RPC';
  end if;
  perform public.zz_f17_back();

  -- Every authenticated-callable public SECURITY DEFINER function must have an empty path
  -- and no implicit PUBLIC EXECUTE. Anonymous access is limited to the six intended public RPCs.
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not ('search_path=""' = any(coalesce(p.proconfig, array[]::text[])))
  ) then
    raise exception 'An authenticated-callable SECURITY DEFINER routine has a non-empty or unset search_path';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'An authenticated-callable SECURITY DEFINER routine still has PUBLIC EXECUTE';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname not in (
        'join_waitlist',
        'support_guest_open',
        'support_guest_ping',
        'support_guest_close',
        'store_reply_stats',
        'support_sla_public'
      )
  ) then
    raise exception 'An unexpected anonymous SECURITY DEFINER RPC is executable';
  end if;
end
$test$;

rollback;
