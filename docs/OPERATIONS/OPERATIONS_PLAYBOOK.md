# EVERNEED
## Operations & Fulfilment Playbook

**Document type:** Internal operating procedures and fulfilment framework  
**Document status:** Proposed operating playbook — procedures must be validated before live use  
**Business status:** Founder-led startup; not yet registered with Nigeria's Corporate Affairs Commission (CAC)  
**Initial market:** Nigeria  
**Project reference branch:** `web-portal`  
**Last updated:** November 2026

---

## 1. Purpose and Operating Boundary

This playbook defines how Everneed should coordinate marketplace orders from seller acceptance through customer delivery, including the proposed hub-supported fulfilment model.

Everneed's intended model combines:
- A multivendor marketplace where independent sellers own and prepare their products.
- One customer-facing parent order for a multi-seller checkout, with separate seller orders or packages beneath it.
- An Everneed hub as a proposed receiving, checking, consolidation and dispatch point for eligible multi-seller orders.
- Direct seller delivery or hub-assisted delivery for suitable single-seller orders.
- Customer support, exception handling, returns and financial reconciliation.

**Important status boundary:** This is a proposed operating procedure. It does not mean Everneed currently operates a physical hub, employs hub staff, owns a delivery fleet, has contracted a courier, or has a live fulfilment operation. Do not advertise a service area, delivery promise or operating capability until it has been selected, resourced and tested.

The founder remains accountable for approving operating policies, launch readiness, material costs, partner commitments and exceptions until responsibilities are formally delegated.

## 2. Operating Principles

1. **Order accuracy before speed:** every item and package must match the order record.
2. **Visible responsibility:** each handover has a named sender, receiver, time and status.
3. **Seller accountability:** sellers remain responsible for accurate listings, stock, preparation and safe initial packaging until the agreed handover point.
4. **Custody accountability:** responsibility for a package must be clear at every transfer.
5. **Customer transparency:** show the delivery route, charge, realistic timing and parcel count before payment where known.
6. **One parent order, traceable packages:** multi-seller orders retain one customer-facing reference while each seller package remains individually traceable.
7. **No false consolidation promise:** combine packages only when safe and operationally practical; otherwise communicate separate parcels.
8. **Financial separation:** merchandise, seller funds, delivery collections, carrier costs, platform fees and refunds must be separately recorded.
9. **Evidence-led status:** a button, database status or generated tracking number is not proof that a physical handover or delivery occurred.
10. **Controlled launch:** start with a small, defined service boundary and expand only when quality and unit economics support it.

## 3. Roles and Accountability

Roles below are proposed functions, not claims of current employees.

| Function | Core accountability |
|---|---|
| Founder / Operations approver | Approves service boundary, pricing principles, partners, policies, major refunds and launch gates |
| Marketplace operations | Seller onboarding, order monitoring, customer communication and case ownership |
| Seller / merchant | Confirms stock, accepts or declines orders, prepares correct items, labels and hands over packages |
| Hub receiving operator | Records package arrival, checks identity and condition, and records discrepancies |
| Hub consolidation operator | Matches seller packages to parent order, sorts, packages and prepares consignment |
| Dispatch coordinator | Assigns an approved delivery route/partner and records dispatch handover |
| Delivery partner / rider | Maintains custody after acceptance, attempts delivery and supplies delivery evidence |
| Customer support owner | Keeps the customer informed and coordinates resolution of complaints and exceptions |
| Finance / reconciliation owner | Reconciles collections, seller liabilities, delivery costs, refunds and settlements |

At pilot scale, one person may cover more than one function, but the same person should not be able to approve and conceal material financial adjustments without independent review. Restrict access according to actual duties.

## 4. Order Lifecycle and Status Definitions

Use consistent statuses across customer, seller, admin and operations interfaces. Final names must match the production implementation.

| Stage | Meaning | Minimum evidence |
|---|---|---|
| Order placed | Customer submitted checkout | Order reference and accepted payment state or clearly labelled payment-pending state |
| Payment confirmed | Payment provider confirmation has been verified server-side | Verified provider event and internal transaction record |
| Seller action required | Seller package is awaiting seller response | Seller notification and timestamp |
| Accepted | Seller confirms ability to fulfil | Seller identity, accepted package and timestamp |
| Preparing | Seller is picking and packing items | Seller status update |
| Ready for handover | Package is packed and labelled | Package reference and seller readiness confirmation |
| In transit to hub | Package has left seller custody | Collection/handover record where available |
| Received at hub | Hub has accepted the package | Receiver, timestamp, package reference and condition |
| Exception / discrepancy | Package or item does not match expectation | Case record, photos where appropriate and assigned owner |
| Consolidated | Eligible seller packages are grouped for the customer | Package-to-parent-order reconciliation and parcel count |
| Dispatched | Consignment handed to delivery provider | Dispatch record, carrier/rider identity and tracking reference if available |
| Out for delivery | Delivery attempt is underway | Partner status or verified operations update |
| Delivered | Customer or authorised recipient received the parcel | Proof of delivery and timestamp |
| Delivery failed | Attempt did not complete | Reason, attempt evidence and next action |
| Return initiated | Approved return process has started | Return authorisation and item/package references |
| Returned / resolved | Return or complaint case has reached an approved outcome | Receipt, inspection and refund/replacement/closure record |

Never mark an order paid based only on a client-side success screen. Never mark a package received, dispatched or delivered solely because a user clicked a status button without the required evidence.

## 5. Seller Onboarding and Operational Readiness

Before a seller is activated for orders:

1. Verify the seller and business information using the approved onboarding process.
2. Confirm the seller's contact person and an escalation channel.
3. Review store details, product categories and listing quality.
4. Confirm product prices, variants, stock and preparation capability.
5. Explain the available fulfilment routes: direct delivery, seller drop-off at hub, or arranged seller-to-hub transfer where available.
6. Explain package labelling, packaging standards, handover evidence and cut-off times.
7. Agree how cancellations, out-of-stock items, late preparation, returns and customer complaints are handled.
8. Explain commercial terms, delivery charges and seller settlement rules before acceptance.
9. Run a rehearsal or test order before treating the seller as pilot-ready.
10. Record approval and the date of the latest readiness check.

### Seller package preparation standard

The seller should:
- Pick the correct product, variant, quantity and condition.
- Check the item against the seller order.
- Use packaging suitable for the item and expected journey.
- Protect fragile, liquid, sharp or easily damaged items using category-appropriate packaging.
- Include required product documentation where applicable.
- Seal the package and attach a readable Everneed package/order reference without exposing unnecessary customer personal data.
- Record any issue before handing over the package.

Do not accept prohibited, unsafe, counterfeit or inadequately described products. Category-specific rules must be approved before the category is opened.

## 6. Multi-Seller Order: Hub Consolidation SOP

The following is the intended process for a multi-seller parent order when a functioning hub service has been approved.

### 6.1 Order creation and seller allocation

1. Customer places one checkout containing items from multiple sellers.
2. The platform creates one parent order and a separate seller order/package for each participating seller.
3. Each seller receives only the package details and customer fulfilment information needed to prepare and deliver their portion.
4. Operations can view the parent order, all expected packages and the overall fulfilment state.
5. Payment state is verified before the order proceeds under the approved payment policy.

### 6.2 Seller preparation and transfer

1. Each seller accepts or declines within the approved response window.
2. Accepted sellers prepare their own packages.
3. Each package receives a unique package reference linked to the parent order and seller order.
4. The seller marks the package ready only after checking the contents.
5. The package moves to the hub using the approved seller drop-off or collection route.
6. The handover record identifies the sender, receiving party/route, time and package reference.

If a seller cannot fulfil, operations must not silently substitute a product or seller. Follow the cancellation, partial-order and customer-consent policy.

### 6.3 Hub receiving

For each arriving package, the receiving operator should:

1. Confirm the hub is authorised to receive the package.
2. Scan or enter the package reference.
3. Match the reference to an expected seller package and parent order.
4. Record arrival time and receiving operator.
5. Inspect external packaging for visible damage, tampering, leakage or unsafe condition.
6. Confirm the package count and any required seal/reference.
7. Record acceptance or quarantine status.
8. Capture discrepancy notes and suitable evidence.
9. Notify operations and the seller when a mismatch, damage or missing package is identified.

The hub should not open sealed products or inspect contents beyond the agreed inspection policy. Any inspection must respect product type, privacy, safety and seller terms.

### 6.4 Reconciliation and consolidation

Before consolidation:

- Confirm every expected package has arrived or is formally recorded as outstanding.
- Match each package to the correct seller order and parent order.
- Resolve duplicate, unknown, damaged, incomplete or mislabelled packages.
- Confirm whether all items can safely travel together.
- Determine whether the order requires one parcel or multiple parcels due to size, fragility, hygiene, legal or handling constraints.

Then:
1. Group eligible packages under the parent order.
2. Apply suitable outer packaging and protection.
3. Assign a consignment reference and parcel count.
4. Record which seller packages are contained in each parcel.
5. Record the operator, time, packaging materials and any special handling.
6. Update the customer-facing order with accurate parcel and delivery information.

Do not mark the parent order ready for dispatch while an unresolved discrepancy could materially affect what the customer receives.

### 6.5 Dispatch and delivery

1. Select a delivery route or partner approved for the destination and parcel characteristics.
2. Confirm the quoted charge and service level are consistent with the amount disclosed to the customer.
3. Record the carrier/rider or partner accepting custody.
4. Record dispatch time, consignment reference and parcel count.
5. Provide the customer with the available tracking/status information.
6. Monitor delivery progress and follow up on delays or failed attempts.
7. Record proof of delivery, including recipient confirmation and time, using a privacy-conscious method.
8. Close the order only after the required delivery and reconciliation checks are complete.

If separate parcels are required, communicate the parcel count and expected delivery arrangement clearly.

## 7. Single-Seller Order SOP

For an order from one seller, choose between direct seller delivery and hub-assisted fulfilment according to the approved service area, distance, seller capability, product characteristics, cost and customer promise.

### Direct seller delivery

1. Confirm the seller is approved for direct fulfilment to the customer's destination.
2. Seller accepts, prepares and checks the order.
3. Seller records dispatch and the delivery person/partner where applicable.
4. Customer receives the agreed status information.
5. Seller or partner records delivery attempt and proof of delivery.
6. Operations handles failed delivery, complaints or returns under the same case standards.

### Hub-assisted delivery

1. Seller prepares and labels the package.
2. Package is transferred to the designated hub using an approved route.
3. Hub records receipt and checks the package reference and external condition.
4. Hub prepares dispatch and records custody transfer.
5. Delivery partner completes the delivery attempt and provides evidence.
6. Operations closes or escalates the order.

The chosen route, responsible party, delivery charge and expected timing must be clear before customer payment. Do not route a package through a hub unless the hub and route are actually available.

## 8. Package Custody and Chain of Responsibility

Every physical transfer should create a record containing, at minimum:

- Parent order and seller package reference.
- Package count and, where applicable, parcel/consignment reference.
- Sender and receiving person or organisation.
- Handover and acceptance timestamps.
- External package condition.
- Location or transfer point, without collecting unnecessary location data.
- Discrepancy or exception notes.
- Evidence reference, where appropriate.

Responsibility should transfer only at the defined acceptance point in the applicable seller, hub or carrier terms. Define in writing who bears responsibility for loss or damage before hub acceptance, after hub acceptance, during carrier custody and after delivery.

Do not promise insurance or compensation unless the cover, exclusions, claims process and responsible party have been confirmed.

## 9. Exceptions and Incident Handling

Every exception must have an owner, a recorded status, a customer communication plan and a resolution deadline appropriate to its severity.

| Exception | Immediate action | Resolution path |
|---|---|---|
| Seller does not respond | Contact seller and flag the package as at risk | Apply seller response window; cancel or reallocate only under approved policy and customer consent |
| Out of stock | Stop fulfilment of affected item and record reason | Offer approved options, partial fulfilment or refund according to policy |
| Seller preparation delay | Record delay and revised estimate | Inform customer where material; escalate repeated seller failures |
| Package missing at hub | Check transfer and receiving records | Trace with sender/route; do not mark received |
| Wrong package/reference | Quarantine and prevent consolidation | Verify seller/order identity and arrange correction |
| Damaged package on arrival | Photograph external condition and record witness/receiver | Quarantine; notify seller and operations; determine responsibility |
| Package incomplete | Record missing items and hold dispatch if material | Reconcile with seller; agree customer remedy |
| Unsafe or leaking package | Isolate safely and follow incident procedure | Do not transport until cleared; escalate to responsible operator |
| Consolidation not practical | Keep parcels separate | Update parcel count and customer information |
| Courier delay | Request status and record partner response | Notify customer if delivery estimate changes; escalate per partner SLA |
| Failed delivery | Record attempt, time and reason | Contact customer; arrange approved reattempt, pickup or return |
| Customer unavailable / address issue | Do not leave parcel without authorised procedure | Confirm instructions and any additional charge before reattempt |
| Lost or damaged in transit | Preserve custody and dispatch evidence | Open partner claim and customer resolution case |
| Payment mismatch | Pause affected fulfilment or settlement according to policy | Reconcile provider event, internal order and bank/provider records |
| Refund or dispute | Open a case and preserve transaction/order evidence | Follow authorised refund and dispute process |

### Incident severity

- **Critical:** suspected fraud, personal-data exposure, serious safety issue, material payment compromise or multiple affected customers. Escalate immediately to the founder and suspend the affected workflow if necessary.
- **High:** lost package, significant damage, incorrect delivery, unauthorised access or material financial discrepancy. Assign an owner promptly and keep the customer informed.
- **Normal:** routine delay, listing correction or non-critical service complaint. Resolve within the published support standard once established.

Do not delete or overwrite evidence to make an incident appear resolved. Record corrections and the person authorising them.

## 10. Returns, Refunds and Cancellations

Before launch, publish a clear policy consistent with applicable Nigerian law, product category requirements, seller agreements and payment-provider rules.

The policy must define:
- Eligible and excluded return reasons.
- Time limits and condition requirements.
- Who receives and inspects returned goods.
- Return route and cost responsibility.
- How partial orders and multi-seller packages are handled.
- When a refund, replacement, repair or other remedy is available.
- How payment-provider fees and delivery charges are treated.
- How seller balances and platform commission are adjusted.
- How disputes and chargebacks are escalated.

### Proposed return workflow

1. Customer opens a support/return request linked to the parent order and relevant item/package.
2. Support records reason, evidence and requested remedy.
3. An authorised reviewer checks eligibility and applicable policy.
4. If approved, issue return instructions and a return reference.
5. Record each custody transfer during return movement.
6. On receipt, inspect and record item condition without altering evidence.
7. Approve the appropriate remedy under policy.
8. Execute any refund through the approved payment process; never claim a refund is complete before provider confirmation.
9. Update seller ledger, platform commission and delivery-cost records as applicable.
10. Inform the customer and close the case with an audit trail.

A multi-seller parent order may contain several seller-specific return cases. Do not assume that returning one seller's item cancels the entire parent order.

## 11. Customer Support Standards

The support process should provide one clear contact route and a case reference for order-related issues.

For each case, record:
- Customer and order reference, with access restricted to staff who need it.
- Issue category and affected seller package or parcel.
- Date/time received and priority.
- Current owner and next action.
- Customer updates and partner/seller communications.
- Evidence and decision history.
- Resolution, refund or other adjustment where applicable.

Support staff should:
- Acknowledge the issue within a response target approved before launch.
- Avoid promising an outcome before the facts are checked.
- Give realistic updates when a case is delayed.
- Escalate safety, fraud, privacy and payment concerns immediately.
- Never request a customer's password, card PIN or one-time authentication code.
- Share only the minimum customer data needed with sellers and delivery partners.

Publish operating hours, response expectations and escalation channels only after staffing can support them.

## 12. Delivery Pricing and Financial Controls

Delivery charges must be designed around actual operating costs and clearly disclosed before payment.

Potential cost components include:
- Seller-to-hub collection or transfer.
- Hub receiving, sorting and consolidation labour.
- Packaging materials.
- Hub storage or handling time where applicable.
- Last-mile carrier/rider charge.
- Remote-area or special-handling cost.
- Failed delivery, reattempt and return movement.
- Claims, loss and damage exposure.
- Payment-provider charges and applicable taxes.

For each order, maintain a separate view of:
1. Merchandise subtotal and discounts.
2. Customer delivery/handling amount collected.
3. Seller payable and platform commission.
4. Carrier and other fulfilment costs.
5. Refunds, reversals and adjustments.
6. Net marketplace contribution.
7. Net logistics contribution.

**Control rules:**
- Customer transaction value is not Everneed revenue.
- Seller balances and carrier funds may be liabilities or pass-through amounts, not unrestricted company cash.
- Do not pay out seller funds based only on an order status; use the approved settlement and refund rules.
- Reconcile payment-provider events, internal orders, refunds and bank/provider settlements.
- Require documented approval for manual balance changes, refunds outside normal policy and write-offs.
- Preserve an audit trail for financial adjustments.
- Obtain qualified accounting and legal advice on the treatment of collected delivery charges, seller funds, taxes and payment flows.

No delivery tariff, commission rate, seller subscription price or staff cost is approved by this playbook.

## 13. Data, Systems and Access Controls

The product and operations system should support:
- Parent orders and seller-specific orders/packages.
- Unique package and consignment references.
- Expected versus received package reconciliation.
- Role-based access for customers, sellers, hub operators, support, administrators and finance.
- Timestamped custody and status events.
- Evidence references for receipt, dispatch and delivery.
- Exception cases with ownership and history.
- Refund, dispute and financial adjustment audit records.
- Customer notifications that do not disclose another seller's private information.

Minimum security expectations:
- Sellers can access only their own store, products, packages, permitted customer fulfilment details and earnings.
- Hub operators see only the information required to receive, consolidate and dispatch packages.
- Delivery partners receive only the details required to complete the assigned delivery.
- Privileged actions are checked by the backend, not merely hidden in the interface.
- Secrets and payment credentials are never stored in public client code or operational documents.
- Access is removed promptly when a staff member or partner no longer needs it.

The current repository's hub/order functions and interfaces require live permission, migration and end-to-end testing before they are relied upon in operations.

## 14. Operating Metrics

Track performance by service area, seller cohort, fulfilment route and order type.

| Metric | Definition / purpose |
|---|---|
| Seller acceptance rate | Share of seller packages accepted within the response window |
| Seller preparation time | Time from acceptance to ready-for-handover |
| Hub arrival compliance | Share of expected packages received within the agreed window |
| Package discrepancy rate | Packages with missing, incorrect, damaged or mismatched contents |
| Consolidation completion time | Time from receipt of the final required package to dispatch readiness |
| On-time dispatch rate | Eligible consignments dispatched within the promised window |
| Delivery success rate | Delivery attempts resulting in verified successful handover |
| First-attempt delivery rate | Share delivered successfully on the first attempt |
| Loss/damage rate | Packages confirmed lost or damaged per total packages handled |
| Return/refund rate | Orders or items returned/refunded, segmented by reason |
| Support resolution time | Time from case opening to verified resolution |
| Cost per delivered order | Actual fulfilment cost divided by completed delivered orders |
| Logistics contribution | Logistics revenue less directly attributable fulfilment costs |
| Seller retention | Sellers remaining active over the defined measurement period |
| Customer repeat rate | Customers completing another purchase in the defined period |

Define measurement windows and data sources before reporting. Do not publish performance figures without verified records and a stated period.

## 15. Launch Readiness Gates

Do not begin accepting live orders that depend on hub consolidation until all relevant gates pass.

### Gate A — Legal and commercial
- Business registration and operating structure reviewed with qualified advisers.
- Seller terms, customer terms, privacy notice, returns/refunds and delivery policy approved.
- Payment collection, seller funds and delivery-charge treatment reviewed.
- Product/category restrictions and consumer obligations assessed.
- Insurance and liability position assessed; no unsupported coverage claims.

### Gate B — Service design
- Launch area and service boundary selected and recorded.
- Hub location, access, operating hours and responsible operator confirmed.
- Seller drop-off/collection routes defined.
- Last-mile delivery capacity and backup route confirmed.
- Delivery prices, cut-offs and customer promises tested.
- Returns and failed-delivery route defined.

### Gate C — Physical operations
- Receiving, inspection, quarantine, storage and dispatch areas ready.
- Package labels and order references tested.
- Packaging materials and handling rules available.
- Custody logs and discrepancy forms usable.
- Staff/partners trained and responsibilities accepted.
- Emergency, safety and incident procedures rehearsed.

### Gate D — Product and technology
- Relevant migrations applied and live schema verified.
- Role and seller-isolation tests passed.
- Multi-seller checkout creates one correct parent order and correct seller packages.
- Payment confirmation, webhook idempotency and reconciliation tested.
- Hub receipt, consolidation, dispatch and delivery states tested end-to-end.
- Notifications, customer support and audit records tested.
- Refund, cancellation and partial-order scenarios tested.
- Monitoring, backups and incident response prepared.

### Gate E — Controlled pilot
- Small seller cohort is operationally ready.
- Test orders complete the full physical and digital journey.
- Package accuracy, delivery reliability and unit economics are measured.
- Customer complaints and exceptions are resolved.
- Founder reviews evidence and explicitly authorises the next stage.

If a critical gate fails, pause the affected route or workflow. Do not compensate for an unready operation with optimistic marketing.

## 16. Pilot Design and Expansion

The first pilot should be deliberately limited by:
- A defined neighbourhood/service boundary.
- A manageable seller cohort.
- A limited set of product categories.
- Daily order/package capacity.
- Confirmed hub opening hours and staff coverage.
- Known delivery routes and backup arrangements.
- A support owner and escalation path.

Set actual pilot limits only after route checks, seller interviews, hub capacity assessment and cost estimates. Do not invent a daily order cap or delivery time in advance.

Review pilot results before increasing order volume. Expand one dimension at a time—seller count, category range, service area or daily capacity—so the source of any operational failure remains identifiable.

## 17. Required Operational Records

Maintain controlled records for:
- Seller readiness and training.
- Order and seller-package exceptions.
- Hub receipt and package condition.
- Package custody and handovers.
- Consolidation and parcel mapping.
- Dispatch and delivery proof.
- Failed delivery and return movement.
- Customer support cases.
- Refunds, disputes and financial adjustments.
- Partner performance and service incidents.
- Daily/weekly operating metrics.
- Launch gate approvals and changes to service boundaries.

Restrict personal and commercially sensitive records to authorised users. Set retention and deletion rules consistent with legal requirements and the privacy policy.

## 18. Immediate Priorities

Before a live hub-supported pilot, Everneed should:

1. Confirm the first proposed operating area through seller/customer evidence and route checks.
2. Identify whether the first hub will be company-operated, shared, partner-operated or another controlled arrangement.
3. Define physical custody, package inspection and liability rules with qualified legal input.
4. Obtain realistic hub, packaging, transfer and last-mile cost estimates.
5. Select and assess delivery partners or define the limited in-house capability, if any.
6. Approve seller, customer, delivery, cancellation and returns terms.
7. Reconcile the operational procedure with the actual product/database workflow.
8. Test one-seller direct delivery and a multi-seller consolidated order physically and digitally.
9. Record defects, costs and customer feedback.
10. Authorise a controlled pilot only when the readiness gates are evidenced.

## 19. Review and Change Control

The founder or delegated operations owner should review this playbook:
- Before the first live fulfilment pilot.
- After any material change to the hub, carrier, service area or pricing model.
- After a serious loss, damage, safety, privacy or payment incident.
- At a regular operating review once live activity begins.

Record material decisions in `docs/GOVERNANCE/DECISION_LOG.md`. Update the product status register when a workflow moves from planned to implemented, tested or operational. Preserve prior evidence and do not silently convert proposed procedures into claims of current capability.

---

**Document control:** Internal working document. Proposed procedures only until approved, resourced, legally reviewed where necessary and validated through controlled operational tests.
