-- Everneed Payment Lifecycle 027 — atomic immutable checkout snapshot
-- Target: web-portal -> Everneed-staging only after review and explicit approval.
-- This migration is a draft. It must ship with the matching Paystack Edge Function.
-- Do not apply while the Edge Function still calls public.create_order directly.

begin;

alter table public.orders
  add column if not exists checkout_snapshot_hash text;

comment on column public.orders.checkout_snapshot_hash is
  'SHA-256 digest of the immutable checkout_snapshot JSONB; NULL only for legacy orders.';

-- Extend the 026 write-once guard to bind the snapshot hash to the exact JSONB value.
create or replace function private.guard_order_checkout_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_hash text;
begin
  if old.checkout_snapshot is not null then
    if new.checkout_snapshot is distinct from old.checkout_snapshot
       or new.checkout_snapshot_version is distinct from old.checkout_snapshot_version
       or new.checkout_snapshot_hash is distinct from old.checkout_snapshot_hash then
      raise exception 'Checkout snapshot is immutable.';
    end if;
    return new;
  end if;

  if new.checkout_snapshot is null
     or new.checkout_snapshot_version is null
     or new.checkout_snapshot_version <= 0
     or new.checkout_snapshot_hash is null
     or jsonb_typeof(new.checkout_snapshot) <> 'object' then
    raise exception 'A checkout snapshot requires a positive version, JSON object and hash.';
  end if;

  expected_hash := encode(
    extensions.digest(convert_to(new.checkout_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );
  if new.checkout_snapshot_hash <> expected_hash then
    raise exception 'Checkout snapshot hash does not match its content.';
  end if;

  return new;
end
$$;

drop trigger if exists orders_checkout_snapshot_immutable on public.orders;
create trigger orders_checkout_snapshot_immutable
before update of checkout_snapshot, checkout_snapshot_version, checkout_snapshot_hash
on public.orders
for each row execute function private.guard_order_checkout_snapshot();

-- Atomic wrapper around the existing, heavily-used order creation function.
-- The existing function remains the sole authority for stock reservation,
-- seller-order creation, commissions, offer redemption and delivery routing.
create or replace function public.create_order_with_snapshot(
  p_user uuid,
  p_items jsonb,
  p_country text,
  p_pm text,
  p_cust jsonb,
  p_k numeric,
  p_cur text,
  p_discount_base numeric,
  p_offer jsonb,
  p_fee numeric,
  p_card_id text,
  p_pricing_context jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_json jsonb;
  v_order public.orders%rowtype;
  v_fx_rate numeric;
  v_markup numeric;
  v_fx_source text;
  v_fx_fetched_at timestamptz;
  v_policy_version text;
  v_exponent smallint;
  v_gross_minor bigint;
  v_net_merch_minor bigint;
  v_item_count integer;
  v_discount_minor bigint;
  v_snapshot jsonb;
  v_hash text;
begin
  if p_user is null then
    raise exception 'A customer account is required.';
  end if;
  if jsonb_typeof(p_pricing_context) <> 'object' then
    raise exception 'Pricing provenance is required.';
  end if;

  v_fx_rate := nullif(p_pricing_context->>'fx_rate', '')::numeric;
  v_markup := nullif(p_pricing_context->>'markup_percent', '')::numeric;
  v_fx_source := nullif(left(trim(p_pricing_context->>'fx_source'), 120), '');
  v_fx_fetched_at := nullif(p_pricing_context->>'fx_fetched_at', '')::timestamptz;
  v_policy_version := nullif(left(trim(p_pricing_context->>'pricing_policy_version'), 80), '');

  if coalesce(v_fx_rate, 0) <= 0
     or coalesce(v_markup, -1) < 0
     or v_markup > 100
     or v_fx_source is null
     or v_fx_fetched_at is null
     or v_policy_version is null then
    raise exception 'Pricing provenance is incomplete or invalid.';
  end if;

  v_exponent := case upper(p_cur)
    when 'NGN' then 2
    when 'GHS' then 2
    when 'KES' then 2
    when 'ZAR' then 2
    when 'GBP' then 2
    when 'USD' then 2
    else null
  end;
  if v_exponent is null
     or nullif(p_pricing_context->>'currency_exponent', '')::smallint is distinct from v_exponent then
    raise exception 'Unsupported currency or currency exponent.';
  end if;

  if abs(p_k - (v_fx_rate * (1 + v_markup / 100))) > 0.00000001 then
    raise exception 'The effective checkout rate does not match its FX provenance.';
  end if;

  -- Nested function execution is part of this transaction. If snapshot creation
  -- or validation fails, order rows, stock reservations and offer redemption roll back.
  v_order_json := public.create_order(
    p_user, p_items, p_country, p_pm, p_cust, p_k, p_cur,
    p_discount_base, p_offer, p_fee, p_card_id
  );

  select *
    into strict v_order
    from public.orders
   where id = v_order_json->>'id'
   for update;

  if v_order.checkout_snapshot is not null then
    raise exception 'This order already has a checkout snapshot.';
  end if;
  if v_order.currency is distinct from upper(p_cur) then
    raise exception 'Persisted order currency does not match checkout currency.';
  end if;

  select coalesce(sum(round(i.line_total * 100)::bigint), 0), count(*)::integer
    into v_gross_minor, v_item_count
    from public.order_items i
   where i.order_id = v_order.id;

  v_discount_minor := round(coalesce(v_order.discount, 0) * 100)::bigint;
  v_net_merch_minor := round((v_order.total - coalesce(v_order.delivery_fee, 0)) * 100)::bigint;

  if v_gross_minor <= 0
     or v_net_merch_minor < 0
     or v_net_merch_minor > v_gross_minor + v_item_count
     or v_discount_minor < 0 then
    raise exception 'Persisted order totals cannot form a safe checkout allocation.';
  end if;

  -- Allocate the exact merchandise amount payable across items in proportion
  -- to persisted gross line values. Floors are used for all but the final item;
  -- the final item receives the deterministic remainder so allocations sum exactly.
  with base as (
    select
      i.id,
      i.product_id,
      i.store_id,
      i.name,
      i.size,
      i.unit_price,
      i.qty,
      round(i.line_total * 100)::bigint as gross_minor,
      row_number() over (order by i.id) as rn,
      count(*) over () as item_count
    from public.order_items i
    where i.order_id = v_order.id
  ),
  floors as (
    select *,
      floor((v_net_merch_minor::numeric * gross_minor::numeric) / v_gross_minor)::bigint as net_floor_minor
    from base
  ),
  allocated as (
    select *,
      net_floor_minor
      + case when rn = item_count
          then v_net_merch_minor - sum(net_floor_minor) over ()
          else 0
        end as net_refundable_minor
    from floors
  )
  select jsonb_agg(
    jsonb_build_object(
      'order_item_id', id,
      'product_id', product_id,
      'store_id', store_id,
      'name', name,
      'size', coalesce(size, ''),
      'quantity', qty,
      'unit_price', unit_price,
      'gross_minor', gross_minor,
      'net_refundable_minor', net_refundable_minor,
      'discount_allocation_minor', greatest(gross_minor - net_refundable_minor, 0),
      'rounding_adjustment_minor', greatest(net_refundable_minor - gross_minor, 0)
    ) order by id
  )
  into v_snapshot
  from allocated;

  v_snapshot := jsonb_build_object(
    'schema_version', 1,
    'order_id', v_order.id,
    'user_id', v_order.user_id,
    'country', v_order.country,
    'currency', v_order.currency,
    'currency_exponent', v_exponent,
    'payment_method', v_order.pm,
    'quoted_at', now(),
    'pricing', jsonb_build_object(
      'fx_rate', v_fx_rate,
      'fx_source', v_fx_source,
      'fx_fetched_at', v_fx_fetched_at,
      'markup_percent', v_markup,
      'effective_rate', p_k,
      'pricing_policy_version', v_policy_version
    ),
    'amounts', jsonb_build_object(
      'gross_merchandise_minor', v_gross_minor,
      'recorded_order_discount_minor', v_discount_minor,
      'allocated_discount_minor', greatest(v_gross_minor - v_net_merch_minor, 0),
      'rounding_adjustment_minor', greatest(v_net_merch_minor - v_gross_minor, 0),
      'net_merchandise_minor', v_net_merch_minor,
      'delivery_fee_minor', round(coalesce(v_order.delivery_fee, 0) * 100)::bigint,
      'total_minor', round(v_order.total * 100)::bigint
    ),
    'delivery_fee_refund_policy', 'admin_review_required',
    'items', coalesce(v_snapshot, '[]'::jsonb)
  );

  v_hash := encode(
    extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );

  update public.orders
     set checkout_snapshot_version = 1,
         checkout_snapshot = v_snapshot,
         checkout_snapshot_hash = v_hash
   where id = v_order.id
     and checkout_snapshot is null
     and checkout_snapshot_version is null
     and checkout_snapshot_hash is null;

  if not found then
    raise exception 'Could not attach the immutable checkout snapshot.';
  end if;

  select to_jsonb(o) into v_order_json
    from public.orders o
   where o.id = v_order.id;

  return v_order_json;
end
$$;

revoke all on function public.create_order_with_snapshot(
  uuid, jsonb, text, text, jsonb, numeric, text, numeric, jsonb, numeric, text, jsonb
) from public, anon, authenticated;

grant execute on function public.create_order_with_snapshot(
  uuid, jsonb, text, text, jsonb, numeric, text, numeric, jsonb, numeric, text, jsonb
) to service_role;

comment on function public.create_order_with_snapshot(
  uuid, jsonb, text, text, jsonb, numeric, text, numeric, jsonb, numeric, text, jsonb
) is
  'Service-only atomic order creation wrapper that persists an immutable quote snapshot and hash. Must be called by the compatible checkout Edge Function.';

commit;
