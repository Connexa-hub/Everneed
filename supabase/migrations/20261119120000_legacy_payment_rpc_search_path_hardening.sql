-- Everneed security follow-up: ensure legacy service-only payment wrappers have an empty search_path.
-- The historical 032 file is not timestamped and is not replayed by Supabase CLI.
-- Keep this as a timestamped migration so fresh CI/local databases actually apply it.

begin;

alter function public.confirm_payment(text, text, uuid) set search_path = '';
alter function public.confirm_received_for(text, uuid) set search_path = '';
alter function public.cancel_order_for(text, uuid, text, boolean) set search_path = '';
alter function public.apply_rental_payment_for(text, text, numeric, text) set search_path = '';

commit;
