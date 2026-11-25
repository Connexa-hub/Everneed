# Universal Access Architecture — Phase B1 Staging Audit & Implementation Plan

**Date:** 25 November 2026  
**Owner:** ChatGPT/Codex (backend)  
**Branch:** `codex/universal-access-phase-b1`  
**Scope:** Read-only audit of Everneed-staging and implementation plan. No schema changes applied. Production untouched.

## Accepted direction

Implement one modular platform with multiple app/workspace shells sharing identity, context, permission keys, domain services and APIs. The initial access model has separate platform and store planes; it must be extensible to partner organizations, hubs, zones, branches, jobs and terminals without redesigning identity. Roles are permission bundles. Server checks are authoritative, default-deny, scoped to the current context/resource, and revocation must take effect on the next request.

Initial role templates are fixed and audited; custom permission overrides, view-as, self-grant and automatic legacy-admin promotion are out of initial scope. This does not limit the architecture's future safe configurability.

## Staging audit (verified 25 Nov 2026)

Project: `vjiadqygpyebpisxslbx` (Everneed-staging), active/healthy.

- Profiles: 4 total — 1 legacy `admin`, 2 `merchant`, 1 `customer`.
- Stores: 3 total — 1 official store, 1 ownerless store.
- No `staff_members`, `store_members`, universal role/permission registry, or role-assignment tables found in the live public schema.
- Existing `public.my_role()` reads `profiles.role`; this is legacy, not a universal authorization contract.
- `profiles`, `stores`, and `audit_log` have RLS enabled.
- `my_access()` is not deployed in staging.

No user IDs or personal profile data are copied into this report. No role assignments, schema changes, or production access changes were made.

## Implementation sequence

### B1.0 — Permission catalogue and fixed role templates (migration draft)
Create a canonical permission registry and role-template registry with explicit plane/scope metadata. Permission names are stable namespaced keys. Role-permission grants are explicit (no wildcard grants); unknown keys deny. Adding a new permission must not silently grant it to existing roles.

Seed initial templates for platform operations, seller review, support, finance, analyst, logistics supervisor/dispatcher/hub/courier and store owner/manager/catalogue/fulfilment/support/finance/viewer. Only seed the templates; do not assign elevated platform roles automatically.

### B1.1 — Scoped assignments
Create a generic assignment model supporting platform/store first, and structurally extensible scope kinds (organization, partner, hub, zone, branch, job, terminal). Assignments carry actor, scope, start/end, revoke state and audit provenance. Validate plane/scope combinations; never permit scope widening or self-escalation.

### B1.2 — Read-only `my_access()`
Return only the signed-in user's active contexts, role key, explicit permission keys, scope identity/name, official-store marker and source. It is an introspection endpoint—not an authorization substitute. Store-owner contexts are derived from the current `stores.owner_id` compatibility model until a safe membership migration. Legacy `profiles.role='admin'` is not silently promoted to owner; existing UI compatibility remains separate until owner identity is verified and a reviewed staff assignment is made.

### B1.3 — Enforcement and compatibility
Introduce server-side permission/context helpers and convert protected RPCs/RLS incrementally, with a compatibility matrix and tests. Do not claim the registry is secure until every protected operation has been audited and enforced. No frontend role UI before backend enforcement.

### B1.4 — Team management
Only after enforcement: invite/accept, role assignment, revoke, expiry, seat/plan constraints, last-owner protection, approval/separation-of-duty controls and audit/activity feed. Tokens are single-use, expiring and bound to the signed-in identity.

## Security invariants

- Platform and store permissions never implicitly cross planes.
- Default deny; no unknown permission grants.
- Re-check live membership, context, scope, ownership, assignment, zone and resource state at each protected request.
- No authorization from editable user metadata, client state or role names alone.
- No self-escalation; no removal/demotion of last owner.
- Revocation takes effect on next backend authorization check.
- Sensitive grants/actions require appropriate approval and immutable audit evidence.
- No impersonation/view-as in initial release.
- No legacy admin auto-promotion; only verified owner receives platform owner assignment.
- Store owners remain compatible while migration is tested.
- New scopes/apps can be added through validated registry/contracts, not by weakening RLS.

## Required tests

Anonymous caller, missing profile, legacy admin compatibility, store owner context, ownerless store, official-store scope, platform-only vs store-only, multiple stores/roles, inactive/future/expired/revoked assignment, unknown permission, cross-plane denial, scope mismatch, self-grant, last-owner guard, invitation binding/expiry/revocation, stale access, and assignment audit completeness.

## Handoff

Claude 10 should add B1 backend dependency to the live team board and coordinate frontend access/context work against the documented `my_access()` contract. UI may use labelled mocks for design only; it must not invent grants or bypass missing backend functionality.

**Status:** Audit complete; B1 migration, SQL checks and CI wiring are drafted in PR #49. Migration replay and regression CI are pending. No schema has been applied to staging or production.
