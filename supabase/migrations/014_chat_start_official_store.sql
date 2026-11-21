-- Everneed's own (official) store has no owner: chats to it are answered by Everneed staff, so only the buyer is a member.
create or replace function public.chat_start(p_kind text, p_store text default null, p_order text default null, p_subject text default null, p_first text default null, p_user uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid; st public.stores%rowtype; v_tier text;
begin
  if uid is null then raise exception 'Sign in to start a chat'; end if;
  if not public.rate_hit(uid,'chat_start',20,3600) then raise exception 'Too many new chats. Try again later.'; end if;
  if p_kind='store' then
    select * into st from public.stores where id=p_store and status='approved';
    if not found then raise exception 'Store not found'; end if;
    if st.owner_id is not distinct from uid then raise exception 'You cannot message your own store'; end if;
    select id into cid from public.conversations where kind='store' and created_by=uid and store_id=p_store and coalesce(order_id,'')=coalesce(p_order,'') and status<>'resolved';
    if cid is null then
      if p_order is not null and not exists(select 1 from public.orders where id=p_order and user_id=uid) then raise exception 'Order not found'; end if;
      insert into public.conversations(kind,subject,store_id,order_id,created_by,tier) values('store',coalesce(p_subject,st.name),p_store,p_order,uid,public.support_tier(p_store)) returning id into cid;
      insert into public.conversation_members(conversation_id,user_id,role) values(cid,uid,'buyer');
      if st.owner_id is not null then insert into public.conversation_members(conversation_id,user_id,role) values(cid,st.owner_id,'seller'); end if;
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
