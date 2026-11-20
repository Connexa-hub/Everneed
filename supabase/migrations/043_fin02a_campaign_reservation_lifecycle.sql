-- FIN-02A: consume campaign reservations on paid orders and release holds on cancellation.
begin;

create or replace function private.finalize_order_campaign_reservations(
  p_order_id text,p_action text,p_reason text default null
) returns integer
language plpgsql security definer set search_path=''
as $$
declare r record; v_count integer:=0;
begin
  if p_order_id is null or p_action not in ('consume','release') then
    raise exception 'Invalid campaign reservation finalization action.';
  end if;
  for r in select id,status from private.offer_budget_reservations
    where order_id=p_order_id and status='reserved' order by id for update
  loop
    if p_action='consume' then
      perform private.consume_offer_campaign_reservation(r.id);
    else
      perform private.release_offer_campaign_reservation(r.id,coalesce(p_reason,'Order cancelled before payment'));
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$$;

create or replace function private.order_campaign_reservation_lifecycle()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.payment_status='paid' and old.payment_status is distinct from 'paid' then
    perform private.finalize_order_campaign_reservations(new.id,'consume','Payment confirmed');
  elsif new.status='cancelled' and old.status is distinct from 'cancelled'
     and new.payment_status not in ('paid','partially_refunded','refunded') then
    perform private.finalize_order_campaign_reservations(new.id,'release','Order cancelled before payment');
  end if;
  return new;
end
$$;

drop trigger if exists order_campaign_reservation_lifecycle on public.orders;
create trigger order_campaign_reservation_lifecycle
after update of status,payment_status on public.orders
for each row execute function private.order_campaign_reservation_lifecycle();

-- Guard the service-only snapshot boundary against inconsistent parent totals even
-- when a trusted caller bypasses the deterministic builder.
create or replace function private.guard_snapshot_v2_store_totals()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_amounts jsonb:=new.payload->'amounts';
  v_gross numeric;
  v_net numeric;
  v_discount numeric;
  v_delivery numeric;
  v_total numeric;
begin
  perform private.validate_snapshot_v2_store_totals(new.payload->'items',new.payload->'store_allocations');
  v_gross:=(v_amounts->>'gross_merchandise_minor')::numeric;
  v_net:=(v_amounts->>'net_merchandise_minor')::numeric;
  v_discount:=(v_amounts->>'discount_minor')::numeric;
  v_delivery:=(v_amounts->>'delivery_fee_minor')::numeric;
  v_total:=(v_amounts->>'total_minor')::numeric;
  if v_gross is null or v_net is null or v_discount is null or v_delivery is null or v_total is null
     or v_gross-v_net<>v_discount or v_net+v_delivery<>v_total then
    raise exception 'Snapshot v2 merchandise, discount, delivery and total amounts do not reconcile.';
  end if;
  return new;
end
$$;

revoke all on function private.finalize_order_campaign_reservations(text,text,text) from public,anon,authenticated,service_role;
revoke all on function private.order_campaign_reservation_lifecycle() from public,anon,authenticated,service_role;

comment on function private.finalize_order_campaign_reservations(text,text,text) is
  'Internal FIN-02A lifecycle helper; paid orders consume active holds and unpaid cancellations release them atomically.';
commit;
