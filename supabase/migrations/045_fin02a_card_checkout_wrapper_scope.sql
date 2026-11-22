-- FIN-02A: ensure the v2 atomic wrapper is restricted to card checkout.
begin;
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
  if p_pm is distinct from 'card' then
    raise exception 'Financial snapshot v2 integration is currently enabled for card checkout only.';
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
  select to_jsonb(o) into v_order from public.orders o where id=v_order_id;
  return v_order || jsonb_build_object('financial_snapshot_v2',v_snapshot);
end
$$;
commit;
