-- Preserve the caller's JWT role when products_guard runs as SECURITY DEFINER.
-- current_user becomes the function owner inside a definer trigger, so it cannot
-- be used to decide whether the original API caller is privileged.
begin;

create or replace function private.is_privileged()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.role(), current_user) not in ('authenticated', 'anon')
    or coalesce(public.is_admin(), false)
$$;

grant execute on function private.is_privileged() to anon, authenticated, service_role;

commit;
