# Everneed Backend Roadmap — ChatGPT/Codex ownership
**Canonical backend scope | Staging-first | Production protected**

Claude 1–9 are specialist frontend builders working across web and Android; Claude 10 is the tenth agent and master planner/researcher/analyst/design strategist/reviewer/debugger/moderator/integrator coordinating them end-to-end. ChatGPT/Codex owns backend end-to-end and supplies reliable contracts and evidence.

## Backend principles
- Backend is the security and business source of truth. Fail closed, validate every request and resource scope, use idempotency and audit.
- Modular monolith, explicit domain contracts. Avoid microservices until operational need.
- Database changes: migration in repo first; staging apply/test; DB_CONTRACT change log; only production migration after owner-approved release.
- Never let frontend write protected role, payment, journal, payout, refund, delivery, or verification state directly.
- Test staging with marked fixtures. Never test with production data or credentials.

## Workstreams in order
### B0 — Repo and environments
Read AI_PROTOCOL + tracker + schema/contracts; verify current branch/head, staging/live refs, migration history and CI. Keep staging ref `vjiadqygpyebpisxslbx`; live ref `zpgasfweaixwsktlueje` protected. Build/test environment stamped; no hostname inference.

### B1 — Universal access foundation
Implement accepted two-plane roles, canonical permission catalogue and scoped assignments. Read-only `my_access()` returns active contexts and role-template permission keys, but does not authorize by itself. Server guards re-check live membership, context, scope and resource state. Initial fixed templates only; no custom overrides, view-as, auto-owner/self-grant. Compatibility adapter until RPC exists; never treat missing RPC as no access.
Tests: unauthenticated, no context, ownerless store, owner/member, expired/revoked, multi-store, platform-only/store-only, legacy admin, cross-plane, unknown permission, scope mismatch, final owner, self-grant.

### B2 — Store/team and seller capability
Ownership and store membership, invitations, expiry/revocation, plan entitlements, activation/verification/compliance separated, quotas and policy-driven limits. Store team management with permission bundles; owner protections and audit. Seller catalogue/editor, inventory, orders, customer-care data access and payout read-only views follow permission contracts.

### B3 — Order and payment reliability
Snapshot order pricing and currency; immutable payment attempts and idempotency; signed webhook verification; replay/duplicate/late success handling; recovery worker; exact amount/currency matching; provider reconciliation. Only trusted provider or approved test path may transition payment. Maintain separate order, payment, fulfilment and refund states.

### B4 — Shared finance journal and settlement
Immutable double-entry ledger balanced per currency; immutable posted entries, reversal/correction workflow, unique source/idempotency. Seller payable, commission, delivery/hub revenue, fees, carrier pass-through, subscriptions and advertising mapped. Reconciliation before payouts; payout request/approve/execute separation, KYC, holds, risk and balance guards. No live transfer until owner authorizes and controls are tested.

### B5 — Logistics/dispatcher domain
Data and API contracts for shipment, delivery legs, consignments, route/stops, zone, dispatcher/courier assignments, hub, custody scans, package condition, event timeline, POD, OTP, exceptions and return flows. Scope dispatch access to assigned regions/jobs; protect customer PII. State machine and idempotent transitions; realtime/polling event outbox; test multi-seller consolidation/direct delivery paths.

### B6 — Support, trust, compliance and audit
Case and escalation models; seller/customer identity minimization; abuse rate limits; verification/compliance state and region/product policy; audit immutable actor/scope/action/reason/diff; secure notification preferences and push tokens; safe public RPC abuse protections.

### B7 — Platform configuration and extensibility
Validated configuration/permission catalogue/role templates/workflow versions, approvals and rollback. Stable adapter interfaces for payments, maps, messaging, storage and analytics. Versioned, safe declarative rules only—no arbitrary admin SQL/JS.

### B8 — POS, inventory depth and partner operations
Branch/location inventory, stock movement ledger, reservations/returns, counts, purchase orders/transfers, POS sessions/sales/receipts, partner organisation/team and settlements. Introduce only after foundational permission and order/finance integrity.

### B9 — Quality and release gates
Migration naming/order and replay, SQL/RLS regressions, integration tests, staging fixture isolation, CI green, contract docs, tracker evidence, API idempotency/security review and monitoring. Release only via reviewed PR to main with owner approval.

## Backend/frontend handoff format
Every backend task response contains: contract name/version; permissions/scopes; request/response schema; state transition rules; error codes; RLS/RPC/function boundaries; migration and staging ref; tests/results; UI implications; known gaps. Update `DB_CONTRACT.md`, tracker and roadmap. Never claim a frontend screen is backed until verified.
