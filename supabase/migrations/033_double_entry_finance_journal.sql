-- Everneed Finance Phase 3 — immutable, balanced double-entry journal foundation
-- Source-only. Does not replace the seller subledger or automate payouts.

begin;

create table if not exists private.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null,
  account_name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  currency text not null check (currency in ('NGN','GHS','KES','ZAR','GBP','USD')),
  created_at timestamptz not null default now(),
  unique (account_code, currency)
);

create table if not exists private.finance_journals (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  idempotency_key text not null,
  currency text not null check (currency in ('NGN','GHS','KES','ZAR','GBP','USD')),
  description text not null,
  request_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  reversal_of uuid references private.finance_journals(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz not null default now(),
  created_by uuid,
  unique (source_type, source_id, idempotency_key),
  unique (reversal_of)
);

create table if not exists private.finance_journal_lines (
  id bigint generated always as identity primary key,
  journal_id uuid not null references private.finance_journals(id),
  line_number integer not null,
  account_id uuid not null references private.finance_accounts(id),
  direction text not null check (direction in ('debit','credit')),
  amount_minor bigint not null check (amount_minor > 0),
  store_id text,
  order_id text,
  seller_order_id text,
  description text,
  created_at timestamptz not null default now(),
  unique (journal_id, line_number)
);

create index if not exists finance_journal_lines_account_idx
  on private.finance_journal_lines(account_id, journal_id);
create index if not exists finance_journal_lines_store_idx
  on private.finance_journal_lines(store_id, journal_id)
  where store_id is not null;
create index if not exists finance_journals_source_idx
  on private.finance_journals(source_type, source_id, posted_at desc);

-- Base chart of accounts. Seller attribution is carried on journal lines so each
-- account remains reusable while balances can still be derived per store.
insert into private.finance_accounts(account_code, account_name, account_type, currency)
select a.account_code, a.account_name, a.account_type, c.currency
from (values
  ('asset.paystack_clearing','Paystack clearing','asset'),
  ('asset.bank_cash','Bank cash','asset'),
  ('asset.cash_in_transit','Cash in transit','asset'),
  ('liability.seller_payable','Seller payable','liability'),
  ('liability.customer_refund_payable','Customer refund payable','liability'),
  ('liability.tax_payable','Tax payable','liability'),
  ('liability.delivery_partner_payable','Delivery partner payable','liability'),
  ('liability.customer_funds_held','Customer funds held','liability'),
  ('revenue.platform_commission','Platform commission revenue','revenue'),
  ('revenue.delivery','Delivery revenue','revenue'),
  ('revenue.seller_ads','Seller advertising revenue','revenue'),
  ('expense.refunds','Refund expense','expense'),
  ('expense.payment_processing_fees','Payment processing fees','expense'),
  ('expense.chargebacks','Chargeback expense','expense'),
  ('expense.delivery_operations','Delivery operations expense','expense'),
  ('expense.adjustments','Finance adjustments','expense')
) as a(account_code,account_name,account_type)
cross join (values ('NGN'),('GHS'),('KES'),('ZAR'),('GBP'),('USD')) as c(currency)
on conflict (account_code, currency) do nothing;

revoke all on private.finance_accounts from public, anon, authenticated, service_role;
revoke all on private.finance_journals from public, anon, authenticated, service_role;
revoke all on private.finance_journal_lines from public, anon, authenticated, service_role;
grant select on private.finance_accounts to service_role;
grant select on private.finance_journals to service_role;
grant select on private.finance_journal_lines to service_role;

create or replace function private.finance_immutable_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Posted finance records are immutable; post a reversal instead.';
end
$function$;

revoke all on function private.finance_immutable_guard() from public, anon, authenticated;

drop trigger if exists finance_journals_immutable on private.finance_journals;
create trigger finance_journals_immutable
before update or delete on private.finance_journals
for each row execute function private.finance_immutable_guard();

drop trigger if exists finance_journal_lines_immutable on private.finance_journal_lines;
create trigger finance_journal_lines_immutable
before update or delete on private.finance_journal_lines
for each row execute function private.finance_immutable_guard();

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
  if coalesce(trim(p_source_type), '') = ''
     or coalesce(trim(p_source_id), '') = ''
     or coalesce(trim(p_idempotency_key), '') = ''
     or v_currency not in ('NGN','GHS','KES','ZAR','GBP','USD')
     or coalesce(trim(p_description), '') = ''
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid finance journal request.';
  end if;
  if p_lines is null then
    raise exception 'Finance journal lines are required.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Finance journal lines must be a JSON array.';
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
    v_direction := lower(coalesce(v_line->>'direction',''));
    if v_direction not in ('debit','credit')
       or coalesce(v_line->>'account_code','') = ''
       or coalesce(v_line->>'amount_minor','') !~ '^[1-9][0-9]*$' then
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

comment on table private.finance_journals is
  'Immutable posted double-entry journal headers. One currency per journal; use reversal journals for corrections.';
comment on table private.finance_journal_lines is
  'Immutable debit/credit lines in integer minor units; each posted journal must balance.';
comment on function public.post_finance_journal(text,text,text,text,text,jsonb,jsonb) is
  'Service-only, idempotent balanced journal posting. Does not initiate payouts or recognize unconfirmed refunds.';


create or replace function public.reverse_finance_journal(
  p_original_journal_id uuid,
  p_idempotency_key text,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_original private.finance_journals%rowtype;
  v_existing_id uuid;
  v_existing_hash text;
  v_journal_id uuid;
  v_hash text;
begin
  if p_original_journal_id is null
     or coalesce(trim(p_idempotency_key), '') = ''
     or coalesce(trim(p_reason), '') = ''
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid finance journal reversal request.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'finance-reversal:' || p_original_journal_id::text, 0
  ));

  select * into v_original
    from private.finance_journals
   where id = p_original_journal_id
   for update;
  if not found then
    raise exception 'Original finance journal was not found.';
  end if;
  if v_original.reversal_of is not null then
    raise exception 'A reversal journal cannot itself be reversed.';
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'original_journal_id', p_original_journal_id,
    'idempotency_key', p_idempotency_key,
    'reason', p_reason,
    'metadata', coalesce(p_metadata, '{}'::jsonb)
  )::text, 'UTF8'), 'sha256'), 'hex');

  select j.id, j.request_hash
    into v_existing_id, v_existing_hash
    from private.finance_journals j
   where j.reversal_of = p_original_journal_id
   for update;
  if v_existing_id is not null then
    if v_existing_hash <> v_hash then
      raise exception 'Original finance journal has already been reversed with different details.';
    end if;
    return v_existing_id;
  end if;

  insert into private.finance_journals(
    source_type, source_id, idempotency_key, currency, description,
    request_hash, metadata, reversal_of
  ) values (
    'journal_reversal', p_original_journal_id::text, p_idempotency_key,
    v_original.currency, left('Reversal: ' || p_reason, 240),
    v_hash, coalesce(p_metadata, '{}'::jsonb), p_original_journal_id
  ) returning id into v_journal_id;

  insert into private.finance_journal_lines(
    journal_id, line_number, account_id, direction, amount_minor,
    store_id, order_id, seller_order_id, description
  )
  select
    v_journal_id,
    l.line_number,
    l.account_id,
    case when l.direction = 'debit' then 'credit' else 'debit' end,
    l.amount_minor,
    l.store_id,
    l.order_id,
    l.seller_order_id,
    left('Reversal: ' || coalesce(l.description, p_reason), 240)
  from private.finance_journal_lines l
  where l.journal_id = p_original_journal_id
  order by l.line_number;

  if not exists (select 1 from private.finance_journal_lines where journal_id = v_journal_id) then
    raise exception 'Original finance journal has no lines to reverse.';
  end if;

  return v_journal_id;
end
$function$;

revoke all on function public.reverse_finance_journal(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.reverse_finance_journal(uuid,text,text,jsonb) to service_role;

comment on function public.reverse_finance_journal(uuid,text,text,jsonb) is
  'Service-only idempotent full reversal of a posted journal. Original and reversal are immutable; partial refunds require a separate allocation flow.';

commit;
