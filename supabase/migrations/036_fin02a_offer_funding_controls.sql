-- FIN-02A: explicit seller promotion funding consent and approved campaign budgets.
-- Additive only. Not wired into checkout or existing offers/redemptions.
begin;

create table if not exists private.offer_store_funding_consent (
  offer_id text not null references public.offers(id) on delete cascade,
  store_id text not null references public.stores(id) on delete cascade,
  seller_funding_bps integer not null check (seller_funding_bps between 0 and 10000),
  platform_funding_bps integer generated always as (10000 - seller_funding_bps) stored,
  consented_by uuid not null,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text,
  primary key (offer_id, store_id),
  check (seller_funding_bps + platform_funding_bps = 10000)
);

create table if not exists private.offer_campaign_budgets (
  offer_id text not null references public.offers(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  approved_budget_minor bigint not null check (approved_budget_minor >= 0),
  reserved_minor bigint not null default 0 check (reserved_minor >= 0),
  consumed_minor bigint not null default 0 check (consumed_minor >= 0),
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approval_note text not null,
  primary key (offer_id, currency),
  check (reserved_minor + consumed_minor <= approved_budget_minor)
);

create table if not exists private.offer_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  offer_id text not null references public.offers(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'reserved' check (status in ('reserved','consumed','released')),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  unique (order_id, offer_id, currency)
);

create index if not exists offer_budget_reservations_status_idx
  on private.offer_budget_reservations(status, created_at);

revoke all on private.offer_store_funding_consent from public, anon, authenticated, service_role;
revoke all on private.offer_campaign_budgets from public, anon, authenticated, service_role;
revoke all on private.offer_budget_reservations from public, anon, authenticated, service_role;

create or replace function public.set_offer_store_funding_consent(
  p_offer_id text,
  p_store_id text,
  p_seller_funding_bps integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if p_offer_id is null or length(trim(p_offer_id)) not between 1 and 128
     or p_store_id is null or length(trim(p_store_id)) not between 1 and 128
     or p_seller_funding_bps is null or p_seller_funding_bps not between 0 and 10000 then
    raise exception 'Invalid consent input.';
  end if;
  if not exists (select 1 from public.stores s where s.id = p_store_id and s.owner_id = v_uid) then
    raise exception 'Store ownership verification failed.';
  end if;
  if not exists (select 1 from public.offers o where o.id = p_offer_id and o.active) then
    raise exception 'Offer is unavailable.';
  end if;
  insert into private.offer_store_funding_consent(
    offer_id, store_id, seller_funding_bps, consented_by, consented_at, revoked_at, revocation_reason
  ) values (p_offer_id, p_store_id, p_seller_funding_bps, v_uid, now(), null, null)
  on conflict (offer_id, store_id) do update set
    seller_funding_bps = excluded.seller_funding_bps,
    consented_by = excluded.consented_by,
    consented_at = excluded.consented_at,
    revoked_at = null,
    revocation_reason = null;
  return jsonb_build_object('offer_id', p_offer_id, 'store_id', p_store_id,
    'seller_funding_bps', p_seller_funding_bps,
    'platform_funding_bps', 10000 - p_seller_funding_bps, 'consented_at', now());
end
$$;

create or replace function public.revoke_offer_store_funding_consent(
  p_offer_id text,
  p_store_id text,
  p_reason text default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  update private.offer_store_funding_consent c
     set revoked_at = now(), revocation_reason = left(coalesce(p_reason, 'Seller revoked consent'), 240)
   where c.offer_id = p_offer_id and c.store_id = p_store_id
     and exists (select 1 from public.stores s where s.id = p_store_id and s.owner_id = v_uid)
     and c.revoked_at is null;
  return found;
end
$$;

create or replace function public.approve_offer_campaign_budget(
  p_offer_id text,
  p_currency text,
  p_budget_minor bigint,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_role text; v_row private.offer_campaign_budgets;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role <> 'admin' then raise exception 'Admin approval required.'; end if;
  if p_offer_id is null or length(trim(p_offer_id)) not between 1 and 128
     or p_currency is null or p_currency !~ '^[A-Z]{3}$'
     or p_budget_minor is null or p_budget_minor < 0
     or p_note is null or length(trim(p_note)) not between 5 and 240 then
    raise exception 'Invalid campaign budget approval.';
  end if;
  if not exists (select 1 from public.offers where id = p_offer_id) then
    raise exception 'Offer does not exist.';
  end if;
  insert into private.offer_campaign_budgets(
    offer_id,currency,approved_budget_minor,approved_by,approved_at,updated_at,approval_note
  ) values (p_offer_id,p_currency,p_budget_minor,v_uid,now(),now(),trim(p_note))
  on conflict (offer_id,currency) do update set
    approved_budget_minor = excluded.approved_budget_minor,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = now(),
    approval_note = excluded.approval_note
  returning * into v_row;
  return jsonb_build_object('offer_id',v_row.offer_id,'currency',v_row.currency,
    'approved_budget_minor',v_row.approved_budget_minor,'reserved_minor',v_row.reserved_minor,
    'consumed_minor',v_row.consumed_minor,'approved_at',v_row.approved_at);
end
$$;

-- Atomic and idempotent: callers may retry the same order/offer/currency key.
-- Only trusted server-side checkout code may invoke these lifecycle functions.
create or replace function private.reserve_offer_campaign_budget(
  p_order_id text, p_offer_id text, p_currency text, p_amount_minor bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_budget private.offer_campaign_budgets; v_res private.offer_budget_reservations; v_id uuid;
begin
  if p_order_id is null or length(trim(p_order_id)) not between 1 and 128
     or p_offer_id is null or length(trim(p_offer_id)) not between 1 and 128
     or p_currency is null or p_currency !~ '^[A-Z]{3}$'
     or p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Invalid campaign reservation input.';
  end if;
  select * into v_res from private.offer_budget_reservations
   where order_id=p_order_id and offer_id=p_offer_id and currency=p_currency for update;
  if found then
    if v_res.amount_minor <> p_amount_minor then raise exception 'Idempotency key reused with different amount.'; end if;
    if v_res.status <> 'reserved' then raise exception 'Reservation is terminal.'; end if;
    return v_res.id;
  end if;
  select * into v_budget from private.offer_campaign_budgets
   where offer_id=p_offer_id and currency=p_currency for update;
  if not found then raise exception 'No approved campaign budget for this currency.'; end if;
  if v_budget.reserved_minor + v_budget.consumed_minor + p_amount_minor > v_budget.approved_budget_minor then
    raise exception 'Campaign budget would be exceeded.';
  end if;
  update private.offer_campaign_budgets set reserved_minor=reserved_minor+p_amount_minor, updated_at=now()
   where offer_id=p_offer_id and currency=p_currency;
  insert into private.offer_budget_reservations(order_id,offer_id,currency,amount_minor)
   values(p_order_id,p_offer_id,p_currency,p_amount_minor) returning id into v_id;
  return v_id;
end
$$;

create or replace function private.consume_offer_campaign_reservation(p_reservation_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_res private.offer_budget_reservations;
begin
  select * into v_res from private.offer_budget_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Reservation not found.'; end if;
  if v_res.status='consumed' then return true; end if;
  if v_res.status<>'reserved' then raise exception 'Reservation is not active.'; end if;
  update private.offer_campaign_budgets
    set reserved_minor=reserved_minor-v_res.amount_minor,
        consumed_minor=consumed_minor+v_res.amount_minor, updated_at=now()
    where offer_id=v_res.offer_id and currency=v_res.currency
      and reserved_minor>=v_res.amount_minor;
  if not found then raise exception 'Budget reservation accounting mismatch.'; end if;
  update private.offer_budget_reservations set status='consumed', consumed_at=now() where id=p_reservation_id;
  return true;
end
$$;

create or replace function private.release_offer_campaign_reservation(
  p_reservation_id uuid, p_reason text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_res private.offer_budget_reservations;
begin
  select * into v_res from private.offer_budget_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Reservation not found.'; end if;
  if v_res.status='released' then return true; end if;
  if v_res.status<>'reserved' then raise exception 'Consumed campaign spend cannot be released.'; end if;
  update private.offer_campaign_budgets
    set reserved_minor=reserved_minor-v_res.amount_minor, updated_at=now()
    where offer_id=v_res.offer_id and currency=v_res.currency
      and reserved_minor>=v_res.amount_minor;
  if not found then raise exception 'Budget reservation accounting mismatch.'; end if;
  update private.offer_budget_reservations set status='released',released_at=now(),
    release_reason=left(coalesce(p_reason,'Order cancelled or payment expired'),240)
    where id=p_reservation_id;
  return true;
end
$$;

revoke all on function public.set_offer_store_funding_consent(text,text,integer) from public, anon;
revoke all on function public.revoke_offer_store_funding_consent(text,text,text) from public, anon;
revoke all on function public.approve_offer_campaign_budget(text,text,bigint,text) from public, anon;
revoke all on function private.reserve_offer_campaign_budget(text,text,text,bigint) from public, anon, authenticated, service_role;
revoke all on function private.consume_offer_campaign_reservation(uuid) from public, anon, authenticated, service_role;
revoke all on function private.release_offer_campaign_reservation(uuid,text) from public, anon, authenticated, service_role;

grant execute on function public.set_offer_store_funding_consent(text,text,integer) to authenticated;
grant execute on function public.revoke_offer_store_funding_consent(text,text,text) to authenticated;
grant execute on function public.approve_offer_campaign_budget(text,text,bigint,text) to authenticated;

comment on table private.offer_store_funding_consent is
  'Seller opt-in funding share for an offer/store. Consent is auditable and checkout integration must fail closed when required consent is absent.';
comment on table private.offer_campaign_budgets is
  'Admin-approved offer/currency campaign budgets. Reserved and consumed amounts are protected by atomic private reservation functions.';
comment on table private.offer_budget_reservations is
  'Idempotent per-order campaign budget holds; released only before consumption, never automatically refunded after payment.';

commit;
