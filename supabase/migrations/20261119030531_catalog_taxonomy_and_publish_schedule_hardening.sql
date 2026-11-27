-- Enforce category tree depth/cycle safety and respect scheduled publication on every public catalogue surface.

create or replace function private.collections_taxonomy_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare parent_depth integer; cycle_found boolean;
begin
  if new.parent_id is null then
    if new.slug is null or new.slug='' then
      new.slug:=lower(trim(both '-' from regexp_replace(regexp_replace(new.name,'[^a-zA-Z0-9]+','-','g'),'-+','-','g')));
    end if;
    return new;
  end if;
  if new.parent_id=new.id then raise exception 'A category cannot be its own parent.'; end if;
  with recursive chain(id,parent_id,depth,path,cycle) as (
    select c.id,c.parent_id,1,array[c.id]::text[],false from public.collections c where c.id=new.parent_id
    union all
    select p.id,p.parent_id,ch.depth+1,ch.path||p.id,p.id=any(ch.path
    ) from public.collections p join chain ch on p.id=ch.parent_id where not ch.cycle
  )
  select coalesce(max(depth),0),coalesce(bool_or(id=new.id),false) into parent_depth,cycle_found from chain;
  if parent_depth=0 then raise exception 'Category parent not found.'; end if;
  if cycle_found then raise exception 'Category hierarchy cannot contain a cycle.'; end if;
  if parent_depth>=3 then raise exception 'Category nesting is limited to three levels.'; end if;
  if new.slug is null or new.slug='' then
    new.slug:=lower(trim(both '-' from regexp_replace(regexp_replace(new.name,'[^a-zA-Z0-9]+','-','g'),'-+','-','g')));
  end if;
  return new;
end $$;
drop trigger if exists collections_taxonomy_guard on public.collections;
create trigger collections_taxonomy_guard before insert or update of parent_id,name,slug on public.collections
for each row execute function private.collections_taxonomy_guard();

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon,authenticated
using (status='published' and visibility='public' and (publish_at is null or publish_at<=now()) and private.store_live(store_id));

drop policy if exists product_variants_public_read on public.product_variants;
create policy product_variants_public_read on public.product_variants
  for select to anon,authenticated using (
    active=true and exists(select 1 from public.products p
      where p.id=product_id and p.status='published' and p.visibility='public'
        and (p.publish_at is null or p.publish_at<=now()) and private.store_live(p.store_id))
  );

drop policy if exists product_media_public_read on public.product_media;
create policy product_media_public_read on public.product_media
  for select to anon,authenticated using (exists(select 1 from public.products p
    where p.id=product_id and p.status='published' and p.visibility='public'
      and (p.publish_at is null or p.publish_at<=now()) and private.store_live(p.store_id)));

drop policy if exists product_price_tiers_public_read on public.product_price_tiers;
create policy product_price_tiers_public_read on public.product_price_tiers
  for select to anon,authenticated using (active=true and exists(select 1 from public.products p
    where p.id=product_id and p.status='published' and p.visibility='public'
      and (p.publish_at is null or p.publish_at<=now()) and private.store_live(p.store_id)));

drop policy if exists product_links_public_read on public.product_links;
create policy product_links_public_read on public.product_links
  for select to anon,authenticated using (exists(select 1 from public.products p
    where p.id=product_id and p.status='published' and p.visibility='public'
      and (p.publish_at is null or p.publish_at<=now()) and private.store_live(p.store_id)));
