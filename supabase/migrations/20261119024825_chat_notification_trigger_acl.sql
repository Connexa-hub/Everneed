-- Trigger-only helper; API roles must not be able to execute it directly.
revoke execute on function public.chat_notification_contract() from public, anon, authenticated;
