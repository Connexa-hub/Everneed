-- FIN-02A: append-only audit events for seller funding consent and campaign reservations.
begin;

create table if not exists private.offer_funding_consent_audit (
  id bigint generated always as identity primary key,
  offer_id text not null,
  store_id text not null,
  action text not null check (action in ('consented','changed','revoked')),
  previous_seller_funding_bps integer,
  new_seller_funding_bps integer,
  actor_id uuid,
  event_at timestamptz not null default now()
);

create table if not exists private.offer_budget_reservation_events (
  id bigint generated always as identity primary key,
  reservation_id uuid not null,
  order_id text not null,
  offer_id text not null,
  currency text not null,
  amount_minor bigint not null,
  from_status text,
  to_status text not null,
  actor_id uuid,
  event_at timestamptz not null default now(),
  reason text
);

revoke all on private.offer_funding_consent_audit from public, anon, authenticated, service_role;
revoke all on private.offer_budget_reservation_events from public, anon, authenticated, service_role;

create or replace function private.audit_offer_funding_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_action text; v_prev integer; v_new integer;
begin
  if tg_op='INSERT' then
    v_action := 'consented'; v_prev := null; v_new := new.seller_funding_bps;
  else
    v_prev := old.seller_funding_bps; v_new := new.seller_funding_bps;
    if old.revoked_at is null and new.revoked_at is not null then
      v_action := 'revoked';
    elsif old.seller_funding_bps is distinct from new.seller_funding_bps
       or old.consented_by is distinct from new.consented_by
       or old.revoked_at is distinct from new.revoked_at then
      v_action := 'changed';
    else
      return new;
    end if;
  end if;
  insert into private.offer_funding_consent_audit(
    offer_id,store_id,action,previous_seller_funding_bps,new_seller_funding_bps,actor_id
  ) values(new.offer_id,new.store_id,v_action,v_prev,v_new,new.consented_by);
  return new;
end
$$;

create or replace function private.audit_offer_budget_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    insert into private.offer_budget_reservation_events(
      reservation_id,order_id,offer_id,currency,amount_minor,from_status,to_status,actor_id
    ) values(new.id,new.order_id,new.offer_id,new.currency,new.amount_minor,null,new.status,auth.uid());
    return new;
  end if;
  if old.status is distinct from new.status then
    insert into private.offer_budget_reservation_events(
      reservation_id,order_id,offer_id,currency,amount_minor,from_status,to_status,actor_id,reason
    ) values(new.id,new.order_id,new.offer_id,new.currency,new.amount_minor,old.status,new.status,
      auth.uid(),coalesce(new.release_reason,''));
  end if;
  return new;
end
$$;

drop trigger if exists offer_funding_consent_audit on private.offer_store_funding_consent;
create trigger offer_funding_consent_audit
after insert or update on private.offer_store_funding_consent
for each row execute function private.audit_offer_funding_consent();

drop trigger if exists offer_budget_reservation_audit on private.offer_budget_reservations;
create trigger offer_budget_reservation_audit
after insert or update on private.offer_budget_reservations
for each row execute function private.audit_offer_budget_reservation();

revoke all on function private.audit_offer_funding_consent() from public, anon, authenticated, service_role;
revoke all on function private.audit_offer_budget_reservation() from public, anon, authenticated, service_role;

comment on table private.offer_funding_consent_audit is
  'Append-only audit record of seller offer funding opt-in, changes and revocation.';
comment on table private.offer_budget_reservation_events is
  'Append-only audit of campaign budget hold, consumption and release transitions.';

commit;
