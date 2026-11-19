-- Rich catalogue foundation regression checks.
-- Structural checks plus a transaction-wrapped product/variant/media/price/link/stock smoke test.
begin;
do $$
declare
  category_id text;
  product_a text := gen_random_uuid()::text;
  product_b text := gen_random_uuid()::text;
  v_variant_id uuid;
  missing_message text;
  schema_result jsonb;
  movement_count integer;
  root_id text:=gen_random_uuid()::text;
  child_id text:=gen_random_uuid()::text;
  leaf_id text:=gen_random_uuid()::text;
  fourth_id text:=gen_random_uuid()::text;
begin
  select id into category_id from public.collections where lower(name)='phones and tablets' limit 1;
  if category_id is null then raise exception 'FAIL: seeded Phones and Tablets category missing'; end if;

  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='attributes') then
    raise exception 'FAIL: products.attributes missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='compare_at_price') then
    raise exception 'FAIL: compare_at_price missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='dimensions') then
    raise exception 'FAIL: structured dimensions missing';
  end if;

  foreach missing_message in array array['category_attributes','product_variants','product_variant_private','product_media','product_price_tiers','product_links','product_inventory_movements'] loop
    if to_regclass('public.'||missing_message) is null then raise exception 'FAIL: table public.% missing',missing_message; end if;
    if not (select rowsecurity from pg_tables where schemaname='public' and tablename=missing_message) then
      raise exception 'FAIL: RLS disabled on %',missing_message;
    end if;
  end loop;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='product_variants' and policyname='product_variants_owner_admin') then
    raise exception 'FAIL: product variants owner/admin policy missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='product_variants' and policyname='product_variants_public_read') then
    raise exception 'FAIL: public product variant visibility policy missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='product_media' and policyname='product_media_public_read') then
    raise exception 'FAIL: public media visibility policy missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='product_price_tiers' and policyname='product_price_tiers_public_read') then
    raise exception 'FAIL: public tier-price visibility policy missing';
  end if;

  schema_result:=public.seller_product_category_schema(category_id);
  if jsonb_typeof(schema_result->'categories')<>'array' or jsonb_typeof(schema_result->'attributes')<>'array' then
    raise exception 'FAIL: category schema RPC must return categories and attributes arrays';
  end if;
  if not exists(select 1 from public.category_attributes where collection_id=category_id and attribute_key='storage') then
    raise exception 'FAIL: seeded phone storage attribute missing';
  end if;

  if not exists(select 1 from public.seller_plan_entitlements where plan_id='plan-free' and product_variants_enabled and category_attributes_enabled and not bulk_tools_enabled) then
    raise exception 'FAIL: Free capabilities should include variations/attributes but not bulk tools';
  end if;
  if not exists(select 1 from public.seller_plan_entitlements where plan_id='plan-growth' and bulk_tools_enabled and csv_import_enabled and csv_export_enabled and analytics_level='advanced' and promotions_enabled) then
    raise exception 'FAIL: Growth capabilities missing';
  end if;
  if not exists(select 1 from public.seller_plan_entitlements where plan_id='plan-pro' and team_seats=5 and bulk_tools_enabled) then
    raise exception 'FAIL: Pro capabilities missing';
  end if;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_public_read' and qual like '%publish_at%') then
    raise exception 'FAIL: scheduled products must remain hidden until publish_at';
  end if;

  insert into public.collections(id,name,slug,parent_id,grp,sort_order)
  values(root_id,'CI taxonomy root '||root_id,root_id,null,'CI',90001);
  insert into public.collections(id,name,slug,parent_id,grp,sort_order)
  values(child_id,'CI taxonomy child '||child_id,child_id,root_id,'CI',90002);
  insert into public.collections(id,name,slug,parent_id,grp,sort_order)
  values(leaf_id,'CI taxonomy leaf '||leaf_id,leaf_id,child_id,'CI',90003);
  begin
    insert into public.collections(id,name,slug,parent_id,grp,sort_order)
    values(fourth_id,'CI taxonomy too deep '||fourth_id,fourth_id,leaf_id,'CI',90004);
    raise exception 'FAIL: fourth taxonomy level was accepted';
  exception when others then
    if sqlerrm not like 'Category nesting is limited to three levels.%' then raise; end if;
  end;
  begin
    update public.collections set parent_id=leaf_id where id=root_id;
    raise exception 'FAIL: category cycle was accepted';
  exception when others then
    if sqlerrm not like 'Category hierarchy cannot contain a cycle.%' then raise; end if;
  end;

  insert into public.category_attributes(collection_id,attribute_key,label,input_type,required,sort_order)
  values(category_id,'__test_required','Test required attribute','text',true,9999);
  begin
    insert into public.products(id,name,col,price,store_id,status,attributes,slug)
    values(product_a,'Catalogue regression product',category_id,1000,'everneed-official','pending_review','{}',product_a);
    raise exception 'FAIL: required category attribute was not enforced';
  exception when others then
    if sqlerrm not like 'PRODUCT_REQUIRED_ATTRIBUTES:%' then raise; end if;
    missing_message:=sqlerrm;
  end;

  insert into public.products(id,name,col,price,store_id,status,attributes,slug,brand,condition,gtin,short_description,highlights,tags,compare_at_price,sale_price,dimensions,visibility)
  values(product_a,'Catalogue regression product',category_id,1000,'everneed-official','pending_review',
    jsonb_build_object('__test_required','valid'),product_a,'Test brand','new','0000000000000','Short description',
    array['Feature one','Feature two'],array['test','catalogue'],1200,950,
    jsonb_build_object('length',10,'width',5,'height',3,'unit','cm'),'hidden');

  insert into public.products(id,name,col,price,store_id,status,slug)
  values(product_b,'Catalogue regression related product',category_id,1500,'everneed-official','draft',product_b);

  insert into public.product_variants(product_id,sku,option_values,price,stock,weight_g,dimensions,position)
  values(product_a,'CAT-TEST-'||product_a,jsonb_build_object('Storage','128GB','Colour','Blue'),1000,10,250,
    jsonb_build_object('length',10,'width',5,'height',3,'unit','cm'),1)
  returning id into v_variant_id;

  perform set_config('everneed.inventory_reason','CI stock adjustment',true);
  update public.product_variants set stock=7 where id=v_variant_id;
  select count(*) into movement_count from public.product_inventory_movements where product_inventory_movements.variant_id=v_variant_id;
  if movement_count<>2 then raise exception 'FAIL: expected initial and adjustment inventory movements, got %',movement_count; end if;
  if not exists(select 1 from public.product_inventory_movements where product_inventory_movements.variant_id=v_variant_id and reason='CI stock adjustment' and delta=-3) then
    raise exception 'FAIL: stock adjustment movement record missing';
  end if;

  insert into public.product_media(product_id,store_id,media_type,url,alt_text,sort_order,is_primary)
  values(product_a,'everneed-official','image','https://example.invalid/catalog-test.jpg','Test media',0,true);
  insert into public.product_price_tiers(product_id,variant_id,store_id,min_quantity,unit_price)
  values(product_a,v_variant_id,'everneed-official',5,900);
  insert into public.product_links(product_id,linked_product_id,store_id,link_kind)
  values(product_a,product_b,'everneed-official','related');

  if not exists(select 1 from public.product_media where product_id=product_a and is_primary) then raise exception 'FAIL: media metadata did not persist'; end if;
  if not exists(select 1 from public.product_price_tiers where product_id=product_a and min_quantity=5) then raise exception 'FAIL: quantity price tier did not persist'; end if;
  if not exists(select 1 from public.product_links where product_id=product_a and linked_product_id=product_b and link_kind='related') then raise exception 'FAIL: product relation did not persist'; end if;
end $$;
rollback;
