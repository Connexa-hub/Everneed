-- Regression for seller accept-by deadline race.
-- Expired acceptance cancels/refunds synchronously; an in-window acceptance succeeds.
begin;
do $$
declare
  seller uuid := gen_random_uuid();
  buyer uuid := gen_random_uuid();
  store_id text := gen_random_uuid()::text;
  late_order text := gen_random_uuid()::text;
  live_order text := gen_random_uuid()::text;
  late_so text := gen_random_uuid()::text;
  live_so text := gen_random_uuid()::text;
  def text;
begin
  select pg_get_functiondef('public.seller_transition(text,text,jsonb)'::regprocedure) into def;
  if position('accept_by' in def)=0 or position('private.cancel_so' in def)=0 or position('clock_timestamp()' in def)=0 then
    raise exception 'FAIL: seller_transition missing wall-clock acceptance deadline guard';
  end if;

  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_super_admin)
  values
    (seller,'authenticated','authenticated','order-deadline-seller-'||seller||'@example.test','',now(),'{}'::jsonb,jsonb_build_object('name','Deadline Seller'),now(),now(),false),
    (buyer,'authenticated','authenticated','order-deadline-buyer-'||buyer||'@example.test','',now(),'{}'::jsonb,jsonb_build_object('name','Deadline Buyer'),now(),now(),false);
  insert into public.profiles(id,name,email,role) values
    (seller,'Deadline Seller','order-deadline-seller-'||seller||'@example.test','merchant'),
    (buyer,'Deadline Buyer','order-deadline-buyer-'||buyer||'@example.test','customer')
  on conflict(id) do update set name=excluded.name,email=excluded.email,role=excluded.role;
  insert into public.stores(id,owner_id,slug,name,status,activation_status,country,business_timezone)
  values(store_id,seller,'deadline-'||seller,'Deadline Test Store','approved','live','NG','Africa/Lagos');
  insert into public.store_subscriptions(store_id,plan_id,status,current_period_start,current_period_end)
  values(store_id,'plan-free','trialing',now(),now()+interval '30 days');

  insert into public.orders(id,user_id,items,total,country,pm,cust,status,at,route,payment_status)
  values
    (late_order,buyer,'[]'::jsonb,0,'NG','test','{}'::jsonb,'paid',extract(epoch from now())::bigint,'hub','paid'),
    (live_order,buyer,'[]'::jsonb,0,'NG','test','{}'::jsonb,'paid',extract(epoch from now())::bigint,'hub','paid');
  insert into public.seller_orders(id,order_id,store_id,status,released,subtotal,commission,earning,accept_by)
  values
    (late_so,late_order,store_id,'pending',true,0,0,0,now()-interval '1 minute'),
    (live_so,live_order,store_id,'pending',true,0,0,0,now()+interval '10 minutes');

  perform set_config('request.jwt.claims',json_build_object('sub',seller,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',seller::text,true);
  execute 'set local role authenticated';
  perform public.seller_transition(late_so,'accepted','{}'::jsonb);
  perform public.seller_transition(live_so,'accepted','{}'::jsonb);
  execute 'reset role';

  if (select status from public.seller_orders where id=late_so) <> 'cancelled' then
    raise exception 'FAIL: expired seller acceptance did not cancel the seller order';
  end if;
  if (select payment_status from public.orders where id=late_order) <> 'refunded' then
    raise exception 'FAIL: expired seller acceptance did not close/refund the parent order';
  end if;
  if (select status from public.seller_orders where id=live_so) <> 'accepted' then
    raise exception 'FAIL: valid acceptance window was rejected';
  end if;
  if (select accepted_at from public.seller_orders where id=live_so) is null then
    raise exception 'FAIL: valid acceptance did not set accepted_at';
  end if;
end $$;
rollback;
