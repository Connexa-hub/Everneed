-- Harden manual bank-transfer confirmation and paid-order cancellation.
-- This deliberately does not alter the verified Paystack settlement path.
begin;

create or replace function public.admin_confirm_payment(p_order text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order record;
  v_result text;
begin
  perform private.need_admin();
  perform private.throttle('admin_confirm', 60, 60);

  select id, pm, status, payment_status
    into v_order
    from public.orders
   where id = p_order
   for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  -- Idempotent retries remain harmless; no second journal/ledger posting.
  if v_order.payment_status = 'paid' then
    return 'already';
  end if;

  if v_order.pm is distinct from 'bank' then
    raise exception 'Manual confirmation is only allowed for bank transfer.';
  end if;

  if v_order.status is distinct from 'payment_reported'
     or v_order.payment_status is distinct from 'payment_reported' then
    raise exception 'Only a buyer-reported bank transfer can be confirmed.';
  end if;

  v_result := private.confirm_payment_core(p_order, null, auth.uid());
  return v_result;
end
$function$;

create or replace function private.cancel_order_core(
  p_order text,
  p_actor uuid,
  p_reason text,
  p_admin boolean
)
returns void
language plpgsql
set search_path = ''
as $function$
declare
  o record;
  so record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;

  if not p_admin then
    if o.user_id is distinct from p_actor then raise exception 'That is not your order.'; end if;
    if exists (
      select 1 from public.seller_orders
      where order_id = p_order and status not in ('pending', 'cancelled', 'rejected')
    ) then
      raise exception 'A seller has already started this order. Contact support to cancel it.';
    end if;
  end if;

  if o.payment_status in ('paid', 'partially_refunded') then
    raise exception 'Paid orders require a refund to be processed before cancellation.';
  end if;

  if o.status in ('delivered', 'cancelled') then
    raise exception 'This order can no longer be cancelled.';
  end if;

  for so in
    select id, status from public.seller_orders
    where order_id = p_order and status not in ('cancelled', 'rejected', 'delivered')
  loop
    if so.status in ('at_hub', 'consolidated') then
      perform set_config('app.order_bypass', '1', true);
      update public.seller_orders set status = 'issue' where id = so.id;
    end if;
    perform private.cancel_so(
      so.id,
      coalesce(nullif(left(p_reason, 300), ''), 'Cancelled'),
      p_actor,
      'cancelled'
    );
  end loop;

  perform set_config('app.order_bypass', '1', true);
  update public.orders set status = 'cancelled' where id = p_order and status <> 'cancelled';
  perform private.audit(
    p_actor,
    'cancel_order',
    'order',
    p_order,
    jsonb_build_object('status', o.status),
    jsonb_build_object('reason', p_reason)
  );
end
$function$;

commit;
