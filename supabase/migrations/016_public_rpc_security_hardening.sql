-- Public RPC hardening: preserve public features while bounding abuse and tightening definer execution.
-- The rate-limit subject is a keyed pseudonym (pepper held in the RLS-protected kv table);
-- raw client IP addresses and email addresses are never written to rate_limits.

insert into public.kv(key, value)
values (
  'public_rpc_rate_limit_pepper_v1',
  pg_catalog.jsonb_build_object(
    'secret',
    pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text
  )
)
on conflict (key) do nothing;

create or replace function private.request_client_ip()
returns inet
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_headers jsonb;
  v_raw text;
begin
  v_headers := coalesce(
    nullif(pg_catalog.current_setting('request.headers', true), '')::jsonb,
    '{}'::jsonb
  );
  v_raw := nullif(pg_catalog.btrim(pg_catalog.split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), '');
  if v_raw is null then
    raise exception 'Unable to validate request origin' using errcode = '22023';
  end if;
  begin
    return v_raw::inet;
  exception when invalid_text_representation then
    raise exception 'Unable to validate request origin' using errcode = '22023';
  end;
end;
$function$;

create or replace function private.enforce_public_rate_limit(
  p_subject text,
  p_action text,
  p_max integer,
  p_window_seconds integer
)
returns void
language plpgsql
set search_path = ''
as $function$
declare
  v_pepper text;
  v_fingerprint uuid;
  v_count integer;
begin
  if p_subject is null or p_subject = ''
     or p_action not in ('guest_open', 'guest_ping', 'guest_close', 'waitlist_ip', 'waitlist_email')
     or p_max < 1 or p_max > 1000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit configuration' using errcode = '22023';
  end if;

  select value->>'secret' into v_pepper
  from public.kv
  where key = 'public_rpc_rate_limit_pepper_v1';

  if v_pepper is null or length(v_pepper) < 64 then
    raise exception 'Public rate limiting is not configured' using errcode = '55000';
  end if;

  -- Keyed pseudonym prevents storing raw IP/email identifiers in the rate-limit table.
  v_fingerprint := pg_catalog.md5(v_pepper || ':' || p_subject)::uuid;

  -- Serialize requests for the same subject/action so concurrent calls cannot race the count.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_fingerprint::text || ':' || p_action, 0)
  );

  delete from public.rate_limits
  where at < pg_catalog.now() - interval '1 day';

  select pg_catalog.count(*) into v_count
  from public.rate_limits
  where user_id = v_fingerprint
    and action = p_action
    and at > pg_catalog.now() - pg_catalog.make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    raise exception 'Too many attempts. Please wait and try again.' using errcode = 'P0001';
  end if;

  insert into public.rate_limits(user_id, action)
  values (v_fingerprint, p_action);
end;
$function$;

revoke all on function private.request_client_ip() from public, anon, authenticated;
revoke all on function private.enforce_public_rate_limit(text, text, integer, integer) from public, anon, authenticated;

create or replace function public.join_waitlist(
  p_email text,
  p_name text default null,
  p_role text default 'shopper',
  p_country text default null,
  p_interest text default null,
  p_source text default 'website'
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_ip inet;
begin
  if v_email = ''
     or pg_catalog.length(v_email) > 254
     or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email' using errcode = '22023';
  end if;
  if p_role not in ('shopper', 'seller', 'both') then
    raise exception 'Choose a valid waitlist role' using errcode = '22023';
  end if;
  if p_country is not null and p_country !~* '^[a-z]{2}$' then
    raise exception 'Choose a valid country' using errcode = '22023';
  end if;

  v_ip := private.request_client_ip();
  perform private.enforce_public_rate_limit('ip:' || pg_catalog.host(v_ip), 'waitlist_ip', 15, 3600);
  perform private.enforce_public_rate_limit('email:' || v_email, 'waitlist_email', 2, 86400);

  insert into public.waitlist(email, name, role, country, interest, source)
  values (
    v_email,
    nullif(pg_catalog.left(pg_catalog.btrim(p_name), 120), ''),
    p_role,
    case when p_country is null then null else pg_catalog.upper(p_country) end,
    nullif(pg_catalog.left(pg_catalog.btrim(p_interest), 200), ''),
    case when p_source in ('website', 'support-callback') then p_source else 'website' end
  )
  on conflict (lower(email)) do nothing;
end;
$function$;

create or replace function public.support_guest_open(
  p_id text,
  p_name text default null,
  p_topic text default null,
  p_page text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ip inet;
  v_rows integer;
begin
  if p_id is null or pg_catalog.length(p_id) < 20 or pg_catalog.length(p_id) > 64
     or p_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid visitor' using errcode = '22023';
  end if;
  if pg_catalog.length(coalesce(p_name, '')) > 40
     or pg_catalog.length(coalesce(p_topic, '')) > 60
     or pg_catalog.length(coalesce(p_page, '')) > 120 then
    raise exception 'Invalid support request' using errcode = '22023';
  end if;

  v_ip := private.request_client_ip();
  perform private.enforce_public_rate_limit('ip:' || pg_catalog.host(v_ip), 'guest_open', 12, 600);

  if (select pg_catalog.count(*) from public.support_queue where created_at > pg_catalog.now() - interval '10 minutes') > 300 then
    raise exception 'We are busy. Please try again shortly.';
  end if;

  insert into public.support_queue(id, name, topic, page)
  values (
    p_id,
    nullif(pg_catalog.left(pg_catalog.btrim(p_name), 40), ''),
    nullif(pg_catalog.left(pg_catalog.btrim(p_topic), 60), ''),
    nullif(pg_catalog.left(pg_catalog.btrim(p_page), 120), '')
  )
  on conflict (id) do update
    set last_seen = pg_catalog.now()
    where public.support_queue.status <> 'closed';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'This chat session has ended' using errcode = 'P0001';
  end if;
end;
$function$;

create or replace function public.support_guest_ping(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ip inet;
begin
  if p_id is null or pg_catalog.length(p_id) < 20 or pg_catalog.length(p_id) > 64
     or p_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid visitor' using errcode = '22023';
  end if;
  v_ip := private.request_client_ip();
  perform private.enforce_public_rate_limit('ip:' || pg_catalog.host(v_ip), 'guest_ping', 180, 600);

  update public.support_queue
  set last_seen = pg_catalog.now()
  where id = p_id and status <> 'closed';
end;
$function$;

create or replace function public.support_guest_close(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ip inet;
begin
  if p_id is null or pg_catalog.length(p_id) < 20 or pg_catalog.length(p_id) > 64
     or p_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid visitor' using errcode = '22023';
  end if;
  v_ip := private.request_client_ip();
  perform private.enforce_public_rate_limit('ip:' || pg_catalog.host(v_ip), 'guest_close', 30, 600);

  update public.support_queue
  set status = 'closed', last_seen = pg_catalog.now()
  where id = p_id;
end;
$function$;

-- These two public read RPCs intentionally disclose only public operational aggregates/configuration.
-- Pin their search paths to pg_catalog only; keep explicit API grants, not implicit PUBLIC grants.
alter function public.store_reply_stats() set search_path = '';
alter function public.support_sla_public() set search_path = '';

revoke all on function public.join_waitlist(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text, text, text) to anon, authenticated;

revoke all on function public.support_guest_open(text, text, text, text) from public, anon, authenticated;
grant execute on function public.support_guest_open(text, text, text, text) to anon, authenticated;

revoke all on function public.support_guest_ping(text) from public, anon, authenticated;
grant execute on function public.support_guest_ping(text) to anon, authenticated;

revoke all on function public.support_guest_close(text) from public, anon, authenticated;
grant execute on function public.support_guest_close(text) to anon, authenticated;

revoke all on function public.store_reply_stats() from public, anon, authenticated;
grant execute on function public.store_reply_stats() to anon, authenticated;

revoke all on function public.support_sla_public() from public, anon, authenticated;
grant execute on function public.support_sla_public() to anon, authenticated;
