create or replace function public.support_sla_public() returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce((select value->'minutes' from public.support_settings where key='sla'),'{}'::jsonb) $$;
revoke execute on function public.support_sla_public() from public;
grant execute on function public.support_sla_public() to anon, authenticated;
