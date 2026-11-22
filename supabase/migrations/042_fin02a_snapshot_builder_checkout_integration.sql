-- FIN-02A: deterministic v2 allocation builder and atomic card checkout integration.
-- Existing v1 snapshot wrapper remains the authoritative order/stock/offer creator.
-- v2 construction and platform budget reservations execute in the same transaction.
begin;

alter table public.orders
  add column if not exists financial_offer_id text references public.offers(id) on delete restrict;

comment on column public.orders.financial_offer_id is
  'Immutable offer identity used by schema-v2 funding allocation; null for legacy orders or no offer.';

create or replace function private.build_order_financial_snapshot_v2(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_v1 jsonb;
  v_offer_id text;
  v_currency text;
  v_exponent smallint;
  v_gross bigint;
  v_net bigint;
  v_discount bigint;
  v_delivery bigint;
  v_total bigint;
  v_input jsonb;
  v_alloc jsonb;
  v_items jsonb;
  v_store_allocations jsonb;
  v_platform_discount bigint;
  v_reservation uuid;
  v_reservations uuid[] := '{}';
  v_payload jsonb;
  v_offer record;
  v_store record;
  v_seller_bps integer;
  v_consent_at timestamptz;
  v_policy text := 'commission-policy-v1';
begin
  if p_order_id is null or length(trim(p_order_id)) not between 1 and 128 then
    raise exception 'Invalid order identifier.';
  end if;
  select * into strict v_order from public.orders where id=p_order_id for update;
  if v_order.checkout_snapshot is null or v_order.checkout_snapshot_version<>1
     or v_order.payment_status not in ('awaiting_payment','awaiting_transfer')
     or exists(select 1 from private.order_financial_snapshots_v2 where order_id=p_order_id) then
    raise exception 'Order is not eligible for financial snapshot v2.';
  end if;
  v_v1 := v_order.checkout_snapshot;
  v_offer_id := v_order.financial_offer_id;
  v_currency := upper(v_order.currency);
  v_exponent := (v_v1->>'currency_exponent')::smallint;
  v_gross := (v_v1->'amounts'->>'gross_merchandise_minor')::bigint;
  v_net := (v_v1->'amounts'->>'net_merchandise_minor')::bigint;
  v_discount := v_gross-v_net;
  v_delivery := (v_v1->'amounts'->>'delivery_fee_minor')::bigint;
  v_total := (v_v1->'amounts'->>'total_minor')::bigint;
  if v_gross<=0 or v_net<0 or v_discount<0 or v_delivery<0
     or v_total<>v_net+v_delivery then
    raise exception 'V1 checkout quote does not reconcile; refusing financial snapshot v2.';
  end if;
  if v_discount>0 and v_offer_id is null then
    raise exception 'Discount funding cannot be identified; checkout must fail closed.';
  end if;
  if v_offer_id is not null then
    select id,code,name,kind,value,scope,target into strict v_offer
      from public.offers where id=v_offer_id;
  end if;

  -- The seller funding basis is frozen from current, active opt-in consent.
  -- If no consent exists, platform bears the discount, but only against an approved budget.
  select jsonb_agg(jsonb_build_object(
    'order_item_id',i.id,
    'store_id',i.store_id,
    'gross_minor',round(i.line_total*100)::bigint,
    'commission_rate',f.commission_rate,
    'seller_funding_bps',coalesce(c.seller_funding_bps,0),
    'platform_funding_bps',10000-coalesce(c.seller_funding_bps,0)
  ) order by i.id)
  into v_input
  from public.order_items i
  join public.order_item_fees f on f.order_item_id=i.id
  left join private.offer_store_funding_consent c
    on c.offer_id=v_offer_id and c.store_id=i.store_id and c.revoked_at is null
  where i.order_id=p_order_id;

  if v_input is null or jsonb_array_length(v_input) not between 1 and 50 then
    raise exception 'Persisted checkout items or commission records are incomplete.';
  end if;

  v_alloc := private.allocate_order_financial_items_v2(v_input,v_net);
  v_items := v_alloc->'items';
  v_platform_discount := (v_alloc->>'platform_funded_discount_minor')::bigint;

  if v_platform_discount>0 then
    if v_offer_id is null then raise exception 'Platform subsidy requires an identifiable campaign.'; end if;
    v_reservation := private.reserve_offer_campaign_budget(
      p_order_id,v_offer_id,v_currency,v_platform_discount
    );
    v_reservations := array_append(v_reservations,v_reservation);
  end if;

  -- Enrich item-level frozen allocation with funding consent provenance.
  select jsonb_agg(
    e || jsonb_build_object(
      'offer_id',v_offer_id,
      'funding_source',case
        when (e->>'discount_minor')::bigint=0 then 'none'
        when (e->>'seller_discount_minor')::bigint=0 then 'platform'
        when (e->>'platform_discount_minor')::bigint=0 then 'seller'
        else 'split'
      end,
      'seller_consent_at',c.consented_at
    ) order by e->>'order_item_id'
  ) into v_items
  from jsonb_array_elements(v_items) e
  left join private.offer_store_funding_consent c
    on c.offer_id=v_offer_id and c.store_id=e->>'store_id' and c.revoked_at is null;

  select jsonb_agg(jsonb_build_object(
    'store_id',x.store_id,
    'gross_minor',x.gross_minor,
    'seller_funded_discount_minor',x.seller_discount_minor,
    'platform_funded_discount_minor',x.platform_discount_minor,
    'commission_minor',x.commission_minor,
    'seller_payable_minor',x.seller_payable_minor
  ) order by x.store_id)
  into v_store_allocations
  from (
    select store_id,
      sum(gross_minor)::bigint gross_minor,
      sum(seller_discount_minor)::bigint seller_discount_minor,
      sum(platform_discount_minor)::bigint platform_discount_minor,
      sum(commission_minor)::bigint commission_minor,
      sum(seller_payable_minor)::bigint seller_payable_minor
    from jsonb_to_recordset(v_items) as a(
      store_id text,gross_minor bigint,seller_discount_minor bigint,
      platform_discount_minor bigint,commission_minor bigint,seller_payable_minor bigint
    )
    group by store_id
  ) x;

  v_payload := jsonb_build_object(
    'schema_version',2,
    'order_id',p_order_id,
    'currency',v_currency,
    'currency_exponent',v_exponent,
    'offer_id',v_offer_id,
    'pricing',v_v1->'pricing',
    'policy',jsonb_build_object(
      'commission_policy_version',v_policy,
      'discount_funding_policy_version','seller-consent-platform-budget-v1',
      'rounding_policy',v_alloc->>'rounding_policy',
      'funding_split_rounding_policy',v_alloc->>'funding_split_rounding_policy'
    ),
    'amounts',jsonb_build_object(
      'gross_merchandise_minor',v_gross,
      'net_merchandise_minor',v_net,
      'discount_minor',v_discount,
      'seller_funded_discount_minor',(v_alloc->>'seller_funded_discount_minor')::bigint,
      'platform_funded_discount_minor',v_platform_discount,
      'commission_minor',(v_alloc->>'commission_minor')::bigint,
      'seller_payable_minor',(v_alloc->>'seller_payable_minor')::bigint,
      'delivery_fee_minor',v_delivery,
      'total_minor',v_total
    ),
    'items',v_items,
    'store_allocations',v_store_allocations,
    'budget_reservation_ids',to_jsonb(v_reservations)
  );

  perform public.persist_order_financial_snapshot_v2(p_order_id,v_payload,v_reservations);
  return v_payload;
end
$$;

revoke all on function private.build_order_financial_snapshot_v2(text) from public,anon,authenticated,service_role;

create or replace function public.create_order_with_financial_snapshot_v2(
  p_user uuid,p_items jsonb,p_country text,p_pm text,p_cust jsonb,
  p_k numeric,p_cur text,p_discount_base numeric,p_offer jsonb,p_fee numeric,
  p_card_id text,p_pricing_context jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_order jsonb;
  v_order_id text;
  v_offer_id text;
  v_snapshot jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'Service role required.';
  end if;
  v_order := public.create_order_with_snapshot(
    p_user,p_items,p_country,p_pm,p_cust,p_k,p_cur,p_discount_base,p_offer,p_fee,p_card_id,p_pricing_context
  );
  v_order_id := v_order->>'id';
  v_offer_id := nullif(p_offer->>'id','');
  if v_offer_id is not null and not exists(select 1 from public.offers where id=v_offer_id) then
    raise exception 'Promotion identity does not match a persisted offer.';
  end if;
  update public.orders set financial_offer_id=v_offer_id where id=v_order_id;
  v_snapshot := private.build_order_financial_snapshot_v2(v_order_id);
  select to_jsonb(o) into v_order from public.orders o where o.id=v_order_id;
  return v_order || jsonb_build_object('financial_snapshot_v2',v_snapshot);
end
$$;

revoke all on function public.create_order_with_financial_snapshot_v2(
  uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb
) from public,anon,authenticated;
grant execute on function public.create_order_with_financial_snapshot_v2(
  uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb
) to service_role;

comment on function public.create_order_with_financial_snapshot_v2(
  uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb
) is 'Service-only atomic card checkout wrapper: v1 order+quote, offer identity, seller/platform discount allocation, budget reservation and immutable v2 snapshot.';

commit;
