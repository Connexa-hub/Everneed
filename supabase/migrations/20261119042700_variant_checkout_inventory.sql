-- Variant-aware checkout, immutable order snapshots and one-time inventory restoration.
-- Draft implementation: review and apply to staging only after SQL tests and CI pass.
begin;

alter table public.order_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists variant_sku text,
  add column if not exists variant_options jsonb not null default '{}'::jsonb check(jsonb_typeof(variant_options)='object'),
  add column if not exists inventory_reserved boolean not null default false,
  add column if not exists inventory_restored boolean not null default false;
create index if not exists order_items_variant_id_idx on public.order_items(variant_id) where variant_id is not null;

create or replace function private.restore_variant_order_item(p_item text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare i public.order_items; n integer;
begin
  select * into i from public.order_items where id=p_item for update;
  if not found or i.variant_id is null or not i.inventory_reserved or i.inventory_restored then return false; end if;
  perform set_config('everneed.inventory_reason','cancellation_restoration',true);
  perform set_config('everneed.inventory_reference',coalesce(i.seller_order_id,i.order_id),true);
  update public.product_variants set stock=coalesce(stock,0)+i.qty where id=i.variant_id;
  get diagnostics n=row_count;
  if n=0 then raise exception 'Reserved variant inventory cannot be restored: variant missing for order item %.',p_item; end if;
  update public.order_items set inventory_restored=true where id=p_item and inventory_reserved and not inventory_restored;
  return found;
end $$;
revoke execute on function private.restore_variant_order_item(text) from public,anon,authenticated;

create or replace function public.create_order(p_user uuid, p_items jsonb, p_country text, p_pm text, p_cust jsonb, p_k numeric, p_cur text,
  p_discount_base numeric, p_offer jsonb, p_fee numeric, p_card_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  it jsonb; p record; n int; sizes_ok boolean; v public.product_variants%rowtype; active_variant_count integer;
  base_price numeric; variant_id_ uuid; variant_sku_ text; variant_options_ jsonb; variant_reserved_ boolean;
  oid text := gen_random_uuid()::text; status_ text; route_ text; reason_ text;
  stores_n int; only_store text; sub_base numeric := 0; disc numeric; total_ numeric; dg int := case when p_cur in ('NGN', 'KES') then 0 else 2 end;
  lines jsonb := '[]'::jsonb; ord jsonb; so record; rate numeric; cat_rate jsonb; plan_disc numeric; zones jsonb; has_outside boolean := false;
  line_base numeric; item_id text; code text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Your cart is empty or too large.'; end if;
  if coalesce(p_k, 0) <= 0 or p_fee < 0 or p_discount_base < 0 then raise exception 'Invalid pricing.'; end if;
  status_ := case p_pm when 'card' then 'awaiting_payment' when 'bank' then 'awaiting_transfer' when 'whatsapp' then 'sent' when 'card_later' then 'awaiting_delivery' end;
  if status_ is null then raise exception 'Choose a payment method.'; end if;

  -- validate and reserve stock atomically (one UPDATE per line; the row lock serialises racing buyers)
  create temp table if not exists _co(product_id text, store_id text, name text, size text, qty int, base numeric, col text, official boolean, variant_id uuid, variant_sku text, variant_options jsonb, inventory_reserved boolean) on commit drop;
  delete from _co;
  for it in select * from jsonb_array_elements(p_items) loop
    if (it->>'qty') !~ '^[0-9]+$' or (it->>'qty')::int not between 1 and 50 then raise exception 'Invalid quantity.'; end if;
    select pr.*, s.is_official into p from public.products pr join public.stores s on s.id = pr.store_id where pr.id = it->>'id';
    if not found or p.status <> 'published' or not private.store_live(p.store_id) then raise exception 'A product in your cart is no longer available.'; end if;
    if cardinality(p.cty) > 0 and not (p_country = any (p.cty)) then raise exception '% is not sold in your country.', p.name; end if;
    if (it->>'qty')::int < p.min_order_qty or (p.max_order_qty is not null and (it->>'qty')::int > p.max_order_qty) then
      raise exception 'Quantity for % must be between % and %.', p.name, p.min_order_qty, coalesce(p.max_order_qty,50);
    end if;
    item_id := p.id; variant_id_ := null; variant_sku_ := null; variant_options_ := '{}'::jsonb; variant_reserved_ := false; base_price := p.price;
    select count(*) into active_variant_count from public.product_variants pv where pv.product_id=p.id and pv.active;
    if nullif(it->>'variant_id','') is not null then
      begin variant_id_ := (it->>'variant_id')::uuid; exception when invalid_text_representation then raise exception 'Invalid product variant selection.'; end;
      select * into v from public.product_variants pv where pv.id=variant_id_ and pv.product_id=p.id and pv.store_id=p.store_id and pv.active for update;
      if not found then raise exception 'The selected product option is no longer available.'; end if;
      base_price := case when v.sale_price is not null and (v.sale_starts_at is null or v.sale_starts_at<=now()) and (v.sale_ends_at is null or v.sale_ends_at>now()) then v.sale_price else v.price end;
      variant_sku_ := v.sku; variant_options_ := v.option_values;
      if v.track_stock and v.stock is not null then
        perform set_config('everneed.inventory_reason','checkout_reservation',true);
        perform set_config('everneed.inventory_reference',oid,true);
        update public.product_variants pv set stock=pv.stock-(it->>'qty')::int
          where pv.id=variant_id_ and (pv.stock >= (it->>'qty')::int or pv.allow_backorder);
        get diagnostics n=row_count;
        if n=0 then raise exception 'Not enough stock for % (%).',p.name,coalesce(v.sku,'selected option'); end if;
        variant_reserved_ := true;
      end if;
    elsif active_variant_count>0 then
      raise exception 'Choose an option for % before checkout.',p.name;
    elsif nullif(it->>'size','') is not null and p.stocks ? (it->>'size') then
      update public.products set stocks=jsonb_set(stocks,array[it->>'size'],to_jsonb((stocks->>(it->>'size'))::int-(it->>'qty')::int))
        where id=p.id and (stocks->>(it->>'size'))::int >= (it->>'qty')::int;
      get diagnostics n=row_count; if n=0 then raise exception 'Not enough % (%) left.',p.name,it->>'size'; end if;
    elsif p.stock is not null and p.track_stock then
      update public.products set stock=stock-(it->>'qty')::int where id=p.id and stock >= (it->>'qty')::int;
      get diagnostics n=row_count; if n=0 then raise exception 'Not enough % left.',p.name; end if;
    end if;
    insert into _co(product_id,store_id,name,size,qty,base,col,official,variant_id,variant_sku,variant_options,inventory_reserved)
      values(p.id,p.store_id,p.name,nullif(it->>'size',''),(it->>'qty')::int,base_price*(it->>'qty')::int,p.col,p.is_official,variant_id_,variant_sku_,variant_options_,variant_reserved_);
    sub_base := sub_base + base_price*(it->>'qty')::int;
  end loop;

  if p_pm in ('whatsapp', 'card_later') and exists (select 1 from _co where not official) then
    raise exception 'That payment method is not available for orders with seller products. Pay by card or bank transfer.';
  end if;

  -- route (A3): direct only for one eligible seller, otherwise hub
  select count(distinct store_id), min(store_id) into stores_n, only_store from _co;
  if stores_n > 1 then route_ := 'hub'; reason_ := 'Items from several sellers are checked and delivered together by EverNeed.';
  elsif not private.polb('direct_enabled', true) then route_ := 'hub'; reason_ := 'Direct delivery is switched off.';
  else
    select sp.delivery_zones into zones from public.store_private sp where sp.store_id = only_store and sp.direct_delivery_enabled;
    if zones is not null and exists (select 1 from jsonb_array_elements_text(zones) z
         where lower(z) in (lower(coalesce(p_cust->>'state', '')), lower(coalesce(p_cust->>'city', '')))) then
      route_ := 'direct'; reason_ := 'The seller delivers to your area.';
    else route_ := 'hub'; reason_ := 'The seller does not deliver directly to your area.'; end if;
  end if;

  disc := least(p_discount_base, sub_base);
  total_ := round((sub_base - disc) * p_k + p_fee, 2);
  if p_offer is not null and p_offer->>'id' is not null then
    if not public.redeem_offer(p_offer->>'id') then raise exception 'That discount code has just been used up.'; end if;
  end if;

  select jsonb_agg(jsonb_build_object('id',product_id,'name',name,'size',coalesce(size,''),'price',round(base/qty*p_k,dg),'qty',qty,
           'variant_id',variant_id,'variant_sku',coalesce(variant_sku,''),'variant_options',variant_options)) into lines from _co;
  insert into public.orders(id, user_id, items, total, country, pm, cust, status, payment_status, at, currency, card_id, coupon, discount, offer, route, route_reason, delivery_fee)
  values (oid, p_user, lines, total_, p_country, p_pm, p_cust, status_, status_, (extract(epoch from now()) * 1000)::bigint, p_cur, p_card_id,
          nullif(p_offer->>'code', ''), round(disc * p_k, 2),
          case when p_offer is null then null else jsonb_build_object('name', p_offer->>'name', 'kind', p_offer->>'kind', 'value', p_offer->'value') end,
          route_, reason_, p_fee);
  code := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 10000)::text, 4, '0');
  insert into public.order_secrets(order_id, delivery_code) values (oid, code);

  for so in select store_id, sum(base) base from _co group by store_id loop
    insert into public.seller_orders(order_id, store_id, subtotal, accept_by) values (oid, so.store_id, so.base, now() + make_interval(hours => private.pol('accept_hours', 24)::int));
  end loop;
  for it in select to_jsonb(c) from _co c loop
    select s.id into so from public.seller_orders s where s.order_id = oid and s.store_id = it->>'store_id';
    select sp.commission_override into rate from public.store_private sp where sp.store_id = it->>'store_id';
    if (select is_official from public.stores where id = it->>'store_id') then rate := 0;
    else
      select data->'category_commission' into cat_rate from public.settings where id = 'policy';
      rate := coalesce(rate, nullif(cat_rate->>(it->>'col'), '')::numeric, private.pol('commission_pct', 10));
      select coalesce(max(pl.commission_discount), 0) into plan_disc from public.store_subscriptions ss join public.store_plans pl on pl.id = ss.plan_id where ss.store_id = it->>'store_id';
      rate := greatest(rate - plan_disc, 0);
    end if;
    line_base := (it->>'base')::numeric;
    with ins as (
      insert into public.order_items(order_id,seller_order_id,product_id,store_id,name,size,unit_price,qty,line_total,variant_id,variant_sku,variant_options,inventory_reserved)
      values(oid,(select id from public.seller_orders where order_id=oid and store_id=it->>'store_id'),it->>'product_id',it->>'store_id',it->>'name',nullif(it->>'size',''),
              round(line_base/(it->>'qty')::int*p_k,dg),(it->>'qty')::int,round(line_base*p_k,2),nullif(it->>'variant_id','')::uuid,nullif(it->>'variant_sku',''),coalesce(it->'variant_options','{}'::jsonb),coalesce((it->>'inventory_reserved')::boolean,false))
      returning id)
    insert into public.order_item_fees(order_item_id, commission_rate, commission_amount) select id, rate, round(line_base * rate / 100, 2) from ins;
  end loop;
  update public.seller_orders s set commission = f.c, earning = s.subtotal - f.c
    from (select i.seller_order_id, sum(fe.commission_amount) c from public.order_items i join public.order_item_fees fe on fe.order_item_id = i.id where i.order_id = oid group by 1) f
   where s.id = f.seller_order_id;

  select to_jsonb(o) into ord from public.orders o where o.id = oid;
  return ord;
end $$;

-- confirm_payment: idempotent. Only now do merchants see the order and the ledger get its entries. -----------
create or replace function private.confirm_payment_core(p_order text, p_reference text, p_actor uuid) returns text language plpgsql as $$
declare o record; so record; owner uuid;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.payment_status = 'paid' then return 'already'; end if;
  if o.status = 'cancelled' then raise exception 'This order was cancelled.'; end if;
  perform set_config('app.order_bypass', '1', true);
  update public.orders set status = case when o.status in ('shipped', 'out_for_delivery', 'delivered') then o.status else 'paid' end,
         payment_status = 'paid', paid_at = (extract(epoch from now()) * 1000)::bigint, ref = coalesce(p_reference, ref) where id = p_order;
  for so in select s.*, st.owner_id, st.is_official from public.seller_orders s join public.stores st on st.id = s.store_id where s.order_id = p_order and s.status not in ('cancelled', 'rejected') loop
    update public.seller_orders set released = true, accept_by = now() + make_interval(hours => private.pol('accept_hours', 24)::int) where id = so.id;
    insert into public.ledger_entries(store_id, order_id, seller_order_id, kind, amount, note) values (so.store_id, p_order, so.id, 'sale', so.subtotal, 'Sale') on conflict do nothing;
    insert into public.ledger_entries(store_id, order_id, seller_order_id, kind, amount, note) values (so.store_id, p_order, so.id, 'commission', -so.commission, 'Commission') on conflict do nothing;
    if so.owner_id is not null then perform private.notify(so.owner_id, 'new_order', 'New order to accept', 'Accept it within ' || private.pol('accept_hours', 24)::int || ' hours.', jsonb_build_object('seller_order_id', so.id));
    else perform private.notify_admins('new_order', 'New EverNeed store order', null, jsonb_build_object('order_id', p_order)); end if;
  end loop;
  perform private.notify(o.user_id, 'payment_confirmed', 'Payment received', 'We have your payment and the sellers have been told.', jsonb_build_object('order_id', p_order));
  perform private.audit(p_actor, 'confirm_payment', 'order', p_order, jsonb_build_object('status', o.status), jsonb_build_object('reference', p_reference));
  perform private.sync_order(p_order);
  return 'paid';
end $$;
create or replace function public.confirm_payment(p_order text, p_reference text default null, p_actor uuid default null) returns text
language sql security definer set search_path = public as $$ select private.confirm_payment_core(p_order, p_reference, p_actor) $$;
create or replace function public.admin_confirm_payment(p_order text) returns text language plpgsql security definer set search_path = public as $$
begin perform private.need_admin(); perform private.throttle('admin_confirm', 60, 60); return private.confirm_payment_core(p_order, null, auth.uid()); end $$;

-- customer reports a bank transfer (replaces the 002 version; now also updates payment_status)
create or replace function public.report_payment(order_id text, reference text default '', note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('report_payment', 10, 60);
  update public.orders set status = 'payment_reported', payment_status = 'payment_reported',
         ref = coalesce(nullif(left(trim(reference), 80), ''), ref), payment_note = nullif(left(trim(note), 300), '')
   where id = order_id and user_id = auth.uid() and status = 'awaiting_transfer';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'This order cannot be reported as paid.'; end if;
  perform private.notify_admins('payment_reported', 'A customer reported a bank transfer', null, jsonb_build_object('order_id', order_id));
  return jsonb_build_object('status', 'payment_reported');
end $$;

-- cancellation and refunds ------------------------------------------------------------------------------------
create or replace function private.cancel_so(p_so text, p_reason text, p_actor uuid, p_to text) returns void language plpgsql as $$
declare so record; o record; it record; paid_share numeric; all_lines numeric; mine numeric; owner uuid;
begin
  select * into so from public.seller_orders where id = p_so for update;
  if not found or so.status in ('delivered', 'cancelled', 'rejected') then return; end if;
  select * into o from public.orders where id = so.order_id;
  perform set_config('app.order_bypass', '1', true);
  update public.seller_orders set status = p_to, rejected_reason = p_reason where id = p_so;
  for it in select product_id, size, qty from public.order_items where seller_order_id = p_so loop
    perform private.stock_add(it.product_id, it.size, it.qty);
  end loop;
  if o.payment_status in ('paid', 'partially_refunded') and so.released then
    select coalesce(sum(line_total), 0) into mine from public.order_items where seller_order_id = p_so;
    select coalesce(sum(line_total), 0) into all_lines from public.order_items where order_id = o.id;
    paid_share := case when all_lines > 0 then round(mine / all_lines * (o.total - o.delivery_fee), 2) else 0 end;
    if paid_share > 0 then
      insert into public.refunds(order_id, seller_order_id, opened_by, reason, amount, status, resolution)
      values (o.id, p_so, p_actor, p_reason, paid_share, 'approved', 'Automatic refund: seller order ' || p_to);
    end if;
    update public.ledger_entries set status = 'reversed' where seller_order_id = p_so and kind in ('sale', 'commission') and status in ('pending', 'available');
    update public.orders set payment_status = case when (select count(*) from public.seller_orders x where x.order_id = o.id and x.status not in ('cancelled', 'rejected')) = 0 then 'refunded' else 'partially_refunded' end where id = o.id;
    perform private.notify(o.user_id, 'refund_approved', 'Part of your order was cancelled', 'A refund is on its way for the cancelled items.', jsonb_build_object('order_id', o.id));
    perform private.notify_admins('refund_due', 'Refund to process', null, jsonb_build_object('order_id', o.id, 'seller_order_id', p_so, 'amount', paid_share));
  else
    perform private.notify(o.user_id, 'order_cancelled', 'Part of your order was cancelled', p_reason, jsonb_build_object('order_id', o.id));
  end if;
  select st.owner_id into owner from public.stores st where st.id = so.store_id;
  perform private.audit(p_actor, 'seller_order_' || p_to, 'seller_order', p_so, jsonb_build_object('status', so.status), jsonb_build_object('reason', p_reason));
  perform private.sync_order(o.id);
end $$;

create or replace function private.cancel_order_core(p_order text, p_actor uuid, p_reason text, p_admin boolean) returns void language plpgsql as $$
declare o record; so record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if not p_admin then
    if o.user_id is distinct from p_actor then raise exception 'That is not your order.'; end if;
    if exists (select 1 from public.seller_orders where order_id = p_order and status not in ('pending', 'cancelled', 'rejected')) then
      raise exception 'A seller has already started this order. Contact support to cancel it.';
    end if;
  end if;
  if o.status in ('delivered', 'cancelled') then raise exception 'This order can no longer be cancelled.'; end if;
  for so in select id, status from public.seller_orders where order_id = p_order and status not in ('cancelled', 'rejected', 'delivered') loop
    if so.status in ('at_hub', 'consolidated') then
      perform set_config('app.order_bypass', '1', true); update public.seller_orders set status = 'issue' where id = so.id;
    end if;
    perform private.cancel_so(so.id, coalesce(nullif(left(p_reason, 300), ''), 'Cancelled'), p_actor, 'cancelled');
  end loop;
  perform set_config('app.order_bypass', '1', true);
  update public.orders set status = 'cancelled' where id = p_order and status <> 'cancelled';
  perform private.audit(p_actor, 'cancel_order', 'order', p_order, jsonb_build_object('status', o.status), jsonb_build_object('reason', p_reason));
end $$;
create or replace function public.cancel_order(p_order text, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('cancel_order', 10, 60);
  perform private.cancel_order_core(p_order, auth.uid(), p_reason, coalesce(public.is_admin(), false));
end $$;
create or replace function public.cancel_order_for(p_order text, p_actor uuid, p_reason text default null, p_admin boolean default false) returns void
language sql security definer set search_path = public as $$ select private.cancel_order_core(p_order, p_actor, p_reason, p_admin) $$;

create or replace function public.refund(p_order text, p_seller_order text, p_amount numeric, p_reason text) returns text
language plpgsql security definer set search_path = public as $$
declare o record; so record; share numeric; paid_total numeric; refunded numeric; rid text; n int;
begin
  perform private.need_admin(); perform private.throttle('refund', 30, 60);
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.payment_status not in ('paid', 'partially_refunded') then raise exception 'This order has no payment to refund.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a refund amount.'; end if;
  if p_seller_order is null then
    select count(*) into n from public.seller_orders where order_id = p_order and status not in ('cancelled', 'rejected');
    if n <> 1 then raise exception 'Choose which seller order to refund.'; end if;
    select id into p_seller_order from public.seller_orders where order_id = p_order and status not in ('cancelled', 'rejected');
  end if;
  select * into so from public.seller_orders where id = p_seller_order and order_id = p_order for update;
  if not found then raise exception 'Seller order not found on this order.'; end if;
  select coalesce(sum(amount), 0) into refunded from public.refunds where order_id = p_order and status in ('approved', 'processed');
  if refunded + p_amount > o.total then raise exception 'That is more than the customer paid.'; end if;
  insert into public.refunds(order_id, seller_order_id, opened_by, reason, amount, status, resolved_by, resolved_at, resolution)
    values (p_order, p_seller_order, auth.uid(), left(p_reason, 500), p_amount, 'processed', auth.uid(), now(), 'Refunded by admin') returning id into rid;
  -- Reverse the seller's share (pro rata of the order currency amount), and give back the matching commission.
  share := case when o.total > 0 then round(p_amount / o.total * so.subtotal, 2) else 0 end;
  insert into public.ledger_entries(store_id, order_id, seller_order_id, kind, amount, status, note) values (so.store_id, p_order, p_seller_order, 'refund', -share, 'available', 'Refund ' || rid);
  if so.subtotal > 0 then
    insert into public.ledger_entries(store_id, order_id, seller_order_id, kind, amount, status, note)
    values (so.store_id, p_order, p_seller_order, 'refund', round(share * so.commission / so.subtotal, 2), 'available', 'Commission returned for refund ' || rid);
  end if;
  update public.orders set payment_status = case when refunded + p_amount >= o.total then 'refunded' else 'partially_refunded' end where id = p_order;
  perform private.notify(o.user_id, 'refund_processed', 'Refund processed', null, jsonb_build_object('order_id', p_order, 'amount', p_amount));
  perform private.audit(auth.uid(), 'refund', 'order', p_order, null, jsonb_build_object('amount', p_amount, 'reason', p_reason, 'seller_order_id', p_seller_order));
  return rid;
end $$;

-- seller flow --------------------------------------------------------------------------------------------------------
create or replace function public.seller_transition(p_so text, p_to text, p_payload jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare so record; o record; st record; admin_ boolean := coalesce(public.is_admin(), false); reason text := left(coalesce(p_payload->>'reason', ''), 300);
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('seller_transition', 60, 60);
  select * into so from public.seller_orders where id = p_so for update;
  if not found then raise exception 'Order not found.'; end if;
  select * into st from public.stores where id = so.store_id;
  if not admin_ and st.owner_id is distinct from auth.uid() then raise exception 'That is not your order.'; end if;
  if not so.released then raise exception 'This order has not been paid yet.'; end if;
  if p_to in ('delivered', 'at_hub', 'consolidated') then raise exception 'That step is done by the delivery or hub team.'; end if;
  if p_to = 'issue' and not admin_ then raise exception 'Contact EverNeed to raise an issue.'; end if;
  select * into o from public.orders where id = so.order_id;
  if p_to in ('rejected', 'cancelled') then
    if p_to = 'rejected' and length(reason) < 3 then raise exception 'Tell the customer why you are rejecting the order.'; end if;
    if p_to = 'cancelled' and not admin_ and so.status <> 'pending' then raise exception 'Contact EverNeed to cancel an order you already accepted.'; end if;
    perform private.cancel_so(p_so, coalesce(nullif(reason, ''), 'Cancelled'), auth.uid(), p_to);
    return;
  end if;
  if not private.so_step_ok(so.status, p_to, o.route) then raise exception 'This order cannot move from % to %.', so.status, p_to; end if;
  update public.seller_orders set status = p_to,
    accepted_at = case when p_to = 'accepted' then now() else accepted_at end,
    ready_at = case when p_to = 'ready' then now() else ready_at end,
    handed_over_at = case when p_to = 'handover_pending' then now() else handed_over_at end where id = p_so;
  if p_to = 'out_for_delivery' then   -- direct route: the seller delivers
    perform set_config('app.order_bypass', '1', true);
    insert into public.deliveries(order_id, mode, courier_name, courier_phone, tracking_note, status, dispatched_at)
      values (so.order_id, 'direct', coalesce(nullif(left(p_payload->>'courier_name', 80), ''), st.name), left(p_payload->>'courier_phone', 30), left(p_payload->>'note', 300), 'dispatched', now())
      on conflict (order_id) do update set status = 'dispatched', dispatched_at = now(), courier_name = excluded.courier_name, courier_phone = excluded.courier_phone, tracking_note = excluded.tracking_note;
    update public.orders set status = 'out_for_delivery', auto_confirm_at = now() + make_interval(days => private.pol('auto_confirm_days', 5)::int) where id = so.order_id and status = 'ready_for_delivery';
  end if;
  if p_to = 'handover_pending' then perform private.notify_admins('handover_pending', 'A seller is bringing items to the hub', null, jsonb_build_object('seller_order_id', p_so)); end if;
  perform private.notify(o.user_id, 'order_update', 'Order update', 'A seller moved your order to ' || replace(p_to, '_', ' ') || '.', jsonb_build_object('order_id', so.order_id));
  perform private.audit(auth.uid(), 'seller_transition', 'seller_order', p_so, jsonb_build_object('status', so.status), jsonb_build_object('status', p_to));
  perform private.sync_order(so.order_id);
end $$;

create or replace function public.hub_receive(p_so text, p_check jsonb) returns void language plpgsql security definer set search_path = public as $$
declare so record; bad int; missing int;
begin
  perform private.need_admin(); perform private.throttle('hub_receive', 120, 60);
  select * into so from public.seller_orders where id = p_so for update;
  if not found or so.status <> 'handover_pending' then raise exception 'This seller order is not waiting at the hub.'; end if;
  if jsonb_typeof(p_check) <> 'array' then raise exception 'Send one check result per item.'; end if;
  select count(*) into missing from public.order_items i where i.seller_order_id = p_so and not exists (select 1 from jsonb_array_elements(p_check) c where c->>'item_id' = i.id);
  if missing > 0 then raise exception 'Every item must be checked.'; end if;
  select count(*) into bad from jsonb_array_elements(p_check) c where coalesce(c->>'status', '') not in ('received', 'missing', 'damaged') or (c->>'status') <> 'received';
  update public.seller_orders set hub_check = p_check, hub_received_at = now(), status = case when bad = 0 then 'at_hub' else 'issue' end where id = p_so;
  if bad > 0 then perform private.notify_admins('hub_issue', 'Hub check found a problem', null, jsonb_build_object('seller_order_id', p_so)); end if;
  perform private.audit(auth.uid(), 'hub_receive', 'seller_order', p_so, null, p_check);
  perform private.sync_order(so.order_id);
end $$;

create or replace function public.hub_consolidate(p_order text) returns void language plpgsql security definer set search_path = public as $$
declare o record; n int;
begin
  perform private.need_admin(); perform private.throttle('hub_consolidate', 60, 60);
  select * into o from public.orders where id = p_order for update;
  if not found or o.route <> 'hub' then raise exception 'This is not a hub order.'; end if;
  select count(*) into n from public.seller_orders where order_id = p_order and status not in ('cancelled', 'rejected') and status <> 'at_hub';
  if n > 0 or not exists (select 1 from public.seller_orders where order_id = p_order and status = 'at_hub') then raise exception 'Every seller must have dropped off and passed the check first.'; end if;
  update public.seller_orders set status = 'consolidated' where order_id = p_order and status = 'at_hub';
  insert into public.deliveries(order_id, mode, parcel_label) values (p_order, 'hub', 'EN-' || upper(substr(replace(p_order, '-', ''), 1, 6)))
    on conflict (order_id) do update set parcel_label = coalesce(public.deliveries.parcel_label, excluded.parcel_label);
  perform private.audit(auth.uid(), 'hub_consolidate', 'order', p_order, null, null);
  perform private.sync_order(p_order);
end $$;

create or replace function public.dispatch(p_order text, p_courier jsonb) returns void language plpgsql security definer set search_path = public as $$
declare o record;
begin
  perform private.need_admin(); perform private.throttle('dispatch', 60, 60);
  select * into o from public.orders where id = p_order for update;
  if not found or o.status <> 'ready_for_delivery' or o.route <> 'hub' then raise exception 'This order is not ready for hub dispatch.'; end if;
  update public.deliveries set status = 'dispatched', dispatched_at = now(), courier_name = left(p_courier->>'name', 80), courier_phone = left(p_courier->>'phone', 30), tracking_note = left(p_courier->>'note', 300)
   where order_id = p_order;
  if not found then raise exception 'Consolidate the parcel first.'; end if;
  update public.seller_orders set status = 'out_for_delivery' where order_id = p_order and status = 'consolidated';
  update public.orders set status = 'out_for_delivery', auto_confirm_at = now() + make_interval(days => private.pol('auto_confirm_days', 5)::int) where id = p_order;
  perform private.notify(o.user_id, 'out_for_delivery', 'Your order is on its way', 'Keep your delivery code ready for the courier.', jsonb_build_object('order_id', p_order));
  perform private.audit(auth.uid(), 'dispatch', 'order', p_order, null, p_courier);
end $$;

create or replace function private.deliver(p_order text, p_proof text, p_actor uuid) returns void language plpgsql as $$
declare o record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.status = 'delivered' then return; end if;
  if o.status not in ('out_for_delivery', 'shipped') then raise exception 'This order is not out for delivery.'; end if;
  perform set_config('app.order_bypass', '1', true);
  update public.seller_orders set status = 'delivered', delivered_at = now() where order_id = p_order and status not in ('cancelled', 'rejected', 'delivered');
  update public.orders set status = 'delivered', auto_confirm_at = null, received_at = coalesce(received_at, (extract(epoch from now()) * 1000)::bigint) where id = p_order;
  insert into public.deliveries(order_id, mode, status, delivered_at, proof) values (p_order, coalesce(o.route, 'hub'), 'delivered', now(), p_proof)
    on conflict (order_id) do update set status = 'delivered', delivered_at = now(), proof = p_proof;
  perform private.notify(o.user_id, 'delivered', 'Delivered', 'Your order was delivered. Tell us how it went.', jsonb_build_object('order_id', p_order));
  perform private.audit(p_actor, 'delivered', 'order', p_order, null, jsonb_build_object('proof', p_proof));
end $$;

create or replace function public.mark_delivered(p_order text, p_code text) returns void language plpgsql security definer set search_path = public as $$
declare o record; code text; ok boolean;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'Order not found.'; end if;
  ok := coalesce(public.is_admin(), false) or (o.route = 'direct' and exists (
    select 1 from public.seller_orders so join public.stores s on s.id = so.store_id where so.order_id = p_order and s.owner_id = auth.uid() and so.status not in ('cancelled', 'rejected')));
  if not ok then raise exception 'You cannot confirm delivery for this order.'; end if;
  if not public.rate_hit(auth.uid(), 'delivery_code:' || p_order, 5, 600) then raise exception 'Too many wrong codes. Try again in a few minutes.'; end if;
  select delivery_code into code from public.order_secrets where order_id = p_order;
  if code is null or code <> coalesce(trim(p_code), '') then raise exception 'That delivery code is not correct.'; end if;
  perform private.deliver(p_order, 'code_verified', auth.uid());
end $$;

create or replace function public.confirm_received(p_order text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('confirm_received', 10, 60);
  if not exists (select 1 from public.orders where id = p_order and user_id = auth.uid()) then raise exception 'That is not your order.'; end if;
  perform private.deliver(p_order, 'customer_confirmed', auth.uid());
end $$;
create or replace function public.confirm_received_for(p_order text, p_user uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.orders where id = p_order and user_id = p_user) then raise exception 'That is not your order.'; end if;
  perform private.deliver(p_order, 'customer_confirmed', p_user);
end $$;

-- what a customer sees of their order progress (no commission or seller private data)
create or replace function public.order_tracking(p_order text) returns jsonb language plpgsql security definer set search_path = public as $$
declare o record; res jsonb;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid();
  if not found then raise exception 'Order not found.'; end if;
  select jsonb_build_object('order_id', o.id, 'status', o.status, 'payment_status', o.payment_status, 'route', o.route, 'route_reason', o.route_reason,
    'sellers', coalesce((select jsonb_agg(jsonb_build_object('store', s.name, 'status', so.status, 'accepted_at', so.accepted_at, 'ready_at', so.ready_at, 'delivered_at', so.delivered_at) order by s.name)
                          from public.seller_orders so join public.stores s on s.id = so.store_id where so.order_id = o.id), '[]'::jsonb),
    'delivery', (select to_jsonb(d) - 'id' - 'order_id' from public.deliveries d where d.order_id = o.id)) into res;
  return res;
end $$;

-- merchant order list with the privacy rule from A3 applied --------------------------------------------------------------
create or replace function public.my_seller_orders(p_status text default null)
returns table(id text, order_id text, status text, route text, subtotal numeric, commission numeric, earning numeric, accept_by timestamptz, created_at timestamptz,
              customer_name text, customer_city text, customer_phone text, customer_address text, items jsonb)
language sql stable security definer set search_path = public as $$
  select so.id, so.order_id, so.status, o.route, so.subtotal, so.commission, so.earning, so.accept_by, so.created_at,
    case when o.route = 'direct' and so.status in ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered') then o.cust->>'name' else split_part(coalesce(o.cust->>'name', ''), ' ', 1) end,
    o.cust->>'city',
    case when o.route = 'direct' and so.status in ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered') then o.cust->>'phone' end,
    case when o.route = 'direct' and so.status in ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered') then concat_ws(', ', o.cust->>'street', o.cust->>'city', o.cust->>'state') end,
    (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'size', i.size, 'qty', i.qty)), '[]'::jsonb) from public.order_items i where i.seller_order_id = so.id)
  from public.seller_orders so join public.orders o on o.id = so.order_id
  where so.released and private.owns_store(so.store_id) and (p_status is null or so.status = p_status)
  order by so.created_at desc
$$;

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
      i.variant_id,
      i.variant_sku,
      i.variant_options,
      i.inventory_reserved,
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
      'variant_id', variant_id,
      'variant_sku', coalesce(variant_sku, ''),
      'variant_options', coalesce(variant_options, '{}'::jsonb),
      'inventory_reserved', inventory_reserved,
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

create or replace function private.cancel_so(p_so text, p_reason text, p_actor uuid, p_to text) returns void language plpgsql as $$
declare so record; o record; it record; paid_share numeric; all_lines numeric; mine numeric; owner uuid;
begin
  select * into so from public.seller_orders where id = p_so for update;
  if not found or so.status in ('delivered', 'cancelled', 'rejected') then return; end if;
  select * into o from public.orders where id = so.order_id;
  perform set_config('app.order_bypass', '1', true);
  update public.seller_orders set status = p_to, rejected_reason = p_reason where id = p_so;
  for it in select id,product_id,size,qty,variant_id,inventory_reserved,inventory_restored from public.order_items where seller_order_id=p_so loop
    if it.variant_id is not null then perform private.restore_variant_order_item(it.id);
    else perform private.stock_add(it.product_id,it.size,it.qty); end if;
  end loop;
  if o.payment_status in ('paid', 'partially_refunded') and so.released then
    select coalesce(sum(line_total), 0) into mine from public.order_items where seller_order_id = p_so;
    select coalesce(sum(line_total), 0) into all_lines from public.order_items where order_id = o.id;
    paid_share := case when all_lines > 0 then round(mine / all_lines * (o.total - o.delivery_fee), 2) else 0 end;
    if paid_share > 0 then
      insert into public.refunds(order_id, seller_order_id, opened_by, reason, amount, status, resolution)
      values (o.id, p_so, p_actor, p_reason, paid_share, 'approved', 'Automatic refund: seller order ' || p_to);
    end if;
    update public.ledger_entries set status = 'reversed' where seller_order_id = p_so and kind in ('sale', 'commission') and status in ('pending', 'available');
    update public.orders set payment_status = case when (select count(*) from public.seller_orders x where x.order_id = o.id and x.status not in ('cancelled', 'rejected')) = 0 then 'refunded' else 'partially_refunded' end where id = o.id;
    perform private.notify(o.user_id, 'refund_approved', 'Part of your order was cancelled', 'A refund is on its way for the cancelled items.', jsonb_build_object('order_id', o.id));
    perform private.notify_admins('refund_due', 'Refund to process', null, jsonb_build_object('order_id', o.id, 'seller_order_id', p_so, 'amount', paid_share));
  else
    perform private.notify(o.user_id, 'order_cancelled', 'Part of your order was cancelled', p_reason, jsonb_build_object('order_id', o.id));
  end if;
  select st.owner_id into owner from public.stores st where st.id = so.store_id;
  perform private.audit(p_actor, 'seller_order_' || p_to, 'seller_order', p_so, jsonb_build_object('status', so.status), jsonb_build_object('reason', p_reason));
  perform private.sync_order(o.id);
end $$;

create or replace function private.cancel_order_core(p_order text, p_actor uuid, p_reason text, p_admin boolean) returns void language plpgsql as $$
declare o record; so record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if not p_admin then
    if o.user_id is distinct from p_actor then raise exception 'That is not your order.'; end if;
    if exists (select 1 from public.seller_orders where order_id = p_order and status not in ('pending', 'cancelled', 'rejected')) then
      raise exception 'A seller has already started this order. Contact support to cancel it.';
    end if;
  end if;
  if o.status in ('delivered', 'cancelled') then raise exception 'This order can no longer be cancelled.'; end if;
  for so in select id, status from public.seller_orders where order_id = p_order and status not in ('cancelled', 'rejected', 'delivered') loop
    if so.status in ('at_hub', 'consolidated') then
      perform set_config('app.order_bypass', '1', true); update public.seller_orders set status = 'issue' where id = so.id;
    end if;
    perform private.cancel_so(so.id, coalesce(nullif(left(p_reason, 300), ''), 'Cancelled'), p_actor, 'cancelled');
  end loop;
  perform set_config('app.order_bypass', '1', true);
  update public.orders set status = 'cancelled' where id = p_order and status <> 'cancelled';
  perform private.audit(p_actor, 'cancel_order', 'order', p_order, jsonb_build_object('status', o.status), jsonb_build_object('reason', p_reason));
end $$;
create or replace function public.cancel_order(p_order text, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('cancel_order', 10, 60);
  perform private.cancel_order_core(p_order, auth.uid(), p_reason, coalesce(public.is_admin(), false));
end $$;
create or replace function public.cancel_order_for(p_order text, p_actor uuid, p_reason text default null, p_admin boolean default false) returns void
language sql security definer set search_path = public as $$ select private.cancel_order_core(p_order, p_actor, p_reason, p_admin) $$;

create or replace function public.refund(p_order text, p_seller_order text, p_amount numeric, p_reason text) returns text
language plpgsql security definer set search_path = public as $$
declare o record; so record; share numeric; paid_total numeric; refunded numeric; rid text; n int;
begin
  perform private.need_admin(); perform private.throttle('refund', 30, 60);
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.payment_status not in ('paid', 'partially_refunded') then raise exception 'This order has no payment to refund.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a refund amount.'; end if;
  if p_seller_order is null then
    select count(*) into n from public.seller_orders where order_id = p_order and status not in ('cancelled', 'rejected');
    if n <> 1 then raise exception 'Choose which seller order to refund.'; end if;
    select id into p_seller_order from public.seller_orders where order_id = p_order and status not in ('cancelled', 'rejected');
  end if;
  select * into so from public.seller_orders where id = p_seller_order and order_id = p_order for update;
  if not found then raise exception 'Seller order not found on this order.'; end if;
  select coalesce(sum(amount), 0) into refunded from public.refunds where order_id = p_order and status in ('approved', 'processed');
  if refunded + p_amount > o.total then raise exception 'That is more than the customer paid.'; end if;
  insert into public.refunds(order_id, seller_order_id, opened_by, reason, amount, status, resolved_by, resolved_at, resolution)
    values (p_order, p_seller_order, auth.uid(), left(p_reason, 500), p_amount, 'processed', auth.uid(), now(), 'Refunded by admin') returning id into rid;
  -- Reverse the seller's share (pro rata of the order currency amount), and give back the matching commission.
  share := case when o.total > 0 then round(p_amount / o.total * so.subtotal, 2) else 0 end;
  insert into public.ledger_entries(store_id, order_id, seller_order_id, kind, amount, status, note) values (so.store_id, p_order, p_seller_order, 'refund', -share, 'available', 'Refund ' || rid);
  if so.subtotal > 0 then
    insert into public.ledger_entries(store_id, order_id, seller_order_id, kind, amount, status, note)
    values (so.store_id, p_order, p_seller_order, 'refund', round(share * so.commission / so.subtotal, 2), 'available', 'Commission returned for refund ' || rid);
  end if;
  update public.orders set payment_status = case when refunded + p_amount >= o.total then 'refunded' else 'partially_refunded' end where id = p_order;
  perform private.notify(o.user_id, 'refund_processed', 'Refund processed', null, jsonb_build_object('order_id', p_order, 'amount', p_amount));
  perform private.audit(auth.uid(), 'refund', 'order', p_order, null, jsonb_build_object('amount', p_amount, 'reason', p_reason, 'seller_order_id', p_seller_order));
  return rid;
end $$;

-- seller flow --------------------------------------------------------------------------------------------------------
create or replace function public.seller_transition(p_so text, p_to text, p_payload jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare so record; o record; st record; admin_ boolean := coalesce(public.is_admin(), false); reason text := left(coalesce(p_payload->>'reason', ''), 300);
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('seller_transition', 60, 60);
  select * into so from public.seller_orders where id = p_so for update;
  if not found then raise exception 'Order not found.'; end if;
  select * into st from public.stores where id = so.store_id;
  if not admin_ and st.owner_id is distinct from auth.uid() then raise exception 'That is not your order.'; end if;
  if not so.released then raise exception 'This order has not been paid yet.'; end if;
  if p_to in ('delivered', 'at_hub', 'consolidated') then raise exception 'That step is done by the delivery or hub team.'; end if;
  if p_to = 'issue' and not admin_ then raise exception 'Contact EverNeed to raise an issue.'; end if;
  select * into o from public.orders where id = so.order_id;
  if p_to in ('rejected', 'cancelled') then
    if p_to = 'rejected' and length(reason) < 3 then raise exception 'Tell the customer why you are rejecting the order.'; end if;
    if p_to = 'cancelled' and not admin_ and so.status <> 'pending' then raise exception 'Contact EverNeed to cancel an order you already accepted.'; end if;
    perform private.cancel_so(p_so, coalesce(nullif(reason, ''), 'Cancelled'), auth.uid(), p_to);
    return;
  end if;
  if not private.so_step_ok(so.status, p_to, o.route) then raise exception 'This order cannot move from % to %.', so.status, p_to; end if;
  update public.seller_orders set status = p_to,
    accepted_at = case when p_to = 'accepted' then now() else accepted_at end,
    ready_at = case when p_to = 'ready' then now() else ready_at end,
    handed_over_at = case when p_to = 'handover_pending' then now() else handed_over_at end where id = p_so;
  if p_to = 'out_for_delivery' then   -- direct route: the seller delivers
    perform set_config('app.order_bypass', '1', true);
    insert into public.deliveries(order_id, mode, courier_name, courier_phone, tracking_note, status, dispatched_at)
      values (so.order_id, 'direct', coalesce(nullif(left(p_payload->>'courier_name', 80), ''), st.name), left(p_payload->>'courier_phone', 30), left(p_payload->>'note', 300), 'dispatched', now())
      on conflict (order_id) do update set status = 'dispatched', dispatched_at = now(), courier_name = excluded.courier_name, courier_phone = excluded.courier_phone, tracking_note = excluded.tracking_note;
    update public.orders set status = 'out_for_delivery', auto_confirm_at = now() + make_interval(days => private.pol('auto_confirm_days', 5)::int) where id = so.order_id and status = 'ready_for_delivery';
  end if;
  if p_to = 'handover_pending' then perform private.notify_admins('handover_pending', 'A seller is bringing items to the hub', null, jsonb_build_object('seller_order_id', p_so)); end if;
  perform private.notify(o.user_id, 'order_update', 'Order update', 'A seller moved your order to ' || replace(p_to, '_', ' ') || '.', jsonb_build_object('order_id', so.order_id));
  perform private.audit(auth.uid(), 'seller_transition', 'seller_order', p_so, jsonb_build_object('status', so.status), jsonb_build_object('status', p_to));
  perform private.sync_order(so.order_id);
end $$;

create or replace function public.hub_receive(p_so text, p_check jsonb) returns void language plpgsql security definer set search_path = public as $$
declare so record; bad int; missing int;
begin
  perform private.need_admin(); perform private.throttle('hub_receive', 120, 60);
  select * into so from public.seller_orders where id = p_so for update;
  if not found or so.status <> 'handover_pending' then raise exception 'This seller order is not waiting at the hub.'; end if;
  if jsonb_typeof(p_check) <> 'array' then raise exception 'Send one check result per item.'; end if;
  select count(*) into missing from public.order_items i where i.seller_order_id = p_so and not exists (select 1 from jsonb_array_elements(p_check) c where c->>'item_id' = i.id);
  if missing > 0 then raise exception 'Every item must be checked.'; end if;
  select count(*) into bad from jsonb_array_elements(p_check) c where coalesce(c->>'status', '') not in ('received', 'missing', 'damaged') or (c->>'status') <> 'received';
  update public.seller_orders set hub_check = p_check, hub_received_at = now(), status = case when bad = 0 then 'at_hub' else 'issue' end where id = p_so;
  if bad > 0 then perform private.notify_admins('hub_issue', 'Hub check found a problem', null, jsonb_build_object('seller_order_id', p_so)); end if;
  perform private.audit(auth.uid(), 'hub_receive', 'seller_order', p_so, null, p_check);
  perform private.sync_order(so.order_id);
end $$;

create or replace function public.hub_consolidate(p_order text) returns void language plpgsql security definer set search_path = public as $$
declare o record; n int;
begin
  perform private.need_admin(); perform private.throttle('hub_consolidate', 60, 60);
  select * into o from public.orders where id = p_order for update;
  if not found or o.route <> 'hub' then raise exception 'This is not a hub order.'; end if;
  select count(*) into n from public.seller_orders where order_id = p_order and status not in ('cancelled', 'rejected') and status <> 'at_hub';
  if n > 0 or not exists (select 1 from public.seller_orders where order_id = p_order and status = 'at_hub') then raise exception 'Every seller must have dropped off and passed the check first.'; end if;
  update public.seller_orders set status = 'consolidated' where order_id = p_order and status = 'at_hub';
  insert into public.deliveries(order_id, mode, parcel_label) values (p_order, 'hub', 'EN-' || upper(substr(replace(p_order, '-', ''), 1, 6)))
    on conflict (order_id) do update set parcel_label = coalesce(public.deliveries.parcel_label, excluded.parcel_label);
  perform private.audit(auth.uid(), 'hub_consolidate', 'order', p_order, null, null);
  perform private.sync_order(p_order);
end $$;

create or replace function public.dispatch(p_order text, p_courier jsonb) returns void language plpgsql security definer set search_path = public as $$
declare o record;
begin
  perform private.need_admin(); perform private.throttle('dispatch', 60, 60);
  select * into o from public.orders where id = p_order for update;
  if not found or o.status <> 'ready_for_delivery' or o.route <> 'hub' then raise exception 'This order is not ready for hub dispatch.'; end if;
  update public.deliveries set status = 'dispatched', dispatched_at = now(), courier_name = left(p_courier->>'name', 80), courier_phone = left(p_courier->>'phone', 30), tracking_note = left(p_courier->>'note', 300)
   where order_id = p_order;
  if not found then raise exception 'Consolidate the parcel first.'; end if;
  update public.seller_orders set status = 'out_for_delivery' where order_id = p_order and status = 'consolidated';
  update public.orders set status = 'out_for_delivery', auto_confirm_at = now() + make_interval(days => private.pol('auto_confirm_days', 5)::int) where id = p_order;
  perform private.notify(o.user_id, 'out_for_delivery', 'Your order is on its way', 'Keep your delivery code ready for the courier.', jsonb_build_object('order_id', p_order));
  perform private.audit(auth.uid(), 'dispatch', 'order', p_order, null, p_courier);
end $$;

create or replace function private.deliver(p_order text, p_proof text, p_actor uuid) returns void language plpgsql as $$
declare o record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.status = 'delivered' then return; end if;
  if o.status not in ('out_for_delivery', 'shipped') then raise exception 'This order is not out for delivery.'; end if;
  perform set_config('app.order_bypass', '1', true);
  update public.seller_orders set status = 'delivered', delivered_at = now() where order_id = p_order and status not in ('cancelled', 'rejected', 'delivered');
  update public.orders set status = 'delivered', auto_confirm_at = null, received_at = coalesce(received_at, (extract(epoch from now()) * 1000)::bigint) where id = p_order;
  insert into public.deliveries(order_id, mode, status, delivered_at, proof) values (p_order, coalesce(o.route, 'hub'), 'delivered', now(), p_proof)
    on conflict (order_id) do update set status = 'delivered', delivered_at = now(), proof = p_proof;
  perform private.notify(o.user_id, 'delivered', 'Delivered', 'Your order was delivered. Tell us how it went.', jsonb_build_object('order_id', p_order));
  perform private.audit(p_actor, 'delivered', 'order', p_order, null, jsonb_build_object('proof', p_proof));
end $$;

create or replace function public.mark_delivered(p_order text, p_code text) returns void language plpgsql security definer set search_path = public as $$
declare o record; code text; ok boolean;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'Order not found.'; end if;
  ok := coalesce(public.is_admin(), false) or (o.route = 'direct' and exists (
    select 1 from public.seller_orders so join public.stores s on s.id = so.store_id where so.order_id = p_order and s.owner_id = auth.uid() and so.status not in ('cancelled', 'rejected')));
  if not ok then raise exception 'You cannot confirm delivery for this order.'; end if;
  if not public.rate_hit(auth.uid(), 'delivery_code:' || p_order, 5, 600) then raise exception 'Too many wrong codes. Try again in a few minutes.'; end if;
  select delivery_code into code from public.order_secrets where order_id = p_order;
  if code is null or code <> coalesce(trim(p_code), '') then raise exception 'That delivery code is not correct.'; end if;
  perform private.deliver(p_order, 'code_verified', auth.uid());
end $$;

create or replace function public.confirm_received(p_order text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('confirm_received', 10, 60);
  if not exists (select 1 from public.orders where id = p_order and user_id = auth.uid()) then raise exception 'That is not your order.'; end if;
  perform private.deliver(p_order, 'customer_confirmed', auth.uid());
end $$;
create or replace function public.confirm_received_for(p_order text, p_user uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.orders where id = p_order and user_id = p_user) then raise exception 'That is not your order.'; end if;
  perform private.deliver(p_order, 'customer_confirmed', p_user);
end $$;

-- what a customer sees of their order progress (no commission or seller private data)
create or replace function public.order_tracking(p_order text) returns jsonb language plpgsql security definer set search_path = public as $$
declare o record; res jsonb;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid();
  if not found then raise exception 'Order not found.'; end if;
  select jsonb_build_object('order_id', o.id, 'status', o.status, 'payment_status', o.payment_status, 'route', o.route, 'route_reason', o.route_reason,
    'sellers', coalesce((select jsonb_agg(jsonb_build_object('store', s.name, 'status', so.status, 'accepted_at', so.accepted_at, 'ready_at', so.ready_at, 'delivered_at', so.delivered_at) order by s.name)
                          from public.seller_orders so join public.stores s on s.id = so.store_id where so.order_id = o.id), '[]'::jsonb),
    'delivery', (select to_jsonb(d) - 'id' - 'order_id' from public.deliveries d where d.order_id = o.id)) into res;
  return res;
end $$;

-- merchant order list with the privacy rule from A3 applied --------------------------------------------------------------
create or replace function public.my_seller_orders(p_status text default null)
returns table(id text, order_id text, status text, route text, subtotal numeric, commission numeric, earning numeric, accept_by timestamptz, created_at timestamptz,
              customer_name text, customer_city text, customer_phone text, customer_address text, items jsonb)
language sql stable security definer set search_path = public as $$
  select so.id, so.order_id, so.status, o.route, so.subtotal, so.commission, so.earning, so.accept_by, so.created_at,
    case when o.route = 'direct' and so.status in ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered') then o.cust->>'name' else split_part(coalesce(o.cust->>'name', ''), ' ', 1) end,
    o.cust->>'city',
    case when o.route = 'direct' and so.status in ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered') then o.cust->>'phone' end,
    case when o.route = 'direct' and so.status in ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered') then concat_ws(', ', o.cust->>'street', o.cust->>'city', o.cust->>'state') end,
    (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'size', i.size, 'qty', i.qty)), '[]'::jsonb) from public.order_items i where i.seller_order_id = so.id)
  from public.seller_orders so join public.orders o on o.id = so.order_id
  where so.released and private.owns_store(so.store_id) and (p_status is null or so.status = p_status)
  order by so.created_at desc
$$;

commit;
