-- CX-01 staging fixture blockers: fix hub issue notification helper and dispatch guard.
-- Both changes preserve existing authorization and state validation.

create or replace function public.hub_receive(p_so text, p_check jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  so record;
  bad integer;
  missing integer;
  expected integer;
begin
  perform private.need_admin();
  perform private.throttle('hub_receive', 120, 60);

  select * into so from public.seller_orders where id = p_so for update;
  if not found or so.status <> 'handover_pending' then
    raise exception 'This seller order is not waiting at the hub.';
  end if;

  if jsonb_typeof(p_check) is distinct from 'array' then
    raise exception 'Send one check result per item.';
  end if;

  select count(*) into expected
  from public.order_items
  where seller_order_id = p_so;

  if expected = 0 or jsonb_array_length(p_check) <> expected then
    raise exception 'Send exactly one check result per item.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_check) c
    where jsonb_typeof(c) <> 'object'
       or nullif(btrim(c->>'item_id'), '') is null
       or coalesce(c->>'status', '') not in ('received', 'missing', 'damaged')
  ) then
    raise exception 'Each item needs a valid check result.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_check) c
    where not exists (
      select 1 from public.order_items i
      where i.seller_order_id = p_so and i.id = c->>'item_id'
    )
  ) then
    raise exception 'The check contains an item that is not in this seller order.';
  end if;

  select count(*) into missing
  from public.order_items i
  where i.seller_order_id = p_so
    and not exists (
      select 1 from jsonb_array_elements(p_check) c
      where c->>'item_id' = i.id
    );

  if missing > 0 then
    raise exception 'Every item must be checked exactly once.';
  end if;

  select count(*) into bad
  from jsonb_array_elements(p_check) c
  where c->>'status' <> 'received';

  update public.seller_orders
  set hub_check = p_check,
      hub_received_at = now(),
      status = case when bad = 0 then 'at_hub' else 'issue' end
  where id = p_so;

  if bad > 0 then
    perform private.notify_admins('hub_issue', 'Hub check found a problem', null, jsonb_build_object('seller_order_id', p_so));
  end if;

  perform private.audit(auth.uid(), 'hub_receive', 'seller_order', p_so, null, p_check);
  perform private.sync_order(so.order_id);
end
$function$;

create or replace function public.dispatch(p_order text, p_courier jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare o record;
begin
  perform private.need_admin();
  perform private.throttle('dispatch', 60, 60);

  if jsonb_typeof(p_courier) is distinct from 'object'
     or nullif(btrim(p_courier->>'name'), '') is null then
    raise exception 'Courier name is required.';
  end if;

  select * into o from public.orders where id = p_order for update;
  if not found or o.status <> 'ready_for_delivery' or o.route <> 'hub' then
    raise exception 'This order is not ready for hub dispatch.';
  end if;

  update public.deliveries
  set status = 'dispatched',
      dispatched_at = now(),
      courier_name = left(p_courier->>'name', 80),
      courier_phone = left(p_courier->>'phone', 30),
      tracking_note = left(p_courier->>'note', 300)
  where order_id = p_order;

  if not found then
    raise exception 'Consolidate the parcel first.';
  end if;

  update public.seller_orders
  set status = 'out_for_delivery'
  where order_id = p_order and status = 'consolidated';

  perform set_config('app.order_bypass', '1', true);
  update public.orders
  set status = 'out_for_delivery',
      auto_confirm_at = now() + make_interval(days => private.pol('auto_confirm_days', 5)::int)
  where id = p_order;

  perform private.notify(o.user_id, 'out_for_delivery', 'Your order is on its way', 'Keep your delivery code ready for the courier.', jsonb_build_object('order_id', p_order));
  perform private.audit(auth.uid(), 'dispatch', 'order', p_order, null, p_courier);
end
$function$;
