-- FIN-03 verified settlement and atomic journal posting regression. Fixtures roll back.
begin;
set local role postgres;
select set_config('request.jwt.claim.role','service_role',true);
do $$
declare
  v_uid uuid:=gen_random_uuid(); v_product text:=gen_random_uuid()::text; v_offer text:=gen_random_uuid()::text;
  v_order jsonb; v_order_id text; v_attempt jsonb; v_attempt_id uuid;
  v_ref text; v_amt bigint; v_result jsonb; v_txid text:=gen_random_uuid()::text;
  v_journal uuid; v_debits numeric; v_credits numeric; v_order2 jsonb; v_attempt2 jsonb; v_result2 jsonb; v_fail_closed boolean:=false; v_platform_discount bigint; v_seller_payable bigint; v_commission bigint; v_delivery bigint;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_uid,'authenticated','authenticated','fin03-settlement-'||v_uid::text||'@example.test','', '{}'::jsonb,'{}'::jsonb,now(),now());
  insert into public.offers(id,name,kind,value,scope,active)
  values(v_offer,'FIN03 journal promotion','fixed',20,'all',true);
  insert into private.offer_campaign_budgets(offer_id,currency,approved_budget_minor,approved_by,approval_note)
  values(v_offer,'NGN',5000,v_uid,'Rollback-only FIN03 test budget');
  insert into public.products(id,name,col,price,store_id,status,stock,track_stock)
  values(v_product,'FIN03 settlement fixture','other',100,'everneed-official','published',null,false);

  v_order:=public.create_order_with_financial_snapshot_v2(
    v_uid,jsonb_build_array(jsonb_build_object('id',v_product,'size','','qty',1)),
    'NG','card',jsonb_build_object('name','Fixture Buyer','phone','0000000000','street','Test Road','city','Test City','state','Test State'),
    1,'NGN',20,jsonb_build_object('id',v_offer,'code',null,'name','FIN03 journal promotion','kind','fixed','value',20),5,null,
    jsonb_build_object('fx_rate',1,'fx_source','fixture','fx_fetched_at',now(),'markup_percent',0,'currency_exponent',2,'pricing_policy_version','fixture-v1'));
  v_order_id:=v_order->>'id';
  v_attempt:=public.create_payment_attempt(v_order_id,v_uid,'fin03-success-'||gen_random_uuid()::text);
  v_attempt_id:=(v_attempt->>'attempt_id')::uuid; v_ref:=v_attempt->>'reference'; v_amt:=(v_attempt->>'amount_minor')::bigint;
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
  select coalesce(sum(case when direction='debit' then amount_minor else 0 end),0),
         coalesce(sum(case when direction='credit' then amount_minor else 0 end),0)
    into v_debits,v_credits from private.finance_journal_lines where journal_id=v_journal;
  if v_debits<>v_amt+v_platform_discount or v_credits<>v_seller_payable+v_commission+v_delivery then
    raise exception 'Journal not balanced or amounts wrong: debit %, credit %, expected debit %, credit %',v_debits,v_credits,v_amt+v_platform_discount,v_seller_payable+v_commission+v_delivery;
  end if;
  if not exists(select 1 from private.finance_journal_lines l join private.finance_accounts a on a.id=l.account_id where l.journal_id=v_journal and a.account_code='asset.paystack_clearing' and l.direction='debit' and l.amount_minor=v_amt)
     or (v_platform_discount>0 and not exists(select 1 from private.finance_journal_lines l join private.finance_accounts a on a.id=l.account_id where l.journal_id=v_journal and a.account_code='expense.platform_promotions' and l.direction='debit' and l.amount_minor=v_platform_discount))
     or not exists(select 1 from private.finance_journal_lines l join private.finance_accounts a on a.id=l.account_id where l.journal_id=v_journal and a.account_code='liability.seller_payable' and l.direction='credit' and l.store_id='everneed-official' and l.amount_minor=v_seller_payable)
     or (v_commission>0 and not exists(select 1 from private.finance_journal_lines l join private.finance_accounts a on a.id=l.account_id where l.journal_id=v_journal and a.account_code='revenue.platform_commission' and l.direction='credit' and l.amount_minor=v_commission))
     or (v_delivery>0 and not exists(select 1 from private.finance_journal_lines l join private.finance_accounts a on a.id=l.account_id where l.journal_id=v_journal and a.account_code='liability.delivery_fee_held' and l.direction='credit' and l.amount_minor=v_delivery)) then
    raise exception 'Journal lines do not match immutable v2 allocation mapping.';
  end if;
  v_result:=public.settle_verified_payment_attempt(v_ref,v_txid,v_amt,'NGN');
  if v_result->>'result'<>'already_settled' then raise exception 'Same transaction replay not idempotent: %',v_result; end if;
  if (select count(*) from private.finance_journals where source_type='payment_settlement' and source_id=v_order_id)<>1 then raise exception 'Duplicate settlement created multiple journals'; end if;

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
  if exists(select 1 from private.finance_journals where source_type='payment_settlement' and source_id=v_order2->>'id') then raise exception 'Mismatch attempt posted a journal'; end if;
end $$;
rollback;
