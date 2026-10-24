-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
create table public.profiles(id uuid primary key references auth.users on delete cascade,name text,email text,phone text,photo text,country text,role text not null default 'customer',created timestamptz not null default now());
create table public.products(id text primary key default gen_random_uuid()::text,name text not null,col text not null,price numeric not null,old numeric not null default 0,stock integer,cty text[] not null default '{}',code text,img text,descr text,at bigint not null default (extract(epoch from now())*1000)::bigint);
create table public.banners(id text primary key default gen_random_uuid()::text,title text not null,text text,type text,scope text,priority integer not null default 1,starts text,ends text,cty text[] not null default '{}',link text,img text,at bigint not null default (extract(epoch from now())*1000)::bigint);
create table public.orders(id text primary key,user_id uuid not null default auth.uid() references auth.users,items jsonb not null,total numeric not null,country text,pm text,cust jsonb not null,status text not null,at bigint not null);

create function public.my_role() returns text language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select coalesce(public.my_role()='admin',false) $$;

create function public.on_signup() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,email,phone,name,country) values(new.id,new.email,new.phone,new.raw_user_meta_data->>'name',new.raw_user_meta_data->>'country'); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.on_signup();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.banners enable row level security;
alter table public.orders enable row level security;

create policy "profile read" on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy "profile update" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid() and role=public.my_role());
create policy "products read" on public.products for select using (true);
create policy "products admin" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "banners read" on public.banners for select using (true);
create policy "banners admin" on public.banners for all using (public.is_admin()) with check (public.is_admin());
create policy "orders read" on public.orders for select using (user_id=auth.uid() or public.is_admin());
create policy "orders insert" on public.orders for insert with check (user_id=auth.uid());
create policy "orders report paid" on public.orders for update using (user_id=auth.uid() and status='awaiting_transfer') with check (user_id=auth.uid() and status='payment_reported');
create policy "orders admin" on public.orders for update using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets(id,name,public) values('media','media',true) on conflict do nothing;
create policy "media read" on storage.objects for select using (bucket_id='media');
create policy "media admin upload" on storage.objects for insert with check (bucket_id='media' and public.is_admin());

-- After you create your account in the app, make yourself admin:
-- update public.profiles set role='admin' where email='YOU@EXAMPLE.COM';

-- Stage 2.1 additions (already applied to the connected project)
alter table public.profiles add column if not exists dob date, add column if not exists idv text;
create table public.collections(id text primary key default gen_random_uuid()::text,name text not null unique,grp text,icon text,at bigint not null default (extract(epoch from now())*1000)::bigint);
create table public.settings(id text primary key,data jsonb not null default '{}'::jsonb,at bigint not null default (extract(epoch from now())*1000)::bigint);
alter table public.collections enable row level security;
alter table public.settings enable row level security;
create policy "collections read" on public.collections for select using (true);
create policy "collections admin" on public.collections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "settings read" on public.settings for select using (true);
create policy "settings admin" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create function public.email_is_admin(e text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where lower(email)=lower(e) and role='admin') $$;
grant execute on function public.email_is_admin(text) to anon, authenticated;

-- Password mode (default while email codes are not set up)
create or replace function public.email_status(e text) returns text language sql stable security definer set search_path=public as $$ select case when exists(select 1 from public.profiles where lower(email)=lower(e) and role='admin') then 'admin' when exists(select 1 from public.profiles where lower(email)=lower(e)) then 'user' else 'new' end $$;
grant execute on function public.email_status(text) to anon, authenticated;

-- Stage 3: card payments (already applied to the connected project)
alter table public.orders add column if not exists ref text, add column if not exists paid_at bigint;
create table public.cards(id text primary key default gen_random_uuid()::text,user_id uuid not null references auth.users on delete cascade,email text,brand text,last4 text,exp text,bank text,code text not null unique,at bigint not null default (extract(epoch from now())*1000)::bigint);
alter table public.cards enable row level security;
revoke all on public.cards from anon, authenticated;
grant select (id,brand,last4,exp,bank,at), delete on public.cards to authenticated;
create policy "cards own read" on public.cards for select to authenticated using (user_id=auth.uid());
create policy "cards own delete" on public.cards for delete to authenticated using (user_id=auth.uid());
drop policy "orders insert" on public.orders;
create policy "orders insert" on public.orders for insert to authenticated with check (user_id=auth.uid() and status in ('new','awaiting_transfer','sent','awaiting_payment'));

-- Regional pricing: orders remember the currency they were placed in (already applied)
alter table public.orders add column if not exists currency text;

-- Sizes, galleries and reviews (already applied to the connected project)
alter table public.products add column if not exists images text[] not null default '{}', add column if not exists chart text, add column if not exists sizes text[] not null default '{}';
create table public.size_charts(id text primary key default gen_random_uuid()::text,name text not null,cols text[] not null default '{}',rows jsonb not null default '[]'::jsonb,at bigint not null default (extract(epoch from now())*1000)::bigint);
alter table public.size_charts enable row level security;
create policy "charts read" on public.size_charts for select using (true);
create policy "charts admin" on public.size_charts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create table public.reviews(id text primary key default gen_random_uuid()::text,product_id text not null references public.products(id) on delete cascade,user_id uuid not null default auth.uid() references auth.users on delete cascade,order_id text references public.orders(id) on delete set null,rating integer not null check (rating between 1 and 5),body text,name text,at bigint not null default (extract(epoch from now())*1000)::bigint,unique(user_id,product_id));
alter table public.reviews enable row level security;
create policy "reviews read" on public.reviews for select using (true);
create policy "reviews insert" on public.reviews for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.orders o where o.user_id=auth.uid() and o.status='delivered' and o.items @> jsonb_build_array(jsonb_build_object('id',product_id))));
create policy "reviews own update" on public.reviews for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "reviews own delete" on public.reviews for delete to authenticated using (user_id=auth.uid() or public.is_admin());
create view public.product_ratings with (security_invoker=true) as select product_id, round(avg(rating)::numeric,1)::float8 as avg, count(*)::int as n from public.reviews group by product_id;
grant select on public.product_ratings to anon, authenticated;

-- Supplier fulfilment (already applied to the connected project)
alter table public.products add column if not exists supplier text, add column if not exists sup_pid text, add column if not exists sup_cost numeric, add column if not exists variants jsonb not null default '[]'::jsonb, add column if not exists opt text, add column if not exists ship_days text;
create unique index if not exists products_supplier_pid on public.products(supplier, sup_pid) where supplier is not null;
alter table public.orders add column if not exists track jsonb;
create table public.order_costs(order_id text primary key references public.orders(id) on delete cascade, data jsonb not null default '{}'::jsonb);
alter table public.order_costs enable row level security;
create policy "costs admin" on public.order_costs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create table public.kv(key text primary key, value jsonb not null);
alter table public.kv enable row level security;

-- Pricing, offers and server-side orders (already applied to the connected project)
alter table public.products add column if not exists sup_ship numeric;
create table public.offers(id text primary key default gen_random_uuid()::text,name text not null,kind text not null check (kind in ('percent','fixed')),value numeric not null check (value>0),scope text not null default 'all',target text,code text unique,min_total numeric not null default 0,starts text,ends text,limit_uses integer,used integer not null default 0,active boolean not null default true,cty text[] not null default '{}',at bigint not null default (extract(epoch from now())*1000)::bigint);
alter table public.offers enable row level security;
create policy "offers admin" on public.offers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create view public.auto_offers as select id,name,kind,value,scope,target,min_total,starts,ends,cty from public.offers where code is null and active;
grant select on public.auto_offers to anon, authenticated;
create function public.coupon_info(c text) returns jsonb language sql stable security definer set search_path=public as $$ select to_jsonb(o) - 'code' - 'used' - 'at' - 'limit_uses' from public.offers o where lower(o.code)=lower(c) and o.active and (o.limit_uses is null or o.used<o.limit_uses) limit 1 $$;
grant execute on function public.coupon_info(text) to anon, authenticated;
alter table public.orders add column if not exists coupon text, add column if not exists discount numeric not null default 0, add column if not exists offer jsonb;
drop policy if exists "orders insert" on public.orders;
