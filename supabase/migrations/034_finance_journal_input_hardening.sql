-- FIN-01 hardening: bound untrusted journal request payloads.
-- Does not change the chart of accounts or existing journal rows.
begin;

create or replace function public.post_finance_journal(
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_currency text,
  p_description text,
  p_lines jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_currency text;
  v_hash text;
  v_existing_id uuid;
  v_existing_hash text;
  v_journal_id uuid;
  v_line jsonb;
  v_account_id uuid;
  v_line_number integer := 0;
  v_amount bigint;
  v_direction text;
  v_debits numeric := 0;
  v_credits numeric := 0;
  v_line_count integer := 0;
begin
  v_currency := upper(coalesce(p_currency, ''));
  if p_source_type is null or p_source_type <> btrim(p_source_type)
     or length(p_source_type) < 1 or length(p_source_type) > 64
     or p_source_type !~ '^[a-z][a-z0-9_.:-]*$'
     or p_source_id is null or p_source_id <> btrim(p_source_id)
     or length(p_source_id) < 1 or length(p_source_id) > 160
     or p_source_id ~ '[[:cntrl:]]'
     or p_idempotency_key is null or p_idempotency_key <> btrim(p_idempotency_key)
     or length(p_idempotency_key) < 1 or length(p_idempotency_key) > 160
     or p_idempotency_key ~ '[[:cntrl:]]'
     or v_currency not in ('NGN','GHS','KES','ZAR','GBP','USD')
     or p_currency <> v_currency
     or p_description is null or p_description <> btrim(p_description)
     or length(p_description) < 1 or length(p_description) > 240
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_metadata, '{}'::jsonb)::text) > 16384 then
    raise exception 'Invalid finance journal request.';
  end if;
  if p_lines is null then
    raise exception 'Finance journal lines are required.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Finance journal lines must be a JSON array.';
  end if;
  if octet_length(p_lines::text) > 524288 then
    raise exception 'Finance journal line payload exceeds 512 KiB.';
  end if;
  if jsonb_array_length(p_lines) < 2 or jsonb_array_length(p_lines) > 1000 then
    raise exception 'Finance journal requires between 2 and 1000 lines.';
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'source_type', p_source_type,
    'source_id', p_source_id,
    'currency', v_currency,
    'description', p_description,
    'lines', p_lines,
    'metadata', coalesce(p_metadata, '{}'::jsonb)
  )::text, 'UTF8'), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    p_source_type || ':' || p_source_id || ':' || p_idempotency_key, 0
  ));

  select j.id, j.request_hash
    into v_existing_id, v_existing_hash
    from private.finance_journals j
   where j.source_type = p_source_type
     and j.source_id = p_source_id
     and j.idempotency_key = p_idempotency_key
   for update;

  if v_existing_id is not null then
    if v_existing_hash <> v_hash then
      raise exception 'Finance journal idempotency key was reused with different content.';
    end if;
    return v_existing_id;
  end if;

  insert into private.finance_journals(
    source_type, source_id, idempotency_key, currency, description,
    request_hash, metadata
  ) values (
    p_source_type, p_source_id, p_idempotency_key, v_currency, left(p_description, 240),
    v_hash, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_journal_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_line_number := v_line_number + 1;
    if jsonb_typeof(v_line) <> 'object'
       or (v_line - array['account_code','direction','amount_minor','store_id','order_id','seller_order_id','description']::text[]) <> '{}'::jsonb then
      raise exception 'Finance journal line % has an invalid object shape.', v_line_number;
    end if;
    v_direction := lower(coalesce(v_line->>'direction',''));
    if v_direction not in ('debit','credit')
       or coalesce(v_line->>'account_code','') !~ '^[a-z][a-z0-9_.:-]{0,95}$'
       or coalesce(v_line->>'amount_minor','') !~ '^[1-9][0-9]{0,18}$'
       or (v_line ? 'store_id' and (jsonb_typeof(v_line->'store_id') <> 'string' or length(v_line->>'store_id') > 128 or (v_line->>'store_id') ~ '[[:cntrl:]]'))
       or (v_line ? 'order_id' and (jsonb_typeof(v_line->'order_id') <> 'string' or length(v_line->>'order_id') > 128 or (v_line->>'order_id') ~ '[[:cntrl:]]'))
       or (v_line ? 'seller_order_id' and (jsonb_typeof(v_line->'seller_order_id') <> 'string' or length(v_line->>'seller_order_id') > 128 or (v_line->>'seller_order_id') ~ '[[:cntrl:]]'))
       or (v_line ? 'description' and (jsonb_typeof(v_line->'description') <> 'string' or length(v_line->>'description') > 240)) then
      raise exception 'Finance journal line % is invalid.', v_line_number;
    end if;

    v_amount := (v_line->>'amount_minor')::bigint;
    select a.id into v_account_id
      from private.finance_accounts a
     where a.account_code = (v_line->>'account_code')
       and a.currency = v_currency;
    if v_account_id is null then
      raise exception 'Finance account % is not configured for currency %.',
        v_line->>'account_code', v_currency;
    end if;

    insert into private.finance_journal_lines(
      journal_id, line_number, account_id, direction, amount_minor,
      store_id, order_id, seller_order_id, description
    ) values (
      v_journal_id, v_line_number, v_account_id, v_direction, v_amount,
      nullif(v_line->>'store_id',''), nullif(v_line->>'order_id',''),
      nullif(v_line->>'seller_order_id',''), left(v_line->>'description',240)
    );

    if v_direction = 'debit' then
      v_debits := v_debits + v_amount;
    else
      v_credits := v_credits + v_amount;
    end if;
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count < 2 or v_debits <= 0 or v_debits <> v_credits then
    raise exception 'Finance journal is not balanced: debits %, credits %.', v_debits, v_credits;
  end if;

  return v_journal_id;
end
$function$;


revoke all on function public.post_finance_journal(text,text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.post_finance_journal(text,text,text,text,text,jsonb,jsonb) to service_role;

comment on function public.post_finance_journal(text,text,text,text,text,jsonb,jsonb) is
  'Service-only idempotent balanced journal posting with bounded request fields and line payloads. Does not initiate payouts or recognize unconfirmed refunds.';

commit;
