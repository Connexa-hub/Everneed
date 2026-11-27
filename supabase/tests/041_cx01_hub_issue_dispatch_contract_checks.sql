-- CX-01 regression checks for the hub issue notification and guarded dispatch transition.
do $$
declare
  v_hub text := pg_get_functiondef('public.hub_receive(text,jsonb)'::regprocedure);
  v_dispatch text := pg_get_functiondef('public.dispatch(text,jsonb)'::regprocedure);
begin
  if to_regprocedure('private.notify_admins(text,text,text,jsonb)') is null
     or position('private.notify_admins' in v_hub) = 0 then
    raise exception 'hub_receive must call the private.notify_admins helper for issue notifications';
  end if;

  if position('app.order_bypass' in v_dispatch) = 0 then
    raise exception 'dispatch must set the guarded delivery transition context';
  end if;

  if position('Courier name is required.' in v_dispatch) = 0 then
    raise exception 'dispatch must reject an empty courier name';
  end if;
end $$;
