-- Supporting indexes for admin order directory sort/filter access.
create index if not exists orders_at_id_desc_idx
  on public.orders (at desc, id desc);
create index if not exists orders_status_at_id_desc_idx
  on public.orders (status, at desc, id desc);
create index if not exists orders_payment_status_at_id_desc_idx
  on public.orders (payment_status, at desc, id desc);
create index if not exists orders_pm_at_id_desc_idx
  on public.orders (pm, at desc, id desc);
