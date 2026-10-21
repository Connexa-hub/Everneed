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
