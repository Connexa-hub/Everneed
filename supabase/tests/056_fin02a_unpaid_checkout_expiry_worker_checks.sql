-- FIN-02A unpaid checkout expiry safety tests; fixtures are rollback-only.
begin;
set local role postgres;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('app.order_bypass','1',true);
do $$
declare
 u uuid:=gen_random_uuid(); oldid text:=gen_random_uuid()::text; recentid text:=gen_random_uuid()::text; paidid text:=gen_random_uuid()::text;
 initid text:=gen_random_uuid()::text; pendingid text:=gen_random_uuid()::text; processingid text:=gen_random_uuid()::text; successid text:=gen_random_uuid()::text; reconid text:=gen_random_uuid()::text; failedid text:=gen_random_uuid()::text;
 cut timestamptz:=now()-interval '1 hour'; result jsonb; s text;
begin
 insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(u,'authenticated','authenticated','expire-'||u||'@example.test','', '{}'::jsonb,'{}'::jsonb,now(),now());
 insert into public.orders(id,user_id,items,total,country,pm,cust,status,payment_status,at,currency,delivery_fee) values
 (oldid,u,'[]',1,'NG','card','{}','awaiting_payment','awaiting_payment',(extract(epoch from cut-interval '5 minutes')*1000)::bigint,'NGN',0),
 (recentid,u,'[]',1,'NG','card','{}','awaiting_payment','awaiting_payment',(extract(epoch from now())*1000)::bigint,'NGN',0),
 (paidid,u,'[]',1,'NG','card','{}','pending','paid',(extract(epoch from cut-interval '5 minutes')*1000)::bigint,'NGN',0),
 (initid,u,'[]',1,'NG','card','{}','awaiting_payment','awaiting_payment',(extract(epoch from cut-interval '5 minutes')*1000)::bigint,'NGN',0),
 (pendingid,u,'[]',1,'NG','card','{}','awaiting_payment','awaiting_payment',(extract(epoch from cut-interval '5 minutes')*1000)::bigint,'NGN',0),
 (processingid,u,'[]',1,'NG','card','{}','awaiting_payment','awaiting_payment',(extract(epoch from cut-interval '5 minutes')*1000)::bigint,'NGN',0),
 (successid,u,'[]',1,'NG','card','{}','awaiting_payment','awaiting_payment',(extract(epoch from cut-interval '5 minutes')*1000)::bigint,'NGN',0),
 (reconid,u,'[]',1,'NG','card','{}','awaiting_payment','awaiting_payment',(extract(epoch from cut-interval '5 minutes')*1000)::bigint,'NGN',0),
 (failedid,u,'[]',1,'NG','card','{}','awaiting_payment','awaiting_payment',(extract(epoch from cut-interval '5 minutes')*1000)::bigint,'NGN',0);
 insert into private.payment_attempts(order_id,user_id,provider,idempotency_key,provider_reference,amount_minor,currency,currency_exponent,checkout_snapshot_version,checkout_snapshot_hash,status) values
 (initid,u,'paystack','exp-i-'||initid,'ref-i-'||initid,100,'NGN',2,1,repeat('0',64),'initializing'),
 (pendingid,u,'paystack','exp-p-'||pendingid,'ref-p-'||pendingid,100,'NGN',2,1,repeat('a',64),'pending'),
 (processingid,u,'paystack','exp-x-'||processingid,'ref-x-'||processingid,100,'NGN',2,1,repeat('b',64),'processing'),
 (successid,u,'paystack','exp-s-'||successid,'ref-s-'||successid,100,'NGN',2,1,repeat('c',64),'succeeded'),
 (reconid,u,'paystack','exp-r-'||reconid,'ref-r-'||reconid,100,'NGN',2,1,repeat('d',64),'reconciliation_required'),
 (failedid,u,'paystack','exp-f-'||failedid,'ref-f-'||failedid,100,'NGN',2,1,repeat('e',64),'failed');
 result:=public.expire_unpaid_checkout_orders(cut,50,'fixture expiry');
 if (result->>'cancelled')::int<>2 then raise exception 'Expected two cancellations, got %',result; end if;
 select status into s from public.orders where id=oldid; if s<>'cancelled' then raise exception 'Old unpaid order not cancelled'; end if;
 select status into s from public.orders where id=failedid; if s<>'cancelled' then raise exception 'Failed attempt should not block'; end if;
 select status into s from public.orders where id=recentid; if s='cancelled' then raise exception 'Recent order expired'; end if;
 select status into s from public.orders where id=paidid; if s='cancelled' then raise exception 'Paid order expired'; end if;
 select status into s from public.orders where id=initid; if s='cancelled' then raise exception 'Initializing attempt cancelled'; end if;
 select status into s from public.orders where id=pendingid; if s='cancelled' then raise exception 'Pending attempt cancelled'; end if;
 select status into s from public.orders where id=processingid; if s='cancelled' then raise exception 'Processing attempt cancelled'; end if;
 select status into s from public.orders where id=successid; if s='cancelled' then raise exception 'Succeeded attempt cancelled'; end if;
 select status into s from public.orders where id=reconid; if s='cancelled' then raise exception 'Reconciliation-required attempt cancelled'; end if;
 result:=public.expire_unpaid_checkout_orders(cut,50,'repeat');
 if (result->>'cancelled')::int<>0 then raise exception 'Repeat run not idempotent: %',result; end if;
 if has_function_privilege('anon','public.expire_unpaid_checkout_orders(timestamptz,integer,text)','EXECUTE') or has_function_privilege('authenticated','public.expire_unpaid_checkout_orders(timestamptz,integer,text)','EXECUTE') then raise exception 'RPC ACL too broad'; end if;
end $$;
rollback;
