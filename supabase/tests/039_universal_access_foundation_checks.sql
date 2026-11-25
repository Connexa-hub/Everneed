-- Universal Access B1.0 schema/catalogue/RPC contract checks.
begin;
do $$
declare
  required_roles text[] := array[
    'platform_owner','platform_operations','platform_reviewer','platform_support',
    'platform_finance','platform_analyst','platform_compliance',
    'platform_logistics_supervisor','platform_dispatcher',
    'partner_hub_staff','partner_courier',
    'store_owner','store_manager','store_catalogue','store_fulfilment',
    'store_support','store_finance_viewer','store_viewer','store_pos_cashier'
  ];
  missing text[];
  ctx jsonb;
  test_uid uuid := gen_random_uuid();
begin
  if to_regclass('public.access_permission_catalog') is null
    or to_regclass('public.access_role_catalog') is null
    or to_regclass('public.access_role_permissions') is null
    or to_regclass('public.access_role_assignments') is null then
    raise exception 'FAIL: Universal access tables missing';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.access_permission_catalog'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.access_role_catalog'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.access_role_permissions'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.access_role_assignments'::regclass) then
    raise exception 'FAIL: RLS not enabled on all access tables';
  end if;

  select array_agg(x) into missing from unnest(required_roles) x
    where not exists (select 1 from public.access_role_catalog r where r.role_key=x and r.active);
  if missing is not null then raise exception 'FAIL: missing active role templates: %',missing; end if;

  if not exists(select 1 from public.access_role_permissions where role_key='platform_owner' and permission_key='platform.staff.manage')
    or not exists(select 1 from public.access_role_permissions where role_key='store_owner' and permission_key='store.team.manage')
    or not exists(select 1 from public.access_role_permissions where role_key='platform_dispatcher' and permission_key='logistics.dispatch.assign')
    or not exists(select 1 from public.access_role_permissions where role_key='partner_courier' and permission_key='logistics.delivery.confirm')
    or not exists(select 1 from public.access_role_permissions where role_key='store_pos_cashier' and permission_key='pos.sales.create') then
    raise exception 'FAIL: required explicit role grants missing';
  end if;

  if has_table_privilege('anon','public.access_role_assignments','select')
    or has_table_privilege('authenticated','public.access_role_assignments','select')
    or has_table_privilege('anon','public.access_role_catalog','select')
    or has_table_privilege('authenticated','public.access_role_catalog','select') then
    raise exception 'FAIL: access tables directly exposed to anon/authenticated';
  end if;

  if has_function_privilege('anon','public.my_access()','execute')
    or not has_function_privilege('authenticated','public.my_access()','execute') then
    raise exception 'FAIL: my_access execute ACL is incorrect';
  end if;

  if (select count(*) from public.access_role_assignments) <> 0 then
    raise exception 'FAIL: migration must not auto-assign roles, including legacy admins';
  end if;

  -- Confirm caller-specific introspection returns an empty list for a new identity.
  perform set_config('request.jwt.claim.sub',test_uid::text,true);
  ctx := public.my_access();
  if ctx <> '[]'::jsonb then raise exception 'FAIL: unassigned identity got contexts: %',ctx; end if;

  raise notice 'PASS: universal access catalogue, scope templates, RLS, grants and empty-context introspection';
end $$;
rollback;
