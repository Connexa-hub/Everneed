-- FIN-01 bounded input contract tests for migration 034.
begin;
do $$
declare
  v_failed boolean;
  v_id uuid;
  v_lines jsonb := '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"1"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"1"}]'::jsonb;
begin
  if not has_function_privilege('service_role',
    'public.post_finance_journal(text,text,text,text,text,jsonb,jsonb)','EXECUTE')
     or has_function_privilege('anon',
    'public.post_finance_journal(text,text,text,text,text,jsonb,jsonb)','EXECUTE')
     or has_function_privilege('authenticated',
    'public.post_finance_journal(text,text,text,text,text,jsonb,jsonb)','EXECUTE') then
    raise exception 'Finance journal posting RPC grants are incorrect.';
  end if;

  v_failed := false;
  begin
    perform public.post_finance_journal(repeat('x',65),'source','idem','NGN','Bound test',v_lines,'{}');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Overlong source type accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal('ci_test',repeat('s',161),'idem','NGN','Bound test',v_lines,'{}');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Overlong source ID accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal('ci_test','source',repeat('i',161),'NGN','Bound test',v_lines,'{}');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Overlong idempotency key accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal('ci_test','source','idem','NGN',repeat('d',241),v_lines,'{}');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Overlong description accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal('ci_test','source','idem','NGN','Large metadata',v_lines,
      jsonb_build_object('blob',repeat('m',17000)));
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Oversized metadata accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal('ci_test','source','idem','NGN','Bad line',
      '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"1","unapproved":"x"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"1"}]',
      '{}');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Unexpected line field accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal('ci_test','source','idem','NGN','Bad line',
      jsonb_build_array(
        jsonb_build_object('account_code','asset.paystack_clearing','direction','debit','amount_minor','1','order_id',repeat('o',129)),
        jsonb_build_object('account_code','liability.seller_payable','direction','credit','amount_minor','1')
      ), '{}');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Overlong line reference accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal('ci_test','source','idem','NGN','Oversized line payload',
      jsonb_build_array(
        jsonb_build_object('account_code','asset.paystack_clearing','direction','debit','amount_minor','1','description',repeat('x',600000)),
        jsonb_build_object('account_code','liability.seller_payable','direction','credit','amount_minor','1')
      ), '{}');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Oversized line payload accepted.'; end if;

  v_failed := false;
  begin
    perform public.post_finance_journal('ci_test','source','idem','NGN','Overflow',
      '[{"account_code":"asset.paystack_clearing","direction":"debit","amount_minor":"9999999999999999999"},{"account_code":"liability.seller_payable","direction":"credit","amount_minor":"9999999999999999999"}]',
      '{}');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'Bigint overflow accepted.'; end if;

  v_id := public.post_finance_journal('ci_test','input-hardening','valid-small','NGN','Valid bounded request',
    v_lines,'{"test":true}');
  if v_id is null then raise exception 'Valid bounded request did not post.'; end if;
end
$$;
rollback;
