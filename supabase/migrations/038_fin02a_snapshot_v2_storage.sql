-- FIN-02A: immutable schema-v2 financial allocation snapshot persistence.
-- This is a storage/validation boundary only; checkout does not call it yet.
begin;

create table if not exists private.order_financial_snapshots_v2 (
  order_id text primary key references public.orders(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  currency_exponent smallint not null check (currency_exponent between 0 and 6),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  budget_reservation_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

revoke all on private.order_financial_snapshots_v2 from public, anon, authenticated, service_role;

create or replace function private.guard_order_financial_snapshot_v2()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'Financial snapshot v2 is immutable.';
end
$$;

drop trigger if exists order_financial_snapshot_v2_immutable on private.order_financial_snapshots_v2;
create trigger order_financial_snapshot_v2_immutable
before update or delete on private.order_financial_snapshots_v2
for each row execute function private.guard_order_financial_snapshot_v2();

create or replace function public.persist_order_financial_snapshot_v2(
  p_order_id text,
  p_payload jsonb,
  p_budget_reservation_ids uuid[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_currency text;
  v_exponent smallint;
  v_items jsonb;
  v_item_count integer;
  v_gross numeric;
  v_net numeric;
  v_discount numeric;
  v_seller_discount numeric;
  v_platform_discount numeric;
  v_commission numeric;
  v_payable numeric;
  v_delivery numeric;
  v_total numeric;
  v_reserved numeric;
  v_hash text;
  v_item record;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_order_id is null or length(trim(p_order_id)) not between 1 and 128
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_budget_reservation_ids is null then
    raise exception 'Invalid financial snapshot input.';
  end if;
  if p_payload->>'schema_version' <> '2'
     or p_payload->>'order_id' is distinct from p_order_id
     or jsonb_typeof(p_payload->'amounts') <> 'object'
     or jsonb_typeof(p_payload->'items') <> 'array'
     or jsonb_typeof(p_payload->'pricing') <> 'object'
     or jsonb_typeof(p_payload->'policy') <> 'object' then
    raise exception 'Snapshot v2 structure is incomplete.';
  end if;
  v_items := p_payload->'items';
  v_item_count := jsonb_array_length(v_items);
  if v_item_count not between 1 and 50 then raise exception 'Snapshot v2 item count is invalid.'; end if;
  v_currency := upper(p_payload->>'currency');
  v_exponent := (p_payload->>'currency_exponent')::smallint;
  if v_currency !~ '^[A-Z]{3}$' or v_exponent not between 0 and 6 then
    raise exception 'Snapshot currency or exponent is invalid.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_items) e
    where jsonb_typeof(e) <> 'object'
      or jsonb_typeof(e->'order_item_id') <> 'string'
      or jsonb_typeof(e->'store_id') <> 'string'
      or jsonb_typeof(e->'gross_minor') <> 'number'
      or jsonb_typeof(e->'discount_minor') <> 'number'
      or jsonb_typeof(e->'seller_discount_minor') <> 'number'
      or jsonb_typeof(e->'platform_discount_minor') <> 'number'
      or jsonb_typeof(e->'seller_consideration_minor') <> 'number'
      or jsonb_typeof(e->'commission_minor') <> 'number'
      or jsonb_typeof(e->'seller_payable_minor') <> 'number'
      or jsonb_typeof(e->'commission_rate') <> 'number'
      or jsonb_typeof(e->'seller_funding_bps') <> 'number'
      or jsonb_typeof(e->'platform_funding_bps') <> 'number'
  ) then raise exception 'Snapshot v2 item structure is invalid.'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_items) as x(
      order_item_id text, store_id text, gross_minor numeric, discount_minor numeric,
      seller_discount_minor numeric, platform_discount_minor numeric,
      seller_consideration_minor numeric, commission_minor numeric,
      seller_payable_minor numeric, commission_rate numeric,
      seller_funding_bps integer, platform_funding_bps integer
    )
    where coalesce(length(trim(order_item_id)),0) not between 1 and 128
      or coalesce(length(trim(store_id)),0) not between 1 and 128
      or gross_minor is null or gross_minor <= 0 or gross_minor <> trunc(gross_minor)
      or discount_minor is null or discount_minor < 0 or discount_minor <> trunc(discount_minor)
      or seller_discount_minor is null or seller_discount_minor < 0 or seller_discount_minor <> trunc(seller_discount_minor)
      or platform_discount_minor is null or platform_discount_minor < 0 or platform_discount_minor <> trunc(platform_discount_minor)
      or seller_consideration_minor is null or seller_consideration_minor < 0 or seller_consideration_minor <> trunc(seller_consideration_minor)
      or commission_minor is null or commission_minor < 0 or commission_minor <> trunc(commission_minor)
      or seller_payable_minor is null or seller_payable_minor < 0 or seller_payable_minor <> trunc(seller_payable_minor)
      or commission_rate is null or commission_rate not between 0 and 100
      or seller_funding_bps is null or seller_funding_bps not between 0 and 10000
      or platform_funding_bps is null or platform_funding_bps not between 0 and 10000
      or seller_funding_bps + platform_funding_bps <> 10000
      or discount_minor <> seller_discount_minor + platform_discount_minor
      or seller_consideration_minor <> gross_minor - seller_discount_minor
      or commission_minor <> round(seller_consideration_minor * commission_rate / 100)
      or seller_payable_minor <> seller_consideration_minor - commission_minor
  ) then raise exception 'Snapshot v2 item arithmetic is invalid.'; end if;

  if exists (
    select order_item_id from jsonb_to_recordset(v_items) as x(order_item_id text)
    group by order_item_id having count(*) > 1
  ) then raise exception 'Snapshot v2 item IDs must be unique.'; end if;

  select coalesce(sum(gross_minor),0),coalesce(sum(gross_minor-discount_minor),0),
         coalesce(sum(discount_minor),0),coalesce(sum(seller_discount_minor),0),
         coalesce(sum(platform_discount_minor),0),coalesce(sum(commission_minor),0),
         coalesce(sum(seller_payable_minor),0)
    into v_gross,v_net,v_discount,v_seller_discount,v_platform_discount,v_commission,v_payable
    from jsonb_to_recordset(v_items) as x(
      gross_minor numeric,discount_minor numeric,seller_discount_minor numeric,
      platform_discount_minor numeric,commission_minor numeric,seller_payable_minor numeric
    );

  v_delivery := (p_payload->'amounts'->>'delivery_fee_minor')::numeric;
  v_total := (p_payload->'amounts'->>'total_minor')::numeric;
  if v_delivery is null or v_delivery < 0 or v_delivery <> trunc(v_delivery)
     or v_total is null or v_total <> trunc(v_total)
     or v_gross > 9223372036854775807 or v_total > 9223372036854775807
     or v_discount <> v_gross-v_net
     or v_payable+v_commission <> v_net+v_platform_discount
     or (p_payload->'amounts'->>'gross_merchandise_minor')::numeric <> v_gross
     or (p_payload->'amounts'->>'net_merchandise_minor')::numeric <> v_net
     or (p_payload->'amounts'->>'discount_minor')::numeric <> v_discount
     or (p_payload->'amounts'->>'seller_funded_discount_minor')::numeric <> v_seller_discount
     or (p_payload->'amounts'->>'platform_funded_discount_minor')::numeric <> v_platform_discount
     or (p_payload->'amounts'->>'commission_minor')::numeric <> v_commission
     or (p_payload->'amounts'->>'seller_payable_minor')::numeric <> v_payable then
    raise exception 'Snapshot v2 totals do not reconcile.';
  end if;

  select * into strict v_order from public.orders where id=p_order_id for update;
  if v_order.checkout_snapshot is null or v_order.checkout_snapshot_version <> 1
     or upper(v_order.currency) <> v_currency
     or v_order.payment_status not in ('awaiting_payment','awaiting_transfer') then
    raise exception 'Order is not eligible for a financial snapshot v2.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_items) as x(
      order_item_id text,store_id text,gross_minor bigint,commission_rate numeric
    )
    left join public.order_items oi on oi.id=x.order_item_id and oi.order_id=p_order_id
    left join public.order_item_fees f on f.order_item_id=oi.id
    where oi.id is null or oi.store_id is distinct from x.store_id
      or round(oi.line_total*100)::bigint is distinct from x.gross_minor
      or f.commission_rate is distinct from x.commission_rate
  ) then raise exception 'Snapshot v2 items do not match persisted checkout lines or commission policy.'; end if;

  if cardinality(p_budget_reservation_ids) > 20 then raise exception 'Too many campaign reservations.'; end if;
  select coalesce(sum(r.amount_minor),0) into v_reserved
    from private.offer_budget_reservations r
   where r.id = any(p_budget_reservation_ids)
     and r.order_id=p_order_id and r.currency=v_currency and r.status='reserved';
  if v_reserved <> v_platform_discount then
    raise exception 'Campaign reservation amount must exactly match platform-funded discount.';
  end if;
  if v_platform_discount=0 and cardinality(p_budget_reservation_ids)<>0 then
    raise exception 'Unexpected campaign reservations for a zero platform subsidy.';
  end if;

  v_hash := encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
  insert into private.order_financial_snapshots_v2(order_id,currency,currency_exponent,payload,payload_hash,budget_reservation_ids)
  values(p_order_id,v_currency,v_exponent,p_payload,v_hash,p_budget_reservation_ids);
  return jsonb_build_object('order_id',p_order_id,'schema_version',2,'payload_hash',v_hash,'snapshot',p_payload);
end
$$;

revoke all on function public.persist_order_financial_snapshot_v2(text,jsonb,uuid[]) from public, anon, authenticated;
grant execute on function public.persist_order_financial_snapshot_v2(text,jsonb,uuid[]) to service_role;

comment on table private.order_financial_snapshots_v2 is
  'Immutable, validated per-item/store financial allocation snapshot. No checkout/payment/settlement integration is enabled yet.';
comment on function public.persist_order_financial_snapshot_v2(text,jsonb,uuid[]) is
  'Service-role-only validated persistence boundary for FIN-02A schema-v2 allocations; requires an existing immutable checkout snapshot v1 and campaign reservations matching platform-funded subsidy.';

commit;
