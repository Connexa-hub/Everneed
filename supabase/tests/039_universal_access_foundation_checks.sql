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
  denied boolean := false;
  test_uid uuid := gen_random_uuid();
  fixture_store text := gen_random_uuid()::text;
  legacy_admin_uid uuid := gen_random_uuid();
  legacy_admin_email text := 'universal-access-admin-ci-'||gen_random_uuid()||'@example.test';
  email_addr text := 'universal-access-ci-'||gen_random_uuid()||'@example.test';
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

  if (select assignable from public.access_role_catalog where role_key='platform_owner')
    or (select assignable from public.access_role_catalog where role_key='store_owner') then
    raise exception 'FAIL: protected owner templates are assignable';
  end if;

  if not exists(select 1 from public.access_role_permissions where role_key='platform_owner' and permission_key='platform.staff.manage')
    or not exists(select 1 from public.access_role_permissions where role_key='store_owner' and permission_key='store.team.manage')
    or not exists(select 1 from public.access_role_permissions where role_key='platform_dispatcher' and permission_key='logistics.dispatch.assign')
    or not exists(select 1 from public.access_role_permissions where role_key='partner_courier' and permission_key='logistics.delivery.confirm')
    or not exists(select 1 from public.access_role_permissions where role_key='store_pos_cashier' and permission_key='pos.sales.create') then
    raise exception 'FAIL: required explicit role grants missing';
  end if;

  if not has_schema_privilege('anon','private','usage')
    or not has_schema_privilege('authenticated','private','usage')
    or not has_schema_privilege('service_role','private','usage') then
    raise exception 'FAIL: migration removed baseline private schema USAGE grants';
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

  if not exists(select 1 from pg_trigger where tgname='access_role_permissions_scope_guard' and not tgisinternal) then
    raise exception 'FAIL: permission scope guard trigger missing';
  end if;

  -- A platform-scoped dispatcher must not receive a job-scoped permission.
  begin
    insert into public.access_role_permissions(role_key,permission_key)
      values('platform_dispatcher','logistics.jobs.read');
  exception when check_violation then denied:=true;
  end;
  if not denied then raise exception 'FAIL: cross-scope role permission grant was accepted'; end if;

  if (select count(*) from public.access_role_assignments) <> 0 then
    raise exception 'FAIL: migration must not auto-assign roles, including legacy admins';
  end if;

  -- Confirm empty introspection for an unassigned identity.
  perform set_config('request.jwt.claim.sub',test_uid::text,true);
  ctx := public.my_access();
  if ctx <> '[]'::jsonb then raise exception 'FAIL: unassigned identity got contexts: %',ctx; end if;

  -- Transaction fixture proves one user can hold platform + store contexts with explicit scope.
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_super_admin)
    values(test_uid,'authenticated','authenticated',email_addr,'',now(),'{}'::jsonb,'{}'::jsonb,now(),now(),false);
  insert into public.profiles(id,name,email,role) values(test_uid,'Universal Access CI',email_addr,'merchant') on conflict(id) do update set name=excluded.name,email=excluded.email,role=excluded.role;
  insert into public.stores(id,owner_id,slug,name,status,activation_status,country,business_timezone)
    values(fixture_store,test_uid,'ua-ci-'||test_uid,'Universal Access CI Store','approved','live','NG','Africa/Lagos');
  insert into public.access_role_assignments(user_id,role_key,plane,scope_type,scope_id,reason)
    values(test_uid,'platform_dispatcher','platform','platform',null,'transactional SQL test fixture');

  ctx := public.my_access();
  if jsonb_array_length(ctx) <> 2 then
    raise exception 'FAIL: expected separate platform and store contexts, got %',ctx;
  end if;
  if not (ctx @> jsonb_build_array(jsonb_build_object(
    'plane','platform','scope_type','platform','scope_id',null,
    'role','platform_dispatcher','permissions',jsonb_build_array('logistics.dispatch.assign','logistics.dispatch.read','logistics.route.plan')))) then
    raise exception 'FAIL: platform dispatcher context/permissions missing or wrong scope: %',ctx;
  end if;
  if not (ctx @> jsonb_build_array(jsonb_build_object(
    'plane','store','scope_type','store','scope_id',fixture_store,
    'role','store_owner','source','legacy_owner'))) then
    raise exception 'FAIL: legacy store-owner context missing: %',ctx;
  end if;

  -- Legacy admin remains a compatibility context only, never auto-promoted to owner or permissions.
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_super_admin)
    values(legacy_admin_uid,'authenticated','authenticated',legacy_admin_email,'',now(),'{}'::jsonb,'{}'::jsonb,now(),now(),false);
  insert into public.profiles(id,name,email,role) values(legacy_admin_uid,'Legacy Admin CI',legacy_admin_email,'admin') on conflict(id) do update set name=excluded.name,email=excluded.email,role=excluded.role;
  perform set_config('request.jwt.claim.sub',legacy_admin_uid::text,true);
  ctx := public.my_access();
  if jsonb_array_length(ctx) <> 1
    or not (ctx @> jsonb_build_array(jsonb_build_object(
      'plane','platform','role','legacy_admin','source','legacy_profile','compatibility',true,'permissions',jsonb_build_array()))) then
    raise exception 'FAIL: legacy admin compatibility must be a permission-empty context: %',ctx;
  end if;

  raise notice 'PASS: universal access catalogue, scope templates, RLS, grants and empty-context introspection';
end $$;
rollback;
