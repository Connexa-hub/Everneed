-- R24/R25 store pause and normalized global store-name uniqueness regression.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  store_id text := gen_random_uuid()::text;
  duplicate_id text := gen_random_uuid()::text;
  result jsonb;
  duplicate_rejected boolean := false;
  direct_write_rejected boolean := false;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_super_admin)
  values(owner_id,'authenticated','authenticated','store-pause-ci-'||owner_id||'@example.test','',now(),'{}'::jsonb,'{}'::jsonb,now(),now(),false);
  insert into public.profiles(id,name,email,role)
  values(owner_id,'Store pause CI','store-pause-ci-'||owner_id||'@example.test','merchant')
  on conflict(id) do update set role='merchant';

  insert into public.stores(id,owner_id,slug,name,status,activation_status,country,business_timezone)
  values(store_id,owner_id,'pause-ci-'||owner_id,'  Pause   CI Store  ','approved','live','NG','Africa/Lagos');

  if (select name from public.stores where id=store_id) <> 'Pause CI Store' then
    raise exception 'FAIL: store name whitespace normalization did not occur';
  end if;

  begin
    insert into public.stores(id,owner_id,slug,name,status,activation_status,country)
    values(duplicate_id,gen_random_uuid(),'pause-ci-duplicate-'||owner_id,'pause ci store','draft','verification_required','NG');
  exception when unique_violation then
    duplicate_rejected := true;
  end;
  if not duplicate_rejected then
    raise exception 'FAIL: normalized case-insensitive duplicate store name was accepted';
  end if;

  if not exists(select 1 from pg_constraint where conrelid='public.stores'::regclass and conname='stores_owner_id_key') then
    raise exception 'FAIL: one-store-per-owner unique constraint missing';
  end if;

  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='stores' and column_name='paused_until') then
    raise exception 'FAIL: stores.paused_until column missing';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and tablename='stores' and indexname='stores_normalized_name_unique') then
    raise exception 'FAIL: normalized unique index missing';
  end if;
  if has_function_privilege('anon','public.seller_set_pause(timestamptz)','EXECUTE')
     or has_function_privilege('public','public.seller_set_pause(timestamptz)','EXECUTE') then
    raise exception 'FAIL: seller_set_pause is executable by anonymous/PUBLIC';
  end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  set local role authenticated;
  result := public.seller_set_pause(now()+interval '2 days');
  if result->>'is_paused' <> 'true' or (result->>'business_timezone') <> 'Africa/Lagos' then
    raise exception 'FAIL: pause RPC did not return active pause and store timezone';
  end if;
  begin
    update public.stores set paused_until=now()+interval '3 days' where id=store_id;
  exception when others then
    direct_write_rejected := true;
  end;
  if not direct_write_rejected then
    raise exception 'FAIL: direct seller UPDATE bypassed pause RPC';
  end if;
  reset role;
  if (select paused_until from public.stores where id=store_id) is null then
    raise exception 'FAIL: pause RPC did not persist expiry';
  end if;

  set local role authenticated;
  perform public.seller_set_pause(null);
  reset role;
  if (select paused_until from public.stores where id=store_id) is not null then
    raise exception 'FAIL: resume RPC did not clear pause';
  end if;
  raise notice 'PASS: store name normalization/uniqueness, one-store-per-owner and owner pause/resume';
end
$$;
rollback;
