-- FIN-02A deterministic integer allocation contract.
-- Pure-function tests only; no order, promotion, journal or payment rows are created.

begin;

do $$
declare
  v_result jsonb;
  v_reordered jsonb;
  v_items jsonb := jsonb_build_array(
    jsonb_build_object('order_item_id','item-a','store_id','store-a','gross_minor',10001,'commission_rate',10,'seller_funding_bps',10000,'platform_funding_bps',0),
    jsonb_build_object('order_item_id','item-b','store_id','store-b','gross_minor',10000,'commission_rate',10,'seller_funding_bps',5000,'platform_funding_bps',5000),
    jsonb_build_object('order_item_id','item-c','store_id','store-c','gross_minor',10000,'commission_rate',10,'seller_funding_bps',0,'platform_funding_bps',10000)
  );
  v_failed boolean;
begin
  v_result := private.allocate_order_financial_items_v2(v_items, 27000);

  if v_result->>'schema_version' <> '2'
     or v_result->>'gross_merchandise_minor' <> '30001'
     or v_result->>'net_merchandise_minor' <> '27000'
     or v_result->>'discount_minor' <> '3001'
     or v_result->>'seller_funded_discount_minor' <> '1500'
     or v_result->>'platform_funded_discount_minor' <> '1501'
     or v_result->>'commission_minor' <> '2850'
     or v_result->>'seller_payable_minor' <> '25651' then
    raise exception 'FIN-02A allocation totals are incorrect: %', v_result;
  end if;

  if v_result->'items'->0->>'discount_minor' <> '1000'
     or v_result->'items'->1->>'discount_minor' <> '1000'
     or v_result->'items'->2->>'discount_minor' <> '1001' then
    raise exception 'Proportional allocation or deterministic residual is incorrect: %', v_result->'items';
  end if;

  if v_result->'items'->0->>'seller_payable_minor' <> '8101'
     or v_result->'items'->1->>'seller_payable_minor' <> '8550'
     or v_result->'items'->2->>'seller_payable_minor' <> '9000' then
    raise exception 'Seller payable calculation is incorrect: %', v_result->'items';
  end if;

  if (v_result->>'seller_payable_minor')::numeric
       + (v_result->>'commission_minor')::numeric
       <> (v_result->>'net_merchandise_minor')::numeric
          + (v_result->>'platform_funded_discount_minor')::numeric then
    raise exception 'Buyer consideration plus platform subsidy does not reconcile to seller payable plus commission.';
  end if;

  v_reordered := private.allocate_order_financial_items_v2(
    jsonb_build_array(v_items->2, v_items->0, v_items->1), 27000
  );
  if v_reordered->'items' is distinct from v_result->'items' then
    raise exception 'Allocation depends on caller-supplied array order.';
  end if;

  v_failed := false;
  begin
    perform private.allocate_order_financial_items_v2(v_items, 30002);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Net amount greater than gross was accepted.'; end if;

  v_failed := false;
  begin
    perform private.allocate_order_financial_items_v2(
      jsonb_build_array(jsonb_build_object(
        'order_item_id','bad','store_id','store-a','gross_minor',100,
        'commission_rate',10,'seller_funding_bps',6000,'platform_funding_bps',3000
      )), 100
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Funding split not equal to 10000 bps was accepted.'; end if;

  v_failed := false;
  begin
    perform private.allocate_order_financial_items_v2(
      jsonb_build_array(jsonb_build_object(
        'order_item_id','bad','store_id','store-a','gross_minor',100,
        'commission_rate',101,'seller_funding_bps',10000,'platform_funding_bps',0
      )), 100
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Commission rate above 100 percent was accepted.'; end if;

  v_failed := false;
  begin
    perform private.allocate_order_financial_items_v2(
      jsonb_build_array(jsonb_build_object(
        'order_item_id','bad','store_id','store-a','gross_minor',100,
        'commission_rate',10,'seller_funding_bps',10000,'platform_funding_bps',0,
        'unexpected','field'
      )), 100
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Unexpected allocation input field was accepted.'; end if;

  if has_function_privilege('anon',
       'private.allocate_order_financial_items_v2(jsonb,bigint)','EXECUTE')
     or has_function_privilege('authenticated',
       'private.allocate_order_financial_items_v2(jsonb,bigint)','EXECUTE')
     or has_function_privilege('service_role',
       'private.allocate_order_financial_items_v2(jsonb,bigint)','EXECUTE') then
    raise exception 'Internal allocation helper is executable by API roles.';
  end if;
end
$$;

rollback;
