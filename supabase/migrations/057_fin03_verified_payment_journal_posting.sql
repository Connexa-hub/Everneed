-- FIN-03: atomically journal verified card settlements from immutable v2 allocation.
begin;

insert into private.finance_accounts(account_code,account_name,account_type,currency)
select 'liability.delivery_fee_held','Delivery fees held pending fulfilment allocation','liability',c.currency
from (values('NGN'),('GHS'),('KES'),('ZAR'),('GBP'),('USD')) c(currency)
on conflict(account_code,currency) do nothing;

-- Platform-funded checkout incentives are a company expense and must be
-- journalable in every supported checkout currency.
insert into private.finance_accounts(account_code,account_name,account_type,currency)
select 'expense.platform_promotions','Platform-funded promotions expense','expense',c.currency
from (values('NGN'),('GHS'),('KES'),('ZAR'),('GBP'),('USD')) c(currency)
on conflict(account_code,currency) do nothing;

create or replace function private.post_verified_order_payment_journal(p_order_id text,p_attempt_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  o public.orders%rowtype;
  a private.payment_attempts%rowtype;
  s private.order_financial_snapshots_v2%rowtype;
  amounts jsonb;
  allocations jsonb;
  currency text;
  exponent smallint;
  total_minor bigint;
  gross_minor bigint;
  net_minor bigint;
  discount_minor bigint;
  seller_discount bigint;
  delivery_minor bigint;
  payload_hash text;
  platform_discount bigint;
  seller_payable bigint;
  commission bigint;
  stores_payable bigint;
  stores_commission bigint;
  lines jsonb:='[]'::jsonb;
  journal_id uuid;
  allocation jsonb;
  payable bigint;
  comm bigint;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required.'; end if;
  if p_order_id is null or p_attempt_id is null then raise exception 'Order and attempt identifiers required.'; end if;
  select * into strict o from public.orders where id=p_order_id for update;
  select * into strict a from private.payment_attempts where id=p_attempt_id for update;
  select * into strict s from private.order_financial_snapshots_v2 where order_id=p_order_id;
  if a.order_id<>o.id or a.status<>'succeeded' or o.payment_status<>'paid'
     or a.provider<>'paystack' or o.ref is distinct from a.provider_reference then
    raise exception 'Order/payment attempt is not a verified paid settlement.';
  end if;
  if s.payload->>'schema_version'<>'2' or s.payload->>'order_id'<>o.id
     or s.currency<>a.currency or s.currency_exponent<>a.currency_exponent
     or upper(o.currency)<>a.currency then
    raise exception 'Financial snapshot identity/currency mismatch.';
  end if;
  amounts:=s.payload->'amounts'; allocations:=s.payload->'store_allocations';
  if jsonb_typeof(amounts)<>'object' or jsonb_typeof(allocations)<>'array' then
    raise exception 'Snapshot v2 amounts or store allocations are missing.';
  end if;
  currency:=upper(s.currency); exponent:=s.currency_exponent;
  payload_hash:=encode(extensions.digest(convert_to(s.payload::text,'UTF8'),'sha256'),'hex');
  total_minor:=(amounts->>'total_minor')::bigint;
  gross_minor:=(amounts->>'gross_merchandise_minor')::bigint;
  net_minor:=(amounts->>'net_merchandise_minor')::bigint;
  discount_minor:=(amounts->>'discount_minor')::bigint;
  seller_discount:=(amounts->>'seller_funded_discount_minor')::bigint;
  delivery_minor:=(amounts->>'delivery_fee_minor')::bigint;
  platform_discount:=(amounts->>'platform_funded_discount_minor')::bigint;
  seller_payable:=(amounts->>'seller_payable_minor')::bigint;
  commission:=(amounts->>'commission_minor')::bigint;
  if payload_hash<>s.payload_hash
     or a.checkout_snapshot_hash<>o.checkout_snapshot_hash
     or a.checkout_snapshot_version<>o.checkout_snapshot_version
     or total_minor<>a.amount_minor or total_minor<>round(o.total*100)::bigint
     or delivery_minor<>round(coalesce(o.delivery_fee,0)*100)::bigint
     or gross_minor<=0 or net_minor<0 or discount_minor<0 or seller_discount<0
     or total_minor<=0 or delivery_minor<0 or platform_discount<0
     or seller_payable<0 or commission<0
     or gross_minor-net_minor<>discount_minor
     or seller_discount+platform_discount<>discount_minor
     or net_minor+delivery_minor<>total_minor
     or seller_payable+commission<>net_minor+platform_discount
     or total_minor+platform_discount<>seller_payable+commission+delivery_minor then
    raise exception 'Snapshot v2 financial totals do not reconcile with the paid attempt.';
  end if;
  select coalesce(sum((x->>'seller_payable_minor')::bigint),0),
         coalesce(sum((x->>'commission_minor')::bigint),0)
    into stores_payable,stores_commission
    from jsonb_array_elements(allocations) x;
  if stores_payable<>seller_payable or stores_commission<>commission then
    raise exception 'Store allocations do not reconcile with snapshot totals.';
  end if;

  lines:=jsonb_build_array(jsonb_build_object('account_code','asset.paystack_clearing','direction','debit','amount_minor',total_minor,'order_id',o.id,'description','Verified Paystack customer payment'));
  if platform_discount>0 then
    lines:=lines||jsonb_build_array(jsonb_build_object('account_code','expense.platform_promotions','direction','debit','amount_minor',platform_discount,'order_id',o.id,'description','Platform-funded promotion'));
  end if;
  for allocation in select value from jsonb_array_elements(allocations) loop
    payable:=(allocation->>'seller_payable_minor')::bigint;
    comm:=(allocation->>'commission_minor')::bigint;
    if payable>0 then
      lines:=lines||jsonb_build_array(jsonb_build_object('account_code','liability.seller_payable','direction','credit','amount_minor',payable,'store_id',allocation->>'store_id','order_id',o.id,'description','Seller payable from verified order'));
    end if;
  end loop;
  if commission>0 then
    lines:=lines||jsonb_build_array(jsonb_build_object('account_code','revenue.platform_commission','direction','credit','amount_minor',commission,'order_id',o.id,'description','Platform commission from verified order'));
  end if;
  if delivery_minor>0 then
    lines:=lines||jsonb_build_array(jsonb_build_object('account_code','liability.delivery_fee_held','direction','credit','amount_minor',delivery_minor,'order_id',o.id,'description','Delivery funds held pending fulfilment allocation'));
  end if;
  journal_id:=public.post_finance_journal(
    'payment_settlement',o.id,a.provider_reference,currency,
    'Verified card settlement for order '||o.id,lines,
    jsonb_build_object('order_id',o.id,'payment_attempt_id',a.id,'provider_reference',a.provider_reference,
      'snapshot_payload_hash',s.payload_hash,'currency_exponent',exponent,'journal_policy_version','verified-card-settlement-v1'));
  return journal_id;
end
$$;
revoke all on function private.post_verified_order_payment_journal(text,uuid) from public,anon,authenticated,service_role;

create or replace function public.settle_verified_payment_attempt(
  p_provider_reference text,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt private.payment_attempts%rowtype;
  v_order public.orders%rowtype;
  v_result text;
  v_journal_id uuid;
  v_snapshot_hash text;
  v_snapshot_amount bigint;
  v_snapshot_exponent smallint;
begin
  if p_provider_reference is null or p_provider_transaction_id is null
     or p_amount_minor is null or p_amount_minor <= 0
     or p_currency is null then
    raise exception 'Verified transaction details are incomplete.';
  end if;

  select * into v_attempt
    from private.payment_attempts
   where provider = 'paystack' and provider_reference = p_provider_reference
   for update;
  if not found then
    return jsonb_build_object('result', 'unknown_reference');
  end if;

  select * into v_order
    from public.orders
   where id = v_attempt.order_id
   for update;
  if not found then
    update private.payment_attempts
       set status = 'reconciliation_required',
           failure_code = 'order_missing',
           failure_message = 'Payment attempt references a missing order.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required');
  end if;

  if v_order.checkout_snapshot is null
     or v_order.checkout_snapshot_version is null
     or v_order.checkout_snapshot_hash is null then
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'snapshot_missing',
           failure_message = 'The order has no complete immutable checkout snapshot.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'snapshot_missing');
  end if;

  v_snapshot_hash := encode(
    extensions.digest(convert_to(v_order.checkout_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );
  v_snapshot_amount := nullif(v_order.checkout_snapshot #>> '{amounts,total_minor}', '')::bigint;
  v_snapshot_exponent := nullif(v_order.checkout_snapshot->>'currency_exponent', '')::smallint;

  if v_attempt.user_id is distinct from v_order.user_id
     or v_order.checkout_snapshot_hash is distinct from v_attempt.checkout_snapshot_hash
     or v_order.checkout_snapshot_version is distinct from v_attempt.checkout_snapshot_version
     or v_snapshot_hash is distinct from v_attempt.checkout_snapshot_hash
     or v_order.checkout_snapshot->>'order_id' is distinct from v_order.id
     or v_order.checkout_snapshot->>'user_id' is distinct from v_order.user_id::text
     or upper(v_order.currency) is distinct from v_attempt.currency
     or upper(v_order.checkout_snapshot->>'currency') is distinct from v_attempt.currency
     or v_snapshot_amount is distinct from v_attempt.amount_minor
     or v_snapshot_exponent is distinct from v_attempt.currency_exponent then
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'order_attempt_integrity_mismatch',
           failure_message = 'Order ownership, snapshot integrity, amount, currency or exponent no longer matches the payment attempt.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'order_attempt_integrity_mismatch');
  end if;

  if p_amount_minor <> v_attempt.amount_minor
     or upper(p_currency) <> v_attempt.currency then
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'amount_or_currency_mismatch',
           failure_message = 'Provider transaction did not exactly match the immutable payment attempt.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'amount_or_currency_mismatch');
  end if;

  if v_attempt.status = 'succeeded' then
    if v_attempt.provider_transaction_id = p_provider_transaction_id then
      return jsonb_build_object('result', 'already_settled', 'order_id', v_order.id);
    end if;
    update private.payment_attempts
       set status = 'reconciliation_required',
           failure_code = 'transaction_id_conflict',
           failure_message = 'A different provider transaction ID was reported for a settled attempt.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'order_id', v_order.id);
  end if;

  if v_attempt.status in ('failed', 'cancelled') then
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'success_after_terminal_attempt',
           failure_message = 'Provider reported a successful charge for a terminal payment attempt.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'success_after_terminal_attempt');
  end if;
  if v_attempt.status not in ('pending', 'processing', 'initializing') then
    return jsonb_build_object('result', 'attempt_not_payable', 'status', v_attempt.status);
  end if;

  if v_order.payment_status = 'paid' or v_order.paid_at is not null then
    if v_order.ref = v_attempt.provider_reference then
      update private.payment_attempts
         set status = 'succeeded',
             provider_transaction_id = p_provider_transaction_id,
             verified_at = now(), succeeded_at = now(), updated_at = now()
       where id = v_attempt.id;
      return jsonb_build_object('result', 'already_settled', 'order_id', v_order.id);
    end if;
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'second_successful_charge',
           failure_message = 'Order was already paid using a different payment reference.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'second_successful_charge');
  end if;

  if v_order.status = 'cancelled' then
    update private.payment_attempts
       set status = 'reconciliation_required',
           provider_transaction_id = p_provider_transaction_id,
           failure_code = 'paid_after_cancellation',
           failure_message = 'Provider reported a successful charge after order cancellation.',
           updated_at = now()
     where id = v_attempt.id;
    return jsonb_build_object('result', 'reconciliation_required', 'reason', 'paid_after_cancellation');
  end if;

  update private.payment_attempts
     set status = 'succeeded',
         provider_transaction_id = p_provider_transaction_id,
         verified_at = now(), succeeded_at = now(), updated_at = now()
   where id = v_attempt.id;

  v_result := private.confirm_payment_core(v_order.id, v_attempt.provider_reference, null);
  if v_result = 'paid' then
    v_journal_id := private.post_verified_order_payment_journal(v_order.id, v_attempt.id);
  end if;
  return jsonb_build_object('result', v_result, 'order_id', v_order.id, 'attempt_id', v_attempt.id, 'journal_id', v_journal_id);
end
$$;
