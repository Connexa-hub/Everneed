-- SECURITY DEFINER notification trigger must not be directly callable by API roles.
do $$
begin
  if has_function_privilege('anon','public.chat_notification_contract()','EXECUTE')
    or has_function_privilege('authenticated','public.chat_notification_contract()','EXECUTE') then
    raise exception 'FAIL: API roles can execute the notification trigger helper';
  end if;
  if not has_function_privilege('postgres','public.chat_notification_contract()','EXECUTE') then
    raise exception 'FAIL: function owner lost execute privilege';
  end if;
end
$$;
