-- R24/R25 structural and regression assertions; read-only, safe on staging after migrations.
do $$
declare
  v_pause_fn regprocedure;
  v_pause_def text;
  v_live_def text;
  v_guard_def text;
  v_idx text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stores' and column_name='storefront_paused'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stores' and column_name='storefront_pause_until'
  ) then
    raise exception 'R24 pause columns missing';
  end if;

  v_pause_fn := to_regprocedure('public.seller_set_pause(text,boolean,timestamp with time zone,text)');
  if v_pause_fn is null then raise exception 'R24 owner pause RPC missing'; end if;
  select pg_get_functiondef(v_pause_fn) into v_pause_def;
  if not (select prosecdef from pg_proc where oid=v_pause_fn::oid)
     or position('auth.uid()' in v_pause_def)=0
     or position('owner_id=auth.uid()' in v_pause_def)=0
     or position('private.audit' in v_pause_def)=0 then
    raise exception 'R24 pause RPC lacks definer/owner/audit guards';
  end if;
  if has_function_privilege('anon',v_pause_fn,'EXECUTE')
     or not has_function_privilege('authenticated',v_pause_fn,'EXECUTE') then
    raise exception 'R24 pause RPC grants are incorrect';
  end if;

  select pg_get_functiondef('private.store_live(text)'::regprocedure) into v_live_def;
  if position('storefront_paused' in v_live_def)=0
     or position('storefront_pause_until' in v_live_def)=0 then
    raise exception 'R24 pause is not enforced in the central store-live gate';
  end if;
  select pg_get_functiondef('private.stores_guard()'::regprocedure) into v_guard_def;
  if position('storefront_paused' in v_guard_def)=0
     or position('seller_set_pause' in v_guard_def)=0 then
    raise exception 'R24 direct table-write guard is missing';
  end if;

  select pg_get_indexdef(i.indexrelid) into v_idx
  from pg_index i join pg_class c on c.oid=i.indexrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='stores_name_normalized_key' and i.indisunique;
  if v_idx is null or position('regexp_replace' in v_idx)=0 or position('lower' in v_idx)=0 then
    raise exception 'R25 normalized unique index missing or wrong expression';
  end if;

  if not exists(select 1 from pg_constraint where conrelid='public.stores'::regclass and conname='stores_owner_id_key' and contype='u') then
    raise exception 'Accepted one-store-per-owner constraint was removed';
  end if;
  if exists (
    select 1 from public.stores
    group by lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    having count(*)>1
  ) then
    raise exception 'Normalized duplicate store names exist';
  end if;
end
$$;
