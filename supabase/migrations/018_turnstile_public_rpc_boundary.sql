-- Move abuse-prone public form RPCs behind a server-verified Turnstile boundary.
-- The public-forms Edge Function validates tokens, then invokes these RPCs with service_role.
-- Aggregate-only public reads (support_sla_public/store_reply_stats) remain public.

revoke all on function public.join_waitlist(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text, text, text) to service_role;

revoke all on function public.support_guest_open(text, text, text, text) from public, anon, authenticated;
grant execute on function public.support_guest_open(text, text, text, text) to service_role;

revoke all on function public.support_guest_ping(text) from public, anon, authenticated;
grant execute on function public.support_guest_ping(text) to service_role;

revoke all on function public.support_guest_close(text) from public, anon, authenticated;
grant execute on function public.support_guest_close(text) to service_role;
