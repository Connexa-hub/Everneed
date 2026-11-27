-- 022: require acceptance of the latest effective English seller policy version for the store's region.
begin;
create or replace function public.submit_store(p_store text)
returns void language plpgsql security definer set search_path = ''
as $$
declare a record; s record; missing_policies text[];
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  perform private.throttle('submit_store',5,600);
  select * into s from public.stores where id=p_store and owner_id=auth.uid() for update;
  if not found then raise exception 'That is not your store.'; end if;
  if s.status not in ('draft','rejected') then raise exception 'This store has already been submitted.'; end if;
  select * into a from public.store_applications where store_id=p_store;
  if not found or coalesce(a.business_name,'')='' or coalesce(a.bank_name,'')='' or coalesce(a.account_number,'')='' or coalesce(a.account_name,'')='' then
    raise exception 'Complete your business and payout details first.';
  end if;
  select array_agg(req.policy_type order by req.policy_type) into missing_policies
  from (values ('seller_terms'),('seller_privacy'),('marketplace_rules'),('returns_refunds')) req(policy_type)
  where not exists (
    select 1
    from public.policy_documents current_doc
    join public.policy_acceptances pa
      on pa.policy_document_id=current_doc.id and pa.user_id=auth.uid() and pa.country=s.country
    where current_doc.id=(
      select d.id from public.policy_documents d
      where d.policy_type=req.policy_type and d.country=s.country and d.locale='en'
        and d.published and d.requires_acceptance and d.effective_at<=now()
      order by d.effective_at desc,d.version desc limit 1
    )
  );
  if coalesce(cardinality(missing_policies),0)>0 then
    raise exception 'Review and accept the latest seller policies for your region before submitting: %.',array_to_string(missing_policies,', ');
  end if;
  update public.stores set status='pending',activation_status='verification_required' where id=p_store;
  update public.store_applications set submitted_at=now(),decision=null,reason=null,reviewed_by=null,reviewed_at=null where store_id=p_store;
  perform private.notify_admins('store_submitted','A store is waiting for approval',s.name,jsonb_build_object('store_id',p_store));
end $$;
revoke execute on function public.submit_store(text) from public, anon;
grant execute on function public.submit_store(text) to authenticated;
commit;
