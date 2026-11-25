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
- Catalog snapshot: 83 public SECURITY DEFINER functions; 47 are executable by `authenticated`; 3 are executable by `anon`; 81 are executable by `service_role`. (These counts are ACL snapshot, not a vulnerability count.)
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
