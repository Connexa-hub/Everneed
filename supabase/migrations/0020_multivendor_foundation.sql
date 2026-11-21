-- EverNeed multivendor foundation (development only)
create table if not exists public.stores (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  logo text,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.store_members (
  store_id text not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'manager' check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
alter table public.products add column if not exists store_id text references public.stores(id) on delete set null;
create index if not exists products_store_id_idx on public.products(store_id);
create index if not exists store_members_user_id_idx on public.store_members(user_id);
create table if not exists public.order_items (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  store_id text references public.stores(id) on delete set null,
  product_snapshot jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  quantity integer not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  currency text,
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_store_id_idx on public.order_items(store_id);
create table if not exists public.seller_orders (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.orders(id) on delete cascade,
  store_id text not null references public.stores(id) on delete restrict,
  status text not null default 'new' check (status in ('new', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  subtotal numeric not null default 0 check (subtotal >= 0),
  currency text,
  tracking jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, store_id)
);
create index if not exists seller_orders_store_id_idx on public.seller_orders(store_id);
create index if not exists seller_orders_order_id_idx on public.seller_orders(order_id);
create table if not exists public.fulfilment_batches (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.orders(id) on delete cascade,
  route_mode text not null default 'hub' check (route_mode in ('hub', 'direct')),
  status text not null default 'pending' check (status in ('pending', 'collecting', 'at_hub', 'dispatched', 'delivered', 'cancelled')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fulfilment_batches_order_id_idx on public.fulfilment_batches(order_id);
create or replace function public.is_store_member(p_store_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.store_members sm where sm.store_id = p_store_id and sm.user_id = auth.uid());
$$;
create or replace function public.owns_store(p_store_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stores s where s.id = p_store_id and s.owner_id = auth.uid());
$$;
revoke all on function public.is_store_member(text) from public;
revoke all on function public.owns_store(text) from public;
grant execute on function public.is_store_member(text) to authenticated;
grant execute on function public.owns_store(text) to authenticated;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.order_items enable row level security;
alter table public.seller_orders enable row level security;
alter table public.fulfilment_batches enable row level security;
drop policy if exists "stores public active read" on public.stores;
create policy "stores public active read" on public.stores for select using (status = 'active' or owner_id = auth.uid() or public.is_admin());
drop policy if exists "stores owner create" on public.stores;
create policy "stores owner create" on public.stores for insert to authenticated with check (owner_id = auth.uid() and status = 'pending');
drop policy if exists "stores owner update" on public.stores;
drop policy if exists "stores admin update" on public.stores;
create policy "stores owner update" on public.stores for update to authenticated using (owner_id = auth.uid() and status = 'pending') with check (owner_id = auth.uid() and status = 'pending');
create policy "stores admin update" on public.stores for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "store members read" on public.store_members;
create policy "store members read" on public.store_members for select to authenticated using (user_id = auth.uid() or public.owns_store(store_id) or public.is_admin());
drop policy if exists "store owner adds members" on public.store_members;
create policy "store owner adds members" on public.store_members for insert to authenticated with check (public.is_admin() or (public.owns_store(store_id) and ((user_id = auth.uid() and role = 'owner') or role = 'manager')));
drop policy if exists "store owner removes members" on public.store_members;
create policy "store owner removes members" on public.store_members for delete to authenticated using (public.owns_store(store_id) or public.is_admin());
drop policy if exists "order items buyer seller admin read" on public.order_items;
create policy "order items buyer seller admin read" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()) or public.is_store_member(store_id) or public.is_admin());
drop policy if exists "seller orders buyer seller admin read" on public.seller_orders;
create policy "seller orders buyer seller admin read" on public.seller_orders for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()) or public.is_store_member(store_id) or public.is_admin());
drop policy if exists "seller orders seller admin update" on public.seller_orders;
create policy "seller orders seller admin update" on public.seller_orders for update to authenticated using (public.is_store_member(store_id) or public.is_admin()) with check (public.is_store_member(store_id) or public.is_admin());
drop policy if exists "fulfilment admin only" on public.fulfilment_batches;
create policy "fulfilment admin only" on public.fulfilment_batches for all to authenticated using (public.is_admin()) with check (public.is_admin());
comment on column public.products.store_id is 'NULL means an EverNeed-owned product; non-NULL assigns the product to a seller store.';
