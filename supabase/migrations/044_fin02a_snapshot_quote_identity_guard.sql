-- FIN-02A: validate snapshot v2 quote identity and frozen campaign references.
begin;

create or replace function private.guard_snapshot_v2_store_totals()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_amounts jsonb:=new.payload->'amounts';
  v_order public.orders%rowtype;
  v_gross numeric;
  v_net numeric;
  v_discount numeric;
  v_delivery numeric;
  v_total numeric;
begin
  perform private.validate_snapshot_v2_store_totals(new.payload->'items',new.payload->'store_allocations');
  select * into strict v_order from public.orders where id=new.order_id;
  v_gross:=(v_amounts->>'gross_merchandise_minor')::numeric;
  v_net:=(v_amounts->>'net_merchandise_minor')::numeric;
  v_discount:=(v_amounts->>'discount_minor')::numeric;
  v_delivery:=(v_amounts->>'delivery_fee_minor')::numeric;
  v_total:=(v_amounts->>'total_minor')::numeric;
  if new.payload->>'order_id' is distinct from new.order_id
     or new.payload->>'offer_id' is distinct from v_order.financial_offer_id
     or upper(new.currency) is distinct from upper(v_order.currency)
     or new.currency_exponent is distinct from (v_order.checkout_snapshot->>'currency_exponent')::smallint
     or v_order.checkout_snapshot_version<>1
     or v_gross is null or v_net is null or v_discount is null or v_delivery is null or v_total is null
     or v_gross-v_net<>v_discount or v_net+v_delivery<>v_total
     or v_total<>round(v_order.total*100)::numeric
     or v_delivery<>round(v_order.delivery_fee*100)::numeric
     or v_discount<>round(coalesce(v_order.discount,0)*100)::numeric
     or v_gross<>(v_order.checkout_snapshot->'amounts'->>'gross_merchandise_minor')::numeric
     or v_net<>(v_order.checkout_snapshot->'amounts'->>'net_merchandise_minor')::numeric then
    raise exception 'Snapshot v2 does not agree with immutable checkout quote identity or totals.';
  end if;
  if new.payload->'budget_reservation_ids' is distinct from to_jsonb(new.budget_reservation_ids) then
    raise exception 'Snapshot campaign reservation references do not match persisted reservation IDs.';
  end if;
  return new;
end
$$;

comment on function private.guard_snapshot_v2_store_totals() is
  'FIN-02A insert guard: validates item/store reconciliation plus parent order, v1 quote, offer identity, amount and reservation references.';
commit;
