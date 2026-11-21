-- FIN-02A: validate snapshot v2 store summaries against item-level allocations.
begin;

create or replace function private.validate_snapshot_v2_store_totals(
  p_items jsonb, p_store_allocations jsonb
) returns boolean
language plpgsql immutable security invoker set search_path = ''
as $$
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_typeof(p_store_allocations) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 50
     or jsonb_array_length(p_store_allocations) not between 1 and 50 then
    raise exception 'Store-total validator expects bounded item and store arrays.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_store_allocations) e
    where jsonb_typeof(e) <> 'object'
      or jsonb_typeof(e->'store_id') <> 'string'
      or jsonb_typeof(e->'gross_minor') <> 'number'
      or jsonb_typeof(e->'seller_funded_discount_minor') <> 'number'
      or jsonb_typeof(e->'platform_funded_discount_minor') <> 'number'
      or jsonb_typeof(e->'commission_minor') <> 'number'
      or jsonb_typeof(e->'seller_payable_minor') <> 'number'
  ) then raise exception 'Store-total object shape is invalid.'; end if;
  if exists (
    select store_id from jsonb_to_recordset(p_store_allocations) as x(
      store_id text,gross_minor numeric,seller_funded_discount_minor numeric,
      platform_funded_discount_minor numeric,commission_minor numeric,seller_payable_minor numeric
    ) group by store_id having count(*)>1
  ) then raise exception 'Store summary IDs must be unique.'; end if;
  if exists (
    with item_totals as (
      select store_id,sum(gross_minor) gross_minor,sum(seller_discount_minor) seller_funded_discount_minor,
        sum(platform_discount_minor) platform_funded_discount_minor,sum(commission_minor) commission_minor,
        sum(seller_payable_minor) seller_payable_minor
      from jsonb_to_recordset(p_items) as x(store_id text,gross_minor numeric,seller_discount_minor numeric,
        platform_discount_minor numeric,commission_minor numeric,seller_payable_minor numeric)
      group by store_id
    ), store_totals as (
      select store_id,gross_minor,seller_funded_discount_minor,platform_funded_discount_minor,commission_minor,seller_payable_minor
      from jsonb_to_recordset(p_store_allocations) as x(store_id text,gross_minor numeric,
        seller_funded_discount_minor numeric,platform_funded_discount_minor numeric,commission_minor numeric,seller_payable_minor numeric)
    )
    select 1 from item_totals i full join store_totals s using(store_id)
    where i.store_id is null or s.store_id is null
      or i.gross_minor is distinct from s.gross_minor
      or i.seller_funded_discount_minor is distinct from s.seller_funded_discount_minor
      or i.platform_funded_discount_minor is distinct from s.platform_funded_discount_minor
      or i.commission_minor is distinct from s.commission_minor
      or i.seller_payable_minor is distinct from s.seller_payable_minor
  ) then raise exception 'Store totals do not reconcile to the item allocation snapshot.'; end if;
  return true;
end
$$;

create or replace function private.guard_snapshot_v2_store_totals()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.validate_snapshot_v2_store_totals(new.payload->'items',new.payload->'store_allocations');
  return new;
end
$$;

drop trigger if exists order_financial_snapshot_v2_store_totals on private.order_financial_snapshots_v2;
create trigger order_financial_snapshot_v2_store_totals
before insert on private.order_financial_snapshots_v2
for each row execute function private.guard_snapshot_v2_store_totals();

revoke all on function private.validate_snapshot_v2_store_totals(jsonb,jsonb) from public, anon, authenticated, service_role;
revoke all on function private.guard_snapshot_v2_store_totals() from public, anon, authenticated, service_role;

comment on function private.validate_snapshot_v2_store_totals(jsonb,jsonb) is
  'Pure FIN-02A validator: each store summary must exactly reconcile to the immutable item allocation details.';
commit;
