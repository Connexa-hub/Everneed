-- Seller inbox notification contract: typed message notifications, deep links and realtime delivery.
-- The existing chat_triage_ai trigger creates generic "message" notifications.
-- This AFTER trigger runs alphabetically after chat_triage_ai and upgrades those rows
-- without duplicating notifications or altering unread/mute behavior.

create or replace function public.chat_notification_contract()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_conversation_kind text;
  v_notification_kind text;
begin
  if new.kind <> 'text' or new.sender_role = 'system' then
    return new;
  end if;

  select c.kind into v_conversation_kind
  from public.conversations c
  where c.id = new.conversation_id;

  if not found then
    return new;
  end if;

  v_notification_kind := case v_conversation_kind
    when 'store' then 'message_customer'
    when 'seller_admin' then 'message_everneed'
    when 'admin_user' then 'message_everneed'
    when 'support' then 'message_support'
    else 'message_support'
  end;

  update public.notifications n
  set kind = v_notification_kind,
      data = coalesce(n.data, '{}'::jsonb) || jsonb_build_object(
        'url', '/inbox/' || new.conversation_id::text,
        'conversation_id', new.conversation_id,
        'conversation', new.conversation_id,
        'kind', v_conversation_kind
      )
  where n.kind = 'message'
    and n.data->>'conversation' = new.conversation_id::text
    and n.body is not distinct from left(new.body, 120)
    and n.created_at = transaction_timestamp()
    and n.user_id in (
      select cm.user_id
      from public.conversation_members cm
      where cm.conversation_id = new.conversation_id
        and cm.user_id is distinct from new.sender_id
    );

  return new;
end
$function$;

drop trigger if exists zzz_chat_notification_contract on public.messages;
create trigger zzz_chat_notification_contract
after insert on public.messages
for each row execute function public.chat_notification_contract();

comment on function public.chat_notification_contract() is
  'Upgrades chat_triage_ai generic notifications to seller-app kinds and adds conversation deep links.';

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
