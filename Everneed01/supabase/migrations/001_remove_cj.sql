-- 001_remove_cj: remove the dropshipping (CJ) integration from the database.
-- Order matters: archive first, verify, then drop.

-- 1. Products get a lifecycle status. Existing rows stay published.
alter table public.products
  add column if not exists status text not null default 'published'
  check (status in ('draft','pending_review','published','rejected','archived'));

-- 2. Archive (never delete) every imported product: past orders reference them.
update public.products set status = 'archived' where supplier is not null;

-- 3. Safety stop: do not drop the supplier columns if anything imported is still live.
do $$
begin
  if exists (select 1 from public.products where supplier is not null and status <> 'archived') then
    raise exception 'Imported products are still not archived; aborting before dropping columns';
  end if;
end $$;

-- 4. Customers and anonymous users never see archived products. Admin still does.
drop policy if exists "products read" on public.products;
create policy "products read" on public.products for select
  using (status <> 'archived' or public.is_admin());

-- 5. Drop supplier cost data, tokens and settings.
drop table if exists public.order_costs;
delete from public.kv where key like 'cj\_%' escape '\';
delete from public.settings where id in ('cj', 'pricing');

-- 6. Drop supplier columns and the index (only after the archive above).
drop index if exists public.products_supplier_pid;
alter table public.products
  drop column if exists supplier,
  drop column if exists sup_pid,
  drop column if exists sup_cost,
  drop column if exists sup_ship,
  drop column if exists variants,
  drop column if exists opt,
  drop column if exists ship_days;
-- Kept on purpose (useful to sellers): maker, maker_addr, origin, ships_from, sku, weight_g, dims, material.
