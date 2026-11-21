-- Authenticated RPC boundary hardening after the first-pass review of all 38 public SECURITY DEFINER routines.
-- Keep all exposed SECURITY DEFINER routines on an empty search_path. Their referenced objects are schema-qualified.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  loop
    execute format('alter function %s set search_path = ''''', f.signature);
  end loop;
end $$;

-- A store conversation may reference only an order that actually contains that store's seller order.
-- Bound the subject at the RPC boundary; chat_send already bounds the first message.
create or replace function public.chat_start(
  p_kind text,
  p_store text default null,
  p_order text default null,
  p_subject text default null,
  p_first text default null,
  p_user uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  cid uuid;
  st public.stores%rowtype;
  v_tier text;
begin
  if uid is null then raise exception 'Sign in to start a chat'; end if;
  if char_length(coalesce(p_subject, '')) > 120 then
    raise exception 'Chat subject is too long';
  end if;
  if char_length(coalesce(p_first, '')) > 2000 then
    raise exception 'First message is too long';
  end if;
  if not public.rate_hit(uid, 'chat_start', 20, 3600) then
    raise exception 'Too many new chats. Try again later.';
  end if;

  if p_kind = 'store' then
    select * into st from public.stores where id = p_store and status = 'approved';
    if not found then raise exception 'Store not found'; end if;
    if st.owner_id is not distinct from uid then raise exception 'You cannot message your own store'; end if;

    if p_order is not null and not exists (
      select 1
      from public.orders o
      join public.seller_orders so on so.order_id = o.id
      where o.id = p_order
        and o.user_id = uid
        and so.store_id = p_store
    ) then
      raise exception 'That order does not belong to this store';
    end if;

    select id into cid
    from public.conversations
    where kind = 'store'
      and created_by = uid
      and store_id = p_store
      and coalesce(order_id, '') = coalesce(p_order, '')
      and status <> 'resolved';

    if cid is null then
      insert into public.conversations(kind, subject, store_id, order_id, created_by, tier)
      values ('store', coalesce(p_subject, st.name), p_store, p_order, uid, public.support_tier(p_store))
      returning id into cid;
      insert into public.conversation_members(conversation_id, user_id, role)
      values (cid, uid, 'buyer');
      if st.owner_id is not null then
        insert into public.conversation_members(conversation_id, user_id, role)
        values (cid, st.owner_id, 'seller');
      end if;
    end if;

  elsif p_kind in ('support', 'seller_admin') then
    if p_kind = 'seller_admin' then
      select * into st from public.stores where id = p_store and owner_id = uid;
      if not found then raise exception 'Store not found'; end if;
    end if;

    select id into cid
    from public.conversations
    where kind = p_kind
      and created_by = uid
      and coalesce(store_id, '') = coalesce(case when p_kind = 'seller_admin' then p_store end, '')
      and status <> 'resolved';

    if cid is null then
      v_tier := case when p_kind = 'seller_admin' then public.support_tier(p_store) else null end;
      insert into public.conversations(kind, subject, store_id, created_by, tier, priority)
      values (
        p_kind,
        coalesce(p_subject, case when p_kind = 'seller_admin' then st.name || ' support' else 'Support' end),
        case when p_kind = 'seller_admin' then p_store end,
        uid,
        v_tier,
        case when v_tier = 'pro' then 1 else 0 end
      )
      returning id into cid;
      insert into public.conversation_members(conversation_id, user_id, role)
      values (cid, uid, case when p_kind = 'seller_admin' then 'seller' else 'user' end);
    end if;

  elsif p_kind = 'admin_user' then
    if not public.is_admin() then raise exception 'Admins only'; end if;
    if p_user is null then raise exception 'Choose a person'; end if;
    insert into public.conversations(kind, subject, order_id, created_by, assignee)
    values ('admin_user', coalesce(p_subject, 'Message from Everneed'), p_order, uid, uid)
    returning id into cid;
    insert into public.conversation_members(conversation_id, user_id, role)
    values (cid, p_user, 'user'), (cid, uid, 'admin');
  else
    raise exception 'Unknown chat type';
  end if;

  if p_first is not null and char_length(trim(p_first)) > 0 then
    perform public.chat_send(cid, p_first, false);
  end if;
  return cid;
end
$function$;

-- Hub checks must contain exactly one valid result for every item in this seller order.
-- Reject duplicates, extra IDs and missing IDs before changing the order state.
create or replace function public.hub_receive(p_so text, p_check jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  so record;
  bad integer;
  missing integer;
  expected integer;
begin
  perform private.need_admin();
  perform private.throttle('hub_receive', 120, 60);

  select * into so from public.seller_orders where id = p_so for update;
  if not found or so.status <> 'handover_pending' then
    raise exception 'This seller order is not waiting at the hub.';
  end if;

  if jsonb_typeof(p_check) is distinct from 'array' then
    raise exception 'Send one check result per item.';
  end if;

  select count(*) into expected
  from public.order_items
  where seller_order_id = p_so;

  if expected = 0 or jsonb_array_length(p_check) <> expected then
    raise exception 'Send exactly one check result per item.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_check) c
    where jsonb_typeof(c) <> 'object'
       or nullif(btrim(c->>'item_id'), '') is null
       or coalesce(c->>'status', '') not in ('received', 'missing', 'damaged')
  ) then
    raise exception 'Each item needs a valid check result.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_check) c
    where not exists (
      select 1
      from public.order_items i
      where i.seller_order_id = p_so
        and i.id = c->>'item_id'
    )
  ) then
    raise exception 'The check contains an item that is not in this seller order.';
  end if;

  select count(*) into missing
  from public.order_items i
  where i.seller_order_id = p_so
    and not exists (
      select 1
      from jsonb_array_elements(p_check) c
      where c->>'item_id' = i.id
    );

  if missing > 0 then
    raise exception 'Every item must be checked exactly once.';
  end if;

  select count(*) into bad
  from jsonb_array_elements(p_check) c
  where c->>'status' <> 'received';

  update public.seller_orders
  set hub_check = p_check,
      hub_received_at = now(),
      status = case when bad = 0 then 'at_hub' else 'issue' end
  where id = p_so;

  if bad > 0 then
    perform public.notify_admins('hub_issue', 'Hub check found a problem', null, jsonb_build_object('seller_order_id', p_so));
  end if;

  perform private.audit(auth.uid(), 'hub_receive', 'seller_order', p_so, null, p_check);
  perform private.sync_order(so.order_id);
end
$function$;

-- A service-role/cron invocation may have no user subject. An authenticated JWT must always be admin.
create or replace function public.support_sla_sweep()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n integer := 0;
  r record;
begin
  if coalesce(auth.role(), '') = 'authenticated' and not public.is_admin() then
    raise exception 'Admins only';
  end if;

  for r in
    select id, kind
    from public.conversations
    where status = 'open'
      and sla_due_at is not null
      and sla_due_at < now()
      and not ('sla-breach' = any(tags))
  loop
    if r.kind = 'store' then
      perform public.chat_escalate_core(r.id, 'Seller did not reply in time', 1);
    else
      update public.conversations
      set tags = array_append(tags, 'sla-breach'),
          priority = greatest(priority, 2)
      where id = r.id;
    end if;
    n := n + 1;
  end loop;

  delete from public.support_queue
  where created_at < now() - interval '1 day'
     or (status = 'closed' and last_seen < now() - interval '1 hour');

  return n;
end
$function$;
