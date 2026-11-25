# Universal Access B2 — Protected RPC/RLS Enforcement Audit (Draft)

**Owner:** ChatGPT/Codex backend  
**Status:** Inventory only; no enforcement or schema changes in this branch  
**Dependency:** B1 (#49) must pass corrected CI, coordinator review, and staging validation before enforcement work is merged/applied.  
**Base:** `web-portal`  
**Environment safety:** staging only; production remains protected.

## Objective

Replace the legacy single `profiles.role = 'admin'` / store-owner authorization model with explicit, live, scoped permission checks for every protected RPC and RLS path. `my_access()` is an introspection API only and must never be trusted as the sole authorization source.

## Current-source inventory

This audit reviewed `supabase/migrations/004_marketplace_core.sql`, `006_marketplace_rls.sql`, `007_marketplace_functions.sql`, and `008_hardening.sql` on `web-portal`.

- Migration 004 grants schema `private` USAGE to `anon`, `authenticated`, and `service_role`; 006 grants execute on selected RLS helper functions to anon/authenticated/service_role.
- 007 grants user-callable RPCs to `authenticated`; service-only operations to `service_role`; and revokes public/anon/authenticated execution on private core functions.
- Admin authorization in existing functions commonly funnels through `private.need_admin()` / `public.is_admin()`, which still use legacy profile-role logic. Store-owner checks often rely on `private.owns_store()`.
- No permission enforcement should be inferred from frontend UI visibility or from permission strings returned by `my_access()`.

## Enforcement map — initial, pending line-by-line function review

| RPC / surface | Existing control (initial scan) | Target permission / scope | B2 action |
|---|---|---|---|
| `report_payment` | signed-in order owner + awaiting-transfer state | customer / order-owner | Preserve ownership; audit resource-scope tests |
| `cancel_order` | signed-in user; admin fallback | customer order owner OR scoped order intervention | Replace admin fallback with live platform permission, retain state guard |
| `seller_transition` | admin or store owner; transition state guard | `store.orders.transition` scoped to seller order's store OR explicit platform intervention | Resolve store scope from DB; validate transition matrix; audit |
| `hub_receive` | legacy admin + seller-order state | `logistics.custody.scan` scoped to assigned hub/consignment | Introduce hub assignment and custody model; don't grant global hub access |
| `hub_consolidate` | legacy admin + order route/state | `logistics.consolidate` scoped to hub and order | Verify all seller legs and hub custody |
| `dispatch` | legacy admin + order readiness | `logistics.dispatch.assign` platform/zone scope | Replace courier JSON payload with validated assignments; dispatcher/courier separation |
| `mark_delivered` | admin or direct-route store owner + delivery code | job-scoped courier permission OR store owner on direct delivery + delivery proof | Avoid courier identity supplied by client; validate assigned job and POD |
| `confirm_received` | customer order owner | customer order owner | Keep customer-only confirmation |
| `order_tracking` | customer order owner | customer order owner / explicitly scoped support | Minimize PII; support access must be audited |
| `my_seller_orders` | store-owner predicate | store-scoped `store.orders.read` | Include team membership, not only owner |
| Store submit | owner only | store-scoped `store.settings.write` / application permission | Add team support only if workflow allows |
| Store approve/reject/suspend | legacy admin | platform seller-review / intervention permissions | Separate review, compliance, and suspension powers; audited reason |
| Product review | legacy admin | platform product-review permission | Check platform scope; audit decision |
| Store terms | legacy admin | platform settings/commission permission | Sensitive dual-control policy may be needed |
| Rental-payment admin record | legacy admin | platform subscription/finance permission | Keep provider-paid path service-only |
| `store_balance` | admin or store owner | platform finance read OR store-scoped finance read | Ensure team roles don't cross store boundaries |
| `record_payout` | legacy admin | finance/payout execution with separation of duties | Split request, approve, execute; keep hold and reconciliation guards |
| `create_order`, payment-core / provider confirm | service-role paths | trusted server/provider lifecycle only | Keep service-only; validate amount, currency, idempotency and signed provider evidence |
| `confirm_payment`, `cancel_order_for`, `confirm_received_for`, `apply_rental_payment_for`, scheduled functions | service-role only per current grants | service-only | Preserve ACL; assert service-only in regression |
| Direct table writes | RLS + grants + existing policies | permission + scope + state | Audit table grants/policies and mutation triggers, not only RPCs |

## Critical B2 requirements

1. Permission helper must check current actor, assignment status, start/expiry/revocation, role template active status, permission active status, plane/scope compatibility, and exact resource scope on every protected operation.
2. Never accept actor identity, store/hub/job scope, role, permission, or admin boolean from client payload as authority.
3. Legacy store ownership is temporary compatibility only; team membership needs explicit assignment and scope.
4. Legacy admin must not be silently mapped to `platform_owner`; migration and operational break-glass require a verified owner bootstrap and audit.
5. Owner role cannot be self-granted or removed in a way that leaves an ownerless active store; protected changes require a dedicated audited workflow.
6. Finance, payouts, refunds, sensitive support access, and verification actions require separate permissions and separation-of-duties where appropriate.
7. Service-only RPCs must remain inaccessible to anon/authenticated even if their bodies are `SECURITY DEFINER`.
8. RLS helpers must retain only the grants needed for current policies; don't regress existing schema/function ACLs (the B1 review caught a private-schema grant regression).
9. Tests must include positive and negative cases for no role, expired/revoked role, cross-store, cross-hub, cross-job, platform/store scope mismatch, legacy admin, owner protections, and service-role-only RPCs.

## Proposed B2 sequence

- **B2.0 Inventory:** complete signature/body/ACL audit of every public RPC and table policy, classify client vs service paths, mark current authorization and data exposure.
- **B2.1 Shared guard:** add carefully reviewed private authorization helpers (no client execute) and tests; don't expose arbitrary permission-check RPCs.
- **B2.2 Low-risk store reads:** store team read access and scoped seller reads after membership is defined.
- **B2.3 Seller mutation paths:** catalogue, inventory, seller order transitions, settings, support; each checks store scope and state transition.
- **B2.4 Platform operations:** seller/product review, support, disputes, logistics; replace legacy admin checks with narrow permissions.
- **B2.5 Sensitive finance:** payout/refund/rental/commission; separate permissions, audit, approval controls, idempotency and reconciliation.
- **B2.6 Logistics:** hub, dispatch, courier/job lifecycle only after shipment/assignment/custody contracts (B5) exist; don't retrofit global admin access into job permissions.
- **B2.7 Regression & staging:** replay, RLS matrix, RPC ACL matrix, seeded staging roles only, audit evidence, rollback plan.

## Acceptance gates

- [ ] B1 passes corrected migration replay + SQL regression test and coordinator review.
- [ ] Complete RPC signature, ACL, body, table RLS/policy inventory (not heuristic only).
- [ ] No authorization bypass through alternate RPC, service wrapper, trigger, or direct table grants.
- [ ] Positive/negative scope tests for every changed operation.
- [ ] CI and migration replay pass; staged fixtures rolled back or explicitly tracked.
- [ ] PR reviewed and merged through Claude 10's integration queue; staging apply only after review.
- [ ] Production untouched until separately approved release.

## Evidence and limitations

This is a preliminary design audit based on source migrations, not runtime validation. Existing functions and policies may have changed in later migrations; B2 implementation must inspect the current final schema and effective ACLs on staging before edits.

## Live staging ACL inventory (read-only snapshot — 2026-11-25)

Verified against **Everneed-staging** project ref `vjiadqygpyebpisxslbx`; production was not queried for this inventory.

- Staging migration history currently ends at `20261122140408 fin03_verified_payment_journal_posting`; B1 migration is not applied.
- Catalog snapshot: 83 public SECURITY DEFINER functions; 47 are executable by `authenticated`; 3 are executable by `anon`; 80 are executable by `service_role`. (These counts are ACL snapshot, not a vulnerability count.)
- `admin_set_plan_entitlements`, `admin_set_verification_scope`, `admin_store_workspace_context`, `apply_rental_payment`, seller approval/rejection/suspension, dispatch/hub operations, payouts/refunds and terms functions are authenticated-executable but call legacy `private.need_admin()` in inspected definitions.
- `approve_offer_campaign_budget` uses a direct `profiles.role='admin'` check rather than `private.need_admin()`; review whether the current legacy admin compatibility behavior is intended and replace with explicit finance/campaign permission in B2.
- `seller_adjust_variant_stock` allows legacy `public.is_admin()` or `private.owns_store()`; migration to store-scoped inventory permission should preserve owner isolation and audit requirements.
- `seller_transition` uses legacy admin/store owner and workflow guards; must support team fulfilment membership without bypassing state rules.
- `dispatch`, `hub_receive`, and `hub_consolidate` use broad legacy admin checks; target role/scope must be narrowed by actual hub, zone, assigned delivery, and order route, not just role label.
- `admin_store_workspace_context` exposes store owner contact data, counts, and capability state to legacy admins; support/operations access needs scope and audit.
- Service-only functions include payment initialization/recovery, verified-event settlement, journal posting/reversal, scheduled workers, order create/confirm wrappers, and finance recovery. Preserve service-only ACLs.
- Anonymous-executable public functions in this snapshot: `seller_plan_catalog`, `store_reply_stats`, `support_sla_public`. These require explicit public-data/abuse assessment; do not automatically revoke without frontend contract review.

This snapshot is a discovery baseline. B2 must inspect each function definition, effective grants, table policies, triggers, dependencies and call paths before changing enforcement. The source migration audit alone is insufficient because later migrations have replaced or extended several functions.

### Live staging RLS policy snapshot

- `public` has 92 RLS policies in the snapshot.
- 57 policy expressions reference legacy `is_admin()`; 27 reference `private.owns_store()`; 19 reference `auth.uid()`. Counts overlap and are not findings by themselves.
- Admin-gated policies include audit log, banners, category attributes, collections, offers, orders, profiles, disputes, ledger, payouts, policy acceptances/documents, product catalogue and media, seller plans/entitlements/verification, settings, store applications/private/payments/subscriptions, stores, support queues/rules/settings, and waitlist.
- Store-owner-only policies affect catalogue variants/media/links/tier tables, private product data, store applications/private settings, subscriptions, verification status, seller orders, finance and payouts. Team access must be introduced without weakening these scopes.
- Customer ownership predicates (orders, order secrets, deliveries, refunds, disputes, notifications, reviews, cards and conversations) must retain customer isolation as roles are generalized.
- Public read policies for published catalogue/storefront content must not be coupled to signed-in role contexts or unintentionally lose anon access.

B2 must inventory effective table grants alongside RLS (RLS alone does not protect tables from grants that bypass policies), and validate all policy/function behavior with role-scoped SQL tests after every migration.


## Expanded live staging audit — direct table grants and guard paths (2026-11-25)

Read-only SQL was run against the same **Everneed-staging** project. No data was changed and no role simulation/write test was attempted.

### Table privilege/RLS results

- No public base table with anon/authenticated INSERT, UPDATE, or DELETE privileges was found with RLS disabled. This is a positive structural check, not a full bypass proof.
- Anonymous role has broad direct DML grants on some public tables (including products, product_variants, profiles, orders, offers, and settings), but the inspected anon policy set contains only SELECT policies—no anon INSERT/UPDATE/DELETE policies. With RLS enabled, those grants should not authorize row mutation; this should be asserted in role-scoped regression tests before any grants are tightened.
- Authenticated has direct DML grants on many public tables. The mutation paths are policy-restricted, with examples: products has owner insert/update and draft/rejected-only delete, plus admin policy; profiles UPDATE is self-only with role = my_role() in WITH CHECK; stores INSERT requires caller owner and draft/pending state, UPDATE is owner-bound; store applications owner update only while decision IS NULL; conversations has admin update; support and platform-config tables use admin policies. These policies are permissive OR-composed, so B2 must ensure a narrow permission policy does not accidentally combine with a broad legacy policy and expand access.
- kv and rate_limits have RLS enabled but no policies; authenticated direct grants therefore currently have no policy path. Keep intentional denial documented and test it, or remove unused grants after dependency review.
- Private schema USAGE is granted to anon/authenticated/service_role, but the read-only catalog check found zero private tables selectable by anon or authenticated. USAGE is not table data access. Do not revoke schema USAGE casually because existing policy helpers depend on it.

### Function and trigger guard paths

- public.is_admin() resolves to public.my_role()='admin'; private.need_admin() delegates to that helper. This is the current central legacy-admin gate, not the new universal permission system.
- private.profiles_guard() rejects role/email changes unless private.is_privileged(); the profile UPDATE RLS policy additionally requires row id = auth.uid() and role unchanged (role = my_role()). This is a defense-in-depth pair; preserve and test both while modernizing role mutation.
- approve_store() legitimately sets an owner profile from customer to merchant during the approved workflow; this privileged transition is protected by its legacy admin gate and audited. Do not replace it with a general team-role write path.
- approve_offer_campaign_budget() is a confirmed inconsistent authorization path: direct profile role lookup (role='admin') instead of private.need_admin(); it is authenticated-executable, not service-role-only. B2 should migrate to a narrow campaign-budget permission and audit reason/actor, with negative tests for non-admin and cross-scope actors.
- admin_store_workspace_context() exposes owner name/email/phone/photo and store/subscription metrics to legacy admins. Before converting to support/store-review roles, require an explicit scoped permission, reason/audit trail, and data-minimized response shape for roles that do not need owner contact data.
- seller_transition() resolves the seller-order and store from DB, then requires legacy admin or store owner; state transitions are checked and seller cannot directly set delivered/at_hub/consolidated. Retain those invariants and add team fulfilment membership only after B3 membership semantics are defined.
- hub_receive() validates exact per-item check coverage, item membership, status values, then updates custody state and audit. hub_consolidate() verifies every seller leg is at hub and uses route/state guards. dispatch() requires ready-for-delivery hub order, existing delivery record, updates courier details, and audits. The authorization gate is currently broad legacy admin; B5 must add assigned hub/zone/dispatch context without weakening these operational guards.
- mark_delivered() requires a valid code and allows admin or store owner on direct-route orders; rate-limits code attempts. Future courier permissions must bind authenticated actor to an assigned delivery job and preserve code/POD evidence.
- record_payout() locks the store, checks positive amount/reference and current balance, records payout plus ledger entry, notifies owner and audits. It is still behind broad legacy admin and needs finance permissions plus maker/checker separation.
- refund() locks order and seller-order, checks paid/refundable state and total cap, records processed refund and ledger reversals/commission restoration, notifies and audits. The operation currently executes under broad admin; introduce narrow refund permission, reason, and explicit approval/processing controls while preserving transactional/idempotency protections.

### Public anon RPCs — data review

- seller_plan_catalog() returns active public plan pricing, product quota, commission discount, features and verification flags. Public storefront plan comparison is likely intended; confirm only public-facing fields are returned and maintain a response-contract test.
- store_reply_stats() exposes store id, median reply minutes, and chat count for the last 30 days, requiring at least three conversations. It returns aggregate—not message or customer data—but still needs a public contract/privacy review and anti-scraping/rate consideration.
- support_sla_public() exposes the configured support SLA minutes. Keep only if this is intentionally public; ensure the selected support_settings value is a public-safe setting, not an arbitrary internal key.

### B2.0 inventory completion status

The read-only snapshot now covers public SECURITY DEFINER function counts and ACL, named high-impact function definitions, RLS policy totals and selected policy bodies, direct table privilege patterns, anon policy surface, private-schema table grants, trigger definitions, and selected role/profile guard helpers. **It is not yet a complete line-by-line audit of all 47 authenticated-executable functions or all 92 policy expressions.** The next audit pass must finish that list and classify each function/policy into: public read, user-owned, store-scoped, platform-admin, logistics, finance, support, or service-only. Enforcement implementation remains blocked on B1 security review/staging validation and must not be started from this incomplete inventory.


## Second-pass targeted findings (2026-11-25)

### Confirmed follow-up items

1. **Campaign budget approval lacks durable change-history audit.** `approve_offer_campaign_budget()` is authenticated-executable, checks `profiles.role='admin'`, overwrites approval fields on conflict, and does not call `private.audit()`. The staging trigger inventory found audit triggers for campaign reservations and seller funding consent, but none on `private.offer_campaign_budgets`. Existing row fields preserve latest approver/time/note only, not prior approved budget changes. Treat as a high-priority finance governance gap: migrate to narrow campaign budget approval permission, require reason, and append immutable audit/history on create/update; add tests that previous values and actor/reason are retained.
2. **Single-store assumptions in plan APIs conflict with multi-store context.** `choose_plan(p_plan)` uses `SELECT ... FROM stores WHERE owner_id=auth.uid()` without store ID or deterministic ordering/limit, so when an actor owns multiple stores the target may be ambiguous. `my_store_entitlements()` also silently picks the most recently created store and has no explicit context input. Before B3/B4 introduce multiple store memberships/contexts, these APIs must accept or resolve a validated active store context and reject ambiguity; never trust client-selected context without checking membership.
3. **Support SLA sweep is authenticated-executable.** `support_sla_sweep()` checks `auth.role()='authenticated' AND NOT is_admin()` and permits service-role calls. This is a deliberate admin/service gate; keep it service-only if the UI does not need manual execution, or assert non-admin rejection and admin-only authenticated behavior. The function also deletes stale support_queue records, so document scheduled invocation and retention expectations.
4. **Public store reply stats.** `store_reply_stats()` publishes aggregate store IDs, median reply latency, and chat counts with a minimum sample size of three. No message content/customer identifiers are returned. Confirm frontend public badge contract and whether a privacy/abuse rate limit is needed; do not expose more fields.

### Targeted second-pass classification (not full source review)

| Function | Current boundary | Review note / target |
|---|---|---|
| `accept_policy` | authenticated user only; inserts using `auth.uid()` | Retain self-only acceptance and effective/published policy checks |
| `choose_plan` | authenticated store owner; subscription-state guard | Add explicit store context for multi-store; lock subscription and audit plan changes |
| `confirm_received` | authenticated order owner | Keep customer-only; retain delivery workflow guard |
| `order_tracking` | authenticated order owner | Returns route/seller status and delivery payload; preserve owner predicate and data minimization |
| `report_payment` | authenticated order owner + awaiting-transfer state | Retain status guard, throttle and notification; add audit event if needed for dispute trail |
| `request_store_activation` | authenticated owner; subscription, plan and verification gates | Preserve exact owner scope and verification requirements |
| `submit_store` | authenticated owner; pending/draft state and policy acceptances | Preserve owner scope and submission state; verify application row integrity |
| `my_seller_orders` | store owner via DB-resolved store; released orders only | Contact details shown only for direct-route stages; hub route shows limited location; team permission must be purpose-limited |
| `my_store_entitlements` | current owner; newest store implicit | Multi-store context ambiguity identified above |
| `seller_product_capabilities` | owner/admin access to explicitly resolved store | Context switch must verify store membership; admin override must become narrow platform permission |
| `seller_product_category_schema` | authenticated read of active taxonomy/attributes | Read-only public product metadata; ensure no inactive/private fields leak |
| `next_slug` | authenticated caller; collision check | No obvious data exposure beyond slug availability; throttle/uniqueness remains important |
| `chat_start` | authenticated; membership/ownership and order-store relationship checks; admin-only admin_user path | `p_user` is only used in admin_user branch; retain participant binding and rate limits |
| `set_offer_store_funding_consent` / `revoke_offer_store_funding_consent` | authenticated store owner; offer availability; consent record | Trigger audit exists; keep owner check and seller consent explicit, do not imply admin consent |
| `support_sla_public` / `seller_plan_catalog` / `seller_product_category_schema` | read-only public/config surfaces (grant varies) | Confirm allowlisted fields and stable public contracts |

These findings are discovery-only. No migration, grant, row, or policy was changed on staging. The audit branch remains documentation-only and must not be merged as an enforcement change.


## Cross-phase dependency review — B1 logistics scope contract

A review of the unmerged B1 migration found a role-template mismatch: `platform_dispatcher` is platform-plane/platform-scope, while dispatch and route planning permissions are also platform-scope. This would represent a globally scoped dispatcher, not a zone-scoped dispatcher. Before B1 merge, the coordinator should keep platform logistics supervisor oversight separate from operational dispatch assignments and add a partner-plane/zone-scoped dispatcher role (or equivalent scope model); dispatch/route permissions must resolve the assignment's zone and prove cross-zone denial. This is a B1 catalogue/contract blocker, not something to patch during B2 enforcement. The B1 role-permission scope guard should also reject inactive roles/permissions, in addition to scope mismatches.


## Frontend context-contract review (2026-11-25)

A fresh Codex review of B1 identified a response-shape mismatch in the existing frontend access adapter `web/assets/js/ds-access.js`: `clean()` consumes `store_id` and `store_name`, while B1 `my_access()` emits generic `scope_id` and `scope_name`. Store context identifiers therefore normalize to null and store-specific gates cannot match. Add backward-compatible store aliases to the RPC response or coordinate a deliberate client contract update; include a regression assertion in test 039 before the gates are enabled.

The current frontend adapter also filters contexts to `plane='platform'` or `plane='store'`, dropping `partner` plane contexts. Hub, courier, dispatcher/zone and other partner contexts will not be visible/selectable until the adapter/context-switcher explicitly supports partner plane and its scopes. This is a cross-layer contract blocker for logistics roles. Keep it in the B1/B4 acceptance gate; do not enable partner assignments while the client discards them.


## Rollout compatibility gate — legacy admin UI

B1 intentionally returns a `legacy_admin` compatibility context with an empty permission array (no auto-promotion). The current `EVAccess` client treats a successful `my_access()` RPC as available; its `can()` then returns false for this context and `gate()` overrides legacy UI checks. If B1 is deployed before a verified platform assignment/bootstrap or an explicit transitional client rule, the existing admin may lose gated platform UI even though backend legacy `is_admin()` checks still authorize existing operations. Add a rollout gate: either compatibility-only context retains legacy UI fallback (explicitly temporary and not backend authorization) or a verified platform role is bootstrapped before turning on the access adapter gates. Do not silently auto-promote legacy admins.


## Sensitive-data RLS matrix spot-check (2026-11-25)

Catalog snapshot: 51 public base tables; RLS enabled on all 51; none currently FORCE RLS. This confirms RLS is present structurally, but table owners/SECURITY DEFINER functions/service_role can bypass it depending on execution context; protected RPCs must perform explicit authorization and resource checks.

Spot-checked policy expressions:
- `orders` SELECT is buyer owner or legacy admin; UPDATE is legacy-admin-only. `order_secrets` and `deliveries` SELECT are buyer (`private.buys`) or legacy admin only. Keep delivery secrets out of courier direct reads; courier verification should use an assigned-job RPC that verifies code without exposing secret values.
- `seller_orders` SELECT requires released + store owner or admin. `my_seller_orders()` is a separate owner-bound RPC that limits customer phone/address exposure to direct-route orders in selected fulfilment stages; hub route returns limited city. Team access must preserve least-privilege field projection and stage-based reveal.
- `refunds` SELECT is buyer, selling store for the related seller-order, or admin. `disputes` SELECT is opener, seller on associated seller-order, or admin; INSERT requires buyer-owned order and open status. Preserve both customer and seller isolation.
- `ledger_entries`, `payouts`, `store_payments`, `store_subscriptions`, and `store_verification_checks` are owner or admin scoped. Store finance viewer/team access must be an explicit store-scoped policy and data projection, never platform-wide.
- `product_private` insert/update are store-owner only; SELECT owner or admin. Inventory movement SELECT owner/admin. Keep adjustment write via audited RPC and inventory reason/reference, not broad direct table grants.
- `notifications` SELECT owner/admin and UPDATE owner-only; `cards` SELECT/delete owner-only. These are user-specific and should not be widened through staff/store roles.

This is a targeted policy spot-check, not complete verification of every policy expression. A full B2.0 checklist must still map all 92 policies to table sensitivity, read/write command, current predicate, target permission, exact scope, and test coverage.


## B2.0 source-policy family inventory — migration 006 (2026-11-25)

A source-level name inventory of the 38 policy definitions created in `006_marketplace_rls.sql` was added as a bounded audit slice. It is **not** a substitute for the live 92-policy staging inventory: baseline policies, later replacement/addition migrations, and dynamic policy definitions still need reconciliation against the final catalog.

### Public/customer catalogue reads
- `stores`: **stores public read**
- `products`: **products public read**
- `offers`: **offers public auto**

### Store owner and application
- `stores`: **stores owner read**
- `stores`: **stores admin read**
- `stores`: **stores owner create**
- `stores`: **stores owner update**
- `store_private`: **store_private owner**
- `store_private`: **store_private owner insert**
- `store_private`: **store_private owner update**
- `store_applications`: **applications read**
- `store_applications`: **applications owner insert**
- `store_applications`: **applications owner update**

### Plan/subscription access
- `store_plans`: **plans read**
- `store_plans`: **plans admin**
- `store_subscriptions`: **subscriptions read**
- `store_payments`: **store payments read**

### Product catalogue/private
- `products`: **products public read**
- `products`: **products owner read**
- `products`: **products owner insert**
- `products`: **products owner update**
- `products`: **products owner delete**
- `product_private`: **product_private read**
- `product_private`: **product_private owner insert**
- `product_private`: **product_private owner update**

### Order and seller fulfilment
- `order_items`: **order_items read**
- `order_item_fees`: **order_item_fees read**
- `seller_orders`: **seller_orders read**
- `deliveries`: **deliveries read**
- `order_secrets`: **order_secrets read**

### Finance/refund/dispute
- `ledger_entries`: **ledger read**
- `payouts`: **payouts read**
- `refunds`: **refunds read**
- `disputes`: **disputes read**
- `disputes`: **disputes open**

### User/system data
- `notifications`: **notifications own**
- `notifications`: **notifications mark read**
- `audit_log`: **audit admin**
- `settings`: **settings merchant hub**

### Follow-up review rules

- For each policy above, reconcile table privileges and the final live policy expression; record command (SELECT/INSERT/UPDATE/DELETE/ALL), role, USING and WITH CHECK, sensitivity, ownership/resource scope, and required negative test.
- Public read policies are intentionally separate from signed-in staff contexts. Keep storefront/catalogue access available to anonymous shoppers only where the final predicate permits it.
- Store owner policy groups must be converted to store membership only after explicit store-scope assignment is proven; do not broaden with a permissive OR that retains a global admin predicate unintentionally.
- Order, order-item, seller-order, delivery-secret, finance, dispute, notification, and audit policies are high-sensitivity. Access expansion must be accompanied by data projection and role-specific tests; courier must not gain direct secret access.
- This slice does not modify schema, data, grants, RLS, staging, or production.


## Live policy command/role matrix — second catalog query (2026-11-25)

A read-only aggregate of `pg_policies` on Everneed-staging confirms all **92** policies are currently `PERMISSIVE` (no restrictive policies in this catalog snapshot). Command/role distribution:

| Command | Role target | Count | Legacy `is_admin()` predicate | `auth.uid()` predicate |
|---|---|---:|---:|---:|
| ALL | authenticated | 18 | 18 | 1 |
| DELETE | authenticated | 5 | 3 | 2 |
| INSERT | authenticated | 9 | 2 | 3 |
| SELECT | anon | 1 | 0 | 0 |
| SELECT | anon, authenticated | 9 | 0 | 0 |
| SELECT | public | 4 | 0 | 0 |
| SELECT | authenticated | 34 | 30 | 9 |
| UPDATE | authenticated | 12 | 4 | 4 |

Counts in predicate columns overlap with each other and with other policies. This is not a vulnerability count. The **permissive OR composition** is the key design constraint: adding a narrowly scoped policy does not neutralize an existing broad policy on the same command/table. For each conversion, legacy admin policy must be deliberately replaced/altered or retained only where the new permission has equivalent scope; do not layer a narrow policy and assume it tightens access.

### Additional live-policy notes

- The 18 authenticated `ALL` policies are legacy-admin gated. Convert by table/domain, not a blanket administrator replacement; the catalogue includes seller verification rules, settings, support, offers, products, banners, collections, category attributes and others.
- The 34 authenticated SELECT policies include 30 with legacy admin predicates; these include mixed owner/customer/admin read paths. Keep each owner/customer branch independent while migrating the admin branch.
- Public catalogue policies (anon/authenticated and PUBLIC) are intentional storefront surfaces. Test anonymous reads against unpublished/inactive/private rows to prevent accidental exposure while retaining approved public data.
- The merchant-facing `settings` policy permits SELECT on row id `hub` when `my_role()='merchant'`. Confirm the `hub` row contains only seller-safe public configuration; this is a field/data review, not a policy change.
- Conversation/message policies include global `is_admin()` visibility and admin update. Any future support role must use assigned case/conversation scope and hide internal notes; do not treat platform support as unrestricted conversation membership.
- `order_secrets` and `deliveries` remain buyer/admin read surfaces; seller/courier roles should use minimal RPC projections rather than direct table access.

This remains a source-and-catalogue inventory. Every policy's final expression and grant interaction still needs explicit test mapping; no staging writes or production access occurred.


## SECURITY DEFINER effective-execute inventory — exact signature snapshot (2026-11-25)

A staging catalog query using `has_function_privilege` enumerated the full current set (not a name heuristic):

| Effective access | Count | Anon-executable | Service-role-executable |
|---|---:|---:|---:|
| Authenticated-executable | 47 | 3 | 44 |
| Service-only | 36 | 0 | 36 |
| **Total** | **83** | **3** | **80** |

This reconciles the earlier high-level snapshot: **36 are service-only**; 47 are authenticated-executable; among those, exactly three are also anon-executable (`seller_plan_catalog()`, `store_reply_stats()`, `support_sla_public()`). Counts are role-effective ACLs, not vulnerability findings.

### Authenticated-executable functions by workstream (47)

**Identity / user / customer-owned**
- `accept_policy(text,text)`
- `cancel_order(text,text)`
- `confirm_received(text)`
- `order_tracking(text)`
- `report_payment(text,text,text)`
- `next_slug(text)`

**Seller / store / catalogue**
- `apply_rental_payment(text,text,numeric,text,text)`
- `choose_plan(text)`
- `my_seller_orders(text)`
- `my_store_entitlements()`
- `request_store_activation(text)`
- `seller_adjust_variant_stock(uuid,integer,text,text)`
- `seller_product_capabilities(text)`
- `seller_product_category_schema(text)`
- `seller_transition(text,text,jsonb)`
- `set_offer_store_funding_consent(text,text,integer)`
- `revoke_offer_store_funding_consent(text,text,text)`
- `set_store_terms(text,numeric,boolean)`
- `store_balance(text)`
- `submit_store(text)`
- `seller_plan_catalog()`

**Platform/admin and sensitive operational**
- `admin_confirm_payment(text)`
- `admin_set_plan_entitlements(text,integer,boolean,integer,boolean,boolean,text)`
- `admin_set_verification_scope(text,text,text,text)`
- `admin_store_workspace_context(text)`
- `approve_offer_campaign_budget(text,text,bigint,text)`
- `approve_store(text,text)`
- `dispatch(text,jsonb)`
- `hub_consolidate(text)`
- `hub_receive(text,jsonb)`
- `mark_delivered(text,text)`
- `record_payout(text,numeric,text,text)`
- `refund(text,text,numeric,text)`
- `reject_store(text,text)`
- `review_product(text,text,text)`
- `suspend_store(text,text)`
- `support_sla_sweep()`

**Chat / support interaction**
- `chat_escalate(uuid,text)`
- `chat_member(uuid)`
- `chat_read(uuid)`
- `chat_send(uuid,text,boolean)`
- `chat_set(uuid,text,uuid,text[],integer)`
- `chat_start(text,text,text,text,text,uuid)`

**Public aggregate/config surfaces (anon-executable; also authenticated)**
- `store_reply_stats()`
- `support_sla_public()`

**Compatibility helper**
- `is_admin()`
- `my_role()`

### Service-only functions (36; exact ACL snapshot)

- `apply_rental_payment_for(text,text,numeric,text)`
- `cancel_order_for(text,uuid,text,boolean)`
- `chat_escalate_core(uuid,text,integer)`
- `chat_notification_contract()`
- `chat_triage()`
- `claim_provider_event_recovery(integer,integer,integer)`
- `claim_stale_payment_attempt_recovery(integer,integer,integer,integer)`
- `confirm_payment(text,text,uuid)`
- `confirm_received_for(text,uuid)`
- `create_order(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text)`
- `create_order_with_snapshot(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)`
- `create_order_with_financial_snapshot_v2(uuid,jsonb,text,text,jsonb,numeric,text,numeric,jsonb,numeric,text,jsonb)`
- `create_payment_attempt(text,uuid,text)`
- `expire_rentals()`
- `expire_unpaid_checkout_orders(timestamp with time zone,integer,text)`
- `finish_provider_event_recovery(uuid,uuid,text,text,text,integer)`
- `finish_stale_payment_attempt_recovery(uuid,uuid,text,text,text,integer)`
- `get_payment_attempt_recovery_context(text)`
- `join_waitlist(text,text,text,text,text,text)`
- `mark_provider_event_processed(text,text,text,text)`
- `on_signup()`
- `persist_order_financial_snapshot_v2(text,jsonb,uuid[])`
- `post_finance_journal(text,text,text,text,text,jsonb,jsonb)`
- `rate_hit(uuid,text,integer,integer)`
- `record_payment_attempt_initialization(uuid,boolean,text,text)`
- `record_verified_provider_event(text,text,text,text,jsonb)`
- `redeem_offer(text)`
- `release_earnings()`
- `reverse_finance_journal(uuid,text,text,jsonb)`
- `run_scheduled_jobs()`
- `settle_verified_payment_attempt(text,text,bigint,text)`
- `support_guest_close(text)`
- `support_guest_open(text,text,text,text)`
- `support_guest_ping(text)`
- `support_sla_minutes(text)`
- `support_tier(text)`

### ACL review actions

- Preserve the 36 service-only functions as service-role-only; add ACL regression checks for the exact signatures, including recovery and finance-journal functions.
- For each authenticated-executable function, review the actual body and any called SECURITY DEFINER helpers, resource resolution, state transitions, data returned, and actor/scope provenance; the inventory does not imply all 47 are protected by the same class of authorization.
- `admin_confirm_payment()` is a special high-risk legacy callable: review its exact lifecycle path and remove client-callability if it is redundant with verified service/provider paths. Do not alter it until call sites and payment state tests are mapped.
- `apply_rental_payment()` and `set_store_terms()` are finance/entitlement-sensitive; narrow permissions, immutable audit, and multi-store explicit context are required.
- `support_sla_sweep()` is authenticated-executable but admin/service-gated and destructive to stale queue records; prefer service-only invocation if no supported admin UI path exists, otherwise test non-admin denial and retention.
- This inventory is the exact signature/ACL baseline; body-level review and dependency mapping for all 47 remains open. No grants, functions, or data changed.


## High-risk function-body review — targeted live staging sample (2026-11-25)

Read-only `pg_get_functiondef` review was performed for eight currently executable RPCs. This adds concrete call-path details; it is not the complete 47-function review.

| Function | Body evidence / existing checks | B2 review requirement |
|---|---|---|
| `admin_confirm_payment(text)` | Calls `private.need_admin()`, throttles, then `private.confirm_payment_core(order,null,auth.uid())`. | Map UI call sites, transfer proof and lifecycle validation inside core; ensure explicit manual-review permission and audit trail. Consider removing authenticated execution if replaced by provider/service-only path, but only after call-site/settlement tests. |
| `admin_store_workspace_context(text)` | Legacy admin gate; returns store/subscription state, owner name/email/phone/photo, catalogue counts and module readiness. Calls `seller_product_capabilities(store)`. | Store-review/support/operations roles must be separately scoped; contact PII should be minimized and access reason audited; avoid granting global support access. |
| `apply_rental_payment(text,text,numeric,text,text)` | Legacy admin gate + throttle, delegates to rental core with `admin_recorded` and actor `auth.uid()`. | Narrow subscription/finance permission, explicit store scope, validated payment reference and duplicate/idempotency checks; actor/reason immutable audit. |
| `approve_offer_campaign_budget(text,text,bigint,text)` | Direct profile-role admin check; validates currency/budget/note/offer; upsert overwrites approval actor/time/note; no explicit audit call or history trigger found in targeted trigger inventory. | Replace inconsistent role check with scoped campaign permission; append immutable approval/change history, preserve previous value and actor/reason; maker/checker for material budget changes. |
| `dispatch(text,jsonb)` | Legacy admin gate + throttle; order lock and ready/hub-route checks; requires delivery row; accepts courier name/phone/note from JSON; advances delivery/seller/order states and audits payload. | Replace global admin with zone/dispatch assignment; courier must be verified entity/job assignment rather than free-text identity; retain locking/state checks; data minimization and evidence requirements. |
| `seller_transition(text,text,jsonb)` | Resolves seller order/store from DB; legacy admin or store owner; released/state guard; prevents seller setting delivered/at_hub/consolidated; seller direct route may write courier metadata and delivery row; issue/cancel/reject restrictions; audit + order sync. | Team fulfilment access must be store-scoped; retain the transition matrix and forbidden states; direct courier metadata should be treated as seller-submitted, not verified courier assignment/POD. |
| `set_store_terms(text,numeric,boolean)` | Legacy admin gate; commission bound 0–60; upserts commission override/trusted; audit records action but no before-state supplied in call. | Narrow store-commercial/commission permission, scope check, before/after audit, approval policy for official/trusted or high-impact commission changes. |
| `support_sla_sweep()` | Authenticated path explicitly rejects non-admin; service role allowed; escalates open overdue conversations; deletes support queue entries older than 1 day or closed entries unseen for 1 hour. | Keep scheduler/service-only if no admin console need; otherwise support-operations permission and tested non-admin denial. Confirm retention requirements before deletion policy changes. |

### New design dependencies

- Admin confirmation of payments and manual rental-payment recording must remain separate from provider webhook/service settlement; never allow staff role to forge provider evidence.
- Courier metadata in legacy dispatch/direct-seller functions is not a substitute for the FIN-02/B5 assignment, custody, proof-of-delivery, and exception lifecycle.
- Finance/commercial operations should use actor-bound immutable audit records with before/after, reason, correlation/idempotency reference and approval state, not only the latest mutable row or a generic audit payload.
- The targeted body review remains read-only. No staging mutation, role simulation, grant change, or production access was performed.


## Refund lifecycle / seller subledger cross-check (2026-11-25)

The live body review of `refund(text,text,numeric,text)` and the existing fast-settlement contract identifies a critical B2 finance boundary:

- The legacy `public.refund()` inserts `public.refunds.status='processed'`, reverses seller share/commission through ledger entries, updates the order payment status and notifies the buyer. It **does not itself confirm a Paystack refund**.
- The existing `private.provider_refunds` foundation (migration 026) is intended to hold provider execution/confirmation; its contract explicitly warns that legacy `approved`/`processed` refund status is not proof the provider sent money. Current lifecycle does not yet model the full provider pending/processing/needs-attention/failed/processed states.
- The live legacy refund RPC enforces a total-order refund cap, but the selected seller-order ledger reversal is calculated pro-rata from `p_amount / orders.total * seller_orders.subtotal`. A seller-order-specific cumulative cap and cross-seller attribution test should be added to the finance audit before using this operation for package-level refunds; ensure refunding one seller leg cannot over-reverse another seller's subledger.
- Do not assign a new staff `refund.approve` / `refund.process` permission or expose this workflow as customer-confirmed until the provider refund lifecycle is wired, idempotent, and reconciled. Separate approval from execution, persist provider reference/status, and only mark provider-paid/processed after verified provider evidence.
- `record_payout()` similarly remains a manual admin record rather than bank-transfer execution confirmation; permissions must not present that record as proof of funds transfer.

This is a high-priority finance blocker/contract note, not a production incident assertion. No refund, payment, payout, or staging data was changed.


## Multi-store and seller-finance function-body pass (2026-11-25)

| RPC | Confirmed behavior | Risk/target |
|---|---|---|
| `choose_plan(text)` | SELECT from stores WHERE owner_id=auth.uid() without store ID, deterministic order, or ambiguity rejection; then updates application/subscription for that selected row. | Must accept explicit store context and verify active membership; reject ambiguous owner. Lock subscription and retain audit on plan changes. |
| `my_store_entitlements()` | Selects most recently created owner store implicitly; then reads its subscription/plan and usage. | Context-specific response; never silently choose latest store when a seller owns multiple. |
| `seller_product_capabilities(text)` | Explicit store ID is resolved and must belong to caller or legacy admin; absent ID defaults to latest store. Admin override returns broad feature flags. | Store context required for multi-store; replace global admin override with narrowly scoped capability-management permission; no team access without B3. |
| `store_balance(text)` | Returns ledger aggregate only for legacy admin or store owner; otherwise NULL. | Preserve per-store scope; finance team read permission should be scoped and use a finance projection, not cross-store balance access. |
| `set_offer_store_funding_consent(text,text,integer)` | Requires caller own the store, active offer and funding basis points 0–10000; upserts consent row and resets revocation fields. | Team members must not consent on behalf of seller by default. Explicit delegated authority, change history, and clear consent UI required. |
| `revoke_offer_store_funding_consent(text,text,text)` | Caller-owned store only; updates active consent with timestamp/reason. | Keep seller-controlled revocation, audit reason, and prevent staff/admin overriding consent. |

No multi-store fixtures or write tests were run. These body-level findings confirm that context selection is a contract issue to resolve before universal team roles are allowed to call seller RPCs.


## Chat/support RPC body and policy cross-check (2026-11-25)

- `chat_member(uuid)` is a caller-membership boolean based on `auth.uid()` and conversation membership; retain its narrow helper contract.
- `chat_read(uuid)` updates the caller's own membership unread/read timestamp; a legacy admin also clears the conversation-wide admin-unread flag. That admin branch is global, so future support staff must only clear assigned-case visibility and should not gain unrestricted conversation access.
- `chat_send(uuid,text,boolean)` validates caller/member or admin, body length (1–2000), throttles, and only allows internal notes for admin. Admin can join/assign themselves on non-note sends. Preserve participant checks, anti-abuse throttle, note separation, and do not expose internal notes to customers/sellers.
- `chat_set(uuid,text,uuid,text[],integer)` allows admins to change status, assignee, tags and priority; conversation members can only resolve. Future support-role write permission must bind to assigned/authorized conversation, restrict assignee selection to active staff, validate tags/priority, and preserve audit/history. Current body has no explicit reason/audit call for these admin changes.
- `chat_start(...)` binds store chat to an approved store, disallows owner messaging own store, and validates optional order belongs to buyer/store. Seller-admin chat requires caller own store. The `admin_user` branch requires legacy admin and creates user/staff membership; no user target eligibility or order association validation is performed in this branch, so the support/admin workflow must be reviewed for recipient and context correctness before it is delegated to support roles.

The current support model is still legacy admin-global. B2/B3 should introduce case assignment and store/subject scope, not a role that inherits global `is_admin()` chat policies. Internal notes must be excluded from customer-visible RPCs and public conversation views. This pass is read-only.


## Trigger / audit-history corroboration (2026-11-25)

A read-only trigger catalog query checked campaign budgets, funding consent, inventory movements, payouts, refunds, conversations/messages, ledger entries, store-private settings and subscriptions:

- The private seller funding-consent table has AFTER INSERT/UPDATE `offer_funding_consent_audit` trigger; retain it and verify actor/reason history semantics before team delegation.
- `public.ledger_entries` has BEFORE UPDATE/DELETE `ledger_guard`; this is a write-protection guard, not an audit event trigger. Journal and reversal flows remain service-only.
- `public.messages` has BEFORE INSERT `chat_guard`, AFTER INSERT triage, and notification-contract triggers. No explicit conversation-assignment/status audit trigger was returned for the checked tables.
- `public.store_private` has BEFORE INSERT/UPDATE guard; the checked table list did not return a history trigger for commission/trusted terms changes.
- No trigger rows were returned for `private.offer_campaign_budgets`, `public.payouts`, `public.refunds`, `public.product_inventory_movements`, `public.conversations`, or `public.store_subscriptions` in this query. This corroborates the campaign-budget history gap and highlights that history must be written by guarded RPCs or dedicated append-only tables, not assumed from RLS or ledger guards.

Trigger inventory is limited to these tables and event types; no schema changes were made.


## Customer order lifecycle body pass (2026-11-25)

- `cancel_order(text,text)` requires authentication, throttles, and delegates to `private.cancel_order_core` with a legacy-admin override flag. Customer cancellation requires ownership and all seller legs still pending/cancelled/rejected; admin override bypasses that seller-started restriction but still rejects delivered/cancelled parent orders. Future platform cancellation/intervention must be narrowly permissioned, order-scoped, reasoned, and audited; don't let ordinary support use the global override.
- `private.cancel_so` restores reserved inventory; for released paid seller orders it creates a `refunds` row with status `approved`, reverses sale/commission ledger entries, sets order partial/refunded status, and sends customer “refund is on its way” plus admin refund-due notification. This remains an internal approval/bookkeeping event, not provider confirmation; reconcile this notification wording with the Paystack provider-refund lifecycle before calling it paid back.
- `confirm_received(text)` binds the order to `auth.uid()`, throttles, then invokes the delivery workflow. Preserve buyer-only confirmation and the out-for-delivery state requirement.
- `order_tracking(text)` binds to the buyer and returns parent/seller status plus delivery JSON with delivery/order IDs omitted. Verify the delivery payload projection remains customer-safe when adding tracking/POD fields; don't expose courier private identifiers or internal evidence to unrelated users.
- `my_seller_orders(text)` is seller-owner scoped and released-only; it conditionally reveals customer name/phone/address for direct route at selected statuses, while hub route reveals reduced information. B3 team access must preserve this exact purpose/stage-based PII projection.
- `report_payment(text,text,text)` updates only caller-owned orders in `awaiting_transfer`, throttles, stores reference/note and notifies admins. It is a customer report, not proof of payment; admin confirmation remains separate and must use verified evidence/manual review.
- `request_store_activation(text)` locks owner store and checks approved application, suspension, active subscription/plan entitlements, regional verification rules and required verified checks before activation; missing checks queue reminders. `submit_store(text)` locks owner store, restricts draft/rejected states, validates business application and latest regional policy acceptances. Preserve these owner/state/compliance gates when adding store-team roles.

Read-only body review; no customer or seller records changed.


## Manual payment-confirmation boundary (2026-11-25)

`admin_confirm_payment(text)` is authenticated-executable but legacy-admin-gated; it throttles and calls `private.confirm_payment_core(order,NULL,auth.uid())`. The core locks the order, returns `already` if paid, rejects cancelled, otherwise marks paid and releases seller legs/ledger sale+commission. The core does not itself require an order to be specifically `awaiting_transfer` or `payment_reported`, nor does the manual wrapper carry provider evidence/reference. This is a privileged manual confirmation path, not a Paystack-verified path.

**B2/payment gate:** replace with a narrow bank-transfer review permission; require allowed pending-transfer/report states and documented evidence/reference, actor/reason audit; ensure only manual transfer orders can use it. Provider-confirmed card checkout remains service/webhook path, and a second successful distinct provider reference must be reconciled rather than hidden by `already`. Keep existing idempotency and seller-release guards. No payment status was changed or simulated.


## Catalogue, verification and inventory RPC body pass (2026-11-25)

Read-only targeted review of seven RPCs and inventory/product/store guard triggers:

| RPC | Current control / evidence | Scoped role migration target |
|---|---|---|
| seller_adjust_variant_stock(uuid,integer,text,text) | Authenticated; variant row locked; legacy admin or owning store; reason >=3 chars; optional reference; transaction-local audit metadata; stock cannot go negative unless backorder; inventory movement trigger records before/after, delta, reason/reference, actor. | Store inventory permission only for assigned store; keep stock lock and negative-stock rule; require reason and reference where stock adjustments are operationally material; movement history must remain append-only/read-protected. |
| review_product(text,text,text) | Legacy admin; decision constrained to publish/reject; rejection note >=3; row lock; updates product_private reviewer/note; notifies owner; audits old status and decision/note. | Seller-review permission with queue scope; store/product scope, decision separation, rejection reason and reviewer audit. No store staff may publish their own products. |
| approve_store(text,text) | Legacy admin; locks store/application; seller-selected active plan + complete entitlements; subscription conflict checks; sets approved/verification_required; updates owner customer->merchant; starts trial; notify + audit. | Seller onboarding/review permission; independent store/application scope; preserve plan and subscription invariants; avoid team member privilege elevation/owner role mutation; approval and activation remain separate. |
| reject_store(text,text) | Legacy admin; reason required (>=3); updates store/application/private note, notification and audit. | Scoped application-review role; reason mandatory and visible to applicant; protect against reviewer changing own application. |
| suspend_store(text,text) | Legacy admin; locks store; rejects official store; updates status/note, notifies owner and audits old status/reason. | Platform trust/safety permission; store-scoped with reason, possible maker/checker for severe suspension; preserve official-store protection and appeals. |
| admin_set_plan_entitlements(...) | Legacy admin; validates explicit finite/unlimited catalogue limits; locks entitlement; updates entitlement + store plan product limit; reason required; before/after audit. | Platform plan-management permission; distinguish plan configuration from subscription/finance; require approvals for unlimited/large increases; audit before/after and actor. |
| admin_set_verification_scope(text,text,text,text) | Legacy admin; allowed scopes only mandatory_compliance/commercial/unclassified; reason; row lock; before/after audit. | Compliance policy-management permission; require country/check type validation and change review; preserve regional legal/compliance meaning. |

### Trigger evidence / integrity notes

- Product variant BEFORE insert/update guard locks parent product, derives store ID, prevents variant moving across products, checks owner/admin and negative stock. AFTER insert/update inventory audit trigger creates movement rows with initial-stock or adjustment reason/reference and auth.uid().
- Product stock audit trigger creates movement rows for product stock updates as well. Trigger context uses everneed.inventory_reason and everneed.inventory_reference; absent metadata becomes generic reason. A privileged/direct stock write without the seller RPC could therefore generate a generic movement record rather than the operator's reason. Direct mutation should remain tightly restricted and future team adjustments should route through the audited RPC.
- Product guard enforces subscription entitlements, listing quota, timezone-aware daily listing event count, draft/pending initial states, store approval before review, and prevents seller publishing/rejecting. Product edits to published name/description/images return it to pending review. Preserve these rules; reviewers cannot bypass them with new team permissions.
- Store guard protects owner, official/demo flags, approved_at, slug and seller-controlled state transitions; privileged transitions are controlled by protected RPCs. approve_store currently changes owner profile role from customer to merchant, which should remain an audited onboarding transition, not a general membership/role assignment API.
- Stock movement triggers provide movement records, but not a substitute for a role-scoped read policy, immutable movement history, or high-risk stock adjustment approval.

No changes to inventory, catalogue, store applications, plan entitlements, verification rules or production were made.

## Scoped RLS policy cross-check for catalogue and seller onboarding (2026-11-25)

Live policy expressions checked on staging:

- product_inventory_movements: authenticated SELECT only when legacy admin or store owner. Future inventory staff should be scoped to assigned store and movement-history visibility; don't grant global SELECT.
- product_variants: permissive authenticated ALL policy allows legacy admin or store owner; separate public read policy requires active variant, published/public product, publish_at reached, and live store. New inventory staff write policy must not coexist with broad ALL in a way that retains global admin bypass.
- products: legacy admin ALL policy OR owner policies (insert/update, owner read, delete only draft/rejected) OR public read (published/public, publish_at reached, live store). Because all policies are permissive, admin ALL remains a broad bypass until intentionally replaced. Preserve the owner deletion and public visibility conditions.
- seller_plan_entitlements: authenticated admin-only SELECT. New plan-management role should have only required plan fields and not private subscription/financial data.
- seller_verification_rules: enabled rules are readable by authenticated users; legacy admin can read disabled rows and insert/update/delete. A compliance policy role should be explicit and audited; public/app clients shouldn't receive disabled/internal policy data unless justified.
- store_applications: owner insert; owner SELECT or legacy admin; owner UPDATE only while decision is NULL. Reviewers need scoped queue access and must not be able to edit application submissions or self-review.
- store_private: owner insert/update, owner/admin SELECT. Team access must be narrow by purpose (review notes, verification status, seller-safe status), not wholesale access to internal store metadata.

The audit reiterates the RLS migration rule: before introducing role-specific policies, replace broad legacy-admin permissive branches for the relevant command/table. A new narrow policy alone does not reduce existing access.

## Public RPC, policy acceptance and seller consent body pass (2026-11-25)

- accept_policy(document,country): auth.uid-bound; accepts only published, effective, region-matching documents requiring acceptance; idempotent insert keyed by user/document. Preserve immutable version identity and country. No admin override or impersonation should be introduced.
- next_slug(name): authenticated-only; slugifies bounded name and returns a collision-free suggestion by probing global stores. It does not reserve the slug; stores_guard performs uniqueness loop at insert. Treat as non-sensitive utility; frontend must not rely on returned slug being reserved.
- seller_plan_catalog(): anon/authenticated public RPC returns active plans, pricing/period, product limits, commission discount, features and verification flags. Keep fields intentionally public and validate features JSON allowlist; never add internal margin/entitlement or operational notes to the response.
- store_reply_stats(): anon/authenticated returns 30-day median reply minutes and chat count per store, only when at least 3 conversations. Keep aggregate disclosure limited; ensure no timestamps, message content, or user identifiers are added. Consider rate-limiting/caching against enumeration.
- support_sla_public(): anon/authenticated returns public SLA minutes setting. Ensure only public-safe SLA config key is exposed and not private support settings.
- set_offer_store_funding_consent(): authenticated store owner only; validates active offer and funding bps 0–10000; upserts current consent and clears revocation fields. Consent trigger records history. Treat resetting revoked consent as an explicit new consent event, never staff delegation without seller authority.
- revoke_offer_store_funding_consent(): authenticated owner only; revokes active consent with bounded reason and returns whether a row changed. Preserve seller-controlled revocation; do not let platform or store staff silently restore consent.
- set_store_terms(store,commission,trusted): legacy admin only; commission 0–60 and audit action, but audit call has no before-state and no reason. trusted may enable auto-approval behavior via product guard settings. Replace with separate scoped commercial-terms and trust/auto-approval permissions, require reason and before/after values, and consider maker-checker for trusted status/high commission. Do not bundle these high-impact powers in a generic store manager role.

Read-only review. No policy acceptance, consent, terms, or public RPC calls were executed against staging data.


## Finance, order, delivery and support RLS cross-check (2026-11-25)

Read-only live policy expressions checked:

- orders SELECT: buyer or legacy admin; UPDATE: legacy admin only. Future support and logistics must use order-scoped RPCs and not gain direct order UPDATE.
- seller_orders SELECT: released orders for store owner or legacy admin. Team fulfilment access should be store-scoped, released-only, and preserve existing stage/route-based PII projection in seller RPCs.
- order_secrets and deliveries SELECT: buyer or legacy admin. Do not widen to seller staff or couriers; courier verification should resolve assigned-job proof via minimal RPC.
- refunds SELECT: buyer, seller for matching seller_order, or legacy admin. Preserve buyer/seller split and avoid provider identifiers/other sellers' financial details in staff projections.
- disputes INSERT: buyer-owned order and opener must equal auth.uid(), status must be open; SELECT: opener, seller for matching seller_order, or legacy admin. Staff dispute access should be assignment scoped, and private evidence/internal notes separated from parties' visible content.
- ledger_entries SELECT: legacy admin or owning store. Store finance-viewer access needs explicit store scope and a projection; do not permit direct writes.
- payouts, store_payments and store_subscriptions SELECT: owning store or legacy admin. Staff finance visibility should be purpose-limited and store-scoped, while payment execution/reconciliation stays service-only.
- notifications SELECT: recipient or legacy admin; UPDATE mark-read restricted to recipient. Staff should not access customer notifications globally.
- conversations SELECT: admin or conversation member; UPDATE admin only. messages SELECT: admin or member excluding kind='note'; preserve internal-note confidentiality and avoid global support access.

All listed policies are permissive. Converting admin branches requires replacing/altering the existing policy while preserving each buyer, seller, recipient, and participant branch. No order/payment/support records were read or changed by this audit query.
