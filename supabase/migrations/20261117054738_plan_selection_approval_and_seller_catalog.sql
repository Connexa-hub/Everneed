-- Seller plan selection must survive application approval; expose a safe public plan catalogue.
-- Staging-first. Does not charge a seller or alter existing approved subscriptions.
begin;

create or replace function public.approve_store(p_store text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  a record;
  chosen record;
  existing_sub record;
  trial_end timestamptz;
begin
  perform private.need_admin();

  select * into s
  from public.stores
  where id = p_store
  for update;
  if not found then
    raise exception 'Store not found.';
  end if;

  select * into a
  from public.store_applications
  where store_id = p_store
  for update;
  if not found then
    raise exception 'Store application not found.';
  end if;

  if a.plan_id is null then
    raise exception 'The seller must choose a plan before the application can be approved.';
  end if;

  select p.id, p.name, p.active,
         e.active_product_limit, e.active_products_unlimited,
         e.daily_new_product_limit, e.daily_new_products_unlimited
    into chosen
  from public.store_plans p
  join public.seller_plan_entitlements e on e.plan_id = p.id
  where p.id = a.plan_id
  for share of p, e;

  if not found or not chosen.active then
    raise exception 'The seller-selected plan is unavailable.';
  end if;

  if (not chosen.active_products_unlimited and chosen.active_product_limit is null)
     or (not chosen.daily_new_products_unlimited and chosen.daily_new_product_limit is null) then
    raise exception 'The seller-selected plan does not have complete catalogue limits.';
  end if;

  select * into existing_sub
  from public.store_subscriptions
  where store_id = p_store
  for update;

  if found and existing_sub.plan_id is not null and existing_sub.plan_id <> a.plan_id then
    raise exception 'An existing subscription has a different plan. Resolve it before approving this application.';
  end if;
  if found and existing_sub.plan_id is null and existing_sub.status <> 'trialing' then
    raise exception 'An existing non-trial subscription has no plan. Resolve it before approving this application.';
  end if;

  update public.stores
  set status = 'approved',
      activation_status = 'verification_required',
      approved_at = coalesce(approved_at, now())
  where id = p_store;

  insert into public.store_private(store_id, status_note)
  values (p_store, left(p_note, 300))
  on conflict (store_id) do update
    set status_note = left(p_note, 300);

  update public.store_applications
  set decision = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      reason = left(p_note, 300)
  where store_id = p_store;

  if s.owner_id is not null then
    update public.profiles
    set role = 'merchant'
    where id = s.owner_id and role = 'customer';
  end if;

  trial_end := now() + make_interval(days => private.pol('trial_days', 30)::int);

  insert into public.store_subscriptions
    (store_id, plan_id, status, current_period_start, current_period_end)
  values
    (p_store, a.plan_id, 'trialing', now(), trial_end)
  on conflict (store_id) do update
    set plan_id = excluded.plan_id
    where public.store_subscriptions.status = 'trialing'
      and public.store_subscriptions.plan_id is null;

  perform private.notify(
    s.owner_id,
    'store_approved',
    'Your application is approved',
    'Your selected plan is assigned. Continue in your seller workspace to complete any plan-specific steps.',
    jsonb_build_object(
      'store_id', p_store,
      'plan_id', a.plan_id,
      'plan_name', chosen.name,
      'activation_status', 'verification_required'
    )
  );

  perform private.audit(
    auth.uid(),
    'approve_store',
    'store',
    p_store,
    jsonb_build_object(
      'status', s.status,
      'activation_status', s.activation_status,
      'application_plan_id', a.plan_id,
      'existing_subscription_plan_id', existing_sub.plan_id
    ),
    jsonb_build_object(
      'status', 'approved',
      'activation_status', 'verification_required',
      'subscription_plan_id', a.plan_id,
      'note', p_note
    )
  );
end
$$;

-- The catalogue exposes only seller-safe plan and entitlement fields.
-- The private entitlement table remains unavailable for direct seller reads.
create or replace function public.seller_plan_catalog()
returns table (
  plan_id text,
  name text,
  price numeric,
  billing_period text,
  active_product_limit integer,
  active_products_unlimited boolean,
  daily_new_product_limit integer,
  daily_new_products_unlimited boolean,
  commission_discount numeric,
  features jsonb,
  verification_included boolean,
  verification_required_to_activate boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.price,
    p.period,
    e.active_product_limit,
    e.active_products_unlimited,
    e.daily_new_product_limit,
    e.daily_new_products_unlimited,
    p.commission_discount,
    p.features,
    e.verification_included,
    e.verification_required_to_activate
  from public.store_plans p
  join public.seller_plan_entitlements e on e.plan_id = p.id
  where p.active = true
  order by p.price asc, p.id asc
$$;

revoke all on function public.seller_plan_catalog() from public;
grant execute on function public.seller_plan_catalog() to anon, authenticated;

commit;
