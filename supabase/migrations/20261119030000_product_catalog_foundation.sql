-- Rich Everneed product catalogue foundation (backwards-compatible extension).
-- Existing products columns, product IDs, checkout snapshots and quota guard are preserved.

alter table public.collections
  add column if not exists parent_id text references public.collections(id) on delete set null,
  add column if not exists slug text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists active boolean not null default true;

update public.collections
set slug = lower(trim(both '-' from regexp_replace(regexp_replace(name,'[^a-zA-Z0-9]+','-','g'),'-+','-','g')))
where slug is null;

create unique index if not exists collections_slug_key on public.collections(slug);
create index if not exists collections_parent_sort_idx on public.collections(parent_id,sort_order,name);

create table if not exists public.category_attributes (
  id uuid primary key default gen_random_uuid(),
  collection_id text not null references public.collections(id) on delete cascade,
  attribute_key text not null,
  label text not null,
  input_type text not null default 'text' check(input_type in ('text','number','boolean','select','multiselect','date','measurement','url')),
  options jsonb not null default '[]'::jsonb check(jsonb_typeof(options)='array'),
  unit text,
  required boolean not null default false,
  searchable boolean not null default false,
  filterable boolean not null default false,
  variation boolean not null default false,
  validation jsonb not null default '{}'::jsonb check(jsonb_typeof(validation)='object'),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(collection_id,attribute_key)
);
alter table public.category_attributes enable row level security;
drop policy if exists category_attributes_public_read on public.category_attributes;
create policy category_attributes_public_read on public.category_attributes
  for select to anon,authenticated using (active=true);
drop policy if exists category_attributes_admin_manage on public.category_attributes;
create policy category_attributes_admin_manage on public.category_attributes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.products
  add column if not exists brand text,
  add column if not exists condition text not null default 'new' check(condition in ('new','refurbished','used','open_box')),
  add column if not exists gtin text,
  add column if not exists mpn text,
  add column if not exists short_description text,
  add column if not exists highlights text[] not null default '{}',
  add column if not exists tags text[] not null default '{}',
  add column if not exists slug text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists attributes jsonb not null default '{}'::jsonb check(jsonb_typeof(attributes)='object'),
  add column if not exists compare_at_price numeric,
  add column if not exists sale_price numeric,
  add column if not exists sale_starts_at timestamptz,
  add column if not exists sale_ends_at timestamptz,
  add column if not exists min_order_qty integer not null default 1 check(min_order_qty>0),
  add column if not exists max_order_qty integer check(max_order_qty is null or max_order_qty>=min_order_qty),
  add column if not exists track_stock boolean not null default true,
  add column if not exists low_stock_threshold integer not null default 5 check(low_stock_threshold>=0),
  add column if not exists allow_backorder boolean not null default false,
  add column if not exists lead_time_days integer check(lead_time_days is null or lead_time_days>=0),
  add column if not exists expiry_date date,
  add column if not exists batch_no text,
  add column if not exists handling_days integer check(handling_days is null or handling_days>=0),
  add column if not exists free_shipping boolean not null default false,
  add column if not exists fragile boolean not null default false,
  add column if not exists hazmat boolean not null default false,
  add column if not exists dimensions jsonb not null default '{}'::jsonb check(jsonb_typeof(dimensions)='object'),
  add column if not exists return_window_days integer check(return_window_days is null or return_window_days>=0),
  add column if not exists warranty_months integer check(warranty_months is null or warranty_months>=0),
  add column if not exists warranty_type text,
  add column if not exists publish_at timestamptz,
  add column if not exists visibility text not null default 'public' check(visibility in ('public','hidden')),
  add column if not exists product_type text not null default 'physical' check(product_type in ('physical','digital','service','subscription')),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists products_store_slug_key
  on public.products(store_id,slug) where slug is not null and slug<>'';
create unique index if not exists products_store_sku_key
  on public.products(store_id,lower(sku)) where sku is not null and sku<>'';
create index if not exists products_collection_slug_idx on public.products(col,slug);
create index if not exists products_brand_idx on public.products(brand);
create index if not exists products_gtin_idx on public.products(gtin) where gtin is not null;
create index if not exists products_tags_gin_idx on public.products using gin(tags);
create index if not exists products_attributes_gin_idx on public.products using gin(attributes);

alter table public.product_private
  add column if not exists cost_price numeric check(cost_price is null or cost_price>=0),
  add column if not exists tax_class text,
  add column if not exists supplier_code text,
  add column if not exists internal_notes text;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  store_id text not null references public.stores(id) on delete cascade,
  sku text,
  barcode text,
  option_values jsonb not null default '{}'::jsonb check(jsonb_typeof(option_values)='object'),
  price numeric not null check(price>=0),
  compare_at_price numeric check(compare_at_price is null or compare_at_price>=0),
  sale_price numeric check(sale_price is null or sale_price>=0),
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  stock integer,
  track_stock boolean not null default true,
  allow_backorder boolean not null default false,
  low_stock_threshold integer not null default 5 check(low_stock_threshold>=0),
  weight_g numeric check(weight_g is null or weight_g>=0),
  dimensions jsonb not null default '{}'::jsonb check(jsonb_typeof(dimensions)='object'),
  image_url text,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(stock is null or stock>=0 or allow_backorder)
);
create unique index if not exists product_variants_store_sku_key
  on public.product_variants(store_id,lower(sku)) where sku is not null and sku<>'';
create unique index if not exists product_variants_store_barcode_key
  on public.product_variants(store_id,barcode) where barcode is not null and barcode<>'';
create index if not exists product_variants_product_position_idx on public.product_variants(product_id,position);
alter table public.product_variants enable row level security;
drop policy if exists product_variants_owner_admin on public.product_variants;
create policy product_variants_owner_admin on public.product_variants
  for all to authenticated using (public.is_admin() or private.owns_store(store_id))
  with check (public.is_admin() or private.owns_store(store_id));
drop policy if exists product_variants_public_read on public.product_variants;
create policy product_variants_public_read on public.product_variants
  for select to anon,authenticated using (
    active=true and exists(select 1 from public.products p
      where p.id=product_id and p.status='published' and p.visibility='public' and private.store_live(p.store_id))
  );

create table if not exists public.product_variant_private (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  cost_price numeric check(cost_price is null or cost_price>=0),
  supplier_code text,
  internal_notes text,
  updated_at timestamptz not null default now()
);
alter table public.product_variant_private enable row level security;
drop policy if exists product_variant_private_owner_admin on public.product_variant_private;
create policy product_variant_private_owner_admin on public.product_variant_private
  for all to authenticated using (public.is_admin() or exists(
    select 1 from public.product_variants v where v.id=variant_id and private.owns_store(v.store_id)
  )) with check (public.is_admin() or exists(
    select 1 from public.product_variants v where v.id=variant_id and private.owns_store(v.store_id)
  ));

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  store_id text not null references public.stores(id) on delete cascade,
  media_type text not null check(media_type in ('image','video','model_3d','document')),
  storage_path text,
  url text,
  alt_text text,
  caption text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  width integer,
  height integer,
  duration_seconds numeric,
  created_at timestamptz not null default now(),
  check(storage_path is not null or url is not null)
);
create index if not exists product_media_product_order_idx on public.product_media(product_id,sort_order);
create unique index if not exists product_media_one_primary_idx on public.product_media(product_id) where is_primary;
alter table public.product_media enable row level security;
drop policy if exists product_media_owner_admin on public.product_media;
create policy product_media_owner_admin on public.product_media
  for all to authenticated using (public.is_admin() or private.owns_store(store_id))
  with check (public.is_admin() or private.owns_store(store_id));
drop policy if exists product_media_public_read on public.product_media;
create policy product_media_public_read on public.product_media
  for select to anon,authenticated using (exists(select 1 from public.products p
    where p.id=product_id and p.status='published' and p.visibility='public' and private.store_live(p.store_id)));

create table if not exists public.product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  store_id text not null references public.stores(id) on delete cascade,
  min_quantity integer not null check(min_quantity>=2),
  max_quantity integer check(max_quantity is null or max_quantity>=min_quantity),
  unit_price numeric not null check(unit_price>=0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_id,variant_id,min_quantity)
);
create index if not exists product_price_tiers_product_idx on public.product_price_tiers(product_id,min_quantity);
alter table public.product_price_tiers enable row level security;
drop policy if exists product_price_tiers_owner_admin on public.product_price_tiers;
create policy product_price_tiers_owner_admin on public.product_price_tiers
  for all to authenticated using (public.is_admin() or private.owns_store(store_id))
  with check (public.is_admin() or private.owns_store(store_id));
drop policy if exists product_price_tiers_public_read on public.product_price_tiers;
create policy product_price_tiers_public_read on public.product_price_tiers
  for select to anon,authenticated using (active=true and exists(select 1 from public.products p
    where p.id=product_id and p.status='published' and p.visibility='public' and private.store_live(p.store_id)));

create table if not exists public.product_links (
  product_id text not null references public.products(id) on delete cascade,
  linked_product_id text not null references public.products(id) on delete cascade,
  store_id text not null references public.stores(id) on delete cascade,
  link_kind text not null check(link_kind in ('related','upsell','cross_sell','bundle_component','replacement')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(product_id,linked_product_id,link_kind),
  check(product_id<>linked_product_id)
);
create index if not exists product_links_product_idx on public.product_links(product_id,link_kind,sort_order);
alter table public.product_links enable row level security;
drop policy if exists product_links_owner_admin on public.product_links;
create policy product_links_owner_admin on public.product_links
  for all to authenticated using (public.is_admin() or private.owns_store(store_id))
  with check (public.is_admin() or private.owns_store(store_id));
drop policy if exists product_links_public_read on public.product_links;
create policy product_links_public_read on public.product_links
  for select to anon,authenticated using (exists(select 1 from public.products p
    where p.id=product_id and p.status='published' and p.visibility='public' and private.store_live(p.store_id));

create table if not exists public.product_inventory_movements (
  id bigint generated always as identity primary key,
  product_id text not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  store_id text not null references public.stores(id) on delete cascade,
  delta integer not null,
  previous_stock integer,
  new_stock integer,
  reason text not null,
  reference text,
  actor uuid,
  created_at timestamptz not null default now()
);
create index if not exists product_inventory_movements_product_idx on public.product_inventory_movements(product_id,created_at desc);
alter table public.product_inventory_movements enable row level security;
drop policy if exists product_inventory_movements_owner_read on public.product_inventory_movements;
create policy product_inventory_movements_owner_read on public.product_inventory_movements
  for select to authenticated using (public.is_admin() or private.owns_store(store_id));

create or replace function private.product_variant_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare parent_store text;
begin
  select p.store_id into parent_store from public.products p where p.id=new.product_id for update;
  if not found then raise exception 'Product not found.'; end if;
  if tg_op='INSERT' then
    new.store_id:=parent_store;
  else
    if new.product_id is distinct from old.product_id then raise exception 'A variant cannot move to another product.'; end if;
    new.store_id:=old.store_id;
  end if;
  if auth.uid() is not null and not public.is_admin() and not private.owns_store(parent_store) then
    raise exception 'You cannot manage variants for this store.';
  end if;
  if new.stock<0 and not new.allow_backorder then raise exception 'Stock cannot be negative unless backorders are enabled.'; end if;
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists product_variant_guard on public.product_variants;
create trigger product_variant_guard before insert or update on public.product_variants
for each row execute function private.product_variant_guard();

create or replace function private.product_variant_inventory_audit()
returns trigger language plpgsql security definer set search_path=''
as $$
declare why text;
begin
  if tg_op='INSERT' then
    if new.stock is not null and new.stock<>0 then
      insert into public.product_inventory_movements(product_id,variant_id,store_id,delta,previous_stock,new_stock,reason,actor)
      values(new.product_id,new.id,new.store_id,new.stock,0,new.stock,'initial_stock',auth.uid());
    end if;
    return new;
  end if;
  if new.stock is distinct from old.stock then
    why:=coalesce(nullif(current_setting('everneed.inventory_reason',true),''),'manual_adjustment');
    insert into public.product_inventory_movements(product_id,variant_id,store_id,delta,previous_stock,new_stock,reason,actor)
    values(new.product_id,new.id,new.store_id,coalesce(new.stock,0)-coalesce(old.stock,0),old.stock,new.stock,why,auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists product_variant_inventory_audit on public.product_variants;
create trigger product_variant_inventory_audit after insert or update of stock on public.product_variants
for each row execute function private.product_variant_inventory_audit();

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
  update public.product_variants set stock=coalesce(stock,0)+p_quantity where id=p_variant returning * into v;
  if v.stock<0 and not v.allow_backorder then raise exception 'This adjustment would make stock negative.'; end if;
  return v;
end $$;

revoke execute on function public.seller_adjust_variant_stock(uuid,integer,text,text) from public,anon;
grant execute on function public.seller_adjust_variant_stock(uuid,integer,text,text) to authenticated;

create or replace function private.validate_product_category_attributes()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  category_id text;
  missing_keys text[];
  bad_keys text[];
  def record;
  val jsonb;
begin
  if new.status not in ('pending_review','published') then return new; end if;
  if jsonb_typeof(coalesce(new.attributes,'{}'::jsonb))<>'object' then
    raise exception 'PRODUCT_ATTRIBUTES_INVALID: attributes must be an object.';
  end if;
  select c.id into category_id from public.collections c
    where c.id=new.col or lower(c.name)=lower(new.col) order by (c.id=new.col) desc limit 1;
  if category_id is null then return new; end if;
  for def in
    with recursive ancestors(id,parent_id) as (
      select c.id,c.parent_id from public.collections c where c.id=category_id
      union all select p.id,p.parent_id from public.collections p join ancestors a on p.id=a.parent_id
    )
    select ca.* from public.category_attributes ca join ancestors a on a.id=ca.collection_id
    where ca.active and ca.required
  loop
    val:=new.attributes->def.attribute_key;
    if val is null or val='null'::jsonb or val='""'::jsonb then
      missing_keys:=array_append(missing_keys,def.label);
      continue;
    end if;
    if def.input_type='number' and jsonb_typeof(val)<>'number' then bad_keys:=array_append(bad_keys,def.label); end if;
    if def.input_type='boolean' and jsonb_typeof(val)<>'boolean' then bad_keys:=array_append(bad_keys,def.label); end if;
    if def.input_type='multiselect' and jsonb_typeof(val)<>'array' then bad_keys:=array_append(bad_keys,def.label); end if;
    if def.input_type in ('text','select','date','url') and jsonb_typeof(val)<>'string' then bad_keys:=array_append(bad_keys,def.label); end if;
  end loop;
  if coalesce(cardinality(missing_keys),0)>0 then
    raise exception 'PRODUCT_REQUIRED_ATTRIBUTES: %',array_to_string(missing_keys,', ');
  end if;
  if coalesce(cardinality(bad_keys),0)>0 then
    raise exception 'PRODUCT_ATTRIBUTE_TYPE_INVALID: %',array_to_string(bad_keys,', ');
  end if;
  return new;
end $$;
drop trigger if exists zzz_product_category_attribute_validation on public.products;
create trigger zzz_product_category_attribute_validation before insert or update on public.products
for each row execute function private.validate_product_category_attributes();

create or replace function public.seller_product_category_schema(p_collection text default null)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'categories',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'group',c.grp,'icon',c.icon,'parent_id',c.parent_id,'slug',c.slug,'sort_order',c.sort_order) order by c.sort_order,c.name),'[]'::jsonb)
      from public.collections c where c.active and (p_collection is null or c.id=p_collection or lower(c.name)=lower(p_collection))),
    'attributes',(select coalesce(jsonb_agg(jsonb_build_object('collection_id',ca.collection_id,'key',ca.attribute_key,'label',ca.label,'type',ca.input_type,'options',ca.options,'unit',ca.unit,'required',ca.required,'searchable',ca.searchable,'filterable',ca.filterable,'variation',ca.variation,'validation',ca.validation,'sort_order',ca.sort_order) order by ca.sort_order,ca.label),'[]'::jsonb)
      from public.category_attributes ca join public.collections c on c.id=ca.collection_id
      where ca.active and (p_collection is null or c.id=p_collection or lower(c.name)=lower(p_collection)))
  )
$$;
grant execute on function public.seller_product_category_schema(text) to anon,authenticated;

alter table public.seller_plan_entitlements
  add column if not exists product_variants_enabled boolean not null default true,
  add column if not exists category_attributes_enabled boolean not null default true,
  add column if not exists bulk_tools_enabled boolean not null default false,
  add column if not exists csv_import_enabled boolean not null default false,
  add column if not exists csv_export_enabled boolean not null default false,
  add column if not exists analytics_level text not null default 'none' check(analytics_level in ('none','basic','advanced')),
  add column if not exists promotions_enabled boolean not null default false,
  add column if not exists inventory_alerts_enabled boolean not null default false,
  add column if not exists reports_export_enabled boolean not null default false,
  add column if not exists team_seats integer not null default 1 check(team_seats>=1);

update public.seller_plan_entitlements e set
  product_variants_enabled=true,
  category_attributes_enabled=true,
  bulk_tools_enabled=e.plan_id in ('plan-growth','plan-pro'),
  csv_import_enabled=e.plan_id in ('plan-growth','plan-pro'),
  csv_export_enabled=e.plan_id in ('plan-growth','plan-pro'),
  analytics_level=case e.plan_id when 'plan-free' then 'none' when 'plan-starter' then 'basic' else 'advanced' end,
  promotions_enabled=e.plan_id in ('plan-growth','plan-pro'),
  inventory_alerts_enabled=e.plan_id in ('plan-starter','plan-growth','plan-pro'),
  reports_export_enabled=e.plan_id in ('plan-growth','plan-pro'),
  team_seats=case e.plan_id when 'plan-pro' then 5 when 'plan-growth' then 2 else 1 end;

create or replace function public.seller_product_capabilities(p_store text default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare s public.stores; e public.seller_plan_entitlements; plan_name text;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  select * into s from public.stores where id=coalesce(p_store,(select id from public.stores where owner_id=auth.uid() order by created_at desc limit 1))
    and (owner_id=auth.uid() or public.is_admin());
  if not found then raise exception 'Store not found or access denied.'; end if;
  if public.is_admin() then
    return jsonb_build_object('store_id',s.id,'plan_id','admin_override','plan_name','Everneed Admin',
      'product_variants_enabled',true,'category_attributes_enabled',true,'bulk_tools_enabled',true,
      'csv_import_enabled',true,'csv_export_enabled',true,'analytics_level','advanced',
      'promotions_enabled',true,'inventory_alerts_enabled',true,'reports_export_enabled',true,'team_seats',null,
      'advanced_product_editor',true,'admin_override',true);
  end if;
  select ent.* into e from public.store_subscriptions ss join public.seller_plan_entitlements ent on ent.plan_id=ss.plan_id
    where ss.store_id=s.id;
  if not found then raise exception 'Seller plan is not configured.'; end if;
  select name into plan_name from public.store_plans where id=e.plan_id;
  return jsonb_build_object('store_id',s.id,'plan_id',e.plan_id,'plan_name',plan_name,
    'product_variants_enabled',e.product_variants_enabled,'category_attributes_enabled',e.category_attributes_enabled,
    'bulk_tools_enabled',e.bulk_tools_enabled,'csv_import_enabled',e.csv_import_enabled,
    'csv_export_enabled',e.csv_export_enabled,'analytics_level',e.analytics_level,
    'promotions_enabled',e.promotions_enabled,'inventory_alerts_enabled',e.inventory_alerts_enabled,
    'reports_export_enabled',e.reports_export_enabled,'team_seats',e.team_seats,
    'advanced_product_editor',e.analytics_level='advanced','admin_override',false);
end $$;
revoke execute on function public.seller_product_capabilities(text) from public,anon;
grant execute on function public.seller_product_capabilities(text) to authenticated;

-- Respect visibility in the existing public catalogue RLS policy.
drop policy if exists "products public read" on public.products;
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon,authenticated
using (status='published' and visibility='public' and private.store_live(store_id));

-- Seed category-specific attribute definitions, without making fields mandatory yet.
insert into public.category_attributes(collection_id,attribute_key,label,input_type,options,unit,required,searchable,filterable,variation,sort_order)
select c.id,seed.key,seed.label,seed.type,seed.options,seed.unit,seed.required,seed.searchable,seed.filterable,seed.variation,seed.ord
from public.collections c
join (values
 ('Phones and Tablets','brand','Brand','text','[]'::jsonb,null,false,true,true,false,10),
 ('Phones and Tablets','model','Model','text','[]'::jsonb,null,false,true,true,false,20),
 ('Phones and Tablets','storage','Storage','select','["32GB","64GB","128GB","256GB","512GB","1TB"]'::jsonb,null,false,true,true,true,30),
 ('Phones and Tablets','ram','RAM','select','["2GB","3GB","4GB","6GB","8GB","12GB","16GB"]'::jsonb,null,false,true,true,true,40),
 ('Phones and Tablets','screen_size','Screen size','number','[]'::jsonb,'inches',false,true,true,false,50),
 ('Phones and Tablets','battery_capacity','Battery capacity','number','[]'::jsonb,'mAh',false,true,true,false,60),
 ('Phones and Tablets','color','Colour','select','[]'::jsonb,null,false,true,true,true,70),
 ('Phones and Tablets','network','Network','select','["2G","3G","4G","5G"]'::jsonb,null,false,true,true,false,80),
 ('Phones and Tablets','warranty','Warranty','text','[]'::jsonb,null,false,false,false,false,90),
 ('Fashion and Clothing','brand','Brand','text','[]'::jsonb,null,false,true,true,false,10),
 ('Fashion and Clothing','size','Size','select','[]'::jsonb,null,false,true,true,true,20),
 ('Fashion and Clothing','color','Colour','select','[]'::jsonb,null,false,true,true,true,30),
 ('Fashion and Clothing','material','Material','text','[]'::jsonb,null,false,true,true,false,40),
 ('Fashion and Clothing','gender','Target gender','select','["Women","Men","Unisex","Girls","Boys"]'::jsonb,null,false,true,true,false,50),
 ('Fashion and Clothing','care_instructions','Care instructions','text','[]'::jsonb,null,false,false,false,false,60),
 ('Shoes','brand','Brand','text','[]'::jsonb,null,false,true,true,false,10),
 ('Shoes','size','Size','select','[]'::jsonb,null,false,true,true,true,20),
 ('Shoes','color','Colour','select','[]'::jsonb,null,false,true,true,true,30),
 ('Shoes','material','Material','text','[]'::jsonb,null,false,true,true,false,40),
 ('Beauty and Personal Care','brand','Brand','text','[]'::jsonb,null,false,true,true,false,10),
 ('Beauty and Personal Care','ingredients','Ingredients','text','[]'::jsonb,null,false,true,false,false,20),
 ('Beauty and Personal Care','skin_type','Skin type','multiselect','["Normal","Dry","Oily","Combination","Sensitive"]'::jsonb,null,false,true,true,false,30),
 ('Beauty and Personal Care','volume','Net content','number','[]'::jsonb,'ml/g',false,true,true,false,40),
 ('Beauty and Personal Care','expiry_date','Expiry date','date','[]'::jsonb,null,false,false,true,false,50),
 ('Electronics','brand','Brand','text','[]'::jsonb,null,false,true,true,false,10),
 ('Electronics','model','Model','text','[]'::jsonb,null,false,true,true,false,20),
 ('Electronics','voltage','Voltage','number','[]'::jsonb,'V',false,true,true,false,30),
 ('Electronics','warranty','Warranty','text','[]'::jsonb,null,false,false,false,false,40),
 ('Home and Kitchen','brand','Brand','text','[]'::jsonb,null,false,true,true,false,10),
 ('Home and Kitchen','material','Material','text','[]'::jsonb,null,false,true,true,false,20),
 ('Home and Kitchen','capacity','Capacity','number','[]'::jsonb,'L',false,true,true,false,30),
 ('Home and Kitchen','color','Colour','select','[]'::jsonb,null,false,true,true,true,40),
 ('Furniture','material','Material','text','[]'::jsonb,null,false,true,true,false,10),
 ('Furniture','assembly_required','Assembly required','boolean','[]'::jsonb,null,false,false,true,false,20),
 ('Furniture','weight_capacity','Weight capacity','number','[]'::jsonb,'kg',false,true,true,false,30),
 ('Building and Tools','brand','Brand','text','[]'::jsonb,null,false,true,true,false,10),
 ('Building and Tools','tool_type','Tool type','text','[]'::jsonb,null,false,true,true,false,20),
 ('Building and Tools','power_rating','Power rating','number','[]'::jsonb,'W',false,true,true,false,30),
 ('Food and Drinks','ingredients','Ingredients','text','[]'::jsonb,null,false,true,false,false,10),
 ('Food and Drinks','allergens','Allergens','multiselect','[]'::jsonb,null,false,true,true,false,20),
 ('Food and Drinks','storage','Storage instructions','text','[]'::jsonb,null,false,false,false,false,30),
 ('Food and Drinks','expiry_date','Expiry date','date','[]'::jsonb,null,false,false,true,false,40),
 ('Baby and Kids','age_group','Age group','select','["0-3 months","3-6 months","6-12 months","1-3 years","3-6 years","6+ years"]'::jsonb,null,false,true,true,false,10),
 ('Baby and Kids','material','Material','text','[]'::jsonb,null,false,true,true,false,20),
 ('Automotive','brand','Brand','text','[]'::jsonb,null,false,true,true,false,10),
 ('Automotive','model_compatibility','Compatible models','text','[]'::jsonb,null,false,true,true,false,20),
 ('Automotive','year_range','Compatible years','text','[]'::jsonb,null,false,true,true,false,30)
) as seed(category,key,label,type,options,unit,required,searchable,filterable,variation,ord)
on lower(c.name)=lower(seed.category)
on conflict(collection_id,attribute_key) do nothing;

