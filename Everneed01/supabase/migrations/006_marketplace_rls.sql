-- 006: access rules. Public reads go through RLS-filtered base tables and security_invoker views.
-- Writes that change state go through functions (007), so most tables get no client write grants.

-- Helpers (private schema: usable inside policies, not exposed as API endpoints) ----------------------
create or replace function private.owns_store(p_store text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid())
$$;
create or replace function private.my_store() returns text language sql stable security definer set search_path = '' as $$
  select id from public.stores where owner_id = auth.uid() limit 1
$$;
-- A store is visible to shoppers when approved and its rental is current (official store: always).
create or replace function private.store_live(p_store text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.stores s
    where s.id = p_store and s.status = 'approved'
      and (s.is_official or exists (
        select 1 from public.store_subscriptions ss
        where ss.store_id = s.id
          and ((ss.status in ('trialing', 'active') and ss.current_period_end > now()) or (ss.status = 'past_due' and ss.grace_until > now())))))
$$;
create or replace function private.buys(p_order text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders o where o.id = p_order and o.user_id = auth.uid())
$$;
create or replace function private.sells(p_seller_order text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.seller_orders so where so.id = p_seller_order and private.owns_store(so.store_id))
$$;
grant execute on function private.owns_store(text), private.my_store(), private.store_live(text), private.buys(text), private.sells(text)
  to anon, authenticated, service_role;
revoke execute on function public.on_signup() from public, anon, authenticated;

-- Enable RLS on every new table ---------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['stores','store_private','store_applications','store_plans','store_subscriptions','store_payments','product_private',
    'order_secrets','seller_orders','order_items','order_item_fees','deliveries','ledger_entries','payouts','refunds','disputes','notifications','audit_log']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- Tables only functions write to: strip client write grants, and anon access to private tables.
do $$ declare t text; begin
  foreach t in array array['seller_orders','order_items','order_item_fees','deliveries','ledger_entries','payouts','refunds','notifications','audit_log',
    'store_subscriptions','store_payments','order_secrets','store_plans']
  loop execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t); end loop;
  foreach t in array array['store_private','store_applications','store_subscriptions','store_payments','product_private','order_secrets','seller_orders','order_items',
    'order_item_fees','deliveries','ledger_entries','payouts','refunds','disputes','notifications','audit_log','store_plans','rate_limits','kv','cards']
  loop execute format('revoke all on public.%I from anon', t); end loop;
end $$;

-- Stores ---------------------------------------------------------------------------------------------------
revoke select on public.stores from anon;
grant select (id, slug, name, tagline, about, logo_url, cover_url, accent, categories, country, state, city, status, is_official, created_at) on public.stores to anon;
revoke insert, update, delete on public.stores from anon, authenticated;
grant insert (owner_id, name, tagline, about, logo_url, cover_url, accent, categories, country, state, city, status) on public.stores to authenticated;
grant update (name, tagline, about, logo_url, cover_url, accent, categories, country, state, city, status) on public.stores to authenticated;
create policy "stores public read" on public.stores for select to anon, authenticated using (status = 'approved' and private.store_live(id));
create policy "stores owner read" on public.stores for select to authenticated using (owner_id = auth.uid());
create policy "stores admin read" on public.stores for select to authenticated using (public.is_admin());
create policy "stores owner create" on public.stores for insert to authenticated with check (owner_id = auth.uid() and status in ('draft', 'pending'));
create policy "stores owner update" on public.stores for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke insert, update, delete on public.store_private from authenticated;
grant insert (store_id, pickup_address, phone, direct_delivery_enabled, delivery_zones) on public.store_private to authenticated;
grant update (pickup_address, phone, direct_delivery_enabled, delivery_zones) on public.store_private to authenticated;
create policy "store_private owner" on public.store_private for select to authenticated using (private.owns_store(store_id) or public.is_admin());
create policy "store_private owner insert" on public.store_private for insert to authenticated with check (private.owns_store(store_id));
create policy "store_private owner update" on public.store_private for update to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));

revoke insert, update, delete on public.store_applications from authenticated;
grant insert (store_id, business_name, id_type, id_ref, bank_name, account_number, account_name) on public.store_applications to authenticated;
grant update (business_name, id_type, id_ref, bank_name, account_number, account_name) on public.store_applications to authenticated;
create policy "applications read" on public.store_applications for select to authenticated using (private.owns_store(store_id) or public.is_admin());
create policy "applications owner insert" on public.store_applications for insert to authenticated with check (private.owns_store(store_id));
create policy "applications owner update" on public.store_applications for update to authenticated using (private.owns_store(store_id) and decision is null) with check (private.owns_store(store_id) and decision is null);

create policy "plans read" on public.store_plans for select to authenticated using (active or public.is_admin());
create policy "plans admin" on public.store_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.store_plans to authenticated;
create policy "subscriptions read" on public.store_subscriptions for select to authenticated using (private.owns_store(store_id) or public.is_admin());
create policy "store payments read" on public.store_payments for select to authenticated using (private.owns_store(store_id) or public.is_admin());

-- Products ---------------------------------------------------------------------------------------------------
drop policy if exists "products read" on public.products;
create policy "products public read" on public.products for select to anon, authenticated using (status = 'published' and private.store_live(store_id));
create policy "products owner read" on public.products for select to authenticated using (private.owns_store(store_id));
create policy "products owner insert" on public.products for insert to authenticated with check (private.owns_store(store_id));
create policy "products owner update" on public.products for update to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));
create policy "products owner delete" on public.products for delete to authenticated using (private.owns_store(store_id) and status in ('draft', 'rejected'));
-- "products admin" (for all, is_admin) from the baseline stays.
grant select on public.product_private to authenticated;
grant insert (product_id, compliance_ref) on public.product_private to authenticated;
grant update (compliance_ref) on public.product_private to authenticated;
create policy "product_private read" on public.product_private for select to authenticated
  using (public.is_admin() or exists (select 1 from public.products p where p.id = product_id and private.owns_store(p.store_id)));
create policy "product_private owner insert" on public.product_private for insert to authenticated
  with check (exists (select 1 from public.products p where p.id = product_id and private.owns_store(p.store_id)));
create policy "product_private owner update" on public.product_private for update to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and private.owns_store(p.store_id)))
  with check (exists (select 1 from public.products p where p.id = product_id and private.owns_store(p.store_id)));

-- Reviews: anonymous readers never get user ids ---------------------------------------------------------------
revoke select on public.reviews from anon;
grant select (id, product_id, rating, body, name, at) on public.reviews to anon;

-- Orders and what hangs off them ------------------------------------------------------------------------------
-- Customers: read own orders (baseline policy), items, delivery and delivery code. Never write.
drop policy if exists "orders insert" on public.orders;
create policy "order_items read" on public.order_items for select to authenticated using (
  private.buys(order_id) or public.is_admin()
  or exists (select 1 from public.seller_orders so where so.id = seller_order_id and so.released and private.owns_store(so.store_id)));
create policy "order_item_fees read" on public.order_item_fees for select to authenticated using (
  public.is_admin() or exists (select 1 from public.order_items i join public.seller_orders so on so.id = i.seller_order_id
    where i.id = order_item_id and so.released and private.owns_store(so.store_id)));
create policy "seller_orders read" on public.seller_orders for select to authenticated using (
  public.is_admin() or (released and private.owns_store(store_id)));
create policy "deliveries read" on public.deliveries for select to authenticated using (private.buys(order_id) or public.is_admin());
create policy "order_secrets read" on public.order_secrets for select to authenticated using (private.buys(order_id) or public.is_admin());

-- Money: merchants see only their own store
create policy "ledger read" on public.ledger_entries for select to authenticated using (public.is_admin() or (store_id is not null and private.owns_store(store_id)));
create policy "payouts read" on public.payouts for select to authenticated using (public.is_admin() or private.owns_store(store_id));
create policy "refunds read" on public.refunds for select to authenticated using (
  public.is_admin() or private.buys(order_id) or (seller_order_id is not null and private.sells(seller_order_id)));
create policy "disputes read" on public.disputes for select to authenticated using (
  public.is_admin() or opened_by = auth.uid() or (seller_order_id is not null and private.sells(seller_order_id)));
grant insert (order_id, seller_order_id, reason) on public.disputes to authenticated;
create policy "disputes open" on public.disputes for insert to authenticated with check (opened_by = auth.uid() and private.buys(order_id) and status = 'open');

create policy "notifications own" on public.notifications for select to authenticated using (user_id = auth.uid() or public.is_admin());
grant update (read_at) on public.notifications to authenticated;
create policy "notifications mark read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "audit admin" on public.audit_log for select to authenticated using (public.is_admin());

-- Settings: merchants may read the hub handover info only
create policy "settings merchant hub" on public.settings for select to authenticated using (id = 'hub' and public.my_role() = 'merchant');

-- Offers: automatic offers are public (through the view); coupon codes never are
create policy "offers public auto" on public.offers for select to anon, authenticated using (code is null and active);
alter view public.auto_offers set (security_invoker = true);

-- Public views (security invoker: they only ever show what the caller's RLS allows) ------------------------------
create view public.public_stores with (security_invoker = true) as
  select id, slug, name, tagline, about, logo_url, cover_url, accent, categories, country, state, city, is_official, created_at from public.stores;
create view public.public_reviews with (security_invoker = true) as
  select id, product_id, rating, body, name, at from public.reviews;
create view public.public_products with (security_invoker = true) as
  select p.id, p.name, p.col, p.price, p.old, p.stock, p.stocks, p.cty, p.code, p.img, p.images, p.descr, p.sizes, p.axes, p.chart,
         p.maker, p.maker_addr, p.origin, p.ships_from, p.sku, p.weight_g, p.dims, p.material, p.at, p.store_id,
         s.name as store_name, s.slug as store_slug, s.logo_url as store_logo
  from public.products p join public.stores s on s.id = p.store_id;
grant select on public.public_stores, public.public_reviews, public.public_products to anon, authenticated;

-- Storage: sellers upload under stores/<store_id>/..., images only, size capped ---------------------------------------
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'] where id = 'media';
create policy "media store insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'stores' and private.owns_store((storage.foldername(name))[2]));
create policy "media store update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'stores' and private.owns_store((storage.foldername(name))[2]));
create policy "media store delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'stores' and private.owns_store((storage.foldername(name))[2]));
create policy "media admin all" on storage.objects for all to authenticated using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());
