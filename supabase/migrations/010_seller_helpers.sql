-- 010: helper for the seller application screen. Returns the store link the name would get
-- (adds -1, -2 ... when taken), without exposing which stores exist beyond their public slugs.
create or replace function public.next_slug(p_name text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare base text; s text; n int := 0;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  base := private.slugify(left(coalesce(p_name, ''), 80)); s := base;
  while exists (select 1 from public.stores where slug = s) loop n := n + 1; s := base || '-' || n; end loop;
  return s;
end $$;
revoke all on function public.next_slug(text) from public, anon;
grant execute on function public.next_slug(text) to authenticated;
