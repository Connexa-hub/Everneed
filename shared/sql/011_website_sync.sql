-- Website sync: waitlist + site content. NOT auto-run: review, then apply in the Supabase SQL editor (or move to supabase/migrations).
-- Admin check uses text comparison so it works whether profiles.id is uuid or text.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null, name text,
  role text not null default 'shopper' check (role in ('shopper','seller','both')),
  country text, interest text, source text default 'website',
  status text not null default 'new' check (status in ('new','invited','joined','unsubscribed')),
  created_at timestamptz not null default now());
create unique index if not exists waitlist_email_uq on public.waitlist (lower(email));
alter table public.waitlist enable row level security;
drop policy if exists waitlist_admin_all on public.waitlist;
create policy waitlist_admin_all on public.waitlist for all
  using (exists (select 1 from public.profiles p where p.id::text = auth.uid()::text and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id::text = auth.uid()::text and p.role = 'admin'));

create or replace function public.join_waitlist(p_email text, p_name text default null, p_role text default 'shopper',
  p_country text default null, p_interest text default null, p_source text default 'website')
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  insert into public.waitlist(email,name,role,country,interest,source)
  values (lower(p_email), left(p_name,120), case when p_role in ('shopper','seller','both') then p_role else 'shopper' end, left(p_country,2), left(p_interest,200), left(p_source,40))
  on conflict (lower(email)) do nothing;
end $$;
revoke all on function public.join_waitlist(text,text,text,text,text,text) from public;
grant execute on function public.join_waitlist(text,text,text,text,text,text) to anon, authenticated;
