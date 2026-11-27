# Everneed Universal Platform Architecture & Extensibility Contract

**Status:** Owner direction accepted — planning contract (25 November 2026). Staging-first; no production schema changes authorized by this document.

## Vision
Everneed grows into modular commerce, merchant services, support, finance, logistics and POS. Roles, departments, apps, workflows, configuration and integrations are extensible without repeated frontend/code changes where safe. Business invariants and authorization remain server-enforced.

## Architectural advice
- **Modular monolith first; service extraction later.** Separate domain modules/contracts within the repository/backend. Avoid premature microservices, duplicated databases and distributed complexity.
- **One core, multiple apps:** Customer, Merchant, Platform Ops, Support, Finance, Dispatcher, Hub, Courier and POS shells share identity, memberships, permission checks, events, APIs and domain rules.
- **Backend is authority.** UI permission gating is UX only; every protected operation checks server-side. Default-deny; no user-editable JWT metadata or client state for authorization.
- **Context/tenant scoped access:** platform, organisation/department, store, branch, hub, zone, assigned job, terminal, own account. Context switch never broadens privilege silently.
- **Extensible RBAC + scoped/attribute rules:** roles are bundles; permission keys are the contract; resource attributes (ownership, zone, assignment, state) constrain actions.
- **Safe configuration, not arbitrary code:** validated declarative config/rules, never admin-editable SQL/JS or arbitrary security policy.
- **Versioning and audit:** every role/config/workflow/integration change gets version, actor, timestamp, before/after, approval where required, rollback and effective scope.
- **Portable interfaces:** isolate identity, DB/data APIs, storage, payments, maps/routing, messaging, analytics and deployment behind adapters. Supabase remains current; migration is a planned engineering project, not a simple toggle.
- Mobile low-data resilience and offline queues; server revalidates and idempotently commits offline actions.

## Identity and access entities
Separate user identity from organisation/resource membership, role assignment, context and permissions. Support one user with multiple roles and contexts, invitations, expiry/revocation, service identities, and application access. Conceptual entities: identity/user, organisation, store, hub/warehouse, zone, branch, membership, role definition, permission registry, role assignment, context, app grant, service identity.

## Universal permission catalogue
Use stable namespaced keys with metadata (description, domain, sensitivity, applicable scope, dependencies, assignability), for example:
- platform: `platform.users.read`, `platform.staff.invite`, `platform.settings.manage`
- store: `store.catalog.read/edit`, `store.orders.manage`, `store.inventory.adjust`
- logistics: `logistics.dispatch.read/assign`, `logistics.jobs.accept`, `logistics.location.share`, `logistics.delivery.confirm`
- support: `support.cases.read/assign/reply/resolve`
- finance: `finance.ledger.read`, `finance.payout.request/approve`
- POS: `pos.sessions.open`, `pos.sales.create`, `pos.refunds.request/approve`

Roles are templates, not fixed code-only enums: system/protected roles, custom roles assembled from assignable permissions, cloned templates, inactive roles, scoped assignments, expiry and temporary elevation. New permissions must **not** be automatically granted to existing roles. Unknown permissions denied. Assigners cannot grant permissions they don't have; self-escalation forbidden; protect the final owner/admin. Sensitive grants require approval.

## Role families (initial templates; extensible)
**Platform:** Owner/Super Admin; Operations/Admin; Product & Configuration; Marketplace/Seller Review; Support/Customer Experience; Trust/Safety/Fraud; Logistics Operations/Dispatch Supervisor; Dispatcher/Route Planner; Hub/Warehouse; Courier/Delivery Agent; Finance/Accounting; Payout Approver; Marketing/Campaign; Catalogue Moderator; Data/Analytics read-only; Compliance/Verification; Technical/Integration Operator; Auditor.

**Store:** Owner; Manager; POS Cashier; Catalogue Editor; Inventory Controller; Picker/Packer/Fulfilment; Store Courier; Customer Care; Store Finance (read-only default); Refund/Returns Handler (request and approve separated); Marketing; Branch Manager; Viewer/Auditor.

**Logistics partner:** Organisation Manager; Dispatch Manager; Dispatcher; Hub Supervisor; Receiving/Sorting/Consolidation/Packing; Courier/Rider/Driver; Fleet Manager; Route Planner; Proof-of-delivery Reviewer; Partner Finance/Settlement; Partner Support; Zone Supervisor.

Launch with the roles required for existing functionality; build the permission extensibility foundation before adding every role.

## Logistics is a first-class domain
Model shipment/delivery, fulfilment legs, route, stops, assignments, courier, vehicle (optional), zones, hubs, SLA, delivery attempts, exceptions, proof-of-delivery, location events and partners. One customer order may contain multiple seller legs, hub receiving/consolidation and final delivery. Use event history, not a single mutable status.

Suggested guarded state progression (adapt to existing contracts): created → awaiting_pickup → assigned → accepted → picked_up → hub_received → sorted/consolidated → out_for_delivery → delivered. Support no-hub routes and explicit exception states (failed attempt, delayed, exception, returned, cancelled). Every transition checks actor scope, assignment and valid state, is idempotent, records event/actor/time, and triggers deduplicated notifications.

Dispatcher workspace: unassigned queue, map/list, zone/SLA filters, assignment board, capacity/availability, route/stop planning, alert and exception queue, live status and audit. Courier app: assigned jobs, navigation handoff, pickup/scan, contact via protected channels, delivery status, POD, exception reporting and offline queue. Customer tracking: timeline, appropriate ETA and privacy-safe/coarse live location. Location sharing limited to active duty/assigned jobs, policy-controlled retention. POD may use recipient confirmation/OTP/signature/photo when justified, with privacy controls. Include failed attempts, unreachable customer, address issue, damage/missing parcel, hub discrepancy, reschedule, escalation, return-to-seller.

## Support and departments
Support is scoped case management, not unrestricted database access. Cases link to customer/store/order/shipment, queues, assignment, priority, SLA, tags, internal notes separate from customer messages, escalation and resolution. Support permissions allow minimum needed reads/replies; refunds are request/approve separated; sensitive access is redacted, time-limited and audited. Finance, trust/safety, compliance, review, analytics, catalogue and operations are separate workspaces/permission groups.

## Configuration/workflow service
Configurable without code for: feature flags/rollout by platform/country/store/segment/app version; module/app registry and navigation; role templates and safe permission bundles; approval and separation-of-duty policies; order/fulfilment/dispatch/support/returns transitions, timers/SLA/escalations; routing/assignment rules; notification templates/channels/preferences; merchant entitlements/limits; regional currency/tax/delivery settings; language/branding; integrations/health; POS terminal/branch/receipt settings.

Objects require schema validation, draft/publish, version, audit, scope, preview/test, rollback and approval where risky. Rules use safe declarative operators and bounded evaluation. Configuration cannot override auth, RLS, financial invariants, safety limits or audit.

## Apps and repo
Keep a monorepo with shared API contracts/SDK, auth/session, permission/context client, design system, domain modules, telemetry and config. App shells/builds: Customer; Merchant (store, catalog, inventory, orders, finance, POS); Platform Ops/Admin; Dispatcher; Courier; future partner/branch apps. Initially shared modules/backend; independently deploy/build or split later without duplicated business logic or DB. Apps access granted by app assignment + scoped permission, not app presence. Do not split services until scaling/ownership demands it.

## POS
Store/branch/terminal, cashier role and shift, product/variant/barcode, pricing/discount policy, inventory movement, cash/card/transfer payment, cash drawer reconciliation, receipt, sales/orders/customer lookup, returns/refunds with approval, device/session controls, audit, offline draft sync. POS shares catalogue, stock, order and ledger invariants; no disconnected inventory or ledger. Offline commits require idempotency, reconciliation and conflict rules; never silently duplicate payment/stock.

## Portability/integration
Adapters/interfaces for auth (Supabase Auth first; future Google/Apple/phone/email/passkey and safe account linking), business API/data (Postgres/Supabase current; domain services avoid frontend provider coupling), storage (signed access/lifecycle), payment (webhook verification/idempotency/reconciliation), maps/geocoding/routing, SMS/email/push/WhatsApp, analytics, deployment. No secrets in client or normal config. Environment-separated dev/staging/prod, secret management, health checks, CI, migration/backup/restore, export and provider-exit plans. Supabase RLS/functions are security-critical; a move requires migration plus parity/security tests, not just swapping env vars.

## Invariants
Default deny; platform/store/partner scopes distinct; validate context, assignment, zone and resource ownership per request; no self escalation; protect last owner; invites bound, expiring, single-use/revocable; split sensitive request/approve; revocation effective next backend check; POS/courier session policy; audit role changes, config, financial actions, dispatch assignments, transitions and privileged access; logs never include tokens/secrets; tests for cross-tenant IDOR, escalation, stale grant, state abuse, scope boundaries and data leakage.

## Delivery roadmap (staging-first)
A. Inventory live schema vs migration history, current role/admin/owner checks, RLS/RPC, finance and orders; threat model and compatibility matrix.  
B. Permission registry, memberships/assignments, context resolver, read-only access introspection, compatibility helpers; test before changing existing users.  
C. Platform/store team workspaces, invites, fixed templates, safe custom roles, expiry/revocation/approval/audit; role UI only after server enforcement.  
D. Logistics shipment/leg/event contract integrated with seller orders/hub; dispatch queue, assignment, zone/capacity/SLA/exceptions; dispatcher/courier apps; customer tracking, POD, notifications.  
E. Feature/module registry, versioned configuration, workflow/rules editor, preview, approval, rollback and regression tests.  
F. POS terminal/shift/sale, shared inventory/ledger, receipt/returns, offline-safe sync.  
G. Provider adapters, SDK/API boundary, environment/secrets, export/restore and migration playbooks. Extract services/providers only when justified.

## Claude / ChatGPT responsibility
**Claude:** frontend/app shells, role-aware workspaces, navigation, responsive/mobile UX, shared UI, dispatcher/courier/POS screens. Can work against documented mock contracts; never invent or bypass backend security.  
**ChatGPT:** DB/RLS/RPC/API contracts, migration design/review, permission registry, threat model, logistics data/state machine, adapters, CI/tests, security and handoffs.  
**Both:** publish a handoff for each feature (data contracts, permissions, states, API dependencies, config, tests, risks, rollout) and keep docs synchronized.

## Acceptance criteria
- A safe custom role can be created/modified without frontend code release.
- New modules/apps can be registered and enabled by scope; genuinely new backend capabilities still need reviewed code.
- Users can have several roles without scope leakage.
- Dispatcher access is zone/job-scoped and valid-state-only; tracking is accurate/privacy-safe.
- Support access is scoped and audited.
- POS shares stock/catalogue/ledger invariants.
- OAuth provider additions use adapter/account-linking contract.
- Infrastructure/provider change follows documented migration and parity testing.
- Every config change versioned/audited/testable and staged.

**Owner direction:** Build the foundation for this universal extensible platform now; implement progressively. This document is a planning contract, not authorization for production migration or rollout.
