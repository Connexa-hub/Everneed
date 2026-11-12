-- Internal helpers must not be callable through the API by signed-in users.
alter function public.chat_guard() set search_path = public;
revoke execute on function public.chat_triage() from authenticated;
revoke execute on function public.chat_guard() from authenticated, anon, public;
revoke execute on function public.chat_escalate_core(uuid,text,int) from authenticated;
revoke execute on function public.support_tier(text) from authenticated;
revoke execute on function public.support_sla_minutes(text) from authenticated;
