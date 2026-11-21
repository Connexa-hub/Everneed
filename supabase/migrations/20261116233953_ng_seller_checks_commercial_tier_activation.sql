-- Classify Nigerian seller checks as commercial plan verification for storefront activation.
-- Free and Starter can activate without commercial verification; Growth and Pro retain
-- their configured verification requirement. This does not waive activity-specific
-- payment-provider, AML/KYC, wallet, virtual-account or payout eligibility controls.
begin;

update public.seller_verification_rules
set requirement_scope='commercial',
    updated_at=now()
where country='NG'
  and check_type in ('phone','identity','face_liveness','business_address')
  and enabled=true
  and required=true;

do $$
declare n integer;
begin
  select count(*) into n
  from public.seller_verification_rules
  where country='NG'
    and check_type in ('phone','identity','face_liveness','business_address')
    and enabled=true and required=true
    and requirement_scope='commercial';
  if n<>4 then
    raise exception 'Expected all four enabled Nigerian seller checks to be classified as commercial; found %.',n;
  end if;
end $$;

commit;
