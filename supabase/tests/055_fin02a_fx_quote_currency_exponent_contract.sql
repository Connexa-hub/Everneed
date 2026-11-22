-- FIN-02A quote FX/currency exponent contract regression.
-- Protect the current explicitly-supported 2-decimal checkout currencies and quote provenance.
begin;
do $$
declare
  v_def text;
  v_builder text;
  v_guard text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='create_order_with_snapshot';
  if v_def is null then raise exception 'Checkout quote wrapper is missing.'; end if;

  -- Current checkout is deliberately limited to currencies whose supported exponent is 2.
  foreach v_builder in array array['NGN','GHS','KES','ZAR','GBP','USD'] loop
    if position('when '''||v_builder||''' then 2' in v_def)=0 then
      raise exception 'Currency exponent mapping for % is missing or changed without updating this contract.',v_builder;
    end if;
  end loop;
  if v_def not like '%v_exponent is null%'
     or v_def not like '%currency_exponent%'
     or v_def not like '%effective checkout rate does not match its FX provenance%'
     or v_def not like '%fx_fetched_at%'
     or v_def not like '%pricing_policy_version%'
     or v_def not like '%v_fx_rate%'
     or v_def not like '%v_markup%' then
    raise exception 'Quote provenance, exponent or FX-rate validation has been weakened.';
  end if;

  select pg_get_functiondef(p.oid) into v_builder
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='private' and p.proname='build_order_financial_snapshot_v2';
  if v_builder is null or v_builder not like '%currency_exponent%'
     or v_builder not like '%v_v1%'
     or v_builder not like '%v_currency%' then
    raise exception 'FIN-02A builder does not carry forward immutable quote currency/exponent.';
  end if;

  select pg_get_functiondef(p.oid) into v_guard
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='private' and p.proname='guard_snapshot_v2_store_totals';
  if v_guard is null or v_guard not like '%currency_exponent%'
     or v_guard not like '%checkout_snapshot%'
     or v_guard not like '%upper(v_order.currency)%' then
    raise exception 'V2 snapshot quote identity guard is missing currency/exponent reconciliation.';
  end if;
end
$$;
rollback;
