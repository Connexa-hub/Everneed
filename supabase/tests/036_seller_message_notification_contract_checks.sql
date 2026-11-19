-- Seller message notification contract regression checks.
-- Catalog assertions: no test users or data mutations required.
do $$
declare
  v_def text;
  v_trigger_order text[];
begin
  if to_regprocedure('public.chat_notification_contract()') is null then
    raise exception 'FAIL: notification contract trigger function missing';
  end if;

  select pg_get_functiondef('public.chat_notification_contract()'::regprocedure)
    into v_def;
  if position('message_customer' in v_def)=0
    or position('message_everneed' in v_def)=0
    or position('message_support' in v_def)=0
    or position('inbox/' in v_def)=0
    or position('conversation_id' in v_def)=0 then
    raise exception 'FAIL: typed message notification or deep-link payload is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.messages'::regclass
      and tgname='zzz_chat_notification_contract'
      and not tgisinternal
  ) then
    raise exception 'FAIL: notification contract trigger is not attached to messages';
  end if;

  select array_agg(tgname order by tgname) into v_trigger_order
  from pg_trigger
  where tgrelid='public.messages'::regclass
    and not tgisinternal
    and (tgtype & 4) = 4; -- INSERT

  if array_position(v_trigger_order,'chat_triage_ai') is null
    or array_position(v_trigger_order,'zzz_chat_notification_contract') is null
    or array_position(v_trigger_order,'zzz_chat_notification_contract')
       <= array_position(v_trigger_order,'chat_triage_ai') then
    raise exception 'FAIL: notification contract trigger must run after chat_triage_ai';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='notifications'
  ) then
    raise exception 'FAIL: notifications is missing from supabase_realtime';
  end if;

  if not (
    select rowsecurity from pg_tables
    where schemaname='public' and tablename='notifications'
  ) then
    raise exception 'FAIL: notifications RLS must remain enabled';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notifications'
      and policyname='notifications own'
      and cmd='SELECT'
      and qual like '%user_id = auth.uid()%'
  ) then
    raise exception 'FAIL: notification SELECT must be owner-scoped';
  end if;

  if has_table_privilege('anon','public.notifications','INSERT')
    or has_table_privilege('authenticated','public.notifications','INSERT') then
    raise exception 'FAIL: API roles must not insert notification rows directly';
  end if;
end
$$;
