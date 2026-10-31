-- 008: hardening from the security advisor.
-- 1. Every private.* function gets a fixed (empty) search_path, so names cannot be hijacked.
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private'
  loop execute format('alter function %s set search_path = ''''', f.sig); end loop;
end $$;

-- 2. Admin-only policies no longer apply to anonymous visitors, so anon cannot (and need not) execute
--    is_admin() / my_role(). Anonymous reads keep working through their public-read policies.
alter policy "products admin" on public.products to authenticated;
alter policy "banners admin" on public.banners to authenticated;
alter policy "orders read" on public.orders to authenticated;
alter policy "orders admin" on public.orders to authenticated;
alter policy "profile read" on public.profiles to authenticated;
alter policy "profile update" on public.profiles to authenticated;
-- Country config stays public; admins already read every settings row through the "settings admin" policy.
drop policy if exists "settings read" on public.settings;
create policy "settings read" on public.settings for select to anon, authenticated using (id in ('NG', 'GH', 'KE', 'ZA', 'GB', 'US'));
revoke execute on function public.is_admin(), public.my_role() from public, anon;
grant execute on function public.is_admin(), public.my_role() to authenticated, service_role;

-- Intentional, not a gap: kv and rate_limits have RLS on and no policies, so only the service role and
-- SECURITY DEFINER functions can touch them.
comment on table public.rate_limits is 'Service-only. RLS enabled with no policies on purpose.';
comment on table public.kv is 'Service-only. RLS enabled with no policies on purpose.';
