-- Everneed messaging: guest live chat queue, persistent conversations (support, store, seller-admin, admin-user), smart triage, SLA, realtime.
-- Also applies the waitlist from shared/sql/011_website_sync.sql. Additive only.

-- ===== waitlist (pre-launch) =====
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null, name text,
  role text not null default 'shopper' check (role in ('shopper','seller','both')),
  country text, interest text, source text default 'website',
  status text not null default 'new' check (status in ('new','invited','joined','unsubscribed')),
  created_at timestamptz not null default now());
create unique index if not exists waitlist_email_uq on public.waitlist (lower(email));
alter table public.waitlist enable row level security;
drop policy if exists waitlist_admin_all on public.waitlist;
create policy waitlist_admin_all on public.waitlist for all to authenticated using (public.is_admin()) with check (public.is_admin());
create or replace function public.join_waitlist(p_email text, p_name text default null, p_role text default 'shopper', p_country text default null, p_interest text default null, p_source text default 'website')
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  insert into public.waitlist(email,name,role,country,interest,source)
  values (lower(p_email), left(p_name,120), case when p_role in ('shopper','seller','both') then p_role else 'shopper' end, left(p_country,2), left(p_interest,200), left(p_source,40))
  on conflict (lower(email)) do nothing;
end $$;
revoke all on function public.join_waitlist(text,text,text,text,text,text) from public;
grant execute on function public.join_waitlist(text,text,text,text,text,text) to anon, authenticated;
revoke all on public.waitlist from anon;

-- ===== settings =====
create table if not exists public.support_settings(key text primary key, value jsonb not null, updated_at timestamptz not null default now());
insert into public.support_settings(key,value) values
 ('sla','{"minutes":{"none":480,"starter":240,"growth":60,"pro":15},"seller_reply_minutes":30,"auto_escalate_extra_minutes":30}'::jsonb)
on conflict (key) do nothing;

-- ===== conversations =====
create table if not exists public.conversations(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('support','store','seller_admin','admin_user')),
  subject text,
  store_id text references public.stores(id) on delete set null,
  order_id text references public.orders(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open','escalated','resolved')),
  priority int not null default 0 check (priority between 0 and 3),
  tier text,
  tags text[] not null default '{}',
  assignee uuid references public.profiles(id) on delete set null,
  escalated_at timestamptz, escalation_reason text,
  sla_due_at timestamptz,
  admin_unread boolean not null default false,
  first_reply_at timestamptz,
  last_message_at timestamptz not null default now(),
  last_preview text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz);
create index if not exists conversations_last on public.conversations(last_message_at desc);
create index if not exists conversations_store on public.conversations(store_id);
create index if not exists conversations_status on public.conversations(status, priority desc);
create unique index if not exists conv_store_open on public.conversations(created_by, store_id, coalesce(order_id,'')) where kind='store' and status<>'resolved';
create unique index if not exists conv_support_open on public.conversations(created_by, kind, coalesce(store_id,'')) where kind in ('support','seller_admin') and status<>'resolved';

create table if not exists public.conversation_members(
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('buyer','seller','user','admin')),
  unread int not null default 0,
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id));
create index if not exists cm_user on public.conversation_members(user_id);

create table if not exists public.messages(
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('buyer','seller','user','admin','system')),
  kind text not null default 'text' check (kind in ('text','system','note','shield','order_card')),
  body text not null check (char_length(body) between 1 and 2000),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp());
create index if not exists messages_conv on public.messages(conversation_id, created_at);

create table if not exists public.support_rules(
  id serial primary key, name text not null, pattern text not null,
  applies_to text[] not null default '{store,support,seller_admin}',
  action text not null check (action in ('escalate','tag','shield')),
  tag text, priority int not null default 1, reason text, reply text, active boolean not null default true);

create table if not exists public.support_queue(
  id text primary key, name text, topic text, page text,
  status text not null default 'waiting' check (status in ('waiting','active','closed')),
  claimed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), last_seen timestamptz not null default now());

create table if not exists public.canned_replies(
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('admin','seller')),
  owner uuid references public.profiles(id) on delete cascade,
  title text not null, body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now());

-- ===== helpers =====
create or replace function public.chat_member(p uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.conversation_members where conversation_id=p and user_id=auth.uid()) $$;
create or replace function public.support_tier(p_store text) returns text language sql stable security definer set search_path=public as $$
  select coalesce((select lower(pl.name) from public.store_subscriptions s join public.store_plans pl on pl.id=s.plan_id
    where s.store_id=p_store and s.status not in ('cancelled','canceled','expired','ended') order by s.current_period_end desc nulls last limit 1),'none') $$;
create or replace function public.support_sla_minutes(p_tier text) returns int language sql stable security definer set search_path=public as $$
  select coalesce((select (value->'minutes'->>coalesce(p_tier,'none'))::int from public.support_settings where key='sla'),
                  (select (value->'minutes'->>'none')::int from public.support_settings where key='sla'),480) $$;

-- ===== message guard: never let a delivery code sit in chat =====
create or replace function public.chat_guard() returns trigger language plpgsql as $$
begin
  if new.kind='text' and new.body ~* '(code|otp|pin)' and new.body ~ '(^|\D)\d{4}(\D|$)' then
    new.body := regexp_replace(new.body,'(^|\D)\d{4}(\D|$)','\1••••\2','g');
    new.meta := new.meta || '{"redacted":true}'::jsonb;
  end if;
  return new;
end $$;

create or replace function public.chat_escalate_core(p_conv uuid, p_reason text, p_prio int) returns void language plpgsql security definer set search_path=public as $$
declare c public.conversations%rowtype; v_first boolean;
begin
  select * into c from public.conversations where id=p_conv for update;
  if not found then return; end if;
  v_first := c.status<>'escalated';
  update public.conversations set status='escalated', escalated_at=coalesce(escalated_at,now()), escalation_reason=coalesce(escalation_reason,p_reason),
    priority=greatest(priority,p_prio), admin_unread=true where id=p_conv;
  if v_first and c.kind='store' then
    insert into public.messages(conversation_id,sender_role,kind,body,meta)
    values(p_conv,'system','system','Everneed support has been alerted ('||p_reason||'). A person from Everneed will join this chat.',jsonb_build_object('reason',p_reason));
  end if;
end $$;

-- ===== triage: SLA, rules, shield, order bot, notifications =====
create or replace function public.chat_triage() returns trigger language plpgsql security definer set search_path=public as $$
declare c public.conversations%rowtype; r public.support_rules%rowtype; v_tags text[]:='{}'; v_prio int:=0; v_esc text; v_mins int;
        v_responder boolean; v_customer boolean; o public.orders%rowtype; v_so text; v_nm text;
begin
  select * into c from public.conversations where id=new.conversation_id;
  if not found then return new; end if;
  if new.kind in ('text','system','order_card') then
    update public.conversation_members set unread=unread+1 where conversation_id=new.conversation_id and user_id is distinct from new.sender_id;
  end if;
  if new.kind='note' then return new; end if;
  update public.conversations set last_message_at=new.created_at,
    last_preview=case when new.kind in ('text','order_card') then left(new.body,80) else last_preview end,
    status=case when status='resolved' and new.kind='text' then 'open' else status end,
    resolved_at=case when status='resolved' and new.kind='text' then null else resolved_at end,
    admin_unread=case when new.kind='text' and new.sender_role not in ('admin','system') then true else admin_unread end
  where id=new.conversation_id;
  if new.kind<>'text' then return new; end if;

  v_responder := new.sender_role='admin' or (c.kind='store' and new.sender_role='seller') or (c.kind='admin_user' and new.sender_role<>'admin');
  v_customer := not v_responder and new.sender_role<>'system';
  if v_responder then
    update public.conversations set sla_due_at=null, first_reply_at=coalesce(first_reply_at,new.created_at) where id=c.id;
  elsif v_customer then
    v_mins := case when c.kind='store' then coalesce((select (value->>'seller_reply_minutes')::int from public.support_settings where key='sla'),30)
                   when c.kind in ('support','seller_admin') then public.support_sla_minutes(c.tier) else null end;
    if v_mins is not null then update public.conversations set sla_due_at=coalesce(sla_due_at, now()+make_interval(mins=>v_mins)) where id=c.id; end if;
  end if;

  if new.meta ? 'redacted' then
    insert into public.messages(conversation_id,sender_role,kind,body,meta)
    values(new.conversation_id,'system','shield','For your safety we hid a 4-digit number. Never share your delivery code in chat. Give it only when your items arrive.','{"rule":"code"}'::jsonb);
    v_tags := array_append(v_tags,'code-shared'); v_prio := greatest(v_prio,1);
  end if;

  if new.sender_role not in ('admin','system') then
    for r in select * from public.support_rules where active and c.kind=any(applies_to) and new.body ~* pattern order by priority desc, id loop
      if r.tag is not null then v_tags := array_append(v_tags,r.tag); end if;
      v_prio := greatest(v_prio,r.priority);
      if r.action='escalate' and v_esc is null then v_esc := coalesce(r.reason,r.name); end if;
      if r.action='shield' and r.reply is not null and not exists(select 1 from public.messages where conversation_id=c.id and kind='shield' and meta->>'rule'=r.id::text and created_at>now()-interval '10 minutes') then
        insert into public.messages(conversation_id,sender_role,kind,body,meta) values(c.id,'system','shield',r.reply,jsonb_build_object('rule',r.id::text));
      end if;
    end loop;
  end if;
  if cardinality(v_tags)>0 or v_prio>0 then
    update public.conversations set tags=(select coalesce(array_agg(distinct t),'{}') from unnest(v_tags||conversations.tags) t), priority=greatest(priority,v_prio) where id=c.id;
  end if;
  if v_esc is not null then perform public.chat_escalate_core(c.id,v_esc,greatest(v_prio,1)); end if;

  if c.order_id is not null and new.sender_role in ('buyer','user') and new.body ~* '(where is|where.s my|track|order status|when will|how long|eta)' then
    select * into o from public.orders where id=c.order_id;
    if found then
      select status into v_so from public.seller_orders where order_id=c.order_id and (c.store_id is null or store_id=c.store_id) limit 1;
      insert into public.messages(conversation_id,sender_role,kind,body,meta)
      values(c.id,'system','order_card','Order '||coalesce(o.ref,left(o.id,8))||': '||coalesce(o.status,'processing')||case when v_so is not null then ' (seller: '||v_so||')' else '' end,
        jsonb_build_object('order_id',o.id,'status',o.status,'seller_status',v_so,'payment',o.payment_status));
    end if;
  end if;

  v_nm := case new.sender_role when 'admin' then 'Everneed Support' else coalesce((select name from public.profiles where id=new.sender_id),'New message') end;
  insert into public.notifications(id,user_id,kind,title,body,data)
  select gen_random_uuid()::text, m.user_id,'message',v_nm,left(new.body,120),jsonb_build_object('conversation',new.conversation_id,'kind',c.kind)
  from public.conversation_members m where m.conversation_id=new.conversation_id and m.user_id is distinct from new.sender_id and not m.muted;
  return new;
end $$;

drop trigger if exists chat_guard_bi on public.messages;
create trigger chat_guard_bi before insert on public.messages for each row execute function public.chat_guard();
drop trigger if exists chat_triage_ai on public.messages;
create trigger chat_triage_ai after insert on public.messages for each row execute function public.chat_triage();

-- ===== RPCs =====
create or replace function public.chat_send(p_conv uuid, p_body text, p_note boolean default false) returns public.messages language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); c public.conversations%rowtype; m public.conversation_members%rowtype; v_member boolean; adm boolean:=public.is_admin(); v_role text; b text:=trim(coalesce(p_body,'')); msg public.messages;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if char_length(b)<1 or char_length(b)>2000 then raise exception 'Message must be 1 to 2000 characters'; end if;
  select * into c from public.conversations where id=p_conv;
  if not found then raise exception 'Chat not found'; end if;
  select * into m from public.conversation_members where conversation_id=p_conv and user_id=uid;
  v_member := found;
  if not v_member and not adm then raise exception 'You are not part of this chat'; end if;
  if p_note and not adm then raise exception 'Only Everneed staff can add notes'; end if;
  if not public.rate_hit(uid,'chat_send',40,60) then raise exception 'Slow down a little'; end if;
  if adm then
    v_role:='admin';
    if not v_member and not p_note then
      insert into public.conversation_members(conversation_id,user_id,role) values(p_conv,uid,'admin') on conflict do nothing;
      update public.conversations set assignee=coalesce(assignee,uid) where id=p_conv;
    end if;
  else
    v_role := case m.role when 'buyer' then 'buyer' when 'seller' then 'seller' else 'user' end;
  end if;
  insert into public.messages(conversation_id,sender_id,sender_role,kind,body) values(p_conv,uid,v_role,case when p_note then 'note' else 'text' end,b) returning * into msg;
  update public.conversation_members set unread=0,last_read_at=now() where conversation_id=p_conv and user_id=uid;
  if adm then update public.conversations set admin_unread=false where id=p_conv; end if;
  return msg;
end $$;

create or replace function public.chat_start(p_kind text, p_store text default null, p_order text default null, p_subject text default null, p_first text default null, p_user uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid; st public.stores%rowtype; v_tier text;
begin
  if uid is null then raise exception 'Sign in to start a chat'; end if;
  if not public.rate_hit(uid,'chat_start',20,3600) then raise exception 'Too many new chats. Try again later.'; end if;
  if p_kind='store' then
    select * into st from public.stores where id=p_store and status='approved';
    if not found then raise exception 'Store not found'; end if;
    if st.owner_id=uid then raise exception 'You cannot message your own store'; end if;
    select id into cid from public.conversations where kind='store' and created_by=uid and store_id=p_store and coalesce(order_id,'')=coalesce(p_order,'') and status<>'resolved';
    if cid is null then
      if p_order is not null and not exists(select 1 from public.orders where id=p_order and user_id=uid) then raise exception 'Order not found'; end if;
      insert into public.conversations(kind,subject,store_id,order_id,created_by,tier) values('store',coalesce(p_subject,st.name),p_store,p_order,uid,public.support_tier(p_store)) returning id into cid;
      insert into public.conversation_members(conversation_id,user_id,role) values(cid,uid,'buyer'),(cid,st.owner_id,'seller');
    end if;
  elsif p_kind in ('support','seller_admin') then
    if p_kind='seller_admin' then
      select * into st from public.stores where id=p_store and owner_id=uid;
      if not found then raise exception 'Store not found'; end if;
    end if;
    select id into cid from public.conversations where kind=p_kind and created_by=uid and coalesce(store_id,'')=coalesce(case when p_kind='seller_admin' then p_store end,'') and status<>'resolved';
    if cid is null then
      v_tier := case when p_kind='seller_admin' then public.support_tier(p_store) else null end;
      insert into public.conversations(kind,subject,store_id,created_by,tier,priority)
      values(p_kind,coalesce(p_subject,case when p_kind='seller_admin' then st.name||' support' else 'Support' end),case when p_kind='seller_admin' then p_store end,uid,v_tier,case when v_tier='pro' then 1 else 0 end) returning id into cid;
      insert into public.conversation_members(conversation_id,user_id,role) values(cid,uid,case when p_kind='seller_admin' then 'seller' else 'user' end);
    end if;
  elsif p_kind='admin_user' then
    if not public.is_admin() then raise exception 'Admins only'; end if;
    if p_user is null then raise exception 'Choose a person'; end if;
    insert into public.conversations(kind,subject,order_id,created_by,assignee) values('admin_user',coalesce(p_subject,'Message from Everneed'),p_order,uid,uid) returning id into cid;
    insert into public.conversation_members(conversation_id,user_id,role) values(cid,p_user,'user'),(cid,uid,'admin');
  else
    raise exception 'Unknown chat type';
  end if;
  if p_first is not null and length(trim(p_first))>0 then perform public.chat_send(cid,p_first,false); end if;
  return cid;
end $$;

create or replace function public.chat_read(p_conv uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  update public.conversation_members set unread=0,last_read_at=now() where conversation_id=p_conv and user_id=auth.uid();
  if public.is_admin() then update public.conversations set admin_unread=false where id=p_conv; end if;
end $$;

create or replace function public.chat_escalate(p_conv uuid, p_reason text default 'Requested by participant') returns void language plpgsql security definer set search_path=public as $$
begin
  if not (public.chat_member(p_conv) or public.is_admin()) then raise exception 'Not allowed'; end if;
  perform public.chat_escalate_core(p_conv,left(coalesce(nullif(trim(p_reason),''),'Requested by participant'),120),1);
end $$;

create or replace function public.chat_set(p_conv uuid, p_status text default null, p_assignee uuid default null, p_tags text[] default null, p_priority int default null) returns void language plpgsql security definer set search_path=public as $$
begin
  if p_status is not null and p_status not in ('open','escalated','resolved') then raise exception 'Bad status'; end if;
  if public.is_admin() then
    update public.conversations set status=coalesce(p_status,status), assignee=coalesce(p_assignee,assignee), tags=coalesce(p_tags,tags), priority=coalesce(p_priority,priority),
      resolved_at=case when p_status='resolved' then now() when p_status in ('open','escalated') then null else resolved_at end,
      sla_due_at=case when p_status='resolved' then null else sla_due_at end where id=p_conv;
  elsif public.chat_member(p_conv) and p_status='resolved' then
    update public.conversations set status='resolved',resolved_at=now(),sla_due_at=null where id=p_conv;
  else
    raise exception 'Not allowed';
  end if;
  if p_status='resolved' then
    insert into public.messages(conversation_id,sender_role,kind,body) values(p_conv,'system','system','This chat was marked resolved. Send a message to reopen it.');
  end if;
end $$;

create or replace function public.support_sla_sweep() returns int language plpgsql security definer set search_path=public as $$
declare n int:=0; r record;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admins only'; end if;
  for r in select id,kind from public.conversations where status='open' and sla_due_at is not null and sla_due_at<now() and not ('sla-breach'=any(tags)) loop
    if r.kind='store' then perform public.chat_escalate_core(r.id,'Seller did not reply in time',1);
    else update public.conversations set tags=array_append(tags,'sla-breach'), priority=greatest(priority,2) where id=r.id; end if;
    n:=n+1;
  end loop;
  delete from public.support_queue where created_at<now()-interval '1 day' or (status='closed' and last_seen<now()-interval '1 hour');
  return n;
end $$;

create or replace function public.store_reply_stats() returns table(store_id text, median_minutes int, chats int) language sql stable security definer set search_path=public as $$
  select c.store_id, round(percentile_cont(0.5) within group (order by extract(epoch from (c.first_reply_at-c.created_at))/60))::int, count(*)::int
  from public.conversations c where c.kind='store' and c.first_reply_at is not null and c.created_at>now()-interval '30 days' group by c.store_id having count(*)>=3 $$;

create or replace function public.support_guest_open(p_id text, p_name text default null, p_topic text default null, p_page text default null) returns void language plpgsql security definer set search_path=public as $$
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{20,64}$' then raise exception 'Invalid visitor'; end if;
  if (select count(*) from public.support_queue where created_at>now()-interval '10 minutes')>300 then raise exception 'We are busy. Please try again shortly.'; end if;
  insert into public.support_queue(id,name,topic,page) values(p_id,left(nullif(trim(p_name),''),40),left(p_topic,60),left(p_page,120))
  on conflict (id) do update set last_seen=now(), status=case when public.support_queue.status='closed' then 'waiting' else public.support_queue.status end;
end $$;
create or replace function public.support_guest_ping(p_id text) returns void language sql security definer set search_path=public as $$ update public.support_queue set last_seen=now() where id=p_id and status<>'closed' $$;
create or replace function public.support_guest_close(p_id text) returns void language sql security definer set search_path=public as $$ update public.support_queue set status='closed', last_seen=now() where id=p_id $$;

-- ===== RLS =====
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.support_rules enable row level security;
alter table public.support_settings enable row level security;
alter table public.support_queue enable row level security;
alter table public.canned_replies enable row level security;

drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations for select to authenticated using (public.is_admin() or public.chat_member(id));
drop policy if exists conv_admin_update on public.conversations;
create policy conv_admin_update on public.conversations for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists cm_select on public.conversation_members;
create policy cm_select on public.conversation_members for select to authenticated using (user_id=auth.uid() or public.is_admin() or public.chat_member(conversation_id));
drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select to authenticated using (public.is_admin() or (kind<>'note' and public.chat_member(conversation_id)));
drop policy if exists rules_admin on public.support_rules;
create policy rules_admin on public.support_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists settings_admin on public.support_settings;
create policy settings_admin on public.support_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists queue_admin on public.support_queue;
create policy queue_admin on public.support_queue for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists canned_select on public.canned_replies;
create policy canned_select on public.canned_replies for select to authenticated using ((scope='admin' and public.is_admin()) or (scope='seller' and (owner is null or owner=auth.uid())) or public.is_admin());
drop policy if exists canned_write on public.canned_replies;
create policy canned_write on public.canned_replies for all to authenticated using (public.is_admin() or (scope='seller' and owner=auth.uid())) with check (public.is_admin() or (scope='seller' and owner=auth.uid()));

revoke all on public.conversations, public.conversation_members, public.messages, public.support_rules, public.support_settings, public.support_queue, public.canned_replies from anon;
grant select on public.conversations, public.conversation_members, public.messages to authenticated;
grant update on public.conversations to authenticated;
grant select, insert, update, delete on public.support_rules, public.support_settings, public.support_queue, public.canned_replies to authenticated;

revoke execute on function public.chat_send(uuid,text,boolean), public.chat_start(text,text,text,text,text,uuid), public.chat_read(uuid), public.chat_escalate(uuid,text), public.chat_set(uuid,text,uuid,text[],int), public.support_sla_sweep() from public, anon;
grant execute on function public.chat_send(uuid,text,boolean), public.chat_start(text,text,text,text,text,uuid), public.chat_read(uuid), public.chat_escalate(uuid,text), public.chat_set(uuid,text,uuid,text[],int), public.support_sla_sweep() to authenticated;
revoke execute on function public.chat_triage(), public.chat_guard(), public.chat_escalate_core(uuid,text,int), public.chat_member(uuid) from public, anon;
grant execute on function public.chat_member(uuid) to authenticated;
revoke execute on function public.support_tier(text), public.support_sla_minutes(text) from public, anon;
grant execute on function public.store_reply_stats() to anon, authenticated;
revoke execute on function public.support_guest_open(text,text,text,text), public.support_guest_ping(text), public.support_guest_close(text) from public;
grant execute on function public.support_guest_open(text,text,text,text), public.support_guest_ping(text), public.support_guest_close(text) to anon, authenticated;

-- ===== realtime =====
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.conversations; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.conversation_members; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.support_queue; exception when duplicate_object then null; end;
  end if;
end $$;

-- ===== seeds: triage rules and quick replies =====
insert into public.support_rules(name,pattern,applies_to,action,tag,priority,reason,reply)
select * from (values
 ('Refund or payment dispute','\y(refund|money back|chargeback|charge ?back|double charge|charged twice)\y','{store,support,seller_admin}'::text[],'escalate','refund',1,'Refund or payment dispute',null),
 ('Fraud, safety or legal','\y(scam|scammer|fraud|fake|stole|stolen|cheated|police|lawyer|sue|blackmail|threat\w*)\y','{store,support,seller_admin}','escalate','trust-safety',2,'Possible fraud, safety or legal issue',null),
 ('Delivery problem','(not (yet )?(delivered|received|arrived)|never (arrived|came|received)|still waiting|missing item|wrong item|damaged|broken|very late)','{store,support}','tag','delivery',1,'Delivery problem',null),
 ('Abusive language','\y(idiot|stupid|fool|useless|bastard|fuck\w*|shit\w*)\y','{store,support,seller_admin}','escalate','abuse',1,'Abusive language',null),
 ('Off-platform payment','(pay (me )?(directly|outside)|send (me )?(the )?(money|cash|payment)|transfer (it )?to my|my account number|whatsapp me|call me on|outside (the )?(app|everneed))','{store}','shield','off-platform',1,'Possible off-platform payment','Keep payment and delivery inside Everneed. Paying or arranging delivery outside the app removes buyer protection and the delivery-code safeguard.'),
 ('Asked for a person','((speak|talk) to (a |an |the )?(human|person|agent|someone|admin|manager|supervisor)|customer care|real person)','{store,support}','escalate','human-requested',0,'Asked for a person',null),
 ('Seller billing','\y(payout|withdraw\w*|commission|subscription|upgrade|downgrade|renew\w*)\y','{support,seller_admin}','tag','billing',0,'Billing question',null),
 ('Account access','(password|hacked|locked out|can.t (log|sign) ?in|verification code)','{support,seller_admin}','tag','account',0,'Account access',null)
) v(name,pattern,applies_to,action,tag,priority,reason,reply)
where not exists (select 1 from public.support_rules);

insert into public.canned_replies(scope,owner,title,body)
select * from (values
 ('admin',null::uuid,'Greeting','Hi, thanks for contacting Everneed. How can I help?'),
 ('admin',null,'Need order details','Could you share your order number so I can look into it?'),
 ('admin',null,'Escalated','I have passed this to the right team and will update you here.'),
 ('admin',null,'Closing','Is there anything else I can help with? I will mark this resolved shortly.'),
 ('seller',null,'Thanks','Thanks for your message. I will check and get back to you shortly.'),
 ('seller',null,'Preparing','Your order is being prepared and will be handed over for delivery soon.'),
 ('seller',null,'Delivery code reminder','Reminder: only share your delivery code with the rider when you receive your items.')
) v(scope,owner,title,body)
where not exists (select 1 from public.canned_replies);
