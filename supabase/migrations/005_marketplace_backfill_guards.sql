-- 005: built-in EverNeed store, history backfill, and the guard triggers that protect state.

create or replace function private.slugify(t text) returns text language sql immutable as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g')), ''), 'store')
$$;

-- 2.3 Backfill ---------------------------------------------------------------------------------
insert into public.stores(id, slug, name, tagline, about, status, is_official, approved_at, country)
values ('everneed-official', 'everneed', 'EverNeed', 'Official store', 'Products sold and shipped by EverNeed.', 'approved', true, now(), 'NG')
on conflict (id) do nothing;
insert into public.store_private(store_id) values ('everneed-official') on conflict do nothing;
insert into public.store_subscriptions(store_id, status, current_period_start, current_period_end)
values ('everneed-official', 'active', now(), now() + interval '100 years') on conflict do nothing;

update public.products set store_id = 'everneed-official' where store_id is null;
alter table public.products alter column store_id set not null;

-- Old orders become one seller_order each (official store) with their items, so history still renders.
with legacy as (
  select o.*, coalesce((select sum((i->>'price')::numeric * (i->>'qty')::numeric) from jsonb_array_elements(o.items) i), o.total) sub
  from public.orders o where not exists (select 1 from public.seller_orders s where s.order_id = o.id)
), ins as (
  insert into public.seller_orders(order_id, store_id, status, released, subtotal, commission, earning, accepted_at, delivered_at, created_at)
  select id, 'everneed-official',
    case status when 'delivered' then 'delivered' when 'shipped' then 'out_for_delivery' when 'cancelled' then 'cancelled'
                when 'paid' then 'accepted' else 'pending' end,
    status in ('paid', 'shipped', 'delivered'), sub, 0, sub,
    case when status in ('paid', 'shipped', 'delivered') then to_timestamp(coalesce(paid_at, at) / 1000.0) end,
    case when status = 'delivered' then to_timestamp(coalesce(received_at, at) / 1000.0) end,
    to_timestamp(at / 1000.0)
  from legacy returning id, order_id
)
insert into public.order_items(order_id, seller_order_id, product_id, store_id, name, size, unit_price, qty, line_total)
select i.order_id, i.id, (select p.id from public.products p where p.id = it->>'id'), 'everneed-official',
       coalesce(it->>'name', 'Item'), nullif(it->>'size', ''), (it->>'price')::numeric, (it->>'qty')::int,
       (it->>'price')::numeric * (it->>'qty')::numeric
from ins i join public.orders o on o.id = i.order_id, jsonb_array_elements(o.items) it
where (it->>'qty')::int > 0;

update public.orders set route = 'direct', route_reason = 'legacy order' where route is null;
update public.orders set payment_status = case
    when paid_at is not null or status in ('paid', 'shipped', 'delivered') then 'paid'
    when status in ('awaiting_transfer', 'payment_reported', 'awaiting_delivery', 'sent', 'awaiting_payment') then status
    else 'awaiting_payment' end;

-- Guards -----------------------------------------------------------------------------------------
-- Inside SECURITY DEFINER functions current_user is the function owner, so those functions are privileged;
-- direct client writes arrive as 'authenticated' or 'anon' and are checked (admins are privileged too).
create or replace function private.is_privileged() returns boolean language sql stable as $$
  select current_user not in ('authenticated', 'anon') or coalesce(public.is_admin(), false)
$$;
grant execute on function private.is_privileged() to anon, authenticated, service_role;

create or replace function private.profiles_guard() returns trigger language plpgsql as $$
begin
  if not private.is_privileged() and (new.role is distinct from old.role or new.email is distinct from old.email) then
    raise exception 'Role and email cannot be changed from the app.';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function private.profiles_guard();

create or replace function private.stores_guard() returns trigger language plpgsql as $$
declare base text; n int := 0;
begin
  if tg_op = 'INSERT' then
    base := private.slugify(coalesce(new.slug, new.name)); new.slug := base;
    while exists (select 1 from public.stores where slug = new.slug) loop n := n + 1; new.slug := base || '-' || n; end loop;
    if not private.is_privileged() then
      if new.status not in ('draft', 'pending') then raise exception 'A new store starts as draft or pending.'; end if;
      new.is_official := false; new.is_demo := false; new.approved_at := null;
    end if;
    return new;
  end if;
  if not private.is_privileged() then
    if new.owner_id is distinct from old.owner_id or new.is_official is distinct from old.is_official or new.is_demo is distinct from old.is_demo
       or new.approved_at is distinct from old.approved_at or new.slug is distinct from old.slug then
      raise exception 'That store field cannot be changed from the app.';
    end if;
    if new.status is distinct from old.status and not (old.status in ('draft', 'rejected') and new.status = 'pending') then
      raise exception 'Store status is changed by the EverNeed team.';
    end if;
  end if;
  return new;
end $$;
create trigger stores_guard before insert or update on public.stores for each row execute function private.stores_guard();

create or replace function private.store_private_guard() returns trigger language plpgsql as $$
begin
  if not private.is_privileged() then
    if tg_op = 'INSERT' then
      if new.status_note is not null or new.commission_override is not null or new.trusted then raise exception 'Not allowed.'; end if;
    elsif new.status_note is distinct from old.status_note or new.commission_override is distinct from old.commission_override or new.trusted is distinct from old.trusted then
      raise exception 'That setting is managed by the EverNeed team.';
    end if;
  end if;
  return new;
end $$;
create trigger store_private_guard before insert or update on public.store_private for each row execute function private.store_private_guard();

create or replace function private.products_guard() returns trigger language plpgsql as $$
declare st text; trusted boolean;
begin
  if new.store_id is null then new.store_id := (select id from public.stores where is_official limit 1); end if;
  if private.is_privileged() then return new; end if;
  select status into st from public.stores where id = new.store_id;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') then raise exception 'New products start as draft or pending review.'; end if;
  else
    if new.store_id is distinct from old.store_id then raise exception 'A product cannot move to another store.'; end if;
    if new.status = 'published' and old.status is distinct from 'published' then raise exception 'Only the EverNeed team publishes products.'; end if;
    if new.status = 'rejected' and old.status is distinct from 'rejected' then raise exception 'Only the EverNeed team rejects products.'; end if;
    if old.status = 'published' and new.status = 'published'
       and (new.name is distinct from old.name or new.descr is distinct from old.descr or new.images is distinct from old.images or new.img is distinct from old.img) then
      new.status := 'pending_review';
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
create trigger products_guard before insert or update on public.products for each row execute function private.products_guard();

-- Order state machines (2.5b). Illegal jumps are rejected for everyone.
create or replace function private.order_step_ok(o text, n text) returns boolean language sql immutable as $$
  select o = n
    or (o in ('new', 'awaiting_payment', 'awaiting_transfer', 'payment_reported', 'awaiting_delivery', 'sent', 'placed')
        and n in ('paid', 'cancelled', 'payment_reported', 'shipped', 'delivered', 'disputed'))   -- shipped/delivered: legacy official-store flows
    or (o = 'paid' and n in ('confirmed', 'preparing', 'cancelled', 'disputed', 'shipped'))
    or (o = 'confirmed' and n in ('preparing', 'cancelled', 'disputed'))
    or (o = 'preparing' and n in ('ready_for_delivery', 'cancelled', 'disputed'))
    or (o = 'ready_for_delivery' and n in ('out_for_delivery', 'cancelled', 'disputed'))
    or (o in ('out_for_delivery', 'shipped') and n in ('delivered', 'disputed'))
    or (o = 'delivered' and n = 'disputed')
    or (o = 'disputed' and n in ('delivered', 'cancelled'))
$$;
create or replace function private.orders_guard() returns trigger language plpgsql as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if not private.order_step_ok(old.status, new.status) then
    raise exception 'An order cannot move from % to %.', old.status, new.status;
  end if;
  if not (coalesce(current_setting('app.order_bypass', true), '') = '1' and current_user not in ('authenticated', 'anon')) then
    if new.status = 'paid' and old.payment_status <> 'paid' then raise exception 'Payments are confirmed with confirm_payment().'; end if;
    if new.status in ('shipped', 'out_for_delivery', 'delivered') and exists (
      select 1 from public.seller_orders so join public.stores s on s.id = so.store_id where so.order_id = new.id and not s.is_official) then
      raise exception 'Marketplace orders are dispatched and delivered through the delivery functions.';
    end if;
  end if;
  return new;
end $$;
create trigger orders_guard before update on public.orders for each row execute function private.orders_guard();

create or replace function private.so_step_ok(o text, n text, route text) returns boolean language sql immutable as $$
  select o = n
    or (o = 'pending' and n in ('accepted', 'rejected', 'cancelled'))
    or (o = 'accepted' and n in ('preparing', 'cancelled'))
    or (o = 'preparing' and n in ('ready', 'cancelled'))
    or (o = 'ready' and (n = 'cancelled' or (route = 'direct' and n = 'out_for_delivery') or (route = 'hub' and n = 'handover_pending')))
    or (o = 'handover_pending' and n in ('at_hub', 'cancelled'))
    or (o = 'at_hub' and n = 'consolidated')
    or (o in ('accepted', 'preparing', 'ready', 'handover_pending', 'at_hub', 'consolidated') and n = 'issue')
    or (o = 'consolidated' and n = 'out_for_delivery')
    or (o = 'out_for_delivery' and n = 'delivered')
    or (o = 'issue' and n in ('ready', 'at_hub', 'cancelled'))
$$;
create or replace function private.seller_orders_guard() returns trigger language plpgsql as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if coalesce(current_setting('app.order_bypass', true), '') = '1' and current_user not in ('authenticated', 'anon') then return new; end if;
  if not private.so_step_ok(old.status, new.status, (select route from public.orders where id = new.order_id)) then
    raise exception 'A seller order cannot move from % to %.', old.status, new.status;
  end if;
  return new;
end $$;
create trigger seller_orders_guard before update on public.seller_orders for each row execute function private.seller_orders_guard();

-- Ledger: append-only. Only the status may change; nothing is ever deleted.
create or replace function private.ledger_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Ledger entries are never deleted.'; end if;
  if new.amount is distinct from old.amount or new.kind is distinct from old.kind or new.store_id is distinct from old.store_id
     or new.order_id is distinct from old.order_id or new.seller_order_id is distinct from old.seller_order_id or new.currency is distinct from old.currency then
    raise exception 'Ledger amounts are never edited; add a reversing entry.';
  end if;
  return new;
end $$;
create trigger ledger_guard before update or delete on public.ledger_entries for each row execute function private.ledger_guard();
