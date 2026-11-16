-- 034: seller onboarding, plan entitlements, and admin-configurable catalogue quotas.
-- Staging-first. Does not alter production. Free plan remains inactive until an admin configures both limits.
begin;

-- Payout destination is a separate payout-eligibility step, not a prerequisite for applying as a seller.
create or replace function public.submit_store(p_store text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare a record; s record; missing_policies text[];
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('submit_store',5,600);
  select * into s from public.stores where id=p_store and owner_id=auth.uid() for update;
  if not found then raise exception 'That is not your store.'; end if;
  if s.status not in ('draft','rejected') then raise exception 'This store has already been submitted.'; end if;
  select * into a from public.store_applications where store_id=p_store;
  if not found or coalesce(a.business_name,'')='' then
    raise exception 'Complete your business details first.';
  end if;
  select array_agg(req.policy_type order by req.policy_type) into missing_policies
  from (values ('seller_terms'),('seller_privacy'),('marketplace_rules'),('returns_refunds')) req(policy_type)
  where not exists (
    select 1 from public.policy_documents current_doc
    join public.policy_acceptances pa
      on pa.policy_document_id=current_doc.id and pa.user_id=auth.uid() and pa.country=s.country
    where current_doc.id=(
      select d.id from public.policy_documents d
      where d.policy_type=req.policy_type and d.country=s.country and d.locale='en'
        and d.published and d.requires_acceptance and d.effective_at<=now()
      order by d.effective_at desc,d.version desc limit 1
    )
  );
  if coalesce(cardinality(missing_policies),0)>0 then
    raise exception 'Review and accept the latest seller policies for your region before submitting: %.',array_to_string(missing_policies,', ');
  end if;
  update public.stores set status='pending',activation_status='verification_required' where id=p_store;
  update public.store_applications set submitted_at=now(),decision=null,reason=null,reviewed_by=null,reviewed_at=null where store_id=p_store;
  perform private.notify_admins('store_submitted','A store is waiting for approval',s.name,jsonb_build_object('store_id',p_store));
end $$;
revoke execute on function public.submit_store(text) from public, anon;
grant execute on function public.submit_store(text) to authenticated;

-- Verification classification is explicit. Existing rules remain unclassified and continue to block
-- activation until an authorised admin classifies them; this migration does not waive existing checks.
alter table public.seller_verification_rules
  add column if not exists requirement_scope text not null default 'unclassified'
  check (requirement_scope in ('unclassified','mandatory_compliance','commercial'));

-- Explicit entitlement representation; NULL + false means not configured, never unlimited.
create table if not exists public.seller_plan_entitlements (
  plan_id text primary key references public.store_plans(id) on delete cascade,
  active_product_limit integer check (active_product_limit is null or active_product_limit > 0),
  active_products_unlimited boolean not null default false,
  daily_new_product_limit integer check (daily_new_product_limit is null or daily_new_product_limit > 0),
  daily_new_products_unlimited boolean not null default false,
  verification_included boolean not null default false,
  verification_required_to_activate boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  constraint active_limit_mode check (not (active_products_unlimited and active_product_limit is not null)),
  constraint daily_limit_mode check (not (daily_new_products_unlimited and daily_new_product_limit is not null))
);
alter table public.seller_plan_entitlements enable row level security;
revoke all on public.seller_plan_entitlements from anon, authenticated;
grant select on public.seller_plan_entitlements to authenticated;
create policy seller_plan_entitlements_admin_read on public.seller_plan_entitlements
  for select to authenticated using (public.is_admin());
grant all on public.seller_plan_entitlements to service_role;

-- Free exists as an inactive plan shell. It cannot be selected until both catalogue limits are configured.
insert into public.store_plans(id,name,price,period,product_limit,commission_discount,features,active)
values ('plan-free','Free',0,'monthly',null,0,
  '["Seller storefront","Basic seller workspace"]'::jsonb,false)
on conflict (id) do nothing;

insert into public.seller_plan_entitlements
  (plan_id,active_product_limit,active_products_unlimited,daily_new_product_limit,daily_new_products_unlimited,
   verification_included,verification_required_to_activate)
select p.id,
       case when p.id='plan-pro' then null else p.product_limit end,
       p.id='plan-pro',
       null,true,
       p.id in ('plan-growth','plan-pro'),
       p.id in ('plan-growth','plan-pro')
from public.store_plans p
where p.id in ('plan-starter','plan-growth','plan-pro')
on conflict (plan_id) do nothing;

insert into public.seller_plan_entitlements(plan_id)
values ('plan-free') on conflict (plan_id) do nothing;

-- Record successful product creation durably; deleting a product cannot reset a daily quota.
alter table public.stores add column if not exists business_timezone text not null default 'UTC';
update public.stores set business_timezone='Africa/Lagos' where country='NG' and business_timezone='UTC';

create table if not exists public.seller_product_listing_events (
  id bigint generated always as identity primary key,
  store_id text not null references public.stores(id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  unique(store_id,product_id)
);
create index if not exists seller_product_listing_events_daily_idx
  on public.seller_product_listing_events(store_id,created_at);
alter table public.seller_product_listing_events enable row level security;
revoke all on public.seller_product_listing_events from anon, authenticated;
grant all on public.seller_product_listing_events to service_role;

-- Admin-only, audited plan configuration. Free is activated only when both limits are explicit.
create or replace function public.admin_set_plan_entitlements(
  p_plan_id text,
  p_active_product_limit integer,
  p_active_products_unlimited boolean,
  p_daily_new_product_limit integer,
  p_daily_new_products_unlimited boolean,
  p_verification_included boolean,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare old_row public.seller_plan_entitlements%rowtype; v_before jsonb; v_after jsonb;
begin
  perform private.need_admin();
  if nullif(btrim(p_reason),'') is null then raise exception 'A reason is required.'; end if;
  if (p_active_products_unlimited and p_active_product_limit is not null)
     or (not p_active_products_unlimited and (p_active_product_limit is null or p_active_product_limit < 1)) then
    raise exception 'Choose a positive active-product limit or explicitly select unlimited.';
  end if;
  if (p_daily_new_products_unlimited and p_daily_new_product_limit is not null)
     or (not p_daily_new_products_unlimited and (p_daily_new_product_limit is null or p_daily_new_product_limit < 1)) then
    raise exception 'Choose a positive daily listing limit or explicitly select unlimited.';
  end if;
  select * into old_row from public.seller_plan_entitlements where plan_id=p_plan_id for update;
  if not found then raise exception 'Plan entitlement record not found.'; end if;
  v_before := to_jsonb(old_row);
  update public.seller_plan_entitlements set
    active_product_limit=p_active_product_limit,
    active_products_unlimited=p_active_products_unlimited,
    daily_new_product_limit=p_daily_new_product_limit,
    daily_new_products_unlimited=p_daily_new_products_unlimited,
    verification_included=p_verification_included,
    verification_required_to_activate=p_verification_included,
    updated_at=now(),updated_by=auth.uid()
  where plan_id=p_plan_id;
  update public.store_plans set product_limit=case when p_active_products_unlimited then null else p_active_product_limit end,
    active=case when p_plan_id='plan-free' then true else active end
  where id=p_plan_id;
  select to_jsonb(e) into v_after from public.seller_plan_entitlements e where e.plan_id=p_plan_id;
  perform private.audit(auth.uid(),'seller_plan_entitlements_updated','seller_plan',p_plan_id,
    v_before,v_after || jsonb_build_object('reason',left(p_reason,500)));
end $$;
revoke all on function public.admin_set_plan_entitlements(text,integer,boolean,integer,boolean,boolean,text) from public,anon;
grant execute on function public.admin_set_plan_entitlements(text,integer,boolean,integer,boolean,boolean,text) to authenticated;

-- Admin-only classification prevents the old generic "required" flag from being mistaken for law.
create or replace function public.admin_set_verification_scope(
  p_country text,p_check_type text,p_scope text,p_reason text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare old_scope text;
begin
  perform private.need_admin();
  if p_scope not in ('mandatory_compliance','commercial','unclassified') then
    raise exception 'Invalid verification requirement scope.';
  end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'A reason is required.'; end if;
  select requirement_scope into old_scope from public.seller_verification_rules
    where country=upper(p_country) and check_type=p_check_type for update;
  if not found then raise exception 'Verification rule not found.'; end if;
  update public.seller_verification_rules set requirement_scope=p_scope,updated_at=now()
    where country=upper(p_country) and check_type=p_check_type;
  perform private.audit(auth.uid(),'seller_verification_scope_updated','verification_rule',
    upper(p_country)||':'||p_check_type,
    jsonb_build_object('requirement_scope',old_scope),
    jsonb_build_object('requirement_scope',p_scope,'reason',left(p_reason,500)));
end $$;
revoke all on function public.admin_set_verification_scope(text,text,text,text) from public,anon;
grant execute on function public.admin_set_verification_scope(text,text,text,text) to authenticated;

-- Effective verification: unclassified rules fail closed; mandatory compliance always applies;
-- commercial verification applies only when the selected plan includes/requires it.
create or replace function private.store_verification_complete(p_store text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
    join public.store_subscriptions ss on ss.store_id=s.id
    join public.seller_plan_entitlements e on e.plan_id=ss.plan_id
    where s.id=p_store
      and exists (select 1 from public.seller_verification_rules r where r.country=s.country and r.enabled)
      and not exists (
        select 1 from public.seller_verification_rules r
        where r.country=s.country and r.enabled and r.required
          and (r.requirement_scope in ('mandatory_compliance','unclassified')
            or (r.requirement_scope='commercial' and e.verification_required_to_activate))
          and not exists (
            select 1 from public.store_verification_checks c
            where c.store_id=s.id and c.check_type=r.check_type
              and c.status='verified' and (c.expires_at is null or c.expires_at>now())
          )
      )
  )
$$;
revoke execute on function private.store_verification_complete(text) from public,anon,authenticated;
grant execute on function private.store_verification_complete(text) to service_role;

create or replace function private.store_live(p_store text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
    join public.store_subscriptions ss on ss.store_id=s.id
    join public.seller_plan_entitlements e on e.plan_id=ss.plan_id
    where s.id=p_store and s.status='approved'
      and (s.is_official or (
        s.activation_status='live'
        and private.store_verification_complete(s.id)
        and ((ss.status in ('trialing','active') and ss.current_period_end>now())
          or (ss.status='past_due' and ss.grace_until>now()))
      ))
  )
$$;
revoke execute on function private.store_live(text) from public;
grant execute on function private.store_live(text) to anon,authenticated,service_role;

create or replace function public.request_store_activation(p_store text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare s record; sub record; ent record; missing text[]; has_rules boolean;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('request_store_activation',5,300);
  select * into s from public.stores where id=p_store and owner_id=auth.uid() for update;
  if not found then raise exception 'That is not your store.'; end if;
  if s.status <> 'approved' or not exists(select 1 from public.store_applications a where a.store_id=p_store and a.decision='approved') then
    return jsonb_build_object('activated',false,'reason_code','APPLICATION_NOT_APPROVED');
  end if;
  if s.activation_status='suspended' then
    return jsonb_build_object('activated',false,'reason_code','STORE_SUSPENDED');
  end if;
  select * into sub from public.store_subscriptions where store_id=p_store;
  if not found or sub.plan_id is null then
    return jsonb_build_object('activated',false,'reason_code','PLAN_NOT_SELECTED');
  end if;
  select * into ent from public.seller_plan_entitlements where plan_id=sub.plan_id;
  if not found or (not ent.active_products_unlimited and ent.active_product_limit is null)
     or (not ent.daily_new_products_unlimited and ent.daily_new_product_limit is null) then
    return jsonb_build_object('activated',false,'reason_code','PLAN_NOT_CONFIGURED');
  end if;
  if not ((sub.status in ('trialing','active') and sub.current_period_end>now())
      or (sub.status='past_due' and sub.grace_until>now())) then
    return jsonb_build_object('activated',false,'reason_code','SUBSCRIPTION_INACTIVE');
  end if;
  select exists(select 1 from public.seller_verification_rules r where r.country=s.country and r.enabled) into has_rules;
  if not has_rules then
    return jsonb_build_object('activated',false,'reason_code','REGIONAL_VERIFICATION_NOT_CONFIGURED');
  end if;
  select array_agg(r.check_type order by r.check_type) into missing
  from public.seller_verification_rules r
  where r.country=s.country and r.enabled and r.required
    and (r.requirement_scope in ('mandatory_compliance','unclassified')
      or (r.requirement_scope='commercial' and ent.verification_required_to_activate))
    and not exists(select 1 from public.store_verification_checks c where c.store_id=p_store
      and c.check_type=r.check_type and c.status='verified' and (c.expires_at is null or c.expires_at>now()));
  if coalesce(cardinality(missing),0)>0 then
    update public.stores set activation_status='verification_required' where id=p_store;
    perform private.queue_seller_verification_reminders(p_store,missing);
    return jsonb_build_object('activated',false,'missing_checks',to_jsonb(missing),
      'reason_code',case when exists(select 1 from public.seller_verification_rules r
        where r.country=s.country and r.check_type=any(missing) and r.requirement_scope='mandatory_compliance')
        then 'MANDATORY_COMPLIANCE_MISSING' else 'PLAN_VERIFICATION_REQUIRED' end,
      'activation_status','verification_required');
  end if;
  update public.stores set activation_status='live' where id=p_store;
  perform private.audit(auth.uid(),'store_activated','store',p_store,
    jsonb_build_object('activation_status',s.activation_status),
    jsonb_build_object('activation_status','live','plan_id',sub.plan_id));
  return jsonb_build_object('activated',true,'missing_checks','[]'::jsonb,'activation_status','live');
end $$;
revoke execute on function public.request_store_activation(text) from public,anon;
grant execute on function public.request_store_activation(text) to authenticated;

-- Seller-facing effective entitlement snapshot; no client-supplied plan/limit values are trusted.
create or replace function public.my_store_entitlements()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare s record; sub record; e record; active_used integer; daily_used integer; day_start timestamptz;
begin
  select * into s from public.stores where owner_id=auth.uid() order by created_at desc limit 1;
  if not found then return jsonb_build_object('configured',false,'reason_code','STORE_NOT_FOUND'); end if;
  select * into sub from public.store_subscriptions where store_id=s.id;
  if not found or sub.plan_id is null then return jsonb_build_object('configured',false,'reason_code','PLAN_NOT_SELECTED'); end if;
  select * into e from public.seller_plan_entitlements where plan_id=sub.plan_id;
  if not found then return jsonb_build_object('configured',false,'reason_code','PLAN_NOT_CONFIGURED'); end if;
  select count(*) into active_used from public.products where store_id=s.id and status<>'archived';
  day_start := date_trunc('day',now() at time zone s.business_timezone) at time zone s.business_timezone;
  select count(*) into daily_used from public.seller_product_listing_events
    where store_id=s.id and created_at>=day_start and created_at<day_start+interval '1 day';
  return jsonb_build_object(
    'configured',((e.active_products_unlimited or e.active_product_limit is not null)
      and (e.daily_new_products_unlimited or e.daily_new_product_limit is not null)),
    'plan_id',sub.plan_id,
    'plan_name',(select name from public.store_plans where id=sub.plan_id),
    'active_products',active_used,
    'active_product_limit',e.active_product_limit,
    'active_products_unlimited',e.active_products_unlimited,
    'daily_new_products_used',daily_used,
    'daily_new_product_limit',e.daily_new_product_limit,
    'daily_new_products_unlimited',e.daily_new_products_unlimited,
    'verification_included',e.verification_included,
    'verification_required_to_activate',e.verification_required_to_activate,
    'business_timezone',s.business_timezone
  );
end $$;
revoke all on function public.my_store_entitlements() from public,anon;
grant execute on function public.my_store_entitlements() to authenticated;

-- Replace the product guard to enforce both limits at the database boundary.
create or replace function private.products_guard()
returns trigger language plpgsql set search_path = ''
as $$
declare st text; trusted boolean; ent record; used integer; daily_used integer; day_start timestamptz; tz text;
begin
  if new.store_id is null then new.store_id := (select id from public.stores where is_official limit 1); end if;
  if private.is_privileged() then return new; end if;
  select status,business_timezone into st,tz from public.stores where id=new.store_id for update;
  if not found then raise exception 'Store not found.'; end if;
  select e.* into ent from public.store_subscriptions ss
    join public.seller_plan_entitlements e on e.plan_id=ss.plan_id
    where ss.store_id=new.store_id;
  if not found then raise exception 'Your seller plan is not configured yet.'; end if;
  if not ent.active_products_unlimited and ent.active_product_limit is null then
    raise exception 'Your active-product limit has not been configured yet.';
  end if;
  if not ent.daily_new_products_unlimited and ent.daily_new_product_limit is null then
    raise exception 'Your daily listing limit has not been configured yet.';
  end if;
  if tg_op='INSERT' then
    if new.status not in ('draft','pending_review') then raise exception 'New products start as draft or pending review.'; end if;
    if not ent.active_products_unlimited then
      select count(*) into used from public.products where store_id=new.store_id and status<>'archived';
      if used>=ent.active_product_limit then
        raise exception 'Your plan allows % active products. Archive a product or upgrade your plan.',ent.active_product_limit;
      end if;
    end if;
    if not ent.daily_new_products_unlimited then
      day_start := date_trunc('day',now() at time zone tz) at time zone tz;
      select count(*) into daily_used from public.seller_product_listing_events
        where store_id=new.store_id and created_at>=day_start and created_at<day_start+interval '1 day';
      if daily_used>=ent.daily_new_product_limit then
        raise exception 'Your daily listing limit of % has been reached.',ent.daily_new_product_limit;
      end if;
    end if;
    insert into public.seller_product_listing_events(store_id,product_id) values(new.store_id,new.id);
  else
    if new.store_id is distinct from old.store_id then raise exception 'A product cannot move to another store.'; end if;
    if new.status='published' and old.status is distinct from 'published' then raise exception 'Only the EverNeed team publishes products.'; end if;
    if new.status='rejected' and old.status is distinct from 'rejected' then raise exception 'Only the EverNeed team rejects products.'; end if;
    if old.status='published' and new.status='published'
      and (new.name is distinct from old.name or new.descr is distinct from old.descr
        or new.images is distinct from old.images or new.img is distinct from old.img) then
      new.status:='pending_review';
    end if;
    if old.status='archived' and new.status<>'archived' and not ent.active_products_unlimited then
      select count(*) into used from public.products where store_id=new.store_id and status<>'archived';
      if used>=ent.active_product_limit then
        raise exception 'Your plan allows % active products. Archive a product or upgrade your plan.',ent.active_product_limit;
      end if;
    end if;
  end if;
  if new.status='pending_review' then
    if st is distinct from 'approved' then raise exception 'Your store must be approved before products go for review.'; end if;
    select sp.trusted into trusted from public.store_private sp where sp.store_id=new.store_id;
    if coalesce(trusted,false) and coalesce((select (data->>'auto_approve_trusted')::boolean from public.settings where id='policy'),false) then
      new.status:='published';
    end if;
  end if;
  return new;
end $$;

commit;
