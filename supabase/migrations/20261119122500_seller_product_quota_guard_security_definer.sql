-- Harden seller quota trigger execution: trusted access to entitlement and durable listing-event rows.
begin;
create or replace function private.products_guard()
returns trigger language plpgsql security definer set search_path = ''
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
revoke execute on function private.products_guard() from public,anon,authenticated;
commit;
