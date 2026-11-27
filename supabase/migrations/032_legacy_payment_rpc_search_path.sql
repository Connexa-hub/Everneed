-- Everneed Payment Lifecycle 032 — harden legacy payment RPC search paths
-- Source-only. These wrappers use fully-qualified references, so an empty search_path
-- preserves behaviour while removing reliance on the public schema search path.

begin;

alter function public.confirm_payment(text, text, uuid) set search_path = '';
alter function public.confirm_received_for(text, uuid) set search_path = '';
alter function public.cancel_order_for(text, uuid, text, boolean) set search_path = '';
alter function public.apply_rental_payment_for(text, text, numeric, text) set search_path = '';

commit;
