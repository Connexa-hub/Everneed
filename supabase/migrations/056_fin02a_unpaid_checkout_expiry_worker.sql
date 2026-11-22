-- FIN-02A: bounded, safe unpaid-checkout expiry worker. Scheduling remains disabled pending policy approval.
begin;
create or replace function public.expire_unpaid_checkout_orders(p_cutoff timestamptz,p_batch_size integer default 50,p_reason text default 'Checkout expired before payment confirmation')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; n_cancelled integer:=0; n_errors integer:=0;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required.'; end if;
 if p_cutoff is null or p_cutoff>now() or p_batch_size is null or p_batch_size not between 1 and 100 or p_reason is null or length(trim(p_reason)) not between 1 and 240 then raise exception 'Invalid unpaid checkout expiry request.'; end if;
 for r in select o.id from public.orders o
  where o.status in ('pending','awaiting_payment') and o.payment_status in ('awaiting_payment','awaiting_transfer')
   and o.at<=(extract(epoch from p_cutoff)*1000)::bigint
   and not exists(select 1 from private.payment_attempts a where a.order_id=o.id and a.status in ('initializing','pending','processing','succeeded','reconciliation_required'))
  order by o.at,o.id for update of o skip locked limit p_batch_size
 loop
  -- Payment-attempt creation locks the order. Recheck under this lock.
  if exists(select 1 from private.payment_attempts a where a.order_id=r.id and a.status in ('initializing','pending','processing','succeeded','reconciliation_required')) then continue; end if;
  begin
   perform private.cancel_order_core(r.id,null,left(p_reason,240),true);
   n_cancelled:=n_cancelled+1;
  exception when others then
   n_errors:=n_errors+1;
   raise warning 'Checkout expiry failed for order %: %',r.id,sqlerrm;
  end;
 end loop;
 return jsonb_build_object('cutoff',p_cutoff,'batch_size',p_batch_size,'cancelled',n_cancelled,'errors',n_errors);
end $$;
revoke all on function public.expire_unpaid_checkout_orders(timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.expire_unpaid_checkout_orders(timestamptz,integer,text) to service_role;
comment on function public.expire_unpaid_checkout_orders(timestamptz,integer,text) is 'Service-only bounded cancellation of old pending/awaiting-payment orders. Unresolved, succeeded and reconciliation-required attempts block cancellation. Scheduling remains disabled pending approved expiry policy.';
commit;
