insert into public.store_plans(id, name, price, product_limit, commission_discount, features, active)
select * from (values
  ('plan-starter', 'Starter', 3000::numeric, 25, 0::numeric, '["Up to 25 products", "Standard commission", "Seller dashboard and earnings", "Hub or direct delivery"]'::jsonb, true),
  ('plan-growth',  'Growth',  8000::numeric, 200, 2::numeric, '["Up to 200 products", "2 points lower commission", "Seller dashboard and earnings", "Hub or direct delivery"]'::jsonb, true),
  ('plan-pro',     'Pro',     20000::numeric, null, 4::numeric, '["Unlimited products", "4 points lower commission", "Seller dashboard and earnings", "Hub or direct delivery"]'::jsonb, true)
) v(id, name, price, product_limit, commission_discount, features, active)
where not exists (select 1 from public.store_plans);

alter table public.store_applications add column if not exists plan_id text references public.store_plans;
grant insert (plan_id) on public.store_applications to authenticated;
grant update (plan_id) on public.store_applications to authenticated;

create or replace function public.approve_store(p_store text, p_note text default null) returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  perform private.need_admin();
  select * into s from public.stores where id = p_store for update;
  if not found then raise exception 'Store not found.'; end if;
  update public.stores set status = 'approved', approved_at = coalesce(approved_at, now()) where id = p_store;
  insert into public.store_private(store_id, status_note) values (p_store, left(p_note, 300)) on conflict (store_id) do update set status_note = left(p_note, 300);
  update public.store_applications set decision = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), reason = left(p_note, 300) where store_id = p_store;
  if s.owner_id is not null then update public.profiles set role = 'merchant' where id = s.owner_id and role = 'customer'; end if;
  insert into public.store_subscriptions(store_id, plan_id, status, current_period_start, current_period_end)
    values (p_store, (select plan_id from public.store_applications where store_id = p_store), 'trialing', now(), now() + make_interval(days => private.pol('trial_days', 30)::int))
    on conflict (store_id) do nothing;
  perform private.notify(s.owner_id, 'store_approved', 'Your store is approved', 'You can now submit products for review.', jsonb_build_object('store_id', p_store));
  perform private.audit(auth.uid(), 'approve_store', 'store', p_store, jsonb_build_object('status', s.status), jsonb_build_object('status', 'approved', 'note', p_note));
end $$;
revoke all on function public.approve_store(text, text) from public, anon;
grant execute on function public.approve_store(text, text) to authenticated;

create or replace function public.choose_plan(p_plan text) returns void language plpgsql security definer set search_path = public as $$
declare st record; sub record;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('choose_plan', 20, 60);
  select * into st from public.stores where owner_id = auth.uid();
  if not found then raise exception 'You do not have a store yet.'; end if;
  if not exists (select 1 from public.store_plans where id = p_plan and active) then raise exception 'That plan is not available.'; end if;
  select * into sub from public.store_subscriptions where store_id = st.id for update;
  if not found then
    update public.store_applications set plan_id = p_plan where store_id = st.id and decision is null;
    return;
  end if;
  if sub.status <> 'trialing' then raise exception 'To change plan, pay for the new plan.'; end if;
  update public.store_subscriptions set plan_id = p_plan where id = sub.id;
  perform private.audit(auth.uid(), 'choose_plan', 'store', st.id, jsonb_build_object('plan', sub.plan_id), jsonb_build_object('plan', p_plan));
end $$;
revoke all on function public.choose_plan(text) from public, anon;
grant execute on function public.choose_plan(text) to authenticated;

create or replace function private.products_guard() returns trigger language plpgsql as $$
declare st text; trusted boolean; lim int; used int;
begin
  if new.store_id is null then new.store_id := (select id from public.stores where is_official limit 1); end if;
  if private.is_privileged() then return new; end if;
  select status into st from public.stores where id = new.store_id;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') then raise exception 'New products start as draft or pending review.'; end if;
    select pl.product_limit into lim from public.store_subscriptions ss join public.store_plans pl on pl.id = ss.plan_id where ss.store_id = new.store_id;
    if lim is not null then
      select count(*) into used from public.products where store_id = new.store_id and status <> 'archived';
      if used >= lim then raise exception 'Your plan allows % products. Archive some or upgrade your plan to add more.', lim; end if;
    end if;
  else
    if new.store_id is distinct from old.store_id then raise exception 'A product cannot move to another store.'; end if;
    if new.status = 'published' and old.status is distinct from 'published' then raise exception 'Only the EverNeed team publishes products.'; end if;
    if new.status = 'rejected' and old.status is distinct from 'rejected' then raise exception 'Only the EverNeed team rejects products.'; end if;
    if old.status = 'published' and new.status = 'published'
       and (new.name is distinct from old.name or new.descr is distinct from old.descr or new.images is distinct from old.images or new.img is distinct from old.img) then
      new.status := 'pending_review';
    end if;
    if old.status = 'archived' and new.status <> 'archived' then
      select pl.product_limit into lim from public.store_subscriptions ss join public.store_plans pl on pl.id = ss.plan_id where ss.store_id = new.store_id;
      if lim is not null then
        select count(*) into used from public.products where store_id = new.store_id and status <> 'archived';
        if used >= lim then raise exception 'Your plan allows % products. Archive some or upgrade your plan to restore this one.', lim; end if;
      end if;
    end if;
  end if;
  if new.status = 'pending_review' then
    if st is distinct from 'approved' then raise exception 'Your store must be approved before products go for review.'; end if;
    select sp.trusted into trusted from public.store_private sp where sp.store_id = new.store_id;
    if coalesce(trusted, false) and coalesce((select (data->>'auto_approve_trusted')::boolean from public.settings where id = 'policy'), false) then
      new.status := 'published';
    end if;
  end if;
  return new;
end $$;
alter function private.products_guard() set search_path = '';
