-- Prevent a seller from accepting after the acceptance window has expired.
-- If the expiry worker has not run yet, cancel/refund the order synchronously while
-- holding the seller-order row lock; this closes the accept-vs-expiry race.
create or replace function public.seller_transition(p_so text, p_to text, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = ''
as $function$
declare
  so record;
  o record;
  st record;
  admin_ boolean := coalesce(public.is_admin(), false);
  reason text := left(coalesce(p_payload->>'reason', ''), 300);
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('seller_transition', 60, 60);
  select * into so from public.seller_orders where id = p_so for update;
  if not found then raise exception 'Order not found.'; end if;
  select * into st from public.stores where id = so.store_id;
  if not admin_ and st.owner_id is distinct from auth.uid() then raise exception 'That is not your order.'; end if;
  if not so.released then raise exception 'This order has not been paid yet.'; end if;

  -- Late seller acceptance must never win against the expiry worker. The row lock
  -- serializes both paths; the cancellation helper performs stock restoration,
  -- refund bookkeeping (where applicable), notifications and audit atomically.
  if not admin_ and p_to = 'accepted' and so.status = 'pending'
     and so.accept_by is not null and so.accept_by <= now() then
    perform private.cancel_so(p_so, 'The seller did not respond in time.', null, 'cancelled');
    return;
  end if;

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
    handed_over_at = case when p_to = 'handover_pending' then now() else handed_over_at end
    where id = p_so;
  if p_to = 'out_for_delivery' then
    perform set_config('app.order_bypass', '1', true);
    insert into public.deliveries(order_id, mode, courier_name, courier_phone, tracking_note, status, dispatched_at)
      values (so.order_id, 'direct', coalesce(nullif(left(p_payload->>'courier_name', 80), ''), st.name),
        left(p_payload->>'courier_phone', 30), left(p_payload->>'note', 300), 'dispatched', now())
      on conflict (order_id) do update set status = 'dispatched', dispatched_at = now(),
        courier_name = excluded.courier_name, courier_phone = excluded.courier_phone, tracking_note = excluded.tracking_note;
    update public.orders set status = 'out_for_delivery',
      auto_confirm_at = now() + make_interval(days => private.pol('auto_confirm_days', 5)::int)
      where id = so.order_id and status = 'ready_for_delivery';
  end if;
  if p_to = 'handover_pending' then
    perform private.notify_admins('handover_pending', 'A seller is bringing items to the hub', null,
      jsonb_build_object('seller_order_id', p_so));
  end if;
  perform private.notify(o.user_id, 'order_update', 'Order update',
    'A seller moved your order to ' || replace(p_to, '_', ' ') || '.', jsonb_build_object('order_id', so.order_id));
  perform private.audit(auth.uid(), 'seller_transition', 'seller_order', p_so,
    jsonb_build_object('status', so.status), jsonb_build_object('status', p_to));
  perform private.sync_order(so.order_id);
end $function$;
