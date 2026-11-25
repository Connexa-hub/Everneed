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
