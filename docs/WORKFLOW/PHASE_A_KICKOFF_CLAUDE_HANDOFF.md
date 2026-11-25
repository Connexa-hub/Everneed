# Phase A Kickoff — Universal Platform Audit and Frontend Parallel Work

**Date:** 25 November 2026  
**Branch:** `web-portal`  
**Status:** Kickoff / read-only audit; no production schema changes authorized.

This kickoff is based on an initial read-only inspection of the currently connected Everneed Supabase project. Findings are preliminary and must be reconciled with repository migrations and function definitions before design or implementation.

## Initial live database observations

- Public tables: marketplace, stores, profiles, seller orders, orders, deliveries, payouts, ledger entries, support, product/catalogue, notifications, disputes and other supporting tables.
- Private schema includes finance journals/accounts/lines, payment attempts, refunds, order financial snapshots and provider-event inbox.
- RLS is enabled on every inspected public base table. `FORCE ROW LEVEL SECURITY` is not enabled on the inspected tables; this is not itself a defect, but owner/bypass behavior and grants must be evaluated.
- Current profile role values: `admin=1`, `merchant=2`, `customer=1` (counts only; no personal data).
- Stores: 3 total, 2 have owner IDs. The third needs explicit classification; do not infer or assign ownership.
- There is no `store_members` or `staff_members` table in the current live public schema. Existing `conversation_members` is unrelated.
- Existing authorization is primarily legacy role/owner helpers such as `is_admin()`, `my_role()`, `owns_store()`, `my_store()`, and direct owner/admin predicates in policies and RPCs.
- Relevant RPCs include admin/store workspace context, seller order transitions, dispatch, order tracking, stock adjustment, store approval/activation, finance/payout functions, and payment/order functions. Many are SECURITY DEFINER and must be reviewed for grants, auth checks, search_path, input validation, and privilege scope.
- Existing delivery table and dispatch/tracking functions mean logistics must extend/align with the present model, not invent a parallel delivery database before inspecting the contract.

## Phase A tasks (ChatGPT-owned audit)

1. Compare migration history and current schema, identify drift and migration gaps.
2. Inventory role/owner/admin checks across policies, triggers, RPCs, views, edge functions, frontend and migrations.
3. Produce authorization matrix for each table and protected operation: actor, permission, resource scope, RLS/policy, RPC guard, UI route, test coverage.
4. Review all SECURITY DEFINER functions for EXECUTE exposure, explicit auth checks, fixed search_path, parameter validation, cross-tenant IDOR, and unintended privilege escalation. Prioritize order, payment, financial, payout, store-admin and dispatch functions.
5. Review delivery/orders/fulfillment model and current state transitions, assignment, tracking, notifications, and privacy. Identify migration path to event-driven shipment/fulfillment legs without breaking checkout/seller settlements.
6. Inventory support, audit, finance separation-of-duty and current configuration/settings tables.
7. Identify high-risk findings and create a staged plan with tests. Do not modify live production schema or data.

## Claude — start parallel work now

Claude may begin frontend and experience research/design on `web-portal` immediately, following the Universal Platform Architecture and AI Protocol. Keep the work contract-first; backend audit is in progress.

### Claude deliverables
- Review current frontend and identify current route/app-shell structure and shared UI.
- Propose and begin a shared permission/context-aware navigation and workspace shell, using a typed/mock permission contract clearly marked as mock until backend introspection is ready.
- Design responsive workspaces/flows for Platform Ops role management, store team/membership, Dispatcher, Hub/Warehouse, Courier, Support and future POS. Do not build all screens at once: start with reusable shell, context switcher, permission-aware nav, role assignment UX prototype, and dispatcher queue/map/list experience.
- Draft role-management UI against this proposed contract: permission key, scope/context, assignment, expiry, invite/revoke, and approval states. No client-side authorization claims.
- For dispatch/logistics UI, use existing delivery concepts in the current app; don't assume a new backend status vocabulary. Clearly label mocks and create a data-contract handoff with fields, events, transitions, permissions and API calls.
- Create a frontend handoff describing components, routes, UX decisions, accessibility/mobile constraints, API dependencies, mock data, test plan, and files changed.
- Avoid committing migrations, changing live Supabase settings, altering production secrets, or bypassing security checks. Don't merge to `main`.

### Proposed initial frontend contract (placeholder; backend audit may revise)
- `AccessContext`: user identity, memberships, active context, role assignments, effective permission keys, scope/resource identifiers, feature/app grants.
- `Permission`: stable namespaced key + description + scope type + sensitivity + dependencies + assignability.
- `Role`: role ID, template/system flag, permission keys, status/version.
- `RoleAssignment`: identity, role, context/scope, assigned by, start/end, status, approval metadata.
- `AppModule`: module/app ID, route, required permission keys, feature state, supported contexts.
- `Delivery`/shipment UI must consume backend events/timeline; frontend never writes arbitrary status values directly.
- Mock/demo payloads must be marked and isolated; do not make fake data look like live customer/order records.

## Work split
- **ChatGPT:** live schema/migration/function/RLS audit, security findings, data/API contracts, staged migration design and verification.
- **Claude:** frontend/app shell, workspaces, UI prototypes, mock contract and handoff.
- **Owner:** approve production changes, sensitive role policy, rollout, secrets and account/provider settings.

## Gate
Phase A ends with an audit report, compatibility matrix, threat model, priority backlog and contract review. Phase B (permission registry/context foundation) begins only after review. Staging migrations/tests first; production changes require explicit owner approval.
