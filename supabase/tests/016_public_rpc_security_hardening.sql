-- Public RPC security regression tests. All inserted rows and rate-limit events roll back.
begin;

do $test$
begin
  if has_function_privilege('anon', 'private.request_client_ip()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.request_client_ip()', 'EXECUTE')
     or has_function_privilege('anon', 'private.enforce_public_rate_limit(text,text,integer,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.enforce_public_rate_limit(text,text,integer,integer)', 'EXECUTE') then
    raise exception 'Private rate-limit helpers must not be executable by API roles';
  end if;
  if has_table_privilege('anon', 'public.kv', 'SELECT')
     or has_table_privilege('anon', 'public.rate_limits', 'SELECT') then
    raise exception 'Anonymous clients must not read internal key or rate-limit tables';
  end if;
end;
$test$;

select pg_catalog.set_config('request.headers', '{"x-forwarded-for":"198.51.100.20"}', true);
set local role anon;

do $test$
begin
  begin
    perform public.support_guest_open('bad', null, null, null);
    raise exception 'Expected malformed open ID to be rejected';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.support_guest_ping('bad');
    raise exception 'Expected malformed ping ID to be rejected';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.support_guest_close('bad');
    raise exception 'Expected malformed close ID to be rejected';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.join_waitlist('security-test@example.invalid', 'Test', 'root', 'NG', null, 'website');
    raise exception 'Expected invalid waitlist role to be rejected';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.join_waitlist('not-an-email', 'Test', 'shopper', 'NG', null, 'website');
    raise exception 'Expected invalid email to be rejected';
  exception when sqlstate '22023' then null;
  end;
end;
$test$;

select public.support_guest_open('security-test-visitor-00000001', 'Test visitor', 'Testing', '/');
select public.support_guest_ping('security-test-visitor-00000001');
select public.support_guest_close('security-test-visitor-00000001');
select public.support_sla_public();
select pg_catalog.count(*) from public.store_reply_stats();

reset role;

do $test$
begin
  if not exists (
    select 1 from public.support_queue
    where id = 'security-test-visitor-00000001' and status = 'closed'
  ) then
    raise exception 'Guest session close did not persist';
  end if;
end;
$test$;

-- Per-IP guest-session creation limit: 12 opens per 10 minutes, then reject.
select pg_catalog.set_config('request.headers', '{"x-forwarded-for":"198.51.100.21"}', true);
set local role anon;
do $test$
declare
  i integer;
  v_id text;
begin
  for i in 1..12 loop
    v_id := 'security-rate-limit-visitor-' || pg_catalog.lpad(i::text, 4, '0');
    perform public.support_guest_open(v_id, null, 'Rate test', '/');
  end loop;
  begin
    perform public.support_guest_open('security-rate-limit-visitor-9999', null, 'Rate test', '/');
    raise exception 'Expected guest-open rate limit to reject the 13th request';
  exception when sqlstate 'P0001' then null;
  end;
end;
$test$;

-- Waitlist is bounded by both client IP and normalized email.
select pg_catalog.set_config('request.headers', '{"x-forwarded-for":"198.51.100.22"}', true);
do $test$
begin
  perform public.join_waitlist('Security-Test+Rate@example.invalid', 'Test', 'seller', 'ng', 'Regression test', 'website');
  perform public.join_waitlist('security-test+rate@example.invalid', 'Test', 'seller', 'NG', 'Regression test', 'website');
  begin
    perform public.join_waitlist('SECURITY-TEST+RATE@example.invalid', 'Test', 'seller', 'NG', 'Regression test', 'website');
    raise exception 'Expected waitlist email rate limit to reject the third request';
  exception when sqlstate 'P0001' then null;
  end;
end;
$test$;

rollback;
