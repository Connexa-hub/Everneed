-- 019: regional policy acceptance and verification-gated store activation.
-- Admin application approval is not permission to publish a seller storefront.
-- Verification results are written only by trusted provider/service workflows.
begin;

alter table public.stores
  add column if not exists activation_status text not null default 'verification_required'
  check (activation_status in ('verification_required','ready','live','suspended'));

create table if not exists public.policy_documents (
  id text primary key default gen_random_uuid()::text,
  policy_type text not null check (policy_type in ('customer_terms','customer_privacy','seller_terms','seller_privacy','marketplace_rules','returns_refunds','cookies')),
  country text not null check (country ~ '^[A-Z]{2}$'),
  locale text not null default 'en',
  version text not null,
  title text not null,
  content_url text not null,
  content_sha256 text,
  effective_at timestamptz not null,
  published boolean not null default false,
  requires_acceptance boolean not null default true,
  created_at timestamptz not null default now(),
  unique(policy_type,country,locale,version)
);
alter table public.policy_documents enable row level security;
revoke all on public.policy_documents from anon, authenticated;
grant select on public.policy_documents to anon, authenticated;
create policy "published policy documents are readable" on public.policy_documents
  for select to anon, authenticated using (published and effective_at <= now());
create policy "policy documents admin manage" on public.policy_documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.policy_documents to authenticated;

create table if not exists public.policy_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  policy_document_id text not null references public.policy_documents(id),
  country text not null check (country ~ '^[A-Z]{2}$'),
  accepted_at timestamptz not null default now(),
  acceptance_method text not null default 'explicit_checkbox',
  unique(user_id,policy_document_id)
);
alter table public.policy_acceptances enable row level security;
revoke all on public.policy_acceptances from anon, authenticated;
grant select on public.policy_acceptances to authenticated;
create policy "users read own policy acceptances" on public.policy_acceptances
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.accept_policy(p_document_id text, p_country text)
returns void language plpgsql security definer set search_path = ''
as $$
declare d record;
begin
  if auth.uid() is null then raise exception 'Please sign in to accept this policy.'; end if;
  select * into d from public.policy_documents
   where id = p_document_id and country = upper(p_country)
     and published and effective_at <= now() and requires_acceptance;
  if not found then raise exception 'This policy is not available for your region.'; end if;
  insert into public.policy_acceptances(user_id,policy_document_id,country)
  values(auth.uid(),d.id,d.country)
  on conflict(user_id,policy_document_id) do nothing;
end $$;


-- Seller applications require explicit acceptance of the current regional seller policy pack.
create or replace function public.submit_store(p_store text)
returns void language plpgsql security definer set search_path = ''
as $
declare a record; s record; missing_policies text[];
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('submit_store',5,600);
  select * into s from public.stores where id=p_store and owner_id=auth.uid() for update;
  if not found then raise exception 'That is not your store.'; end if;
  if s.status not in ('draft','rejected') then raise exception 'This store has already been submitted.'; end if;
  select * into a from public.store_applications where store_id=p_store;
  if not found or coalesce(a.business_name,'')='' or coalesce(a.bank_name,'')='' or coalesce(a.account_number,'')='' or coalesce(a.account_name,'')='' then
    raise exception 'Complete your business and payout details first.';
  end if;
  select array_agg(req.policy_type order by req.policy_type) into missing_policies
  from (values ('seller_terms'),('seller_privacy'),('marketplace_rules'),('returns_refunds')) req(policy_type)
  where not exists (
    select 1 from public.policy_documents d
    join public.policy_acceptances pa on pa.policy_document_id=d.id and pa.user_id=auth.uid()
    where d.policy_type=req.policy_type and d.country=s.country
      and d.published and d.requires_acceptance and d.effective_at<=now()
  );
  if coalesce(cardinality(missing_policies),0)>0 then
    raise exception 'Review and accept the current seller policies for your region before submitting: %.',array_to_string(missing_policies,', ');
  end if;
  update public.stores set status='pending',activation_status='verification_required' where id=p_store;
  update public.store_applications set submitted_at=now(),decision=null,reason=null,reviewed_by=null,reviewed_at=null where store_id=p_store;
  perform private.notify_admins('store_submitted','A store is waiting for approval',s.name,jsonb_build_object('store_id',p_store));
end $;
revoke execute on function public.submit_store(text) from public, anon;
grant execute on function public.submit_store(text) to authenticated;

create table if not exists public.seller_verification_rules (
  country text not null check (country ~ '^[A-Z]{2}$'),
  check_type text not null check (check_type in ('phone','identity','face_liveness','business_address')),
  required boolean not null default true,
  enabled boolean not null default true,
  help_text text,
  updated_at timestamptz not null default now(),
  primary key(country,check_type)
);
alter table public.seller_verification_rules enable row level security;
revoke all on public.seller_verification_rules from anon, authenticated;
grant select on public.seller_verification_rules to authenticated;
create policy "seller verification rules readable" on public.seller_verification_rules
  for select to authenticated using (enabled or public.is_admin());
create policy "seller verification rules admin manage" on public.seller_verification_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.seller_verification_rules to authenticated;

-- Nigeria is the first enabled seller market. Other markets must be configured and legally/provider-ready
-- before seller activation is enabled there.
insert into public.seller_verification_rules(country,check_type,required,enabled,help_text) values
 ('NG','phone',true,true,'Confirm a working phone number by OTP.'),
 ('NG','identity',true,true,'Verify a nationally recognised identity document through an approved provider.'),
 ('NG','face_liveness',true,true,'Complete the approved face/liveness check.'),
 ('NG','business_address',true,true,'Provide accepted evidence matching your declared business/store address.')
on conflict(country,check_type) do update set required=excluded.required,enabled=excluded.enabled,help_text=excluded.help_text,updated_at=now();

create table if not exists public.store_verification_checks (
  id bigint generated always as identity primary key,
  store_id text not null references public.stores on delete cascade,
  check_type text not null check (check_type in ('phone','identity','face_liveness','business_address')),
  status text not null default 'not_started' check (status in ('not_started','pending','verified','needs_attention','skipped','expired')),
  provider text,
  provider_reference text,
  reviewed_by uuid references auth.users,
  reviewed_at timestamptz,
  expires_at timestamptz,
  safe_note text,
  updated_at timestamptz not null default now(),
  unique(store_id,check_type)
);
alter table public.store_verification_checks enable row level security;
revoke all on public.store_verification_checks from anon, authenticated;
grant select on public.store_verification_checks to authenticated;
create policy "seller reads own verification status" on public.store_verification_checks
  for select to authenticated using (private.owns_store(store_id) or public.is_admin());
-- No client write policy by design: only trusted service/provider workflows can write verification outcomes.

create or replace function private.store_verification_complete(p_store text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
    where s.id = p_store
      and exists (select 1 from public.seller_verification_rules r where r.country=s.country and r.enabled)
      and not exists (
        select 1 from public.seller_verification_rules r
        where r.country=s.country and r.enabled and r.required
          and not exists (
            select 1 from public.store_verification_checks c
            where c.store_id=s.id and c.check_type=r.check_type
              and c.status='verified' and (c.expires_at is null or c.expires_at > now())
          )
      )
  )
$$;
revoke execute on function private.store_verification_complete(text) from public, anon, authenticated;
grant execute on function private.store_verification_complete(text) to service_role;

create or replace function private.store_live(p_store text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
    where s.id=p_store and s.status='approved'
      and (s.is_official or (
        s.activation_status='live'
        and private.store_verification_complete(s.id)
        and exists (select 1 from public.store_subscriptions ss where ss.store_id=s.id
          and ((ss.status in ('trialing','active') and ss.current_period_end>now())
            or (ss.status='past_due' and ss.grace_until>now())))
      ))
  )
$$;
revoke execute on function private.store_live(text) from public;
grant execute on function private.store_live(text) to anon, authenticated, service_role;


create table if not exists public.seller_verification_reminder_state (
  store_id text not null references public.stores on delete cascade,
  check_type text not null check (check_type in ('phone','identity','face_liveness','business_address')),
  last_sent_at timestamptz not null default now(),
  primary key(store_id,check_type)
);
alter table public.seller_verification_reminder_state enable row level security;
revoke all on public.seller_verification_reminder_state from anon, authenticated;
grant select on public.seller_verification_reminder_state to authenticated;
create policy "seller reads own verification reminder state" on public.seller_verification_reminder_state
  for select to authenticated using (private.owns_store(store_id) or public.is_admin());

create or replace function private.queue_seller_verification_reminders(p_store text,p_missing text[])
returns integer language plpgsql security definer set search_path = ''
as $
declare k text; n integer:=0; changed integer;
begin
  foreach k in array coalesce(p_missing,'{}'::text[]) loop
    insert into public.seller_verification_reminder_state(store_id,check_type,last_sent_at)
    values(p_store,k,now())
    on conflict(store_id,check_type) do update set last_sent_at=now()
      where public.seller_verification_reminder_state.last_sent_at < now()-interval '7 days';
    get diagnostics changed = row_count;
    if changed>0 then
      perform private.notify((select owner_id from public.stores where id=p_store),
        'verification_required','Action needed: complete seller verification',
        'Your store application is approved, but your store cannot go live until you complete: '||replace(k,'_',' ')||'.',
        jsonb_build_object('store_id',p_store,'check_type',k));
      n:=n+1;
    end if;
  end loop;
  return n;
end $;
revoke execute on function private.queue_seller_verification_reminders(text,text[]) from public, anon, authenticated;
grant execute on function private.queue_seller_verification_reminders(text,text[]) to service_role;

create or replace function public.request_store_activation(p_store text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare s record; missing text[];
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('request_store_activation',5,300);
  select * into s from public.stores where id=p_store and owner_id=auth.uid() for update;
  if not found then raise exception 'That is not your store.'; end if;
  if s.status <> 'approved' or not exists(select 1 from public.store_applications a where a.store_id=p_store and a.decision='approved') then
    raise exception 'Your store application must be approved before activation.';
  end if;
  select array_agg(r.check_type order by r.check_type) into missing
  from public.seller_verification_rules r
  where r.country=s.country and r.enabled and r.required
    and not exists(select 1 from public.store_verification_checks c where c.store_id=p_store
      and c.check_type=r.check_type and c.status='verified' and (c.expires_at is null or c.expires_at>now()));
  if not exists(select 1 from public.seller_verification_rules r where r.country=s.country and r.enabled) then
    raise exception 'Seller verification is not configured for your region yet. Please contact Everneed support.';
  end if;
  if coalesce(cardinality(missing),0)>0 then
    update public.stores set activation_status='verification_required' where id=p_store;
    perform private.queue_seller_verification_reminders(p_store,missing);
    return jsonb_build_object('activated',false,'missing_checks',to_jsonb(missing),'activation_status','verification_required');
  end if;
  update public.stores set activation_status='live' where id=p_store;
  perform private.audit(auth.uid(),'store_activated','store',p_store,
    jsonb_build_object('activation_status',s.activation_status),
    jsonb_build_object('activation_status','live'));
  return jsonb_build_object('activated',true,'missing_checks','[]'::jsonb,'activation_status','live');
end $$;

revoke execute on function public.accept_policy(text,text), public.request_store_activation(text) from public, anon;
grant execute on function public.accept_policy(text,text), public.request_store_activation(text) to authenticated;

-- A customer/seller cannot forge acceptance or verification status with direct table writes.
revoke insert, update, delete on public.policy_acceptances, public.store_verification_checks from anon, authenticated;
revoke insert, update, delete on public.seller_verification_rules from anon;
commit;
