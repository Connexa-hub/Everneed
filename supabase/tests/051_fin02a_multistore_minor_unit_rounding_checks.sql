-- FIN-02A cross-store allocation and deterministic minor-unit rounding regression.
begin;
do $$
declare
  v_input jsonb;
  v_a jsonb;
  v_b jsonb;
  v_store jsonb;
  v_total_discount bigint;
  v_total_seller bigint;
  v_total_platform bigint;
  v_total_commission bigint;
  v_total_payable bigint;
begin
  v_input := jsonb_build_array(
    jsonb_build_object('order_item_id','item-a','store_id','store-a','gross_minor',33,'commission_rate',10,'seller_funding_bps',3333,'platform_funding_bps',6667),
    jsonb_build_object('order_item_id','item-b','store_id','store-a','gross_minor',34,'commission_rate',10,'seller_funding_bps',3333,'platform_funding_bps',6667),
    jsonb_build_object('order_item_id','item-c','store_id','store-b','gross_minor',34,'commission_rate',7,'seller_funding_bps',10000,'platform_funding_bps',0)
  );
  v_a:=private.allocate_order_financial_items_v2(v_input,84);
  v_b:=private.allocate_order_financial_items_v2(jsonb_build_array(v_input->2,v_input->0,v_input->1),84);
  if v_a<>v_b then raise exception 'Allocation output is not invariant to input JSON array order.'; end if;
  v_total_discount:=(v_a->>'discount_minor')::bigint;
  v_total_seller:=(v_a->>'seller_funded_discount_minor')::bigint;
  v_total_platform:=(v_a->>'platform_funded_discount_minor')::bigint;
  v_total_commission:=(v_a->>'commission_minor')::bigint;
  v_total_payable:=(v_a->>'seller_payable_minor')::bigint;
  if v_total_discount<>17 or v_total_seller+v_total_platform<>17 then
    raise exception 'Discount or funding split failed exact reconciliation.';
  end if;
  if (v_a->>'gross_merchandise_minor')::bigint<>101
     or (v_a->>'net_merchandise_minor')::bigint<>84
     or v_total_payable+v_total_commission<>101-v_total_seller then
    raise exception 'Buyer net, gross, commission and seller payable do not reconcile.';
  end if;
  select jsonb_build_object(
    'gross_minor',sum((e->>'gross_minor')::bigint),
    'seller_discount_minor',sum((e->>'seller_discount_minor')::bigint),
    'platform_discount_minor',sum((e->>'platform_discount_minor')::bigint),
    'commission_minor',sum((e->>'commission_minor')::bigint),
    'seller_payable_minor',sum((e->>'seller_payable_minor')::bigint)
  ) into v_store
  from jsonb_array_elements(v_a->'items') e
  where e->>'store_id'='store-a';
  if (v_store->>'gross_minor')::bigint<>67
     or (v_store->>'seller_discount_minor')::bigint+(v_store->>'platform_discount_minor')::bigint
        <> (select sum((e->>'discount_minor')::bigint) from jsonb_array_elements(v_a->'items') e where e->>'store_id'='store-a') then
    raise exception 'Store A aggregate does not reconcile to its item allocations.';
  end if;
  if (select count(*) from jsonb_array_elements(v_a->'items') e where e->>'store_id'='store-b' and (e->>'seller_discount_minor')::bigint<>(e->>'discount_minor')::bigint)<>1 then
    raise exception 'Store B 100%% seller funding consent was not honored.';
  end if;
  if (select sum((e->>'discount_minor')::bigint) from jsonb_array_elements(v_a->'items') e)<>17 then
    raise exception 'Per-item discount allocation failed to conserve the exact total.';
  end if;
end
$$;
rollback;
