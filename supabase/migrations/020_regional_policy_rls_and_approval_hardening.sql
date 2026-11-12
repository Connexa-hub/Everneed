-- 020: tighten regional policy RLS and clarify the approval-versus-activation state.
begin;

drop policy if exists "published policy documents are readable" on public.policy_documents;
drop policy if exists "policy documents admin manage" on public.policy_documents;
create policy "policy documents read" on public.policy_documents
  for select to anon, authenticated
  using ((published and effective_at <= now()) or public.is_admin());
create policy "policy documents admin insert" on public.policy_documents
  for insert to authenticated with check (public.is_admin());
create policy "policy documents admin update" on public.policy_documents
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "policy documents admin delete" on public.policy_documents
  for delete to authenticated using (public.is_admin());

drop policy if exists "seller verification rules readable" on public.seller_verification_rules;
drop policy if exists "seller verification rules admin manage" on public.seller_verification_rules;
create policy "seller verification rules read" on public.seller_verification_rules
  for select to authenticated using (enabled or public.is_admin());
create policy "seller verification rules admin insert" on public.seller_verification_rules
  for insert to authenticated with check (public.is_admin());
create policy "seller verification rules admin update" on public.seller_verification_rules
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "seller verification rules admin delete" on public.seller_verification_rules
  for delete to authenticated using (public.is_admin());

drop policy if exists "users read own policy acceptances" on public.policy_acceptances;
create policy "users read own policy acceptances" on public.policy_acceptances
  for select to authenticated using ((select auth.uid()) = user_id or public.is_admin());

create or replace function public.approve_store(p_store text,p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare s record;
begin
  perform private.need_admin();
  select * into s from public.stores where id=p_store for update;
  if not found then raise exception 'Store not found.'; end if;
  update public.stores set status='approved',activation_status='verification_required',
    approved_at=coalesce(approved_at,now()) where id=p_store;
  insert into public.store_private(store_id,status_note) values(p_store,left(p_note,300))
    on conflict(store_id) do update set status_note=left(p_note,300);
  update public.store_applications set decision='approved',reviewed_by=auth.uid(),
    reviewed_at=now(),reason=left(p_note,300) where store_id=p_store;
  if s.owner_id is not null then
    update public.profiles set role='merchant' where id=s.owner_id and role='customer';
  end if;
  insert into public.store_subscriptions(store_id,status,current_period_start,current_period_end)
    values(p_store,'trialing',now(),now()+make_interval(days=>private.pol('trial_days',30)::int))
    on conflict(store_id) do nothing;
  perform private.notify(s.owner_id,'store_approved','Your application is approved',
    'Complete the required seller verification checks before your store can go live.',
    jsonb_build_object('store_id',p_store,'activation_status','verification_required'));
  perform private.audit(auth.uid(),'approve_store','store',p_store,
    jsonb_build_object('status',s.status,'activation_status',s.activation_status),
    jsonb_build_object('status','approved','activation_status','verification_required','note',p_note));
end $$;

revoke execute on function public.approve_store(text,text) from public, anon;
grant execute on function public.approve_store(text,text) to authenticated;
commit;
