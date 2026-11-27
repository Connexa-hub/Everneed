-- R24: owner-controlled storefront pause/holiday mode, enforced centrally.
-- Staging-first. Pausing affects new purchase eligibility only; existing orders are untouched.
begin;

alter table public.stores
  add column if not exists storefront_paused boolean not null default false,
  add column if not exists storefront_pause_until timestamptz,
  add column if not exists storefront_pause_note text,
  add column if not exists storefront_pause_updated_at timestamptz;

alter table public.stores
  add constraint stores_pause_until_future_when_paused
  check (not storefront_paused or storefront_pause_until is null or storefront_pause_until > storefront_pause_updated_at)
  not valid;
alter table public.stores validate constraint stores_pause_until_future_when_paused;

create or replace function public.seller_set_pause(
  p_store text,
  p_paused boolean,
  p_until timestamptz default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  s public.stores%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if p_store is null or length(trim(p_store)) not between 1 and 128 or p_paused is null then
    raise exception 'Invalid pause request.';
  end if;
  if p_paused and p_until is not null and p_until <= now() then
    raise exception 'Pause expiry must be in the future.';
  end if;
  if p_note is not null and length(trim(p_note)) > 240 then
    raise exception 'Pause note must be 240 characters or fewer.';
  end if;

  select * into s from public.stores
   where id=p_store and owner_id=auth.uid()
   for update;
  if not found then raise exception 'That is not your store.'; end if;
  if s.is_official then raise exception 'The official store pause is controlled by Everneed.'; end if;
  if s.status not in ('approved') then raise exception 'Only an approved store can be paused.'; end if;

  v_before := jsonb_build_object('paused',s.storefront_paused,'until',s.storefront_pause_until,'note',s.storefront_pause_note);
  update public.stores
     set storefront_paused=p_paused,
         storefront_pause_until=case when p_paused then p_until else null end,
         storefront_pause_note=case when p_paused then nullif(trim(p_note),'') else null end,
         storefront_pause_updated_at=now()
   where id=p_store;
  select jsonb_build_object('paused',storefront_paused,'until',storefront_pause_until,'note',storefront_pause_note,'updated_at',storefront_pause_updated_at)
    into v_after from public.stores where id=p_store;

  perform private.audit(auth.uid(),case when p_paused then 'seller_store_pause' else 'seller_store_resume' end,
    'store',p_store,v_before,v_after);
  return jsonb_build_object('store_id',p_store,'timezone',s.business_timezone,'pause',v_after);
end
$function$;

revoke all on function public.seller_set_pause(text,boolean,timestamptz,text) from public, anon;
grant execute on function public.seller_set_pause(text,boolean,timestamptz,text) to authenticated;

-- Keep direct seller table writes from changing pause controls; the owner RPC runs as its definer.
create or replace function private.stores_guard()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare base text; n int := 0;
begin
  if tg_op = 'INSERT' then
    base := private.slugify(coalesce(new.slug, new.name)); new.slug := base;
    while exists (select 1 from public.stores where slug = new.slug) loop n := n + 1; new.slug := base || '-' || n; end loop;
    if not private.is_privileged() then
      if new.status not in ('draft', 'pending') then raise exception 'A new store starts as draft or pending.'; end if;
      new.is_official := false; new.is_demo := false; new.approved_at := null;
      new.storefront_paused := false; new.storefront_pause_until := null; new.storefront_pause_note := null; new.storefront_pause_updated_at := null;
    end if;
    return new;
  end if;
  if not private.is_privileged() then
    if new.owner_id is distinct from old.owner_id or new.is_official is distinct from old.is_official or new.is_demo is distinct from old.is_demo
       or new.approved_at is distinct from old.approved_at or new.slug is distinct from old.slug then
      raise exception 'That store field cannot be changed from the app.';
    end if;
    if new.storefront_paused is distinct from old.storefront_paused
       or new.storefront_pause_until is distinct from old.storefront_pause_until
       or new.storefront_pause_note is distinct from old.storefront_pause_note
       or new.storefront_pause_updated_at is distinct from old.storefront_pause_updated_at then
      raise exception 'Use seller_set_pause to change storefront pause settings.';
    end if;
    if new.status is distinct from old.status and not (old.status in ('draft', 'rejected') and new.status = 'pending') then
      raise exception 'Store status is changed by the EverNeed team.';
    end if;
  end if;
  return new;
end
$function$;

create or replace function private.store_live(p_store text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.stores s
    where s.id=p_store
      and s.status='approved'
      and (not s.storefront_paused or s.storefront_pause_until is not null and s.storefront_pause_until<=now())
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
$function$;

commit;
