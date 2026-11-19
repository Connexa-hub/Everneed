-- Official Everneed store is not a seller subscription and must remain publicly live.
-- Seller subscription and activation checks remain mandatory for all non-official stores.
begin;

create or replace function private.store_live(p_store text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists (
    select 1
    from public.stores s
    where s.id=p_store
      and s.status='approved'
      and (
        s.is_official
        or exists (
          select 1
          from public.store_subscriptions ss
          join public.seller_plan_entitlements e on e.plan_id=ss.plan_id
          where ss.store_id=s.id
            and s.activation_status='live'
            and private.store_verification_complete(s.id)
            and ((ss.status in ('trialing','active') and ss.current_period_end>now())
              or (ss.status='past_due' and ss.grace_until>now()))
        )
      )
  )
$$;
revoke execute on function private.store_live(text) from public;
grant execute on function private.store_live(text) to anon,authenticated,service_role;

commit;
