-- FIN-03 verified settlement and atomic journal posting regression. Fixtures roll back.
begin;
set local role postgres;
select set_config('request.jwt.claim.role','service_role',true);
do $$
declare
  v_uid uuid:=gen_random_uuid();
  v_store text:='fin03-store-'||gen_random_uuid()::text;
  v_offer text:=gen_random_uuid()::text;
  v_order_id text:=gen_random_uuid()::text;
  v_so text:=gen_random_uuid()::text;
  v_item text:=gen_random_uuid()::text;
  v_v1 jsonb;
  v_snapshot jsonb;
  v_attempt jsonb;
  v_attempt_id uuid;
  v_ref text;
  v_amt bigint;
  v_result jsonb;
  v_txid text:=gen_random_uuid()::text;
  v_journal uuid;
  v_debits numeric;
  v_credits numeric;
  v_fail_closed boolean:=false;
  v_platform_discount bigint;
  v_seller_payable bigint;
  v_commission bigint;
  v_delivery bigint;
  v_order2 text:=gen_random_uuid()::text;
  v_attempt2 jsonb;
  v_result2 jsonb;
  v_v1_2 jsonb;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_uid,'authenticated','authenticated','fin03-settlement-'||v_uid::text||'@example.test','', '{}'::jsonb,'{}'::jsonb,now(),now());
  insert into public.stores(id,owner_id,slug,name,country,status,is_official)
  values(v_store,v_uid,'fin03-'||substr(v_store,1,12),'FIN03 Test Store','NG','approved',false);
  insert into public.store_private(store_id,commission_override)
  values(v_store,10);
  insert into public.offers(id,name,kind,value,scope,active)
  values(v_offer,'FIN03 journal promotion','fixed',20,'all',true);
  insert into private.offer_campaign_budgets(offer_id,currency,approved_budget_minor,approved_by,approval_note)
  values(v_offer,'NGN',5000,v_uid,'Rollback-only FIN03 test budget');

  -- Construct a v1 checkout quote and v2 allocation fixture directly. This avoids
  -- cart availability checks while exercising the exact immutable settlement contract.
  v_v1:=jsonb_build_object(
    'schema_version',1,'order_id',v_order_id,'user_id',v_uid,'currency','NGN','currency_exponent',2,
    'pricing',jsonb_build_object('fx_rate',1,'fx_source','fixture','fx_fetched_at',now(),
      'markup_percent',0,'effective_rate',1,'pricing_policy_version','fixture-v1'),
    'amounts',jsonb_build_object('gross_merchandise_minor',10000,'net_merchandise_minor',8000,
      'allocated_discount_minor',2000,'delivery_fee_minor',500,'total_minor',8500),
    'items',jsonb_build_array(jsonb_build_object('order_item_id',v_item,'gross_minor',10000,'net_refundable_minor',8000))
  );
  insert into public.orders(id,user_id,items,total,country,pm,cust,status,payment_status,at,currency,discount,offer,delivery_fee,financial_offer_id,checkout_snapshot_version,checkout_snapshot,checkout_snapshot_hash)
  values(v_order_id,v_uid,'[]'::jsonb,85,'NG','card',
    jsonb_build_object('name','Fixture Buyer','phone','0000000000','street','Test Road','city','Test City','state','Test State'),
    'awaiting_payment','awaiting_payment',(extract(epoch from now())*1000)::bigint,'NGN',20,
    jsonb_build_object('name','FIN03 journal promotion','kind','fixed','value',20),5,v_offer,
    1,v_v1,encode(extensions.digest(convert_to(v_v1::text,'UTF8'),'sha256'),'hex'));
  insert into public.seller_orders(id,order_id,store_id,subtotal)
  values(v_so,v_order_id,v_store,100);
  insert into public.order_items(id,order_id,seller_order_id,store_id,name,size,unit_price,qty,line_total)
  values(v_item,v_order_id,v_so,v_store,'FIN03 settlement fixture',null,100,1,100);
  insert into public.order_item_fees(order_item_id,commission_rate,commission_amount)
  values(v_item,10,10);
  v_snapshot:=private.build_order_financial_snapshot_v2(v_order_id);
  if (v_snapshot->'amounts'->>'platform_funded_discount_minor')::bigint<>2000
     or (v_snapshot->'amounts'->>'seller_payable_minor')::bigint<>9000
     or (v_snapshot->'amounts'->>'commission_minor')::bigint<>1000 then
    raise exception 'Fixture allocation did not produce expected platform subsidy/10%% commission.';
  end if;

  v_attempt:=public.create_payment_attempt(v_order_id,v_uid,'fin03-success-'||gen_random_uuid()::text);
  v_attempt_id:=(v_attempt->>'attempt_id')::uuid;
  v_ref:=v_attempt->>'reference';
  v_amt:=(v_attempt->>'amount_minor')::bigint;
  if v_amt<>8500 then raise exception 'Fixture buyer amount expected 8500 minor, got %',v_amt; end if;
  perform public.record_payment_attempt_initialization(v_attempt_id,true,'fixture initialization',null);

  -- Missing required account must fail closed and roll back order/attempt settlement.
  begin
    delete from private.finance_accounts
     where account_code='expense.platform_promotions' and currency='NGN';
    perform public.settle_verified_payment_attempt(v_ref,v_txid,v_amt,'NGN');
    raise exception 'Expected settlement to fail when platform promotion account is missing.';
  exception when others then
    if sqlerrm not like '%not configured for currency NGN%' then raise; end if;
    v_fail_closed:=true;
  end;
  if not v_fail_closed then raise exception 'Missing finance account failure was not exercised.'; end if;
  if exists(select 1 from public.orders where id=v_order_id and payment_status='paid')
     or exists(select 1 from private.payment_attempts where id=v_attempt_id and status='succeeded')
     or exists(select 1 from private.finance_journals where source_type='payment_settlement' and source_id=v_order_id) then
    raise exception 'Settlement did not roll back fully after missing account failure.';
  end if;

  v_result:=public.settle_verified_payment_attempt(v_ref,v_txid,v_amt,'NGN');
  if v_result->>'result' not in ('paid','already','already_settled') then raise exception 'Exact settlement failed: %',v_result; end if;
  if not exists(select 1 from public.orders where id=v_order_id and payment_status='paid') then raise exception 'Order was not marked paid'; end if;
  if not exists(select 1 from private.payment_attempts where id=v_attempt_id and status='succeeded' and provider_transaction_id=v_txid) then raise exception 'Attempt was not marked succeeded'; end if;
  select id into v_journal from private.finance_journals where source_type='payment_settlement' and source_id=v_order_id and idempotency_key=v_ref;
  if v_journal is null then raise exception 'Verified settlement did not create finance journal'; end if;
  select
    (payload->'amounts'->>'platform_funded_discount_minor')::bigint,
    (payload->'amounts'->>'seller_payable_minor')::bigint,
    (payload->'amounts'->>'commission_minor')::bigint,
    (payload->'amounts'->>'delivery_fee_minor')::bigint
    into v_platform_discount,v_seller_payable,v_commission,v_delivery
    from private.order_financial_snapshots_v2 where order_id=v_order_id;
  if v_platform_discount<>2000 or v_seller_payable<>9000 or v_commission<>1000 or v_delivery<>500 then
    raise exception 'Unexpected immutable allocation amounts: platform %, payable %, commission %, delivery %',
      v_platform_discount,v_seller_payable,v_commission,v_delivery;
  end if;
  select coalesce(sum(case when direction='debit' then amount_minor else 0 end),0),
         coalesce(sum(case when direction='credit' then amount_minor else 0 end),0)
    into v_debits,v_credits from private.finance_journal_lines where journal_id=v_journal;
  if v_debits<>v_amt+v_platform_discount or v_credits<>v_seller_payable+v_commission+v_delivery then
    raise exception 'Journal not balanced or amounts wrong: debit %, credit %, expected debit %, credit %',
      v_debits,v_credits,v_amt+v_platform_discount,v_seller_payable+v_commission+v_delivery;
  end if;
  if not exists(select 1 from private.finance_journal_lines l join private.finance_accounts a on a.id=l.account_id where l.journal_id=v_journal and a.account_code='asset.paystack_clearing' and l.direction='debit' and l.amount_minor=v_amt)
     or not exists(select 1 from private.finance_journal_lines l join private.finance_accounts a on a.id=l.account_id where l.journal_id=v_journal and a.account_code='expense.platform_promotions' and l.direction='debit' and l.amount_minor=v_platform_discount)
     or not exists(select 1 from private.finance_journal_lines l join private.finance_accounts a on a.id=l.account_id where l.journal_id=v_journal and a.account_code='liability.seller_payable' and l.direction='credit' and l.store_id=v_store and l.amount_minor=v_seller_payable)
     or not exists(select 1 from private.finance_journal_lines l join private.finance_accounts a on a.id=l.account_id where l.journal_id=v_journal and a.account_code='revenue.platform_commission' and l.direction='credit' and l.amount_minor=v_commission)
     or not exists(select 1 from private.finance_journal_lines l join private.finance_accounts a on a.id=l.account_id where l.journal_id=v_journal and a.account_code='liability.delivery_fee_held' and l.direction='credit' and l.amount_minor=v_delivery) then
    raise exception 'Journal lines do not match immutable v2 allocation mapping.';
  end if;
  v_result:=public.settle_verified_payment_attempt(v_ref,v_txid,v_amt,'NGN');
  if v_result->>'result'<>'already_settled' then raise exception 'Same transaction replay not idempotent: %',v_result; end if;
  if (select count(*) from private.finance_journals where source_type='payment_settlement' and source_id=v_order_id)<>1 then raise exception 'Duplicate settlement created multiple journals'; end if;

  -- A distinct order and attempt deliberately mismatch provider amount.
  v_v1_2:=jsonb_build_object(
    'schema_version',1,'order_id',v_order2,'user_id',v_uid,'currency','NGN','currency_exponent',2,
    'pricing',jsonb_build_object('fx_rate',1,'fx_source','fixture','fx_fetched_at',now(),
      'markup_percent',0,'effective_rate',1,'pricing_policy_version','fixture-v1'),
    'amounts',jsonb_build_object('gross_merchandise_minor',10000,'net_merchandise_minor',10000,
      'allocated_discount_minor',0,'delivery_fee_minor',0,'total_minor',10000),
    'items',jsonb_build_array()
  );
  insert into public.orders(id,user_id,items,total,country,pm,cust,status,payment_status,at,currency,discount,offer,delivery_fee,checkout_snapshot_version,checkout_snapshot,checkout_snapshot_hash)
  values(v_order2,v_uid,'[]'::jsonb,100,'NG','card','{}'::jsonb,'awaiting_payment','awaiting_payment',
    (extract(epoch from now())*1000)::bigint,'NGN',0,null,0,1,v_v1_2,encode(extensions.digest(convert_to(v_v1_2::text,'UTF8'),'sha256'),'hex'));
  v_attempt2:=public.create_payment_attempt(v_order2,v_uid,'fin03-mismatch-'||gen_random_uuid()::text);
  perform public.record_payment_attempt_initialization((v_attempt2->>'attempt_id')::uuid,true,'fixture initialization',null);
  v_result2:=public.settle_verified_payment_attempt(v_attempt2->>'reference',gen_random_uuid()::text,(v_attempt2->>'amount_minor')::bigint+1,'NGN');
  if v_result2->>'result'<>'reconciliation_required' then raise exception 'Amount mismatch not quarantined: %',v_result2; end if;
  if not exists(select 1 from private.payment_attempts where id=(v_attempt2->>'attempt_id')::uuid and status='reconciliation_required') then raise exception 'Mismatch attempt not marked reconciliation_required'; end if;
  if exists(select 1 from private.finance_journals where source_type='payment_settlement' and source_id=v_order2) then raise exception 'Mismatch attempt posted a journal'; end if;
end $$;
rollback;
