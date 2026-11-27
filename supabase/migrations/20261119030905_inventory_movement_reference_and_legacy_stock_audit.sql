-- Complete inventory movement audit for both the legacy product stock field and variants.
create or replace function private.product_variant_inventory_audit()
returns trigger language plpgsql security definer set search_path=''
as $$
declare why text; ref text;
begin
  if tg_op='INSERT' then
    if new.stock is not null and new.stock<>0 then
      insert into public.product_inventory_movements(product_id,variant_id,store_id,delta,previous_stock,new_stock,reason,reference,actor)
      values(new.product_id,new.id,new.store_id,new.stock,0,new.stock,'initial_stock',null,auth.uid());
    end if;
    return new;
  end if;
  if new.stock is distinct from old.stock then
    why:=coalesce(nullif(current_setting('everneed.inventory_reason',true),''),'manual_adjustment');
    ref:=nullif(current_setting('everneed.inventory_reference',true),'');
    insert into public.product_inventory_movements(product_id,variant_id,store_id,delta,previous_stock,new_stock,reason,reference,actor)
    values(new.product_id,new.id,new.store_id,coalesce(new.stock,0)-coalesce(old.stock,0),old.stock,new.stock,why,ref,auth.uid());
  end if;
  return new;
end $$;

create or replace function private.product_stock_inventory_audit()
returns trigger language plpgsql security definer set search_path=''
as $$
declare why text; ref text;
begin
  if tg_op='INSERT' then
    if new.stock is not null and new.stock<>0 then
      insert into public.product_inventory_movements(product_id,variant_id,store_id,delta,previous_stock,new_stock,reason,reference,actor)
      values(new.id,null,new.store_id,new.stock,0,new.stock,'initial_stock',null,auth.uid());
    end if;
    return new;
  end if;
  if new.stock is distinct from old.stock then
    why:=coalesce(nullif(current_setting('everneed.inventory_reason',true),''),'product_stock_change');
    ref:=nullif(current_setting('everneed.inventory_reference',true),'');
    insert into public.product_inventory_movements(product_id,variant_id,store_id,delta,previous_stock,new_stock,reason,reference,actor)
    values(new.id,null,new.store_id,coalesce(new.stock,0)-coalesce(old.stock,0),old.stock,new.stock,why,ref,auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists product_stock_inventory_audit on public.products;
create trigger product_stock_inventory_audit after insert or update of stock on public.products
for each row execute function private.product_stock_inventory_audit();

create or replace function public.seller_adjust_variant_stock(p_variant uuid,p_quantity integer,p_reason text,p_reference text default null)
returns public.product_variants language plpgsql security definer set search_path=''
as $$
declare v public.product_variants;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if p_quantity is null then raise exception 'Quantity is required.'; end if;
  if length(coalesce(p_reason,''))<3 then raise exception 'Enter a reason for the stock adjustment.'; end if;
  select * into v from public.product_variants where id=p_variant for update;
  if not found then raise exception 'Variant not found.'; end if;
  if not public.is_admin() and not private.owns_store(v.store_id) then raise exception 'You cannot manage this inventory.'; end if;
  perform set_config('everneed.inventory_reason',left(p_reason,80),true);
  perform set_config('everneed.inventory_reference',left(coalesce(p_reference,''),120),true);
  update public.product_variants set stock=coalesce(stock,0)+p_quantity where id=p_variant returning * into v;
  if v.stock<0 and not v.allow_backorder then raise exception 'This adjustment would make stock negative.'; end if;
  return v;
end $$;
revoke execute on function public.seller_adjust_variant_stock(uuid,integer,text,text) from public,anon;
grant execute on function public.seller_adjust_variant_stock(uuid,integer,text,text) to authenticated;
