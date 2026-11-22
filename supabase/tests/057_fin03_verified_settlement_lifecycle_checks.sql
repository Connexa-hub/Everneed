-- FIN-03 verified settlement lifecycle regression. All fixture data rolls back.
begin;
set local role postgres;
select set_config('request.jwt.claim.role','service_role',true);
do $$
declare
  v_uid uuid:=gen_random_uuid(); v_product text:=gen_random_uuid()::text;
  v_order jsonb; v_order_id text; v_attempt jsonb; v_attempt_id uuid;
  v_ref text; v_amt bigint; v_result jsonb; v_txid text:=gen_random_uuid()::text;
  v_order2 jsonb; v_attempt2 jsonb; v_result2 jsonb;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_uid,'authenticated','authenticated','fin03-settlement-'||v_uid::text||'@example.test','', '{}'::jsonb,'{}'::jsonb,now(),now());
  insert into public.products(id,name,col,price,store_id,status,stock,track_stock)
  values(v_product,'FIN03 settlement fixture','other',100,'everneed-official','published',null,false);
  v_order:=public.create_order_with_financial_snapshot_v2(
    v_uid,jsonb_build_array(jsonb_build_object('id',v_product,'size','','qty',1)),
    'NG','card',jsonb_build_object('name','Fixture Buyer','phone','0000000000','street','Test Road','city','Test City','state','Test State'),
    1,'NGN',0,null,0,null,
    jsonb_build_object('fx_rate',1,'fx_source','fixture','fx_fetched_at',now(),'markup_percent',0,'currency_exponent',2,'pricing_policy_version','fixture-v1'));
  v_order_id:=v_order->>'id';
  v_attempt:=public.create_payment_attempt(v_order_id,v_uid,'fin03-success-'||gen_random_uuid()::text);
  v_attempt_id:=(v_attempt->>'attempt_id')::uuid; v_ref:=v_attempt->>'reference'; v_amt:=(v_attempt->>'amount_minor')::bigint;
  perform public.record_payment_attempt_initialization(v_attempt_id,true,'fixture initialization',null);
  v_result:=public.settle_verified_payment_attempt(v_ref,v_txid,v_amt,'NGN');
  if v_result->>'result' not in ('paid','already','already_settled') then raise exception 'Exact settlement failed: %',v_result; end if;
  if not exists(select 1 from public.orders where id=v_order_id and payment_status='paid') then raise exception 'Order was not marked paid'; end if;
  if not exists(select 1 from private.payment_attempts where id=v_attempt_id and status='succeeded' and provider_transaction_id=v_txid) then raise exception 'Attempt was not marked succeeded'; end if;
  v_result:=public.settle_verified_payment_attempt(v_ref,v_txid,v_amt,'NGN');
  if v_result->>'result'<>'already_settled' then raise exception 'Same transaction replay not idempotent: %',v_result; end if;
  v_order2:=public.create_order_with_financial_snapshot_v2(
    v_uid,jsonb_build_array(jsonb_build_object('id',v_product,'size','','qty',1)),
    'NG','card',jsonb_build_object('name','Fixture Buyer','phone','0000000000','street','Test Road','city','Test City','state','Test State'),
    1,'NGN',0,null,0,null,
    jsonb_build_object('fx_rate',1,'fx_source','fixture','fx_fetched_at',now(),'markup_percent',0,'currency_exponent',2,'pricing_policy_version','fixture-v1'));
  v_attempt2:=public.create_payment_attempt(v_order2->>'id',v_uid,'fin03-mismatch-'||gen_random_uuid()::text);
  perform public.record_payment_attempt_initialization((v_attempt2->>'attempt_id')::uuid,true,'fixture initialization',null);
  v_result2:=public.settle_verified_payment_attempt(v_attempt2->>'reference',gen_random_uuid()::text,(v_attempt2->>'amount_minor')::bigint+1,'NGN');
  if v_result2->>'result'<>'reconciliation_required' then raise exception 'Amount mismatch not quarantined: %',v_result2; end if;
  if not exists(select 1 from private.payment_attempts where id=(v_attempt2->>'attempt_id')::uuid and status='reconciliation_required') then raise exception 'Mismatch attempt not marked reconciliation_required'; end if;
end $$;
rollback;
