# Everneed Project Standard & Roadmap
**Canonical working standard | 25 Nov 2026 | Development: web-portal | Release: main**

This document consolidates accepted product, architecture, role/access, logistics, app/web and delivery standards. If older planning notes conflict, this document plus the current implementation contracts and migration files prevail. It does not authorize production changes.

## 1. Product and delivery
Everneed is a multi-vendor marketplace and logistics platform, not a single store. Customers discover across stores, buy in one checkout, and may receive consolidated delivery via Everneed hub or eligible direct delivery. Sellers own their storefront and catalogue. Everneed earns through disclosed marketplace fees and delivery/fulfilment services; never invent charges or hide deductions.

**One repository and one workflow:** `web-portal` is development/integration for shopper app, merchant, public site, platform operations and Android packaging. `main` is reviewed production release and Cloudflare production. PR `web-portal → main`; hotfixes from main must return to web-portal. No force pushes, no direct production edits, and no app-only branch.

## 2. Architecture
- Modular monolith and domain boundaries first; no premature microservices.
- One identity/session and shared contracts; multiple experiences/shells: shopper, merchant/store team, platform ops, support, finance, logistics, hub, courier and POS.
- Backend is the authority. RLS and server-side RPC/Edge Function guards enforce permissions, ownership, assignment, state, eligibility, financial and regional rules. UI gating is usability, never security.
- Scoped contexts (platform, store, branch, hub, zone, assigned job, terminal, own account). Context switching cannot expand authority.
- Adapter boundaries for auth/session, APIs/data, storage, payment providers, maps, messaging, analytics and native capabilities.
- Use real data and real states. Never invent metrics, balances, orders, ETA, access, or pretend an unavailable backend is live. Mock fixtures must be visibly MOCK and isolated.
- Mobile-first, low-data and older Android/WebView friendly; 360–412px, readable high contrast, 44px touch targets, restrained assets, avoid blur-heavy UI. Validate mobile and desktop; light/dark/AMOLED where supported; no horizontal overflow.

## 3. Roles and permissions (accepted two-plane model)
**Platform plane** (Everneed staff) and **Store plane** (merchant and store team) are separate. Platform role never implicitly grants store data; store role never grants platform privileges. The official Everneed store is still a store, accessed through explicit store scope.
- Canonical permissions are namespaced and stable (e.g. `platform.staff.manage`, `platform.orders.intervene`, `store.catalogue.write`, `store.orders.transition`, `logistics.dispatch.assign`, `finance.payout.approve`).
- Roles are permission bundles, not hardcoded screen rules. Initial launch uses fixed templates; custom permission overrides, self-grant, auto-owner assignment and view-as are not in the accepted initial scope.
- Least privilege, separation of duties and immutable audit records for sensitive actions. Unknown permission, invalid scope, stale/revoked/expired membership, or ambiguous authority fails closed.
- Access is live at the server authorization check; don't trust role strings or JWT custom metadata as the final authority.

### Initial role families (extensible)
**Platform:** Owner/Super Admin; Operations; Marketplace/Seller & Product Reviewer; Support/Customer Experience; Trust/Safety/Fraud; Logistics Supervisor; Dispatcher/Route Planner; Hub/Warehouse Supervisor & workers (receiving/sorting/consolidation/packing); Courier/Delivery Agent; Finance/Accounting; Payout Approver; Marketing; Catalogue Moderator; Analyst (read-only); Compliance/Verification; Technical/Integration Operator; Auditor.
**Store:** Owner; Manager; Catalogue Editor; Inventory Controller; Fulfilment/Picker/Packer; Store Courier; Customer Care; Store Finance (read-only); Returns Handler (request/approve separated); Marketing; Branch Manager; Viewer/Auditor; POS Cashier.
**Logistics partner:** Organisation Manager; Dispatch Manager; Dispatcher; Hub Supervisor; Receiver/Sorter/Consolidator/Packer; Courier/Rider/Driver; Fleet Manager; Route Planner; POD Reviewer; Partner Finance/Settlement; Partner Support; Zone Supervisor.

Build only roles required for real flows first, while establishing the extensible permission/context foundation. Owner protections: one accountable owner, final-owner removal/transfer protections, no self-elevation. Financial approvals and payout detail changes separated.

## 4. Dispatcher, hub and delivery operating standard
Dispatch is a first-class backend domain—not just a map screen.
- Lifecycle: eligible order/consignment → dispatch queue → route/assignment → accepted → pickup/collection → hub intake (if routed) → sorting/consolidation → out-for-delivery → proof of delivery → completed; exception states include failed attempt, delay, damage, missing, return-to-hub, cancellation and reassignment.
- Track parent order, seller-order/package, consignment, delivery legs, route/stops, assigned dispatcher/courier, hub/zone, custody events, timestamps, status reason, evidence and customer-facing timeline.
- Multi-seller hub orders: each seller package remains identifiable; scan/check intake, record condition/quantity/custody, consolidate compatible packages under one consignment; separate incompatible packages with clear customer disclosure. Direct orders follow a separate allowed flow.
- Assignments are scoped to zone/partner/shift and active job; dispatchers cannot see unrelated customer/seller financial data. Location sharing is consented, purpose-limited and time-bound.
- Delivery PIN/OTP is rate-limited, expires and is single-use; proof of delivery and exceptions audited. POD/release eligibility is a business event, never payment authorization.
- Reassignment, cancellation, route changes and status transitions use backend state machine, authorization, idempotency and audit. Client cannot jump states.
- Customer and seller timelines derive from authoritative events; ETA is estimated only with valid route/telemetry and shown as estimate.

## 5. Financial and order standards
- Checkout prices/fees/discount/FX/tax/delivery are snapshotted and immutable for the order/payment attempt. Amounts use currency-aware integer minor units at provider boundaries.
- Payment state changes only through verified provider events or approved, authenticated staging test lifecycle. Never fabricate provider references or set paid flags directly.
- Seller liabilities, platform fees, hub/delivery revenues and carrier pass-through reconcile by currency. Use immutable double-entry journal; corrections via reversals. Operational seller ledger remains compatibility/projection until migration.
- Provider success is not automatically withdrawable settlement. Reconcile provider settlement/balance, risk/KYC/holds, delivery/refunds/chargebacks and idempotency before payout.
- Refund and payout request/approval/execution are distinct; separation of duties and audit. No real transfers enabled unless separately approved and fully verified.

## 6. Standard app and web delivery
- Shared repository and domain contracts; frontend teams own both web and app experience, and app integration/package lane ensures the same relevant screens and APIs work in the Android shell. Avoid duplicate implementations where feasible; where distinct frontends exist, explicitly document the bridge and parity acceptance.
- Native features go through shared adapters. One canonical session, token-refresh lock, logout propagation and session adoption. Native Google Sign-in feeds the same Supabase session.
- CI build stamps environment; staging APKs use staging only, production is reviewed `main` only. Never select DB environment based on WebView hostname. Assert staging artifact excludes production ref.
- Package validation must fail on missing assets; support nested route, deep link/direct open, reload, browser back/forward and Android Back.
- API contract: list every frontend call in DB_CONTRACT; typed/validated inputs; clear loading/empty/error/success/permission/offline states; safe escaped rendering; no sensitive logs.
- Accessibility and responsiveness; tests include unit/SQL, integration, E2E, physical Android as available. A task is DONE only with evidence, CI and tracker updated—not just merged.

## 7. Development and release workflow
1. Pull latest `web-portal`; read AI protocol, tracker and relevant contracts.
2. Claim a tracker item before work, update status/owner/branch. One task/claim; respect file ownership and agent lanes.
3. Use staging only for tests and migrations; maintain explicit environment refs. Production remains read-only unless owner explicitly approves a release/operation.
4. Migrations are numbered and committed first; review; apply to staging; record DB contract; run regression and security tests. Never use dashboard-only SQL as an undocumented change.
5. Small focused commits, no secrets, no broad reformatting. Read the full file before changing. Use current SHA to prevent races.
6. Verify mobile and desktop, role-scope/security, real backend, no fake data, accessibility and relevant builds; attach evidence.
7. Update tracker, open PR, CI and owner review; merge to main only after release approval. Bring main hotfix back into web-portal.
8. Keep docs small and authoritative. Decisions/standards belong here; task statuses in tracker; implementation contracts in their dedicated retained docs; obsolete reports/handoffs are removed after consolidation.

## 8. Priority roadmap
**P0 — Foundation/security:** shared identity/session; environment separation; canonical access/context API and live backend guards; RLS audit; schema/contract and migration integrity; build packaging and test reliability; order/payment lifecycle idempotency.
**P1 — Core marketplace:** customer browse/search/storefront/cart/checkout/payment/order history; seller onboarding/entitlements/catalogue/inventory/orders/inbox; platform seller/product review/support/order intervention; notification and audit foundations.
**P1 — Logistics operations:** dispatcher queue/assignment/zone/route; courier acceptance/pickup/scan/custody; hub receiving/sorting/consolidation; tracking/timeline; POD/OTP and exceptions; test data and operational reporting.
**P1 — Financial integrity:** immutable payment attempts, provider webhook verification/recovery, double-entry journal, reconciliation, refund/dispute workflow, seller payable and guarded payouts; delivery fee/commission disclosure and policy configuration.
**P2 — Universal platform:** extensible departments/roles, store teams, branches, partner logistics, POS, inventory depth, analytics, integrations and configuration/versioning.
**P3 — Optimisation:** offline-safe queue, advanced route optimization, growth/ads, automation, deeper analytics and service extraction only when justified.

## 9. Source-of-truth and precedence
1. This standard (product direction, workflow and architecture).
2. Current AI coordination protocol and tracker (who is doing what/status).
3. Specific accepted contracts (payment, financial journal, entitlements, backend handoff, DB contract) for detailed API/schema.
4. Migration files and tested live staging schema for actual implementation truth.
5. Historical audits/reports are not active requirements unless explicitly re-accepted.
