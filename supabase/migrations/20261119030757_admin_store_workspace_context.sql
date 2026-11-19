-- Safe admin store-context switcher: explicit selected store, full capability override,
-- and honest module-readiness flags for the frontend.
create or replace function public.admin_store_workspace_context(p_store text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare s public.stores; sub public.store_subscriptions; pl public.store_plans; owner_profile public.profiles;
begin
  perform private.need_admin();
  select * into s from public.stores where id=p_store;
  if not found then raise exception 'Store not found.'; end if;
  select * into owner_profile from public.profiles where id=s.owner_id;
  select * into sub from public.store_subscriptions where store_id=s.id;
  if found and sub.plan_id is not null then select * into pl from public.store_plans where id=sub.plan_id; end if;

  return jsonb_build_object(
    'store',jsonb_build_object('id',s.id,'slug',s.slug,'name',s.name,'is_official',s.is_official,
      'status',s.status,'activation_status',s.activation_status,'country',s.country,'state',s.state,'city',s.city,
      'created_at',s.created_at,'approved_at',s.approved_at),
    'owner',case when owner_profile.id is null then null else jsonb_build_object('id',owner_profile.id,'name',owner_profile.name,'email',owner_profile.email,'phone',owner_profile.phone,'photo',owner_profile.photo) end,
    'subscription',case when sub.store_id is null then null else jsonb_build_object('plan_id',sub.plan_id,'plan_name',pl.name,'status',sub.status,'period_start',sub.current_period_start,'period_end',sub.current_period_end) end,
    'capabilities',public.seller_product_capabilities(s.id),
    'counts',jsonb_build_object(
      'products',(select count(*) from public.products p where p.store_id=s.id),
      'draft_products',(select count(*) from public.products p where p.store_id=s.id and p.status='draft'),
      'pending_review_products',(select count(*) from public.products p where p.store_id=s.id and p.status='pending_review'),
      'published_products',(select count(*) from public.products p where p.store_id=s.id and p.status='published'),
      'archived_products',(select count(*) from public.products p where p.store_id=s.id and p.status='archived'),
      'variants',(select count(*) from public.product_variants v where v.store_id=s.id),
      'low_stock_variants',(select count(*) from public.product_variants v where v.store_id=s.id and v.active and v.track_stock and v.stock<=v.low_stock_threshold),
      'seller_orders',(select count(*) from public.seller_orders so where so.store_id=s.id)
    ),
    'module_readiness',jsonb_build_object(
      'catalogue','ready','category_attributes','ready','variants','ready_for_catalogue_only',
      'media_metadata','ready','media_uploads','pending_storage_contract',
      'inventory_adjustment_audit','ready','multi_location_inventory','pending',
      'quantity_price_tiers','stored_not_checkout_integrated','variant_checkout','pending',
      'bulk_edit','pending','csv_import','pending','csv_export','pending',
      'promotions','pending','sales_analytics','pending','team_management','pending',
      'orders','existing_contract','messaging','existing_contract','payments','existing_contract',
      'finance_and_settlement','existing_contract_with_pending_payout_work'
    )
  );
end $$;
revoke execute on function public.admin_store_workspace_context(text) from public,anon;
grant execute on function public.admin_store_workspace_context(text) to authenticated;
