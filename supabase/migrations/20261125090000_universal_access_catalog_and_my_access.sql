-- Everneed Universal Access B1.0
-- Permission catalogue, fixed role templates, scoped assignments and read-only my_access().
-- Staging-first. This migration does NOT auto-promote legacy admins or assign platform owners.
-- Role introspection is not authorization; protected RPC/RLS enforcement is a later phase.

create table if not exists public.access_permission_catalog (
  permission_key text primary key,
  domain text not null,
  scope_type text not null check (scope_type in ('platform','store','partner','hub','zone','branch','terminal','job')),
  description text not null,
  sensitivity text not null default 'normal' check (sensitivity in ('normal','sensitive','critical')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.access_role_catalog (
  role_key text primary key,
  plane text not null check (plane in ('platform','store','partner')),
  scope_type text not null check (scope_type in ('platform','store','partner','hub','zone','branch','terminal','job')),
  display_name text not null,
  description text not null,
  system_role boolean not null default true,
  assignable boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (role_key, plane),
  unique (role_key, plane, scope_type),
  check (
    (plane = 'platform' and scope_type = 'platform')
    or (plane = 'store' and scope_type in ('store','branch','terminal'))
    or (plane = 'partner' and scope_type in ('partner','hub','zone','branch','terminal','job'))
  )
);

create table if not exists public.access_role_permissions (
  role_key text not null references public.access_role_catalog(role_key) on delete cascade,
  permission_key text not null references public.access_permission_catalog(permission_key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

-- Prevent cross-plane or scope-incompatible permission bundles from being seeded.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.access_role_permission_scope_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_role_scope text;
  v_permission_scope text;
begin
  select scope_type into v_role_scope
  from public.access_role_catalog
  where role_key=new.role_key;

  select scope_type into v_permission_scope
  from public.access_permission_catalog
  where permission_key=new.permission_key;

  if v_role_scope is null or v_permission_scope is null then
    raise exception 'ACCESS_ROLE_PERMISSION_INVALID' using errcode='23503';
  end if;

  if v_role_scope <> v_permission_scope
     and not (v_role_scope='branch' and v_permission_scope='store') then
    raise exception 'ACCESS_ROLE_PERMISSION_SCOPE_MISMATCH' using errcode='23514';
  end if;
  return new;
end;
$function$;

revoke all on function private.access_role_permission_scope_guard() from public, anon, authenticated;

create table if not exists public.access_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null,
  plane text not null check (plane in ('platform','store','partner')),
  scope_type text not null check (scope_type in ('platform','store','partner','hub','zone','branch','terminal','job')),
  scope_id text,
  granted_by uuid references auth.users(id) on delete set null,
  reason text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((scope_type = 'platform' and scope_id is null) or (scope_type <> 'platform' and scope_id is not null)),
  check (expires_at is null or expires_at > starts_at),
  check (
    (plane = 'platform' and scope_type = 'platform')
    or (plane = 'store' and scope_type in ('store','branch','terminal'))
    or (plane = 'partner' and scope_type in ('partner','hub','zone','branch','terminal','job'))
  ),
  foreign key (role_key,plane,scope_type) references public.access_role_catalog(role_key,plane,scope_type) on delete restrict
);

create index if not exists access_role_assignments_user_active_idx
  on public.access_role_assignments(user_id, plane, scope_type, scope_id)
  where revoked_at is null;
create index if not exists access_role_assignments_scope_active_idx
  on public.access_role_assignments(scope_type, scope_id, role_key)
  where revoked_at is null;

-- Access catalogues are backend-managed. No client CRUD/read access in this phase.
alter table public.access_permission_catalog enable row level security;
alter table public.access_role_catalog enable row level security;
alter table public.access_role_permissions enable row level security;
alter table public.access_role_assignments enable row level security;
revoke all on public.access_permission_catalog, public.access_role_catalog,
  public.access_role_permissions, public.access_role_assignments from public, anon, authenticated;

insert into public.access_permission_catalog(permission_key,domain,scope_type,description,sensitivity) values
('platform.users.read','platform','platform','Read platform user profiles','sensitive'),
('platform.staff.invite','platform','platform','Invite platform staff','critical'),
('platform.staff.manage','platform','platform','Manage platform staff roles and access','critical'),
('platform.settings.manage','platform','platform','Manage platform settings','critical'),
('platform.sellers.read','platform','platform','Read seller accounts and stores','sensitive'),
('platform.sellers.review','platform','platform','Review seller onboarding and verification','sensitive'),
('platform.products.review','platform','platform','Moderate marketplace products','sensitive'),
('platform.orders.read','platform','platform','Read platform order operations','sensitive'),
('platform.orders.intervene','platform','platform','Perform approved order intervention','critical'),
('platform.disputes.manage','platform','platform','Manage platform disputes','sensitive'),
('platform.inbox.reply','platform','platform','Reply in platform support inbox','sensitive'),
('platform.finance.read','platform','platform','Read finance and reconciliation','critical'),
('platform.payouts.approve','platform','platform','Approve eligible payouts','critical'),
('platform.refunds.approve','platform','platform','Approve eligible refunds','critical'),
('platform.plans.read','platform','platform','Read plan configuration','normal'),
('platform.audit.read','platform','platform','Read security and audit events','critical'),
('platform.analytics.read','platform','platform','Read platform analytics','sensitive'),
('platform.compliance.review','platform','platform','Review compliance cases','sensitive'),
('platform.hubs.read','platform','platform','Read platform hub operations','sensitive'),
('logistics.dispatch.read','partner','platform','Read dispatch queues within assigned scope','sensitive'),
('logistics.dispatch.assign','partner','platform','Assign dispatch jobs within assigned scope','critical'),
('logistics.route.plan','partner','platform','Plan routes within assigned scope','sensitive'),
('logistics.jobs.read','partner','job','Read assigned delivery jobs','sensitive'),
('logistics.jobs.accept','partner','job','Accept or decline assigned jobs','sensitive'),
('logistics.location.share','partner','job','Share location while on assigned duty','sensitive'),
('logistics.delivery.confirm','partner','job','Confirm delivery on assigned job','critical'),
('logistics.pod.capture','partner','job','Capture proof of delivery','sensitive'),
('logistics.exception.report','partner','job','Report delivery exceptions','sensitive'),
('logistics.hub.read','partner','hub','Read hub operations','sensitive'),
('logistics.custody.scan','partner','hub','Record parcel custody scans','critical'),
('logistics.consolidate','partner','hub','Consolidate parcels at authorized hub','critical'),
('logistics.zone.manage','partner','platform','Manage zones in assigned scope','sensitive'),
('store.catalogue.read','store','store','Read store catalogue','normal'),
('store.catalogue.write','store','store','Create and edit catalogue items','sensitive'),
('store.catalogue.publish','store','store','Publish and unpublish catalogue items','sensitive'),
('store.inventory.read','store','store','Read store inventory','normal'),
('store.inventory.write','store','store','Adjust inventory through approved flows','critical'),
('store.orders.read','store','store','Read store orders','sensitive'),
('store.orders.transition','store','store','Advance store order workflow','critical'),
('store.inbox.reply','store','store','Reply to store customers','sensitive'),
('store.finance.read','store','store','Read store financial summaries','critical'),
('store.finance.payout','store','store','Request eligible store payouts','critical'),
('store.settings.write','store','store','Manage store settings','sensitive'),
('store.discounts.write','store','store','Manage store discounts','sensitive'),
('store.team.manage','store','store','Invite and manage store team','critical'),
('store.analytics.read','store','store','Read store analytics','sensitive'),
('pos.sessions.open','store','terminal','Open or close a POS session','sensitive'),
('pos.sales.create','store','terminal','Create POS sales','critical'),
('pos.refunds.request','store','terminal','Request POS refund','critical'),
('pos.refunds.approve','store','terminal','Approve POS refund subject to separation of duties','critical'),
('support.cases.read','platform','platform','Read assigned support cases','sensitive'),
('support.cases.assign','platform','platform','Assign support cases','sensitive'),
('support.cases.reply','platform','platform','Reply to support cases','sensitive'),
('support.cases.resolve','platform','platform','Resolve support cases','sensitive')
on conflict(permission_key) do update set
  domain=excluded.domain, scope_type=excluded.scope_type, description=excluded.description,
  sensitivity=excluded.sensitivity, active=true;

insert into public.access_role_catalog(role_key,plane,scope_type,display_name,description) values
('platform_owner','platform','platform','Platform Owner','Verified owner; full platform authority'),
('platform_operations','platform','platform','Operations','Day-to-day marketplace operations'),
('platform_reviewer','platform','platform','Marketplace Reviewer','Seller and product review'),
('platform_support','platform','platform','Support','Scoped customer/seller support'),
('platform_finance','platform','platform','Finance','Finance and payout controls'),
('platform_analyst','platform','platform','Analyst','Read-only analytics'),
('platform_compliance','platform','platform','Compliance','Verification and compliance review'),
('platform_logistics_supervisor','platform','platform','Logistics Supervisor','Platform logistics oversight'),
('platform_dispatcher','platform','platform','Dispatcher','Dispatch assignment and route planning'),
('partner_hub_staff','partner','hub','Hub Staff','Hub receiving, custody and consolidation'),
('partner_courier','partner','job','Courier','Assigned delivery execution'),
('store_owner','store','store','Store Owner','Store authority within this store only'),
('store_manager','store','store','Store Manager','Store operations excluding sensitive money/team control'),
('store_catalogue','store','store','Catalogue Editor','Catalogue and inventory'),
('store_fulfilment','store','store','Fulfilment','Store order workflow and handover'),
('store_support','store','store','Store Support','Store customer messaging'),
('store_finance_viewer','store','store','Store Finance Viewer','Read-only store financial information'),
('store_viewer','store','store','Store Viewer','Read-only store context'),
('store_pos_cashier','store','terminal','POS Cashier','POS sales in assigned terminal')
on conflict(role_key) do update set plane=excluded.plane,scope_type=excluded.scope_type,
  display_name=excluded.display_name,description=excluded.description,active=true;

-- Ownership templates are protected: ownership changes use a dedicated audited workflow.
update public.access_role_catalog set assignable=false where role_key in ('platform_owner','store_owner');

-- Explicit role bundles. No wildcard permission grants.
insert into public.access_role_permissions(role_key,permission_key)
select 'platform_owner', permission_key from public.access_permission_catalog
where scope_type='platform'
on conflict do nothing;

insert into public.access_role_permissions(role_key,permission_key) values
('platform_operations','platform.sellers.read'),
('platform_operations','platform.orders.read'),
('platform_operations','platform.orders.intervene'),
('platform_operations','platform.disputes.manage'),
('platform_operations','platform.analytics.read'),
('platform_reviewer','platform.sellers.read'),
('platform_reviewer','platform.sellers.review'),
('platform_reviewer','platform.products.review'),
('platform_reviewer','platform.compliance.review'),
('platform_support','platform.sellers.read'),
('platform_support','platform.orders.read'),
('platform_support','platform.inbox.reply'),
('platform_support','support.cases.read'),
('platform_support','support.cases.assign'),
('platform_support','support.cases.reply'),
('platform_support','support.cases.resolve'),
('platform_finance','platform.finance.read'),
('platform_finance','platform.payouts.approve'),
('platform_finance','platform.refunds.approve'),
('platform_finance','platform.audit.read'),
('platform_analyst','platform.analytics.read'),
('platform_analyst','platform.sellers.read'),
('platform_analyst','platform.orders.read'),
('platform_analyst','platform.plans.read'),
('platform_compliance','platform.sellers.read'),
('platform_compliance','platform.compliance.review'),
('platform_compliance','platform.audit.read'),
('platform_logistics_supervisor','logistics.dispatch.read'),
('platform_logistics_supervisor','logistics.dispatch.assign'),
('platform_logistics_supervisor','logistics.route.plan'),
('platform_logistics_supervisor','platform.hubs.read'),
('platform_logistics_supervisor','logistics.zone.manage'),
('platform_dispatcher','logistics.dispatch.read'),
('platform_dispatcher','logistics.dispatch.assign'),
('platform_dispatcher','logistics.route.plan'),
('partner_hub_staff','logistics.hub.read'),
('partner_hub_staff','logistics.custody.scan'),
('partner_hub_staff','logistics.consolidate'),
('partner_courier','logistics.jobs.read'),
('partner_courier','logistics.jobs.accept'),
('partner_courier','logistics.location.share'),
('partner_courier','logistics.delivery.confirm'),
('partner_courier','logistics.pod.capture'),
('partner_courier','logistics.exception.report'),
('store_owner','store.catalogue.read'),
('store_owner','store.catalogue.write'),
('store_owner','store.catalogue.publish'),
('store_owner','store.inventory.read'),
('store_owner','store.inventory.write'),
('store_owner','store.orders.read'),
('store_owner','store.orders.transition'),
('store_owner','store.inbox.reply'),
('store_owner','store.finance.read'),
('store_owner','store.finance.payout'),
('store_owner','store.settings.write'),
('store_owner','store.discounts.write'),
('store_owner','store.team.manage'),
('store_owner','store.analytics.read'),
('store_manager','store.catalogue.read'),
('store_manager','store.catalogue.write'),
('store_manager','store.catalogue.publish'),
('store_manager','store.inventory.read'),
('store_manager','store.inventory.write'),
('store_manager','store.orders.read'),
('store_manager','store.orders.transition'),
('store_manager','store.inbox.reply'),
('store_manager','store.settings.write'),
('store_manager','store.discounts.write'),
('store_manager','store.analytics.read'),
('store_catalogue','store.catalogue.read'),
('store_catalogue','store.catalogue.write'),
('store_catalogue','store.catalogue.publish'),
('store_catalogue','store.inventory.read'),
('store_catalogue','store.inventory.write'),
('store_fulfilment','store.orders.read'),
('store_fulfilment','store.orders.transition'),
('store_support','store.orders.read'),
('store_support','store.inbox.reply'),
('store_finance_viewer','store.finance.read'),
('store_viewer','store.catalogue.read'),
('store_viewer','store.inventory.read'),
('store_viewer','store.orders.read'),
('store_viewer','store.finance.read'),
('store_pos_cashier','pos.sessions.open'),
('store_pos_cashier','pos.sales.create')
on conflict do nothing;

create trigger access_role_permissions_scope_guard
before insert or update on public.access_role_permissions
for each row execute function private.access_role_permission_scope_guard();

create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with caller as (
    select auth.uid() as user_id
  ),
  assigned_contexts as (
    select
      a.plane,
      a.scope_type,
      a.scope_id,
      r.role_key,
      r.display_name,
      coalesce(array_agg(rp.permission_key order by rp.permission_key)
        filter (where rp.permission_key is not null and pc.permission_key is not null), array[]::text[]) as permissions,
      'assignment'::text as source,
      case when a.scope_type='store' then s.name else null end as scope_name,
      case when a.scope_type='store' then s.is_official else false end as official
    from public.access_role_assignments a
    join caller c on c.user_id=a.user_id
    join public.access_role_catalog r on r.role_key=a.role_key and r.plane=a.plane and r.active
    left join public.access_role_permissions rp on rp.role_key=r.role_key
    left join public.access_permission_catalog pc on pc.permission_key=rp.permission_key and pc.active
    left join public.stores s on a.scope_type='store' and s.id=a.scope_id
    where a.revoked_at is null
      and a.starts_at <= now()
      and (a.expires_at is null or a.expires_at > now())
      and (a.scope_type <> 'store' or s.id is not null)
    group by a.plane,a.scope_type,a.scope_id,r.role_key,r.display_name,s.name,s.is_official
  ),
  legacy_store_owners as (
    select
      'store'::text as plane,
      'store'::text as scope_type,
      s.id as scope_id,
      'store_owner'::text as role_key,
      'Store Owner'::text as display_name,
      coalesce(array_agg(rp.permission_key order by rp.permission_key)
        filter (where rp.permission_key is not null and pc.permission_key is not null), array[]::text[]) as permissions,
      'legacy_owner'::text as source,
      s.name as scope_name,
      s.is_official as official
    from public.stores s
    join caller c on c.user_id=s.owner_id
    join public.access_role_catalog r on r.role_key='store_owner' and r.active
    left join public.access_role_permissions rp on rp.role_key=r.role_key
    left join public.access_permission_catalog pc on pc.permission_key=rp.permission_key and pc.active
    group by s.id,s.name,s.is_official
  ),
  contexts as (
    select * from assigned_contexts
    union all
    select * from legacy_store_owners
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'plane',plane,
    'scope_type',scope_type,
    'scope_id',scope_id,
    'scope_name',scope_name,
    'role',role_key,
    'display_name',display_name,
    'permissions',permissions,
    'source',source,
    'official',official
  ) order by plane,scope_type,scope_id,role_key),'[]'::jsonb)
  from contexts
  where (select user_id from caller) is not null;
$function$;

revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

comment on function public.my_access() is
  'Read-only caller context/permission introspection. Not an authorization substitute; protected operations must re-check live scope and resource permissions. Legacy store-owner contexts are derived from stores.owner_id. Legacy profile admins are not auto-promoted.';
