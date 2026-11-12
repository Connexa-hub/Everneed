# Routine and privilege security review — Everneed01

**Project:** Everneed Supabase `zpgasfweaixwsktlueje`  
**Inspection date:** 12 Nov 2026  
**Environment:** Existing live project; read-only catalog and definition inspection  
**Status:** Preliminary findings for review; no changes applied

## Safety

This review is descriptive. It does not modify privileges, functions, policies, data, or migration history. It is not a security certification and does not prove that every execution path is safe. Do not apply corrective SQL based only on this document.

## Inventory facts

- 84 application routines were found in `public` and `private`: 30 in `private`, 54 in `public`.
- 58 routines are marked `SECURITY DEFINER`.
- 30 of those 58 directly reference `auth.uid()`; the remaining 28 require review of their caller, grants, internal checks, and intended service role.
- 939 table/view privilege rows were returned for the public schema.
- Anonymous and authenticated roles currently have schema USAGE on both `public` and `private`.
- No hard-coded payment secret-key, JWT, long bearer-token, or private-key literal matched the targeted scan of the 84 function definitions. This is a narrow scan, not proof that secrets cannot exist elsewhere.

## SECURITY DEFINER functions with PUBLIC EXECUTE

Six routines were observed with PUBLIC EXECUTE in their ACL:

| Routine | Schema | Review note |
|---|---|---|
| `buys(text)` | private | Checks the order owner using `auth.uid()`. |
| `my_store()` | private | Returns the caller's store using `auth.uid()`. |
| `owns_store(text)` | private | Checks store ownership using `auth.uid()`. |
| `sells(text)` | private | Delegates to `owns_store`; no direct `auth.uid()` call. |
| `store_live(text)` | private | Returns whether a store is approved and has a qualifying subscription; no direct `auth.uid()` call. |
| `store_reply_stats()` | public | Returns aggregate store reply-time statistics. |

The `private` schema currently grants USAGE to `anon` and `authenticated`. Whether these helpers are reachable through the REST Data API also depends on the project's configured exposed-schema list; the database-session setting lookup returned NULL and did not establish that configuration. Keep this as an open security-review item rather than assuming REST exposure.

## Anonymous/public RPC endpoints reviewed

The following functions have anonymous or PUBLIC execution grants:

- `join_waitlist(...)`: validates email shape, normalizes the email, bounds several text fields, and ignores duplicate emails.
- `support_guest_open(...)`: validates visitor IDs against a 20–64 character alphanumeric/underscore/hyphen pattern, limits input lengths, and has a coarse queue-volume guard.
- `support_guest_close(text)` and `support_guest_ping(text)`: update a support-queue row by visitor ID. These two routines do not repeat the ID-format validation used by `support_guest_open`. Confirm that visitor IDs are generated with sufficient cryptographic randomness and are never exposed in public logs or URLs; consider consistent validation and abuse controls in a separately reviewed hardening change.
- `support_sla_public()`: returns configured public SLA-minute values.
- `store_reply_stats()`: returns aggregate store reply-time statistics.

This review did not find evidence that these endpoints expose raw customer messages or contact details. Their current behavior and intended public use should still be confirmed against the website/app flows.

## Paystack Edge Function — version 4

The active `paystack` Edge Function was retrieved and reviewed statically. Its deployed configuration has `verify_jwt=false`. This is consistent with accepting Paystack webhooks without a Supabase user JWT, but it makes the function's own request authentication essential.

Observed controls:
- Webhook requests are authenticated by validating the `x-paystack-signature` HMAC-SHA512 against the raw request body using the Paystack secret.
- Non-webhook requests require a bearer token that is validated with Supabase Auth `getUser`; the handler rejects missing/invalid users.
- Order creation, payment initialization, saved-card charging, receipt confirmation, and admin-only actions are scoped in the handler to the authenticated user or admin profile.
- Payment settlement checks successful transaction status, order metadata, currency, and that the paid amount is at least the server-stored order total before calling `confirm_payment`.
- The function uses server-side `PAYSTACK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; secret values were not retrieved or recorded.

Items requiring further verification:
1. Confirm that `confirm_payment`, `create_order`, `confirm_received_for`, `cancel_order_for`, and `rate_hit` enforce their own intended authorization and idempotency guarantees.
2. Review the saved-card authorization-code storage and access controls on `cards`; the Edge Function uses the service role to read and upsert authorization records.
3. Confirm Paystack webhook configuration points to this function and that signature verification is tested against real provider test events.
4. Consider constant-time signature comparison and explicit handling of malformed webhook JSON as defense-in-depth.
5. Confirm CORS wildcard behavior is intentional. CORS is not authentication, and the handler still requires a user token for non-webhook actions.
6. The function's deployed source references an external FX-rate provider. Verify timeout, failure handling, and acceptable staleness for checkout pricing.

No Edge Function deployment, secret change, or database change was made. This was a source inspection only.

## Default privilege concern

The live database has default privileges in the `public` schema for objects created by both `postgres` and `supabase_admin`.

For objects created by `postgres`, the observed defaults grant:
- All table privileges (`arwdDxtm`) to `anon`, `authenticated`, and `service_role`.
- Function EXECUTE to `anon`, `authenticated`, and `service_role`.
- Sequence privileges to `anon`, `authenticated`, and `service_role`.

RLS is enabled on all 38 current public tables, but RLS is separate from SQL object privileges. Every new exposed table still needs deliberate RLS policies. Function EXECUTE defaults are especially important because RLS does not automatically protect a function's internal logic, and SECURITY DEFINER functions execute with their owner's privileges.

Do not copy these defaults blindly into a reconstructed baseline. Before the next production schema expansion, review whether the defaults should be narrowed in a separately tested and approved migration. No such change has been made.

## Baseline requirements

Before any function or privilege definitions are placed into the reconstructed fresh-install baseline:

1. Export all 84 complete function definitions and their exact ACLs in bounded batches.
2. Review every SECURITY DEFINER routine for caller authorization, safe search path, ownership, and data exposure.
3. Confirm the Data API exposed-schema configuration, especially whether `private` is exposed.
4. Reconcile explicit grants with default privileges and table RLS policies.
5. Test anonymous, authenticated buyer, authenticated seller, admin, and service-role behavior on a disposable database.
6. Document intentional public RPC endpoints and add negative tests for unauthorized callers.
7. Test Paystack webhook and user-token flows against provider test events and a disposable database.

## Current decision

Keep the live Everneed01 database untouched. Treat these findings as baseline-reconstruction and security-hardening work items. Any privilege/function changes require a separate reviewed migration, tests on a disposable database, and explicit approval before production application.
