-- FIN-02A: preserve the actor performing a consent change/revocation in audit events.
begin;
create or replace function private.audit_offer_funding_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_action text; v_prev integer; v_new integer; v_actor uuid;
begin
  v_actor := coalesce(auth.uid(), new.consented_by);
  if tg_op='INSERT' then
    v_action := 'consented'; v_prev := null; v_new := new.seller_funding_bps;
  else
    v_prev := old.seller_funding_bps; v_new := new.seller_funding_bps;
    if old.revoked_at is null and new.revoked_at is not null then
      v_action := 'revoked';
    elsif old.seller_funding_bps is distinct from new.seller_funding_bps
       or old.consented_by is distinct from new.consented_by
       or old.revoked_at is distinct from new.revoked_at then
      v_action := 'changed';
    else
      return new;
    end if;
  end if;
  insert into private.offer_funding_consent_audit(
    offer_id,store_id,action,previous_seller_funding_bps,new_seller_funding_bps,actor_id
  ) values(new.offer_id,new.store_id,v_action,v_prev,v_new,v_actor);
  return new;
end
$$;
revoke all on function private.audit_offer_funding_consent() from public, anon, authenticated, service_role;
commit;
