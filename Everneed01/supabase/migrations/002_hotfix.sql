-- 002_hotfix: close S1 (interim), S2, S3 and S7.

-- S2: customers can no longer PATCH their own orders at all.
-- They report a bank transfer through report_payment(), which changes only status, reference and note.
drop policy if exists "orders report paid" on public.orders;
alter table public.orders add column if not exists payment_note text;

create or replace function public.report_payment(order_id text, reference text default '', note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  update public.orders
     set status = 'payment_reported',
         ref = coalesce(nullif(left(trim(reference), 80), ''), ref),
         payment_note = nullif(left(trim(note), 300), '')
   where id = order_id and user_id = auth.uid() and status = 'awaiting_transfer';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'This order cannot be reported as paid.'; end if;
  return jsonb_build_object('status', 'payment_reported');
end $$;
revoke all on function public.report_payment(text, text, text) from public, anon;
grant execute on function public.report_payment(text, text, text) to authenticated;

-- S3: no more email lookups. Sign-in relies on Supabase Auth responses only.
drop function if exists public.email_status(text);
drop function if exists public.email_is_admin(text);

-- S7: coupon checks move into the Edge Function (service role, rate limited).
drop function if exists public.coupon_info(text);

create table if not exists public.rate_limits(
  user_id uuid not null,
  action text not null,
  at timestamptz not null default now()
);
create index if not exists rate_limits_lookup on public.rate_limits(user_id, action, at desc);
alter table public.rate_limits enable row level security; -- no policies: service role only

create or replace function public.rate_hit(p_user uuid, p_action text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.rate_limits where at < now() - interval '1 day';
  select count(*) into n from public.rate_limits
   where user_id = p_user and action = p_action and at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then return false; end if;
  insert into public.rate_limits(user_id, action) values (p_user, p_action);
  return true;
end $$;
revoke all on function public.rate_hit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(uuid, text, integer, integer) to service_role;

-- Atomic coupon redemption: one statement, so two buyers cannot both take the last use.
create or replace function public.redeem_offer(p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.offers set used = used + 1
   where id = p_id and active and (limit_uses is null or used < limit_uses);
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.redeem_offer(text) from public, anon, authenticated;
grant execute on function public.redeem_offer(text) to service_role;

-- S1 (interim): anonymous users read only the country config rows, not every settings row.
drop policy if exists "settings read" on public.settings;
create policy "settings read" on public.settings for select
  using (id in ('NG', 'GH', 'KE', 'ZA', 'GB', 'US') or public.is_admin());
