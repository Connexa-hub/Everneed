-- FIN-02A: deterministic, integer-minor-unit checkout allocation primitive.
-- This function is deliberately isolated: it does not mutate orders, reserve
-- campaign budgets, post journals, release sellers, or initiate payments.

begin;

create or replace function private.allocate_order_financial_items_v2(
  p_items jsonb,
  p_net_merchandise_minor bigint
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_count integer;
  v_gross_total numeric;
  v_discount_total numeric;
  v_allocated jsonb;
  v_seller_discount bigint;
  v_platform_discount bigint;
  v_commission bigint;
  v_seller_payable bigint;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Financial allocation items must be a JSON array.';
  end if;

  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 50 then
    raise exception 'Financial allocation requires between 1 and 50 items.';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) e
     where jsonb_typeof(e) <> 'object'
        or case when jsonb_typeof(e) = 'object'
             then (select count(*) from jsonb_object_keys(e)) <> 6
             else true
           end
        or not (e ?& array[
          'order_item_id','store_id','gross_minor','commission_rate',
          'seller_funding_bps','platform_funding_bps'
        ])
        or jsonb_typeof(e->'order_item_id') <> 'string'
        or jsonb_typeof(e->'store_id') <> 'string'
        or jsonb_typeof(e->'gross_minor') <> 'number'
        or jsonb_typeof(e->'commission_rate') <> 'number'
        or jsonb_typeof(e->'seller_funding_bps') <> 'number'
        or jsonb_typeof(e->'platform_funding_bps') <> 'number'
        or coalesce(length(trim(e->>'order_item_id')), 0) not between 1 and 128
        or coalesce(length(trim(e->>'store_id')), 0) not between 1 and 128
        or (e->>'gross_minor')::numeric <> trunc((e->>'gross_minor')::numeric)
        or (e->>'gross_minor')::numeric not between 1 and 9223372036854775807
        or (e->>'seller_funding_bps')::numeric <> trunc((e->>'seller_funding_bps')::numeric)
        or (e->>'platform_funding_bps')::numeric <> trunc((e->>'platform_funding_bps')::numeric)
  ) then
    raise exception 'Financial allocation item shape is invalid.';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_items) as x(
        order_item_id text,
        store_id text,
        gross_minor bigint,
        commission_rate numeric,
        seller_funding_bps integer,
        platform_funding_bps integer
      )
     where gross_minor is null or gross_minor <= 0
        or commission_rate is null or commission_rate < 0 or commission_rate > 100
        or seller_funding_bps is null or seller_funding_bps not between 0 and 10000
        or platform_funding_bps is null or platform_funding_bps not between 0 and 10000
        or seller_funding_bps + platform_funding_bps <> 10000
  ) then
    raise exception 'Financial allocation amount, commission rate, or funding split is invalid.';
  end if;

  if exists (
    select order_item_id
      from jsonb_to_recordset(p_items) as x(
        order_item_id text,
        store_id text,
        gross_minor bigint,
        commission_rate numeric,
        seller_funding_bps integer,
        platform_funding_bps integer
      )
     group by order_item_id
    having count(*) > 1
  ) then
    raise exception 'Financial allocation item identifiers must be unique.';
  end if;

  select sum(gross_minor::numeric)
    into v_gross_total
    from jsonb_to_recordset(p_items) as x(
      order_item_id text,
      store_id text,
      gross_minor bigint,
      commission_rate numeric,
      seller_funding_bps integer,
      platform_funding_bps integer
    );

  if v_gross_total is null
     or v_gross_total <= 0
     or v_gross_total > 9223372036854775807
     or p_net_merchandise_minor is null
     or p_net_merchandise_minor < 0
     or p_net_merchandise_minor::numeric > v_gross_total then
    raise exception 'Financial allocation totals are outside the supported range.';
  end if;

  v_discount_total := v_gross_total - p_net_merchandise_minor::numeric;

  with parsed as (
    select
      x.order_item_id,
      x.store_id,
      x.gross_minor,
      x.commission_rate,
      x.seller_funding_bps,
      x.platform_funding_bps,
      row_number() over (order by x.order_item_id) as rn,
      count(*) over () as item_count
    from jsonb_to_recordset(p_items) as x(
      order_item_id text,
      store_id text,
      gross_minor bigint,
      commission_rate numeric,
      seller_funding_bps integer,
      platform_funding_bps integer
    )
  ),
  floors as (
    select *,
      floor(v_discount_total * gross_minor::numeric / v_gross_total)::bigint
        as discount_floor_minor
    from parsed
  ),
  discount_allocated as (
    select *,
      discount_floor_minor
      + case when rn = item_count
          then (v_discount_total - sum(discount_floor_minor::numeric) over ())::bigint
          else 0
        end as discount_minor
    from floors
  ),
  split as (
    select *,
      floor(discount_minor::numeric * seller_funding_bps / 10000)::bigint
        as seller_discount_minor
    from discount_allocated
  ),
  calculated as (
    select *,
      discount_minor - seller_discount_minor as platform_discount_minor,
      gross_minor - seller_discount_minor as seller_consideration_minor,
      round((gross_minor - seller_discount_minor)::numeric * commission_rate / 100)::bigint
        as commission_minor
    from split
  ),
  final as (
    select *,
      seller_consideration_minor - commission_minor as seller_payable_minor
    from calculated
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'order_item_id', order_item_id,
        'store_id', store_id,
        'gross_minor', gross_minor,
        'discount_minor', discount_minor,
        'seller_discount_minor', seller_discount_minor,
        'platform_discount_minor', platform_discount_minor,
        'seller_consideration_minor', seller_consideration_minor,
        'commission_rate', commission_rate,
        'commission_minor', commission_minor,
        'seller_payable_minor', seller_payable_minor,
        'seller_funding_bps', seller_funding_bps,
        'platform_funding_bps', platform_funding_bps
      ) order by order_item_id
    ),
    coalesce(sum(seller_discount_minor), 0),
    coalesce(sum(platform_discount_minor), 0),
    coalesce(sum(commission_minor), 0),
    coalesce(sum(seller_payable_minor), 0)
  into v_allocated, v_seller_discount, v_platform_discount, v_commission, v_seller_payable
  from final;

  return jsonb_build_object(
    'schema_version', 2,
    'rounding_policy', 'proportional_floor_last_item_residual_v1',
    'funding_split_rounding_policy', 'seller_floor_platform_residual_v1',
    'gross_merchandise_minor', v_gross_total::bigint,
    'net_merchandise_minor', p_net_merchandise_minor,
    'discount_minor', v_discount_total::bigint,
    'seller_funded_discount_minor', v_seller_discount,
    'platform_funded_discount_minor', v_platform_discount,
    'commission_minor', v_commission,
    'seller_payable_minor', v_seller_payable,
    'items', coalesce(v_allocated, '[]'::jsonb)
  );
end
$function$;

revoke all on function private.allocate_order_financial_items_v2(jsonb,bigint)
  from public, anon, authenticated, service_role;

comment on function private.allocate_order_financial_items_v2(jsonb,bigint) is
  'Pure deterministic FIN-02A integer-minor-unit allocation primitive. Not wired to checkout, journal posting or seller settlement.';

commit;
