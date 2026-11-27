-- Give every new/free-trial seller a real, bounded Entry entitlement.
-- Staging-first; paid plan pricing and limits are intentionally untouched.
begin;

update public.store_plans
set active=true,
    product_limit=5,
    features='["Seller storefront","Basic seller workspace","Up to 5 active products","Up to 2 new product listings per day","Basic catalogue and order workspace"]'::jsonb
where id='plan-free';

update public.seller_plan_entitlements
set active_product_limit=5,
    active_products_unlimited=false,
    daily_new_product_limit=2,
    daily_new_products_unlimited=false,
    verification_included=false,
    verification_required_to_activate=false,
    updated_at=now(),
    updated_by=null
where plan_id='plan-free';

-- Approval-created trial subscriptions with no selected plan are the Free trial.
-- Do not rewrite subscriptions already assigned to a paid plan or expired trials.
update public.store_subscriptions
set plan_id='plan-free'
where plan_id is null
  and status='trialing'
  and current_period_end>now();

commit;
