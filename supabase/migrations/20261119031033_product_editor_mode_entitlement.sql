-- All tiers retain rich product fields; basic tiers use a guided editor rather than a restricted schema.
alter table public.seller_plan_entitlements
  add column if not exists advanced_product_editor boolean not null default true,
  add column if not exists product_editor_mode text not null default 'guided' check(product_editor_mode in ('guided','full'));

update public.seller_plan_entitlements set
  advanced_product_editor=true,
  product_editor_mode=case when plan_id in ('plan-growth','plan-pro') then 'full' else 'guided' end;

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
      'advanced_product_editor',true,'product_editor_mode','full','admin_override',true);
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
    'advanced_product_editor',e.advanced_product_editor,'product_editor_mode',e.product_editor_mode,
    'admin_override',false);
end $$;
revoke execute on function public.seller_product_capabilities(text) from public,anon;
grant execute on function public.seller_product_capabilities(text) to authenticated;
