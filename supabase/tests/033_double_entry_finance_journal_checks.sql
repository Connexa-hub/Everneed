-- Structural and behavioural checks for finance journal migration 033.

begin;
do $$
declare
  v_fn regprocedure;
  v_reverse_fn regprocedure;
  v_journal_id uuid;
  v_repeat_id uuid;
  v_reversal_id uuid;
  v_reversal_repeat_id uuid;
  v_failed boolean := false;
  v_line_count integer;
  v_debits numeric;
  v_credits numeric;
  v_many_lines jsonb;
begin
  v_fn := to_regprocedure('public.post_finance_journal(text,text,text,text,text,jsonb,jsonb)');
  if v_fn is null then
    raise exception 'Finance journal posting RPC is missing';
  end if;
  if not (select prosecdef from pg_proc where oid=v_fn::oid)
     or not (select coalesce(array_to_string(proconfig,','),'') like '%search_path=""%' from pg_proc where oid=v_fn::oid) then
    raise exception 'Finance journal RPC must be SECURITY DEFINER with an empty search_path';
  end if;
  if has_function_privilege('anon',v_fn,'EXECUTE')
     or has_function_privilege('authenticated',v_fn,'EXECUTE')
     or not has_function_privilege('service_role',v_fn,'EXECUTE') then
    raise exception 'Finance journal RPC grants are not service-role-only';
  end if;
  v_reverse_fn := to_regprocedure('public.reverse_finance_journal(uuid,text,text,jsonb)');
  if v_reverse_fn is null
     or not (select prosecdef from pg_proc where oid=v_reverse_fn::oid)
     or not (select coalesce(array_to_string(proconfig,','),'') like '%search_path=""%' from pg_proc where oid=v_reverse_fn::oid)
     or has_function_privilege('anon',v_reverse_fn,'EXECUTE')
     or has_function_privilege('authenticated',v_reverse_fn,'EXECUTE')
     or not has_function_privilege('service_role',v_reverse_fn,'EXECUTE') then
    raise exception 'Finance reversal RPC security boundary is incorrect';
  end if;

  if has_table_privilege('service_role','private.finance_journals','INSERT')
     or has_table_privilege('service_role','private.finance_journals','UPDATE')
     or has_table_privilege('service_role','private.finance_journal_lines','INSERT')
     or has_table_privilege('service_role','private.finance_journal_lines','UPDATE') then
    raise exception 'service_role must post only through the balanced journal RPC, not direct table writes';
  end if;

  if has_table_privilege('anon','private.finance_journals','SELECT')
     or has_table_privilege('authenticated','private.finance_journals','SELECT')
     or has_table_privilege('anon','private.finance_journal_lines','SELECT')
     or has_table_privilege('authenticated','private.finance_journal_lines','SELECT') then
    raise exception 'Client roles must not read private finance journal tables';
  end if;

  if not exists (select 1 from pg_trigger where tgname='finance_journals_immutable' and tgrelid='private.finance_journals'::regclass and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='finance_journal_lines_immutable' and tgrelid='private.finance_journal_lines'::regclass and not tgisinternal) then
    raise exception 'Finance journal headers and lines must be immutable';
  end if;

  v_journal_id := public.post_finance_journal(
    'ci_test','phase3-balanced','ci-phase3-balanced','NGN','Balanced journal test',
    '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"12500","store_id":"ci-store"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"12500","store_id":"ci-store"}]'::jsonb,
    '{"test":true}'::jsonb
  );

  select count(*),
         coalesce(sum(amount_minor) filter (where direction='debit'),0),
         coalesce(sum(amount_minor) filter (where direction='credit'),0)
    into v_line_count,v_debits,v_credits
    from private.finance_journal_lines where journal_id=v_journal_id;
  if v_line_count <> 2 or v_debits <> 12500 or v_credits <> 12500 then
    raise exception 'Balanced journal did not persist the expected two lines.';
  end if;

  v_repeat_id := public.post_finance_journal(
    'ci_test','phase3-balanced','ci-phase3-balanced','NGN','Balanced journal test',
    '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"12500","store_id":"ci-store"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"12500","store_id":"ci-store"}]'::jsonb,
    '{"test":true}'::jsonb
  );
  if v_repeat_id <> v_journal_id then
    raise exception 'An identical idempotent retry created a second journal.';
  end if;

  begin
    perform public.post_finance_journal(
      'ci_test','phase3-unbalanced','ci-phase3-unbalanced','NGN','Unbalanced journal test',
      '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"100","store_id":"ci-store"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"99","store_id":"ci-store"}]'::jsonb,
      '{"test":true}'::jsonb
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'An unbalanced journal was accepted.';
  end if;

  v_failed := false;
  begin
    perform public.post_finance_journal(
      'ci_test','phase3-balanced','ci-phase3-balanced','NGN','Different content with reused key',
      '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"12501","store_id":"ci-store"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"12501","store_id":"ci-store"}]'::jsonb,
      '{"test":true}'::jsonb
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Idempotency key reuse with different content was accepted.';
  end if;

  -- Reject malformed or unsupported journal requests.
  v_failed := false;
  begin
    perform public.post_finance_journal(
      'ci_test','phase3-bad-currency','ci-bad-currency','EUR','Unsupported currency',
      '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"1"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"1"}]'::jsonb,
      '{"test":true}'::jsonb
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Unsupported currency was accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal(
      'ci_test','phase3-unknown-account','ci-unknown-account','NGN','Unknown account',
      '[{"account_code":"asset.not_configured","direction":"debit","amount_minor":"1"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"1"}]'::jsonb,
      '{"test":true}'::jsonb
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Unknown account code was accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal(
      'ci_test','phase3-zero-amount','ci-zero-amount','NGN','Zero amount',
      '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"0"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"0"}]'::jsonb,
      '{"test":true}'::jsonb
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Zero amount was accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal(
      'ci_test','phase3-negative-amount','ci-negative-amount','NGN','Negative amount',
      '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"-1"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"-1"}]'::jsonb,
      '{"test":true}'::jsonb
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Negative amount was accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal(
      'ci_test','phase3-invalid-direction','ci-invalid-direction','NGN','Invalid direction',
      '[{"account_code":"asset.paystack_clearing","direction":"sideways","amount_minor":"1"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"1"}]'::jsonb,
      '{"test":true}'::jsonb
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Invalid line direction was accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal(
      'ci_test','phase3-invalid-lines-shape','ci-invalid-lines-shape','NGN','Invalid lines shape',
      '{}'::jsonb,'{"test":true}'::jsonb
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Non-array journal lines were accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal(
      'ci_test','phase3-invalid-metadata','ci-invalid-metadata','NGN','Invalid metadata',
      '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"1"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"1"}]'::jsonb,
      '[]'::jsonb
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'Non-object metadata was accepted.'; end if;

  select jsonb_agg(jsonb_build_object(
    'account_code', case when g=1 then 'asset.paystack_clearing' else 'liability.seller_payable' end,
    'direction', case when g=1 then 'debit' else 'credit' end,
    'amount_minor','1'
  ))
  into v_many_lines
  from generate_series(1,1001) g;
  v_failed := false;
  begin
    perform public.post_finance_journal(
      'ci_test','phase3-too-many-lines','ci-too-many-lines','NGN','Too many lines',
      v_many_lines,'{"test":true}'::jsonb
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'More than 1000 journal lines were accepted.'; end if;

  v_reversal_id := public.reverse_finance_journal(
    v_journal_id,'ci-phase3-reversal','CI reversal test','{"test":true}'::jsonb
  );
  if not exists (
    select 1 from private.finance_journals
    where id=v_reversal_id and reversal_of=v_journal_id
  ) then
    raise exception 'The reversal journal is not linked to its original.';
  end if;
  if not exists (
    select 1 from private.finance_journal_lines
    where journal_id=v_reversal_id and direction='credit' and amount_minor=12500
      and account_id=(select account_id from private.finance_journal_lines where journal_id=v_journal_id and direction='debit')
  ) or not exists (
    select 1 from private.finance_journal_lines
    where journal_id=v_reversal_id and direction='debit' and amount_minor=12500
      and account_id=(select account_id from private.finance_journal_lines where journal_id=v_journal_id and direction='credit')
  ) then
    raise exception 'Reversal lines do not exactly invert the original journal.';
  end if;

  v_reversal_repeat_id := public.reverse_finance_journal(
    v_journal_id,'ci-phase3-reversal','CI reversal test','{"test":true}'::jsonb
  );
  if v_reversal_repeat_id <> v_reversal_id then
    raise exception 'An identical reversal retry created a second journal.';
  end if;

  v_failed := false;
  begin
    update private.finance_journals set description='tampered' where id=v_journal_id;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'A posted finance journal header was mutable.';
  end if;

  v_failed := false;
  begin
    perform public.reverse_finance_journal(
      v_journal_id,'ci-phase3-reversal-2','Different reversal request','{"test":true}'::jsonb
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'A second conflicting reversal was accepted.';
  end if;

  v_failed := false;
  begin
    perform public.reverse_finance_journal(
      v_reversal_id,'ci-phase3-reversal-of-reversal','Reverse a reversal','{"test":true}'::jsonb
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'A reversal journal was allowed to be reversed.'; end if;

  v_failed := false;
  begin
    update private.finance_journal_lines set amount_minor=1 where journal_id=v_journal_id;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'A posted finance journal line was mutable.'; end if;

  v_failed := false;
  begin
    delete from private.finance_journal_lines where journal_id=v_journal_id;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'A posted finance journal line was deletable.'; end if;

  v_failed := false;
  begin
    delete from private.finance_journals where id=v_journal_id;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'A posted finance journal header was deletable.'; end if;

  v_failed := false;
  begin
    perform public.reverse_finance_journal(
      gen_random_uuid(),'ci-phase3-missing-original','Missing original','{"test":true}'::jsonb
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'A missing journal was reversed.'; end if;
end
$$;

rollback;
