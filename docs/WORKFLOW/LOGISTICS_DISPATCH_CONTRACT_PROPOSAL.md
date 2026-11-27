# FIN-02 — Dispatcher, courier and custody contract proposal

**Status:** backend design / not implemented  
**Base:** `web-portal` commit `01787663dafe97f08de13e71a157c55cb2f5fd9d`  
**Scope:** staged logistics architecture for Everneed's existing hub/direct delivery flow. This proposal does not change schema, permissions, or live/staging data.

## Why this is needed

The existing marketplace flow has a parent-order `deliveries` row and seller-order handover/hub states. The existing `dispatch(p_order,p_courier)` function is an admin-only dispatch shortcut: it stores courier name/phone/note, marks the parent delivery dispatched, moves consolidated seller orders to out_for_delivery, and notifies the buyer. There is no first-class dispatcher membership, courier identity, assignment acceptance, route/stop, custody event ledger, or per-leg model. The UI must not simulate those missing events.

Existing server flows that remain valid while this contract is pending:
- seller `seller_transition(..., 'handover_pending', ...)` requests hub handover.
- `hub_receive(p_so,p_check)` records per-item hub check; non-received items create an issue state.
- `hub_consolidate(p_order)` requires every active seller order at_hub and creates the delivery record.
- `dispatch(p_order,p_courier)` is the current admin-only hub dispatch action.
- Direct delivery remains seller-operated through the existing seller transition.

## Domain model target

Keep order/payment/finance state separate from logistics state.

1. **Shipment/consignment** — delivery unit, associated with parent order; hub route can consolidate seller orders into one shipment; direct route may have one seller shipment. IDs are opaque text/UUID, not human order numbers.
2. **Delivery leg** — one accountable transport segment with origin/destination type and scoped location; leg has assigned courier/dispatcher and explicit state.
3. **Route and stops** — ordered stops for pickup/dropoff; only necessary customer data is exposed to assigned workers.
4. **Assignment** — courier assignment lifecycle (offered, accepted, declined, revoked, completed); assignment is scoped to shipment/leg and worker's active membership/region.
5. **Custody event** — append-only evidence for package handoff, scan, condition, seal, exception, hub receipt, dispatch, arrival, delivery attempt, return. Event includes actor, timestamp, object scope, event type, idempotency key, minimal payload, optional proof reference.
6. **Proof of delivery (POD)** — delivery-code verification, recipient confirmation, image/document proof only if a secure storage contract exists. Never store raw delivery codes or unnecessary identity documents in event JSON.
7. **Exception/return** — structured reason, who opened it, resolution, next state and audit evidence. No direct terminal-state override from the client.

## Roles and permission intent

Permission names are proposed, not seeded in B1.

| Role/context | Permission intent | Scope |
|---|---|---|
| Platform logistics supervisor | view all logistics, manage hubs/regions, reassign, resolve exceptions, authorize overrides | platform or assigned region |
| Dispatcher | view queue, plan routes/stops, offer/assign/reassign, monitor legs, open exceptions | region/hub and assigned jobs |
| Hub staff | receive, item-check, consolidate, dispatch-ready scan, report damage/missing | assigned hub/consignment |
| Courier | see accepted assignments and minimum customer details; accept/decline; pickup/transfer/delivery-attempt/POD | assigned leg only |
| Store seller/fulfilment | view own seller-order handover; confirm readiness and handover | store membership |
| Support | view safe tracking timeline, initiate support case; no custody mutation | support case and authorized order |

Suggested permission keys:
- `logistics.shipments.read`
- `logistics.assignments.offer`, `logistics.assignments.reassign`, `logistics.assignments.accept`, `logistics.assignments.decline`
- `logistics.route.plan`, `logistics.stops.update`
- `logistics.custody.scan`, `logistics.hub.receive`, `logistics.hub.check`, `logistics.hub.consolidate`, `logistics.dispatch.confirm`
- `logistics.delivery.attempt`, `logistics.delivery.confirm`, `logistics.exceptions.open`, `logistics.exceptions.resolve`, `logistics.pod.read`
- `logistics.customer_pii.read` (separate, minimal, time-bound and auditable)

B1's fixed role catalogue should not be silently expanded by this proposal. FIN-02 becomes a later migration/implementation phase with explicit role-to-permission review.

## API proposal (versioned implementation later)

- `logistics_my_queue()`: authenticated worker's assignments/queue, filtered server-side by current role and scope.
- `logistics_offer_assignment(p_leg,p_courier,p_expires_at,p_reason)`: dispatcher offers; validates region/hub, worker active and eligibility.
- `logistics_assignment_response(p_assignment,p_response,p_note)`: assigned courier accepts/declines; idempotent, assignment must belong to caller.
- `logistics_reassign(p_assignment,p_new_courier,p_reason)`: authorized dispatcher/supervisor; revokes previous assignment and records new offer.
- `logistics_record_event(p_leg,p_event,p_payload,p_idempotency_key)`: validates allowed event/state transition, actor permissions and scope; append-only.
- `logistics_hub_receive(p_consignment,p_item_checks,p_idempotency_key)`: hub membership and required item checks; missing/damaged opens exception and prevents ready-to-dispatch.
- `logistics_consolidate(p_order,p_checks,p_idempotency_key)`: all active seller-order consignments accepted at hub; creates/updates shipment and audit event.
- `logistics_dispatch_confirm(p_leg,p_assignment,p_scan,p_idempotency_key)`: requires accepted assignment, correct custody and route; legacy dispatch is temporarily admin-compatible during migration.
- `logistics_delivery_attempt(p_leg,p_outcome,p_reason,p_proof_ref,p_idempotency_key)`: attempt, failed, recipient-unavailable, etc.; never claims delivery unless POD requirement succeeds.
- `logistics_pod_confirm(p_leg,p_method,p_proof,p_idempotency_key)`: delivery code or approved proof path; server validates and records proof, then updates parent/seller order only when all required legs complete.
- `logistics_tracking(p_order)`: safe customer-facing timeline; strips internal notes, worker contact and evidence payloads.

Every RPC must check current membership, role permission, scope, resource relationship and state—not trust frontend role labels or payload actor IDs. SECURITY DEFINER functions pin search_path, revoke public/anon execution, grant only intended roles, rate-limit where abuse possible, audit, lock affected rows and be idempotent.

## State machine

Assignment: `offered → accepted | declined | expired | revoked`; reassignment creates a new assignment record rather than rewriting history.

Leg: `planned → assigned → accepted → pickup_pending → in_transit → arrived → delivered`; alternate `delivery_attempt_failed`, `exception`, `return_pending → returned`. States may be refined, but no client-side arbitrary jump. Custody events are append-only and drive the current projection.

Hub path:
`seller ready → handover_pending → hub received + item check → at_hub → consolidated → leg assigned/accepted → dispatched/in_transit → POD → delivered`.

Direct path:
`seller ready → seller handover/direct dispatch → assigned/accepted if platform courier is used → in_transit → POD → delivered`. Seller-managed direct delivery may remain on the legacy flow until courier assignment is explicitly enabled.

## Data minimization and safety

- Assignment/queue views show only assigned job data. Customer address/phone is exposed only after assignment acceptance and only for the active delivery need; access is logged.
- Couriers cannot browse orders, seller balances, payment details, customer history, or unrelated deliveries.
- OTP/code values are never returned in tracking or stored in plaintext events. Attempts are rate-limited and proof is represented by method + verified outcome.
- Photo proof uses private storage, signed short-lived retrieval, strict type/size limits, no public URLs, and retention policy.
- No live map/location tracking until consent, retention and operational requirements are approved. Route planning can initially use stops without continuous GPS.
- Assignment/custody/exception/audit records are append-only or corrected by compensating events.

## Implementation sequencing and gates

1. Verify B1 universal access migration and role contract first.
2. Stage logistics tables and indexes; avoid altering existing `deliveries` semantics until adapter/migration plan is reviewed.
3. Implement assignment + custody RPCs with unit/regression tests and least-privilege ACL/RLS.
4. Build a migration adapter so existing admin hub board continues to function while new dispatcher/courier workflows roll out.
5. Test staging only: direct delivery, one seller hub delivery, multi-seller consolidation, damaged/missing item, declined/expired/reassigned courier, failed attempt, return, idempotent duplicate scans, scope escape attempts, revoked membership, and customer PII isolation.
6. Promote only with CI, security review, DB_CONTRACT + tracker updated, and owner-approved production release.

## Frontend contract

Claude 5's current Hub board must use only existing RPCs until the new API is implemented. It may show current courier text as legacy metadata, but must not render fake assignment acceptance, custody scans, live route, courier location, or POD evidence. Show capability status and disabled/clearly unavailable actions. Future dispatcher/courier views consume these RPCs and `logistics_my_queue()`; do not call protected tables directly.

## Open design decisions

- Which hub/region hierarchy is canonical (hub vs state/zone vs partner organisation)?
- Whether courier is a staff membership or external contractor identity with limited account lifecycle?
- Multi-leg route semantics and carrier integrations.
- Approved POD proof storage and retention.
- SLA definitions, automatic reassignment/expiry, and exception escalation.
- Whether sellers can opt into hub or direct route per store/order; the checkout snapshot remains authoritative.
