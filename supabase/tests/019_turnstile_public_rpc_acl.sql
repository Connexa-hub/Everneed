-- WEB-F18: only the server-side Edge Function's service role may execute write-oriented public RPCs.
begin;

do $test$
begin
  if has_function_privilege('anon','public.join_waitlist(text,text,text,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.join_waitlist(text,text,text,text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.support_guest_open(text,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.support_guest_open(text,text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.support_guest_ping(text)','EXECUTE')
     or has_function_privilege('authenticated','public.support_guest_ping(text)','EXECUTE')
     or has_function_privilege('anon','public.support_guest_close(text)','EXECUTE')
     or has_function_privilege('authenticated','public.support_guest_close(text)','EXECUTE') then
    raise exception 'Public form write RPCs must not be directly executable by anon/authenticated';
  end if;

  if not has_function_privilege('service_role','public.join_waitlist(text,text,text,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.support_guest_open(text,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.support_guest_ping(text)','EXECUTE')
     or not has_function_privilege('service_role','public.support_guest_close(text)','EXECUTE') then
    raise exception 'Edge Function service_role must retain execution rights';
  end if;

  if not has_function_privilege('anon','public.support_sla_public()','EXECUTE')
     or not has_function_privilege('anon','public.store_reply_stats()','EXECUTE') then
    raise exception 'Intended public aggregate read RPCs must remain callable';
  end if;
end;
$test$;

rollback;
