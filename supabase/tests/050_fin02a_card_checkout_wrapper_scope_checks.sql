-- FIN-02A wrapper card-only scope regression.
begin;
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.create_order_with_financial_snapshot_v2(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)'::regprocedure)
    into v_def;
  if v_def is null or v_def not like '%p_pm is distinct from ''card''%' then
    raise exception 'Financial v2 checkout wrapper does not restrict payment method.';
  end if;
  if not has_function_privilege('service_role',
    'public.create_order_with_financial_snapshot_v2(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)','EXECUTE')
     or has_function_privilege('anon',
    'public.create_order_with_financial_snapshot_v2(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated',
    'public.create_order_with_financial_snapshot_v2(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)','EXECUTE') then
    raise exception 'Card checkout wrapper permissions are incorrect.';
  end if;
end
$$;
rollback;
