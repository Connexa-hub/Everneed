-- Regression checks for manual payment confirmation and paid-order cancellation guards.
begin;
do $$
declare
  confirm_def text;
  cancel_def text;
begin
  confirm_def := pg_get_functiondef('public.admin_confirm_payment(text)'::regprocedure);
  cancel_def := pg_get_functiondef('private.cancel_order_core(text,uuid,text,boolean)'::regprocedure);

  if confirm_def not ilike '%v_order.pm is distinct from ''bank''%'
     or confirm_def not ilike '%status is distinct from ''payment_reported''%'
     or confirm_def not ilike '%payment_status is distinct from ''payment_reported''%' then
    raise exception 'FAIL: admin confirmation must enforce bank method and buyer-reported state';
  end if;
  if confirm_def not ilike '%payment_status = ''paid''%'
     or confirm_def not ilike '%return ''already''%' then
    raise exception 'FAIL: already-paid admin confirmation must be idempotent';
  end if;
  if confirm_def not ilike '%private.confirm_payment_core(p_order, null, auth.uid())%' then
    raise exception 'FAIL: admin confirmation must use the trusted legacy confirmation core';
  end if;
  if cancel_def not ilike '%payment_status in (''paid'', ''partially_refunded'')%'
     or cancel_def not ilike '%Paid orders require a refund to be processed before cancellation%' then
    raise exception 'FAIL: cancellation must block paid/partially-refunded orders pending refund processing';
  end if;
  if has_function_privilege('anon','public.admin_confirm_payment(text)','EXECUTE') then
    raise exception 'FAIL: anon must not execute admin confirmation';
  end if;
  raise notice 'PASS: manual bank transfer and paid cancellation guards are installed';
end
$$;
rollback;
