-- Admin order directory regression checks.
begin;
do $$
declare
  fn text;
begin
  fn := pg_get_functiondef('public.admin_order_directory(text,text,text,text,integer,integer)'::regprocedure);
  if fn not ilike '%perform private.need_admin()%' then raise exception 'FAIL: admin RPC missing authorization'; end if;
  if fn not ilike '%least(greatest(coalesce(p_page_size, 25), 1), 100)%' then raise exception 'FAIL: page size must be bounded to 100'; end if;
  if fn not ilike '%p_status is null or o.status = p_status%' then raise exception 'FAIL: status filter missing'; end if;
  if fn not ilike '%p_payment_status is null or o.payment_status = p_payment_status%' then raise exception 'FAIL: payment filter missing'; end if;
  if fn not ilike '%p_payment_method is null or o.pm = p_payment_method%' then raise exception 'FAIL: payment method filter missing'; end if;
  if fn not ilike '%buyer_email%' or fn not ilike '%seller_count%' then raise exception 'FAIL: expected safe buyer/store summary fields missing'; end if;
  if has_function_privilege('anon','public.admin_order_directory(text,text,text,text,integer,integer)','EXECUTE') then raise exception 'FAIL: anon must not execute directory RPC'; end if;
  if not has_function_privilege('authenticated','public.admin_order_directory(text,text,text,text,integer,integer)','EXECUTE') then raise exception 'FAIL: authenticated should have execute to invoke admin-gated RPC'; end if;
  raise notice 'PASS: admin order directory authorization, filters, pagination cap and API shape';
end $$;
rollback;
