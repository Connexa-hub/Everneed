# Phase A continuation — migration drift and frontend access-client review

**Date:** 25 November 2026  
**Target:** Everneed01 production read-only; Everneed-staging migration history; repository `web-portal`  
**Status:** Audit only. No database, secrets, or production changes.

## 1. Migration-history comparison

Everneed01 records migrations through `015_support_sla_public` (timestamped history, with early foundation and cleanup entries). Everneed-staging records the same logical baseline through 015, but then includes additional migration groups through `20261122140408_fin03_verified_payment_journal_posting`.

Staging-only logical groups include:
- public RPC security and authenticated RPC boundary hardening (016–018)
- regional policy, store verification gate and policy acceptance (019–022)
- managed seller categories and storefront public details (023–025)
- payment lifecycle, checkout snapshots, attempt/recovery and legacy search-path fixes (026–032)
- double-entry finance journal (033) and later finance hardening/allocation/funding/snapshot lifecycle
- seller onboarding entitlements/quotas and trial/plan selection/approval
- provider-neutral seller verification foundations and cleanup
- seller notification contract and trigger ACL
- product catalogue/taxonomy, variants, inventory movements, product editor entitlements, admin store context, and catalogue trigger ACL hardening
- verified-payment journal posting (FIN03)

This is not a small patch backlog. Production requires a dependency-aware rollout plan and compatibility review. The migration ledger alone does not prove that all staging migrations are safe to apply to production.

## 2. Latest Claude frontend commits reviewed

Latest branch commits:
- `25518f70`: lazy-load product editor to reduce initial bundle cost (WEB-S22 part 21)
- `b4f9bbd0`: access client with safe fallback and centralized permission-gate table (WEB-S22 part 22)

Files reviewed:
- `web/assets/js/ds-access.js`
- `web/assets/js/ds-lazy.js`
- `tools/web-seller-tests/ds-access.js`
- `tools/web-seller-tests/ds-lazy.js`
- `web/index.html`

### Positive findings
- Access client explicitly treats `my_access()` as server-provided capability data; it does not fabricate permissions.
- Missing RPC/network failure returns unavailable and callers can retain legacy behavior, documented as temporary compatibility.
- Contexts are limited to platform/store planes; store IDs are matched when requested.
- Expired assignments are excluded.
- The test file covers missing RPC, network failure, permissions, scope, plane separation, wildcard grants, aliases, expiry, session reset.
- Product editor is lazy-loaded only on product route, uses same-folder URL, caches load, and falls back to old portal route on load error.
- Index now loads lazy loader and access client as dedicated modules.

### Review cautions / contract blockers
1. **Fallback is compatibility, not security.** When `my_access()` is unavailable, UI gates return the legacy value. Backend authorization remains authoritative. Do not claim the new role system is enforced until server RPC/RLS enforcement exists.
2. **No production or staging `my_access()` implementation verified.** UI availability remains false until the RPC exists. Backend Phase A inventory and schema/RPC design must precede permission-management UI.
3. **Permission-key aliases are temporary.** The gate table accepts variants such as `store.catalogue.write` and `store.catalog.edit`; choose one canonical namespace in the backend contract and remove compatibility aliases once migrations and tests are aligned.
4. **Context switch UI is not security boundary.** Active-context state only affects presentation; every request and mutation must independently authorize its context and resource.
5. **Wildcard matching deserves a focused regression review.** Confirm server-side wildcard semantics exactly match frontend matching and that wildcards cannot imply write/admin keys.
6. **Current access-client test files have been inspected but not executed in this environment.** CI/test results are not claimed.
7. **Lazy loading is a performance change only.** It does not prove product-editor behavior or route E2E; confirm script order, URL handling, CSP compatibility, and real product route in preview.

## 3. Release boundary

- Everneed01 production remains unchanged.
- Everneed-staging remains unchanged during this audit.
- No role assignment, ownership classification, migration, or access change has been made.
- `web-portal` remains development branch; `main` remains protected for owner-approved PR review/merge.

## 4. Next audit sequence
1. Reconcile every repository migration with both project ledgers and categorize additive, destructive, data-backfill, ACL/RLS, dependency and environment-specific changes.
2. Inspect complete SECURITY DEFINER inventory, effective EXECUTE grants, fixed search_path, auth/ownership checks, and API-exposed schema configuration in Everneed01.
3. Build actor/resource/action matrix and cross-store threat tests.
4. Review order/payment/ledger/payout/dispatch lifecycle and current delivery model.
5. Produce staged compatibility rollout with rollback and tests; production migration only after explicit owner approval.


## 5. Everneed01 SECURITY DEFINER privilege inventory — initial pass

Read-only query on production project `zpgasfweaixwsktlueje`, 25 Nov 2026. This is an inventory, not a complete function-body or exploit test.

### Positive observations
- Sensitive operational helpers/functions including `cancel_order_for`, `confirm_payment`, `create_order`, `release_earnings`, `run_scheduled_jobs`, `chat_escalate_core`, `chat_triage`, and `apply_rental_payment_for` are not executable by anon/authenticated based on current privilege checks.
- Owner helpers `private.buys`, `private.owns_store`, `private.sells`, `private.my_store` are SECURITY DEFINER but use `auth.uid()` in their ownership predicates and have an empty search_path.
- Most inspected public SECURITY DEFINER functions use fixed `search_path=public`; private helpers commonly set an empty search_path and qualify referenced objects.

### Functions callable by anon at the database privilege level — require exposure/config and abuse review
- `public.join_waitlist`: input validation, bounded text, allowed role values and unique-email conflict handling present. Check rate limiting and public schema exposure.
- `public.support_guest_open`: validates guest ID format and limits field lengths; has a count-based recent-queue throttle. Evaluate whether the throttle is robust under concurrency and whether guest identifiers are unguessable.
- `public.support_guest_ping`: updates last_seen by guest ID. Identifier secrecy/entropy and public API exposure need review.
- `public.support_guest_close`: closes queue row by guest ID only. Confirm ID entropy, abuse/race handling and that a visitor cannot close another visitor's session.
- `public.support_sla_public`: returns public SLA JSON; verify only non-sensitive public configuration is returned.
- `public.store_reply_stats`: returns aggregated store response statistics; currently filters to stores with >=3 chats and 30-day window. Review whether this aggregate is intended to be public and whether store IDs are public identifiers.
- Private helpers `my_store`, `owns_store`, `buys`, `sells`, `store_live` have anon EXECUTE privilege according to PostgreSQL ACLs; their definitions are ownership/context predicates, but confirm that the `private` schema is not exposed through PostgREST/Data API and retain least-privilege grants regardless.

### ACL caveat
An EXECUTE grant is not by itself proof that a function is reachable over HTTP. Verify Supabase Data API exposed schemas and schema USAGE privileges separately. No API schema configuration was changed or verified in this pass.

### Next focused checks
- Verify exposed schema configuration and schema USAGE grants.
- Audit all public SECURITY DEFINER function bodies for authorization, IDOR, state-transition rules, argument validation, and data leakage.
- Review support guest abuse/rate-limiting behavior.
- Review financial functions for four-eyes controls and direct state mutation paths.
- Do not revoke or change grants in production without a staging rehearsal and owner approval.


## 6. Order, delivery and finance RPC review — focused source inspection

Read-only production definitions inspected for `seller_transition`, `dispatch`, `hub_receive`, `hub_consolidate`, `mark_delivered`, `confirm_received`, `report_payment`, `refund`, `record_payout`, `store_balance`, store approval/rejection/suspension, support chat functions and related helpers.

### Positive controls observed
- `seller_transition` requires authentication, rate-limits, locks the seller order, checks store ownership/admin, requires released orders, blocks seller-only actions from marking hub states, uses a legal transition helper, writes audit/notifications and synchronizes parent order.
- Hub receive requires the admin guard, row lock, correct handover state and item-by-item check array; hub consolidate checks all active seller orders have reached `at_hub` and locks parent order.
- Dispatch requires admin, locks parent order, validates hub route/readiness, requires delivery record, and updates tracking/order state.
- Delivery-code confirmation rate-limits per order; direct delivery is limited to seller owner/admin, and customer confirmation checks order ownership.
- `report_payment` updates only the authenticated buyer's order in awaiting-transfer state.
- Refund and payout recording use admin guards, throttling, row locks, amount/balance validations, ledger writes, notifications and audit records.

### Issues / questions for follow-up
1. **Seller acceptance deadline:** `seller_transition` does not visibly check `accept_by` before accepting. The timeout/auto-cancel job and concurrency behavior must be examined. A server-side deadline guard and regression test are recommended before enabling accept UI. (High priority.)
2. **Refund provider boundary:** `refund()` inserts a refund row as `processed` and posts ledger adjustments in the same call; this function does not call a payment provider. Confirm this is strictly manual/recorded-refund workflow and that UI wording cannot imply money was returned electronically. Actual provider refund initiation/confirmation needs a separate lifecycle and reconciliation.
3. **Hub check input shape:** the function checks each order item is represented, but review duplicate/extra item IDs and JSON validation so submitted check data is a one-to-one item mapping. Consider enforcing array length and unique IDs.
4. **Delivery assignment model:** current dispatch stores courier name/phone/note directly on order-level delivery record. This is a minimal legacy model, not structured courier identity, assignment history, shipment legs, route stops, attempts, exception events or proof-of-delivery event history. New logistics design must extend/reconcile this, not replace checkout data abruptly.
5. **Chat assignment controls:** admin-only `chat_set` permits status/assignee/tags/priority updates; validate that assignee is a current authorized staff user and assignment changes are audited in the future role model.
6. **Refund bounds:** cumulative processed/approved refunds are compared against order total; run adversarial tests for concurrent refund requests, partial seller allocations, commission math, and order/payment-status consistency.

No functions, rows, grants or migrations were changed. These are source observations and proposed tests, not confirmed exploit findings.


## 7. Production RLS policy and table-grant review (read-only)

The public-schema RLS policy inventory was queried from Everneed01.

### Policy coverage summary
- Protected tables have RLS enabled (verified in baseline); policy predicates are generally owner/admin scoped for private records.
- Orders: buyer/admin SELECT; admin UPDATE. No anon policy; direct grants still exist for anon on table operations, so RLS is the blocking layer. This illustrates why grants and RLS must be audited together.
- Seller orders: admin or released seller-order rows for store owner; sellers cannot read unreleased seller orders through this policy.
- Order items: buyer/admin or seller owner where seller order released.
- Delivery and order secrets: buyer/admin read. Delivery code is buyer-visible through order_secrets policy; verify code rotation/expiry/one-use and ensure seller/courier paths cannot expose it.
- Ledger, payout, store payments, subscriptions: admin or store owner.
- Product private: admin or owning store. Public products read only published/live product rows.
- Store private: admin or owner. Stores: owner/admin/public live-approved read; owner create/update has owner_id guard, create status limited to draft/pending.
- Refunds/disputes: buyer/admin or associated seller (seller read only); dispute opening requires buyer/order ownership.
- Profiles: self/admin SELECT, self UPDATE with role invariant. Anon table grants are present but policies deny access.
- Chat: member/admin SELECT; messages restrict internal notes from ordinary members. Admin updates conversation; membership predicate is used for reads.

### Grant observation (high-priority least-privilege review; not yet a confirmed exploit)
The database role-table-grant inventory shows broad default table privileges for `anon` and `authenticated` on some tables (including SELECT/INSERT/UPDATE/DELETE/TRUNCATE), while RLS is intended to block unauthorized rows/actions. Some tables have grants broader than their policy set requires. RLS is not a substitute for minimizing SQL privileges. Review the exact table/column grants and default privileges, then create a staging-only revocation/allowlist migration and API regression tests. Do not revoke in production during this audit.

The `private` schema has USAGE granted to anon and authenticated in this production snapshot. This does not prove PostgREST exposes it; API exposed-schema settings could not be confirmed via the SQL connector. Confirm Supabase API settings (exposed schemas and search path) through dashboard or config evidence. Restrict private schema USAGE/EXECUTE to minimum necessary if compatible with existing functions; test all dependencies first.

### R23 response — accepted contract, implementation not yet started
The two-plane proposal is accepted. Use its canonical permission keys (e.g. `store.catalogue.write`, `store.orders.transition`, `platform.staff.manage`) rather than architecture-document aliases in new backend contract. Frontend compatibility aliases are transitional and should be removed after the backend/UI contract aligns. R23 `my_access()` is read-only introspection and must be based on active membership/assignment records; it must not grant or mutate access. It will be staged only after role inventory, orphaned/ownerless stores and legacy admin account classification. No automatic owner assignment, no view-as, no custom role permissions in initial release. Bootstrap preserves legacy admin only as a compatibility/emergency path until controlled audited migration.


## 8. Table-grant finding refinement — anon TRUNCATE and excess privileges

A follow-up query separated base tables from security-invoker views. It confirms **no anon-granted base table in the inspected public list has RLS disabled**; the RLS-disabled objects (`auto_offers`, `product_ratings`, `public_products`, `public_reviews`, `public_stores`) are views with `security_invoker=true`. Their underlying table policies still apply.

However, the anon role has broad table privileges on several RLS-enabled base tables, including `TRUNCATE` on `banners`, `collections`, `offers`, `orders`, `products`, `profiles`, `reviews`, `settings`, and `size_charts`; plus broad INSERT/UPDATE/DELETE/TRIGGER/REFERENCES on multiple tables. **TRUNCATE is not protected by RLS.** Although ordinary PostgREST CRUD does not expose TRUNCATE as a normal endpoint operation, the grant is unnecessary and should be treated as a high-priority privilege-hardening finding, not as an RLS-contained privilege.

This is a confirmed excessive SQL privilege in the catalog, but reachability through a public API or any other execution path is not established. Immediate action: construct a least-privilege allowlist migration on staging, revoke anon table write/DDL-like privileges (including TRUNCATE, TRIGGER, REFERENCES), retain only required SELECT and explicitly required public writes, and separately constrain authenticated grants. Test all web/app flows, RPCs, views and triggers. Production remains untouched until the staging suite and owner approval.
