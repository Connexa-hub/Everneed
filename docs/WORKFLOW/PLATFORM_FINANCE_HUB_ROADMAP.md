# Everneed platform finance, settlement and hub operations roadmap

**Status:** Architecture approved for development planning; no live money movement enabled by this document.
**Branch:** `web-portal`
**Owner:** ChatGPT coordinator (database, payment backend, security, CI); Claude (seller/admin frontend screens)
**Environment:** Everneed-staging (`vjiadqygpyebpisxslbx`) only for development. Production project `Everneed01` remains untouched.
**Related contracts:** `docs/DATA_MODEL.md`, `docs/COMPANY/BUSINESS_MODEL.md`, `docs/LEGAL/SELLER_FEES_AND_SETTLEMENT_POLICY.md`, `docs/LEGAL/DELIVERY_AND_FULFILMENT_POLICY.md`, `docs/LEGAL/RETURNS_AND_REFUNDS_POLICY.md`, `docs/OPERATIONS/OPERATIONS_PLAYBOOK.md`.

## 1. Product outcome

Everneed is the marketplace operator and logistics coordinator. A customer may buy from several independent stores in one checkout. The customer sees one parent order; each seller sees only its own seller order/package. For multi-seller hub fulfilment, sellers hand over their packages to the hub, the hub checks and consolidates compatible packages into one consignment, and the customer confirms receipt using a one-time delivery code. A single-seller order may be seller-direct or hub-assisted according to the route selected at checkout.

The admin workplace is the control plane for the whole platform: orders, seller applications and verification, hubs, consignments, deliveries, payment reconciliation, seller payables, payouts, refunds, disputes, pricing/policy settings, staff permissions, audit trails and operational reports.

## 2. Important money-flow correction

The delivery code is a **proof-of-delivery and settlement-eligibility event**, not a card charge instruction and not a bank transfer itself.

1. Customer pays at checkout through the configured payment provider. The provider's signed, verified success event confirms the customer payment.
2. The backend posts balanced journal entries: customer funds received/clearing, seller payable, platform commission, delivery/hub revenue or carrier pass-through, and provider fees as applicable.
3. Funds are not represented as withdrawable merely because the payment webhook arrived. Provider settlement and available platform balance must be reconciled.
4. Sellers prepare and hand over their own packages. Hub staff scan/enter package references and record condition, count, timestamps and custody.
5. Hub consolidates eligible seller packages under one parent-order consignment. The consignment stores the contributing seller-order IDs; non-consolidatable items become separately labelled consignments with customer disclosure.
6. Customer's one-time delivery code is validated against the consignment/parent order, rate-limited, time-bound and consumed once. Record recipient confirmation and proof-of-delivery evidence.
7. The system marks the contributing seller packages delivered and computes each seller's payable after item-level refunds, agreed commission and permitted disclosed deductions.
8. An automated payout worker queues and sends Paystack Transfers only when provider balance, seller KYC/verification, bank recipient, currency, hold/risk rules and idempotency checks all pass. A payout is complete only after provider confirmation/reconciliation.

A seller may see the amount as **earned / pending payout** immediately after verified delivery. It must not be labelled **paid** until the transfer is confirmed. Provider settlement delay, insufficient platform balance, a dispute, return window or failed transfer must remain visible.

### Buyer saved-card / auto-debit

- Default path: charge the customer during checkout. Never collect or store PAN, CVV, PIN or OTP in Everneed.
- Optional saved-card capability: use only the provider's reusable authorization token, linked to the correct customer and currency, after clear opt-in and provider permission for the transaction type.
- Existing code has a `card_later` / `chargeSaved` path. It must be reviewed before reuse: a failed post-delivery charge must not silently make the order paid or release seller funds. Delivery completion and payment collection are separate states.
- Do not charge a customer merely because a courier entered a delivery code. The customer must have consented to the saved-card arrangement and the backend must confirm the correct amount, order and authorization.
- A delivery code must never be treated as card consent or a mandate.

## 3. Current code and schema baseline (web-portal)

Existing foundations:
- `orders` parent order and `seller_orders` one per seller, with `order_items` and `order_item_fees`.
- `orders.route` distinguishes `direct` and `hub`; multi-seller orders are routed to hub by `create_order`.
- Seller-order states include `ready`, `handover_pending`, `at_hub`, `consolidated`, `out_for_delivery`, `delivered`.
- `deliveries` currently has one row per parent order; `order_secrets` stores the delivery code.
- `ledger_entries`, `payouts`, `refunds`, `disputes`, `cards`, `settings`, `audit_log` already exist.
- Server routines include `confirm_payment`, `seller_transition`, `hub_receive`, `hub_consolidate`, `dispatch`, `mark_delivered`, `confirm_received_for`, `release_earnings`, `refund`, `record_payout`, `store_balance` and `run_scheduled_jobs`.
- Paystack Edge Function verifies transaction status and currency/amount before calling `confirm_payment`; it stores reusable authorization tokens, and includes a saved-card charge path.

Critical gaps / risks to resolve before money movement (confirmed against Everneed-staging on 15 Nov):
- `private.deliver()` is invoked by both `confirm_received_for()` and `mark_delivered()`; inspect its exact release and ledger effects before changing delivery or payout behavior.
- `mark_delivered()` reads the raw `order_secrets.delivery_code` and compares it directly; the code is currently four digits and rate-limited to five attempts per ten minutes. Replace with a high-entropy one-time code stored as a hash, expiry, attempt counter and consumed timestamp.
- `deliveries.order_id` is unique, and `hub_consolidate()` creates one delivery row per parent order. That cannot represent split consignments.
- `release_earnings()` changes pending sale/commission rows to available only after delivered status plus the configured hold (default three days). The scheduled job is not yet installed, so the hold/release lifecycle is not automated.
- `record_payout()` is an admin-entered manual record that inserts a payout and negative ledger entry; it does not call Paystack Transfers or confirm a provider transfer.
- `refund()` currently inserts a refund directly as `processed` and posts ledger adjustments internally; it does not call the Paystack refund API or wait for provider confirmation. This must be separated into requested/approved/submitting/processing/processed/failed states.
- `paystack/index.ts` marks a pay-on-delivery order delivered via `confirm_received_for()` before attempting `chargeSaved()`. If the saved-card charge fails, the order remains delivered with a failed collection result. This may be valid as a delivery fact, but it must never release seller funds until payment collection is confirmed; the failure must open a collection exception.
- `store_balance()` is derived from legacy `ledger_entries`; it is not a provider cash balance and must not be shown as a guaranteed instantly withdrawable wallet.
- Existing `ledger_entries` is a seller-facing balance record, not a full double-entry journal. It has no immutable transaction grouping, account chart, debit/credit postings or provider settlement reconciliation.
- Legacy `ledger_entries` is a seller-facing balance record, not a full double-entry journal. It has no immutable transaction grouping, account chart, debit/credit postings or provider settlement reconciliation.
- Existing `payouts` records a payout but the current documented/admin flow is manual recording; no verified automated Paystack transfer lifecycle is established.
- Existing `deliveries` is unique per parent order, so it cannot represent multiple consignments if some seller packages cannot be consolidated or a split delivery is needed.
- Existing `order_secrets` has a single code on the parent order. The storage and validation path needs security review; codes must be hashed at rest, rate-limited and single-use.
- The project tracker says `run_scheduled_jobs()` has no installed schedule today. Earnings release and expiry jobs therefore cannot be assumed to run automatically.
- The saved-card post-delivery path requires a fail-closed payment/fulfilment state machine.
- The business/legal policy does not yet approve commission rates, delivery tariffs, payout timetable, reserve/hold duration, payment-provider fee allocation or legal payment-receiving entity. Do not invent or activate these values.
- Physical hub staffing, locations, carrier arrangements, custody procedures and service coverage remain operational prerequisites.

## 4. Target architecture

### A. Immutable finance journal
Add a finance journal independent of the existing compatibility `ledger_entries` view/records:
- `finance_accounts`: chart of accounts by legal entity, currency and account class (provider clearing, platform cash, seller payable per seller, commission revenue, delivery revenue, carrier payable, provider fee expense, refund liability, reserve/hold).
- `finance_transactions`: immutable business event, source type/id, idempotency key, provider reference, currency, effective/created timestamps, metadata and actor.
- `finance_postings`: signed debit/credit lines referencing a transaction and account; enforce balanced debits = credits per currency and transaction.
- Corrections use reversing transactions and replacement postings; never edit or delete posted financial history.
- Seller statements are derived from postings and package-level allocations. Never use a mutable cached balance as the accounting source of truth.
- Separate actual provider/bank balances from ledger liabilities and available-to-pay calculations.

### B. Payment and provider reconciliation
- Persist every Paystack transaction reference and provider event with unique idempotency constraints.
- Verify webhook signature against raw request body; fetch/verify transaction where needed; validate expected order, user, amount, currency and state.
- Handle duplicate, out-of-order, delayed and failed events safely.
- Add provider settlement/payout reconciliation import or API polling; compare expected net receipts, fees, refunds and actual settlement.
- Add refund API execution and provider status tracking. Never mark a refund complete on internal approval alone.

### C. Seller package and hub consignment
- Keep one parent order and one seller order per contributing seller.
- Add `delivery_consignments` for each actual customer parcel/route. One parent order can have one consolidated consignment or multiple separately disclosed consignments.
- Add `consignment_packages` linking each seller_order to the consignment, with scan label/reference, package count/condition, received-by, timestamps and custody state.
- Add append-only `custody_events` for seller handover, hub intake, inspection, storage location, consolidation, dispatch, carrier handover, delivery attempt, proof and return.
- Use role-scoped hub staff permissions; hub staff must not see seller bank data or unrelated customer details.
- Delivery code verifies the correct consignment and marks all linked seller packages delivered in one transaction only after the consignment is actually delivered.

### D. Seller payouts
- Seller must complete required identity, business/address and bank-account verification before automated payouts.
- Store only provider recipient code and masked bank metadata in normal app tables; encrypt/restrict raw account details if retention is legally necessary.
- Create payout batch and payout item records with states: eligible, queued, submitting, processing, paid, failed, reversed, cancelled.
- Generate unique provider transfer references; submit transfers from server-only Edge Function; reconcile transfer webhooks/status before marking paid.
- Enforce available balance, payout minimum/fees if approved, reserve/hold, dispute/refund exposure, duplicate prevention and manual review thresholds.
- A failed transfer returns the amount to seller payable through a compensating journal transaction; it does not disappear or become platform revenue.

### E. Admin workplace
Build one operations shell with role-based sections:
1. Overview: GMV, paid orders, unfulfilled orders, hub queue, seller payable, provider balance/reconciliation, payouts pending/failed, refunds/disputes, verification backlog and SLA.
2. Orders: parent order timeline, seller packages, payment state, route and exceptions.
3. Hub & delivery: inbound expected, receive/scan, discrepancies, consolidation, dispatch, carrier, POD, failed delivery and returns.
4. Finance: accounts, immutable journal, seller statements, provider settlement reconciliation, commission, delivery/carrier allocation and exports.
5. Payouts: eligibility queue, batch preview, approvals, transfer execution, retries and reconciliation.
6. Refunds & disputes: case timeline, item/package allocation, approvals, provider refund execution, evidence and appeal.
7. Sellers & verification: application review, verification cases, store activation and payout holds.
8. Settings: country/currency, hub coverage, route policy, fees, commission, payout holds, approval thresholds, notification/SLA rules and payment provider config.
9. Staff, roles and audit: least privilege, two-person approval for high-risk finance actions, immutable audit history.

## 5. Delivery roadmap and gates

### Phase 0 — Lock contracts and test safety (now)
- Review current SQL definitions, grants, RLS, triggers and Edge Function behavior for all finance/order functions.
- Confirm provider capabilities and the legal receiving/settlement model with Paystack and qualified Nigerian counsel/accountant.
- Define currency and decimal/major-unit vs minor-unit conventions consistently.
- Confirm business decisions: commission base/rates, delivery charge allocation, provider fees, payout event/hold, refunds/returns, failed delivery and reserves.
- Keep all work on staging; create test-only accounts and use Paystack test keys.

**Exit:** approved accounting map, provider flow, fee schedule placeholders and passing baseline tests. No production transfers.

### Phase 1 — Order and delivery model
- Add multi-consignment support and append-only custody events.
- Harden delivery-code generation, storage, attempt throttling, expiry and one-time consumption.
- Implement hub staff roles and parent-to-seller-package status consistency.
- Add tests for one seller direct, one seller via hub, three sellers consolidated, partial consolidation and one seller package failure.

**Exit:** every item/package has traceable custody and customer sees truthful order/parcel status.

### Phase 2 — Double-entry journal and payment reconciliation
- Add chart of accounts, journal transactions and balanced postings.
- Post checkout success, commission, delivery, provider fee, refunds, reversals and adjustments idempotently.
- Reconcile provider settlements and expose accurate seller pending/available balances.
- Keep legacy `ledger_entries` read compatibility until all app/web surfaces migrate.

**Exit:** sample order reconciles from checkout through provider settlement and seller liability with no unexplained difference.

### Phase 3 — Delivery-triggered seller payout automation
- Make verified POD create payout eligibility, not a direct unguarded transfer.
- Add payout batch worker, Paystack transfer recipient and transfer APIs, webhook/status reconciliation, retry/compensation and two-person thresholds.
- Add seller bank detail verification/change controls.
- Test insufficient provider balance, duplicate event, timeout, failed transfer, returned transfer, dispute and partial refund.

**Exit:** seller is marked paid only after confirmed transfer; all movements reconcile.

### Phase 4 — Refunds, disputes and chargebacks
- Implement item/package-level full and partial refunds, provider API calls, journal reversals, stock restoration where appropriate, seller/platform/carrier allocation and customer notifications.
- Add dispute evidence, custody timeline and independent review.
- Do not claw back unrelated undisputed seller earnings unless law/provider terms allow and evidence supports it.

**Exit:** all refund and dispute cases produce consistent customer, seller, provider and ledger records.

### Phase 5 — Admin workplace and reporting
- Implement the finance/hub/admin screens against stable RPC contracts.
- Add permissions, approvals, audit history, exports, reconciliation exceptions and operational alerts.
- Keep frontend work coordinated with Claude through the tracker and API contract.

**Exit:** admin can operate test marketplace end-to-end without direct SQL edits or manual balance manipulation.

### Phase 6 — Controlled pilot and production release
- Complete operational hub/carrier readiness, training, customer disclosures, seller agreements, fee schedule, privacy and regulatory review.
- Run three-seller end-to-end tests with test funds, refunds and payout reconciliation.
- Owner approves release; reviewed PR to `main`; apply reviewed migrations to production only through approved workflow.

## 6. Admin test account

The staging database currently has no profile for the nominated admin email. The account must first be created through the normal staging sign-up and email-confirmation flow. After the profile exists, an authorised owner-only staging operation can assign `profiles.role='admin'`. Never hardcode admin email/password in frontend code, migrations, GitHub, or public documentation. Use a unique test password stored in a password manager; credentials pasted into chat should be rotated. Do not create or promote an account in production as part of this work.

## 7. Required test scenarios

- One buyer, three sellers, three seller packages, one hub consignment, one customer delivery code, three seller payable allocations.
- Single seller direct delivery does not touch hub custody.
- Single seller hub-assisted delivery records custody and route charges.
- Partial consolidation creates separate parcels and does not claim one parcel.
- Duplicate Paystack webhook and duplicate delivery code do not double-post or double-pay.
- Delivery code entered before dispatch, for wrong order, expired, guessed or reused is rejected.
- Buyer card charge fails after delivery: delivery remains delivered, payment remains unpaid/collection-failed, sellers are not paid, customer/admin are notified.
- Partial refund for one seller package does not debit another seller incorrectly.
- Refund/provider transfer failures remain visible and retryable without duplicate movement.
- Seller cannot read another seller's order, ledger, payout or customer private data.
- Hub staff cannot change finance settings or approve their own payout exception.
- Admin finance actions require role checks, audit records and approval policy.

## 8. Provider and legal constraints

Paystack documents separate APIs for transfer recipients and transfers, and supports subaccounts/split payments. These are alternative settlement patterns, not automatic permission to hold or escrow seller funds. The implementation must use the model Paystack approves for Everneed's marketplace and legal entity. See:
- https://paystack.com/docs/transfers/creating-transfer-recipients/
- https://paystack.com/docs/api/transfer/
- https://paystack.com/docs/api/subaccount/
- https://paystack.com/docs/api/transaction/
- https://paystack.com/docs/api/refund/

Do not activate a wallet/escrow representation, delayed settlement promise, auto-debit or automated seller payout until the provider and legal/accounting review confirm the structure. A dashboard balance is an accounting view, not a bank account or stored-value wallet.
