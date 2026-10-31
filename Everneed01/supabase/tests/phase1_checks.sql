-- Phase 1 checks. Run on a database with migrations 000-002 applied.
-- Everything runs inside one DO block and is rolled back by a final exception that carries the report.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  r text := ''; n int; ok boolean; i int;
  ids text[] := array['T-ORDER-1'];
begin
  insert into auth.users(id,email,aud,role) values (u1,'a@test.local','authenticated','authenticated'),(u2,'b@test.local','authenticated','authenticated');
  insert into public.orders(id,user_id,items,total,country,pm,cust,status,at,currency)
    values ('T-ORDER-1',u1,'[]'::jsonb,5000,'NG','bank','{}'::jsonb,'awaiting_transfer',0,'NGN');
  insert into public.settings(id,data) values ('NG','{"bank":"x"}'),('secretrow','{"k":"v"}') on conflict (id) do nothing;
  insert into public.products(id,name,col,price,status) values ('T-P-LIVE','Live','X',100,'published'),('T-P-OLD','Old','X',100,'archived');
  insert into public.offers(id,name,kind,value,code,limit_uses) values ('T-OFFER','t','percent',10,'TESTCODE',1);

  -- (a) a customer cannot change an order total
  perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  set local role authenticated;
  update public.orders set total = 1 where id = 'T-ORDER-1';
  get diagnostics n = row_count;
  r := r || format(E'(a) customer PATCH total: %s rows changed (want 0)\n', n);
  update public.orders set status = 'paid' where id = 'T-ORDER-1';
  get diagnostics n = row_count;
  r := r || format(E'(a) customer PATCH status=paid: %s rows changed (want 0)\n', n);
  -- report_payment works once, for the owner only
  perform public.report_payment('T-ORDER-1','REF123','sent from GTB');
  r := r || E'(a) report_payment by owner: ok\n';
  begin perform public.report_payment('T-ORDER-1','x',''); r := r || E'(a) second report: FAILED (should be refused)\n';
  exception when others then r := r || E'(a) second report refused: ok\n'; end;
  reset role;
  select total::text into r from (select r || format(E'(a) total still %s (want 5000)\n',(select total from public.orders where id='T-ORDER-1')) as total) s;

  -- another customer cannot report someone else's order
  update public.orders set status='awaiting_transfer' where id='T-ORDER-1';
  perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u2::text, true);
  set local role authenticated;
  begin perform public.report_payment('T-ORDER-1','x',''); r := r || E'(a) other user report: FAILED\n';
  exception when others then r := r || E'(a) other user report refused: ok\n'; end;
  reset role;

  -- (b) anon cannot call removed or locked RPCs
  set local role anon;
  begin perform public.email_status('a@test.local'); r := r || E'(b) email_status: STILL EXISTS\n';
  exception when others then r := r || E'(b) email_status gone: ok\n'; end;
  begin perform public.email_is_admin('a@test.local'); r := r || E'(b) email_is_admin: STILL EXISTS\n';
  exception when others then r := r || E'(b) email_is_admin gone: ok\n'; end;
  begin perform public.coupon_info('TESTCODE'); r := r || E'(b) coupon_info: STILL EXISTS\n';
  exception when others then r := r || E'(b) coupon_info gone: ok\n'; end;
  begin perform public.redeem_offer('T-OFFER'); r := r || E'(b) redeem_offer callable by anon: FAILED\n';
  exception when others then r := r || E'(b) redeem_offer locked: ok\n'; end;
  begin perform public.rate_hit(u1,'x',1,60); r := r || E'(b) rate_hit callable by anon: FAILED\n';
  exception when others then r := r || E'(b) rate_hit locked: ok\n'; end;
  begin perform public.report_payment('T-ORDER-1','x',''); r := r || E'(b) report_payment by anon: FAILED\n';
  exception when others then r := r || E'(b) report_payment refused for anon: ok\n'; end;
  -- S1 interim and archived products
  select count(*) into n from public.settings where id='secretrow';
  r := r || format(E'(S1) anon sees non-country settings row: %s (want 0)\n', n);
  select count(*) into n from public.settings where id='NG';
  r := r || format(E'(S1) anon sees country row: %s (want 1)\n', n);
  select count(*) into n from public.products where id='T-P-OLD';
  r := r || format(E'(1.2) anon sees archived product: %s (want 0)\n', n);
  select count(*) into n from public.products where id='T-P-LIVE';
  r := r || format(E'(1.2) anon sees published product: %s (want 1)\n', n);
  select count(*) into n from public.orders;
  r := r || format(E'(S9) anon sees orders: %s (want 0)\n', n);
  reset role;

  -- S7: atomic redeem and rate limit (service-side)
  select public.redeem_offer('T-OFFER') into ok; r := r || format(E'(S7) first redeem of a 1-use code: %s (want true)\n', ok);
  select public.redeem_offer('T-OFFER') into ok; r := r || format(E'(S7) second redeem: %s (want false)\n', ok);
  n := 0; for i in 1..12 loop if public.rate_hit(u1,'coupon',10,60) then n := n + 1; end if; end loop;
  r := r || format(E'(S7) rate limit allowed %s of 12 attempts (want 10)\n', n);

  raise exception E'PHASE1 REPORT (rolled back)\n%', r;
end $$;
