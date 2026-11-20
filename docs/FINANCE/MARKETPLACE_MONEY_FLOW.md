# Everneed Marketplace Money Flow & Payments Architecture

**Status:** Architecture baseline / implementation specification  
**Date:** 19 November 2026  
**Branch:** `feature/variant-checkout`  
**Environment:** Staging design and implementation only  
**Production:** No production migration, deployment, payment, wallet funding or withdrawal is authorised by this document.

## 1. Product objective

Everneed is a multi-vendor marketplace and fulfilment operator. Its money system must support:

- Buyer checkout across one or multiple stores.
- Cards, bank transfer, USSD, bank account and other locally enabled Paystack channels.
- Buyer saved payment methods, with explicit consent and provider tokenisation.
- Buyer account credit / promotional cashback, with strict distinctions between cash and promotional value.
- Store financial workspace: sales, pending earnings, available balance, reserves, fees, refunds and payout history.
- Seller bank-account onboarding, validation, withdrawal requests and payout tracking.
- Everneed marketplace commissions, store-plan charges, hub handling, delivery revenue, promotions and other platform revenue.
- Coupons, automatic promotions, seller-funded/platform-funded/co-funded discounts, referrals and cashback.
- Shipping estimates, hub consolidation, direct delivery, split seller orders and delivery exceptions.
- Partial/full refunds, chargebacks, disputes, reversals, reconciliation and immutable audit history.
- Multi-currency expansion without mixing currency balances or silently changing exchange rates.

The system must never equate order status with payment status, seller earnings with cash, wallet display balance with a bank balance, or a delivery charge with Everneed profit.

## 2. Current staging audit — important facts and gaps

The staging project currently has:

- `orders`, `seller_orders`, `order_items`, `order_item_fees`, `ledger_entries`, `payouts`, `refunds`, `store_payments`, `offers`, `cards`, `payment_attempts` and provider-event/recovery functions.
- `seller_orders` stores seller-level subtotal, commission and earning; existing release flag and lifecycle fields are present.
- `ledger_entries` is a legacy, single-row event ledger with kinds `sale/commission/rental/refund/payout/adjustment` and statuses `pending/available/paid/reversed`. It is not a complete double-entry general ledger.
- `payouts` records completed/recorded store payouts; it is not a full withdrawal-request and provider-transfer state machine.
- `refunds` supports requested/approved/processed/rejected records, but the complete gateway refund lifecycle and accounting reversals need review.
- `offers` supports one code or automatic offer, percent/fixed values, minimum total, country, date range and total-use cap. It does not yet model per-user limits, seller/platform funding shares, coupon stacking policy, targeted segments, cashback liability, promo budgets or redemption reservations.
- `cards` currently has a `code` field containing the provider authorization token. Staging RLS has an owner-read policy, an owner-delete policy and no owner insert/update policy; the edge function accesses it with service role. Table grants and policies must be reviewed together. The token must never be included in client payloads, logs, exports or generic profile queries; add encryption/token-vaulting or provider-managed references before enabling reusable-card charging broadly.
- There are no buyer-wallet or store-wallet account tables in staging. Do not present the current system as already having functioning wallets.
- Existing Paystack function supports card initialize/charge/verify, signed webhook verification, saved-card charging, coupon lookup, order create and some admin/order actions. It is not yet the full payments platform described here.
- Existing Paystack price logic fetches FX and applies offer plus a country setting fee, but a complete delivery quote, multi-seller allocation, promotion funding, wallet debit/credit, seller reserve, payout and reconciliation lifecycle are not yet proven end-to-end.
- Existing currency mapping is not yet a production-grade country/payment-method/currency capability matrix. In particular, international presentment, settlement and FX must not be inferred from a display currency.
- Existing variant checkout has passed staging regression test 039, but the gateway success/failure/webhook lifecycle still needs controlled sandbox acceptance.

These are verified design constraints, not claims that all planned modules are implemented.

## 3. Non-negotiable money rules

1. **One source of truth:** immutable, balanced journal postings are the financial source of truth. Wallet and dashboard balances are projections from the journal, not independent mutable amounts.
2. **Double-entry:** every financial event posts debits and credits that balance per currency. No one-sided balance edits.
3. **Currency isolation:** each journal transaction and wallet account is denominated in exactly one currency. NGN, GHS, KES, ZAR, GBP and USD never net against one another without an explicit FX trade and two-sided postings.
4. **Integer minor units:** store money as integer minor units (kobo/cents/pesewas) plus ISO currency and currency exponent. Never use JavaScript floating-point or client-supplied totals for settlement.
5. **Server-side quote:** server prices catalogue items, quantity tiers, taxes where applicable, discounts, shipping, handling, insurance and gateway fees according to policy. The client submits selections, never authoritative amounts.
6. **Immutable snapshots:** save the exact item, seller, price, discount allocation, tax, shipping quote, route, currency, FX source/rate/time, policy versions and payment total at checkout.
7. **Idempotency:** every checkout, gateway initialization, webhook, refund, wallet operation and payout has a unique idempotency key and durable state.
8. **No premature seller release:** seller earnings become withdrawable only after delivery confirmation / approved completion, risk checks and the applicable dispute/return reserve. Paid by buyer does not mean payable to seller.
9. **No negative wallet by default:** wallet debit, coupon use, cashback redemption and seller withdrawal must lock and verify available funds atomically. Negative balances require a documented receivable/recovery workflow, never a hidden override.
10. **Reversals are new entries:** never edit or delete posted journal lines. Refunds, chargebacks and corrections post compensating entries linked to the original.
11. **Separation of duties:** admin may approve a refund or payout, but the same action cannot silently alter the underlying ledger. High-value/manual adjustments require maker-checker approval.
12. **No secret leakage:** provider secret keys, card authorization tokens, bank verification payloads and identity data are server-only, encrypted/redacted and never written to logs or public docs.

## 4. Target architecture

### 4.1 Financial services

- **Checkout Quote Service:** validates products/variants, stock, seller eligibility, buyer address, coupon/promo eligibility, shipping and taxes; returns a short-lived, signed/identified quote.
- **Payment Orchestrator:** selects available provider/channel by country and currency; creates payment attempts; handles redirects, saved methods, verification, webhooks and retries.
- **Financial Journal:** append-only double-entry postings and account balances by currency.
- **Buyer Credit Service:** handles eligible refunds-to-credit, promotional cashback and (only if legally approved) cash wallet deposits/withdrawals.
- **Seller Settlement Service:** calculates pending/held/available seller earnings, payout requests, approval, transfer and reconciliation.
- **Promotion Service:** validates coupon rules, reserves limited budgets/uses, allocates discount funding and posts marketing subsidy liability/expense.
- **Fulfilment Pricing Service:** calculates direct/hub shipping, handling, consolidation, insurance, remote-area and return fees from explicit tariffs.
- **Reconciliation Service:** matches provider settlements, fees, transfers, refunds, disputes and bank statements to Everneed journal postings.
- **Risk & Verification Service:** buyer/store verification levels, device/account velocity, chargeback/fraud signals and payout holds.
- **Admin Finance Console:** permissions, exception queues, approval controls, financial reports and audit trail.

### 4.2 Core records to introduce (names are proposed; inspect migration history and naming before implementation)

- `financial_accounts`: owner type/id, account purpose, currency, account status, legal classification and optional external provider reference.
- `journal_transactions`: immutable event header, event type, reference, idempotency key, currency, actor, source, metadata hash, posted/reversed state.
- `journal_lines`: account, debit minor units, credit minor units, currency, order/seller-order/payment/payout/refund references; enforce exactly one positive debit or credit per line and balanced totals per journal transaction.
- `account_balance_snapshots`: rebuildable cached posted, pending and reserved totals by account/currency; never the authoritative source.
- `buyer_credit_lots`: source (cash refund, promo cashback, goodwill), original value, remaining value, expiry, restriction and refundability; linked to journal postings.
- `wallet_operations`: top-up, spend, transfer (only if enabled), refund-to-credit, cash-out; state machine, provider references and idempotency.
- `seller_payout_methods`: verified bank account/provider recipient references, masked account details, verification status, owner approval and change history.
- `seller_withdrawal_requests`: requested/approved/rejected/processing/paid/failed/cancelled, amount, fee, net amount, currency, destination snapshot and risk hold.
- `seller_reserves`: rolling reserve, dispute reserve, refund hold, release date and reason.
- `payment_allocations`: payment amount allocated to merchandise, each seller, tax, shipping, platform fee, gateway fee, discounts and credits.
- `payment_refunds`: gateway refund attempts, partial amount, provider response, retry/reconcile status and original payment link.
- `promotion_campaigns`, `promotion_rules`, `promotion_funding_allocations`, `promotion_redemptions`, `promotion_budget_movements`.
- `cashback_rules`, `cashback_awards`, `cashback_lots`, `cashback_redemptions`, `cashback_reversals`.
- `shipping_rate_cards`, `shipping_zones`, `shipping_quotes`, `shipping_quote_lines`, `shipping_charge_allocations`, `delivery_partner_costs`.
- `provider_settlements`, `provider_settlement_lines`, `provider_transfers`, `provider_refunds`, `reconciliation_runs`, `reconciliation_exceptions`.
- `buyer_verification_cases`, `verification_evidence_refs`, `risk_decisions`, `payout_holds`.

Do not create one mutable `wallet.balance` field as the accounting source. A wallet UI can show computed spendable, pending and restricted balances from the ledger.

## 5. Money accounts and chart of accounts

Create separate accounts per legal entity and currency. Example account families:

### Assets / clearing
- Provider clearing receivable (Paystack collections awaiting settlement).
- Bank settlement account (actual bank funds received).
- Provider transfer-in-flight / payout clearing.
- Refund receivable from provider.
- Delivery partner receivable / cash-on-delivery receivable.
- FX clearing / conversion-in-progress.

### Liabilities
- Buyer cash-credit liability (only if legally permitted and safeguarded).
- Buyer promotional-credit liability (restricted, non-cash).
- Seller payable — pending delivery.
- Seller payable — available.
- Seller rolling reserve / dispute reserve.
- Refunds payable.
- Delivery partner payable.
- Tax payable.
- Unredeemed gift / promotional obligations where required by accounting policy.

### Revenue / expenses
- Marketplace commission revenue.
- Store subscription / plan revenue.
- Delivery and hub handling revenue (only Everneed's earned portion).
- Seller-funded marketing reimbursement / promo receivable.
- Platform-funded promotion expense.
- Payment processing expense.
- Delivery partner / courier cost.
- Hub packaging and handling cost.
- Refund loss / goodwill expense.
- Chargeback and fraud loss.
- FX gain/loss.

Each account has owner scope and currency. A seller must never see another seller's accounts. The Everneed official store and marketplace operator accounts must be distinguished; no artificial transfer between them.

## 6. Buyer payment journey

### 6.1 Account, buyer validation and activation

- Guest browsing may remain available. Checkout requires an authenticated account or a verified guest-to-account flow with an immutable order owner.
- Verify email or phone for account recovery and transactional notices. Before a high-risk order, verify the delivery phone using OTP.
- Capture recipient name, phone, country, state, city, street, landmark, delivery instructions and optional map pin; validate the service zone before payment.
- A first-time buyer can pay by card/bank transfer without being forced to provide BVN/NIN by default. Ask for additional identity evidence only where a risk threshold, provider rule, legal requirement or cash-out feature requires it.
- Activation levels should be explicit: `registered`, `contact_verified`, `checkout_eligible`, `enhanced_verified`, `restricted`, `suspended`. Each transition has a reason and audit record.
- A buyer cannot use another person's saved card token or payout instrument. Step-up verification applies to new device, changed phone, unusual value, repeated failed payments, wallet cash-out or suspicious refunds.
- Address and phone validation are delivery controls, not proof of legal identity.

### 6.2 Checkout quote and order creation

1. Buyer basket may contain products from multiple stores.
2. Server rechecks product status, store status, country eligibility, selected variant, current price, min/max quantity, stock, preorder/backorder rules and seller fulfilment route.
3. Apply eligible coupon/promotion rules. Reserve limited-use code/budget atomically; do not increment redemption counters on mere code lookup.
4. Calculate delivery quote for each package/route and buyer destination; clearly show separate product subtotal, discounts, shipping, hub handling, tax, insurance/surcharges, wallet credit and total.
5. Generate quote ID, expiry, policy versions and immutable snapshot hash.
6. Create one parent order and one seller order per participating store. Allocate items, discounts, shipping and taxes to seller-order level. A single payment attempt pays the parent order exactly once.
7. Create payment attempt with provider reference and idempotency key. Do not create a second order when the user retries a payment.
8. Reserve inventory at order creation or payment initiation according to one documented policy; expire unpaid reservations safely and restore inventory once.
9. Payment is confirmed only after server-side provider verification and amount/currency/reference/metadata/order/attempt checks.
10. Once paid, move the order to paid/processing and notify each seller. Never rely on redirect success alone.

### 6.3 Buyer payment methods

**Cards**
- Paystack-hosted checkout or provider-hosted authorization; no PAN/CVV stored by Everneed.
- Saved card is opt-in. Store only masked brand/last4/expiry plus encrypted provider token reference. Provide delete/revoke and default-card controls.
- Reusable authorization must follow provider rules and explicit consent; do not silently charge saved cards for new orders.
- 3DS/OTP challenge and failed/timeout/pending states must be represented.

**Bank transfer / virtual account**
- Generate transaction-specific reference or dedicated virtual account through the provider.
- Match incoming transfer by reference, amount, currency and expiry; partial/overpayment goes to a reconciliation exception, not automatic order settlement.
- Display pending until provider/bank confirms. Never ask buyer to upload proof as sole payment evidence.

**USSD / bank account / mobile money**
- Show only channels enabled for that country, currency and Paystack account.
- Channel handoff may be asynchronous; poll or await signed provider event and verify before marking paid.

**Cash on delivery**
- Treat as a separate high-risk collection method, not paid revenue at checkout.
- Restrict by location, order value, buyer history, seller route and courier capability.
- Consider confirmation deposit for expensive/high-return orders. Record cash collected by courier/hub and reconcile to bank; seller must not be marked paid merely because order is delivered.
- Do not enable COD where courier cash reconciliation and fraud controls are not operational.

**Saved methods**
- A saved card is a provider token, not a wallet.
- Add bank-account payout destination separately; a buyer's saved card cannot be a withdrawal destination.

## 7. Buyer wallet / account credit design

### 7.1 Critical regulatory boundary

A balance that can be funded, stored, transferred between users or withdrawn to bank can be regulated stored value/e-money activity. Do not launch a general-purpose cash wallet, peer-to-peer transfer or cash-out facility simply by adding a database table. Nigeria's CBN mobile-money framework identifies wallet creation and e-money issuance as licensed activities; legal counsel and a properly licensed bank/MMO/PSP partner must approve the structure, safeguarding, KYC tiers, limits, disclosures and customer-fund treatment.

**Safe staged launch recommendation:**
- Phase A: display a buyer "Everneed Credits" area for non-transferable promotional credits and refunds-to-credit only if the legal/accounting review approves the structure. Promo credits are not cash, not withdrawable and not transferable.
- Phase B: enable cash refunds to original payment method by default; offer refund-to-credit only as an informed, optional alternative with terms and applicable expiry.
- Phase C: only with licensed partner/legal approval, add cash wallet top-up, cash balance, bank withdrawal and possibly transfer. The partner should custody/issue regulated value; Everneed maintains a mirrored ledger and orchestration layer, not an unlicensed pooled deposit product.

### 7.2 Separate buyer balance buckets

- **Cash wallet balance:** only if approved; funds from buyer top-up or cash refund, subject to partner rules. Withdrawal and purchase spending may be allowed by tier.
- **Refund credit:** from a cancelled/returned order; refund-to-credit option; linked to original order and refund policy.
- **Promotional cashback:** earned only after qualifying completed purchase; restricted to future eligible checkout; not withdrawable or transferable.
- **Goodwill credit:** admin compensation with reason, cap and approval; normally non-cash and restricted.
- **Pending rewards:** earned but not yet available (delivery, return window, fraud review).
- **Reserved credit:** applied to an unpaid checkout and released if checkout expires/fails.
- **Expired/reversed credit:** visible in history; never silently deleted.

### 7.3 Wallet actions

- **Top up:** partner-hosted collection, unique reference, verify provider webhook, post cash-wallet liability only after confirmed receipt, reconcile provider settlement.
- **Spend:** quote service reserves credit; payment transaction atomically debits buyer credit liability and allocates the value to seller/platform/shipping funding buckets. If external payment covers remainder, both methods settle one order atomically or use a controlled payment intent.
- **Refund:** choose original source or eligible refund credit. Never refund more than net paid amount; reverse discounts and cashback according to policy.
- **Withdraw:** only approved cash-wallet funds, KYC tier, bank-account name match, velocity limits, step-up auth, fraud review, maker-checker above threshold, transfer API and final provider verification.
- **Transfer:** disabled by default; only after legal/partner approval and recipient verification.
- **Expiry:** promotional lots expire according to disclosed terms and local consumer law; cash/refund funds must not be expired as promotional value.
- **Statements:** downloadable transaction history, reference, status, source, amount, currency and closing balance; do not expose internal ledger account identifiers.

## 8. Store wallet / seller financial workspace

A store wallet is initially a **seller settlement ledger**, not a deposit account and not a promise of instant cash custody.

### 8.1 Seller balance buckets

- Pending: paid order allocated to seller but not yet delivered/cleared.
- Available: seller payable released after delivery, reserve and dispute checks.
- Reserved: rolling reserve, refund/dispute hold, chargeback exposure.
- Processing: payout requested and funds locked.
- Paid: provider confirmed successful transfer.
- Reversed/adjusted: explicit journal reversal or approved correction.
- Lifetime sales, gross merchandise value and net earnings are analytics, not spendable balance.

### 8.2 Seller earnings formula

For each seller order, calculate and snapshot:

`seller_net = allocated_merchandise
            - seller_funded_discount
            - marketplace_commission
            - seller_borne_gateway_fee
            - seller_borne_shipping_or_handling
            - tax_withheld_if_applicable
            - refund_or_chargeback_debit
            - other disclosed seller fees`

Platform-funded coupons and cashback must not reduce seller earnings. If a promotion is co-funded, each party's share must be explicit. Customer-paid shipping is not seller revenue unless the seller is contractually responsible for fulfilment and the allocation says so.

### 8.3 Seller onboarding and payout activation

- Seller store approval, seller identity/business verification and payment capability are separate states.
- Seller can set up catalogue before payout activation, but cannot withdraw until required identity, bank ownership, tax and risk checks are complete.
- Offer a non-CAC path where allowed: individual/sole proprietor verification and manual review; do not falsely label BVN/NIN as CAC incorporation.
- Bank details are entered and verified server-side; show masked account and resolved account name for seller confirmation.
- Changing payout account triggers OTP/step-up verification, cooling-off period and risk hold; notify old and new contact channels.
- Store owner, payout beneficiary and legal business name mismatches go to manual review.
- Plans may change analytics, withdrawal cadence, support, limits or fees only where disclosed; plan must never silently confiscate accrued earnings.

### 8.4 Withdrawal lifecycle

`requested -> risk_check -> approved -> processing -> provider_pending -> paid`
Alternative terminal states: `rejected`, `cancelled`, `failed`, `reversed`.

1. Seller selects available balance and verified payout destination.
2. Server checks available funds, currency, minimum/maximum, account status, KYC, holds, payout schedule and fees.
3. Atomically move amount from available to payout-in-flight/reserved.
4. Apply approval rules: automatic below low-risk threshold, maker-checker for higher values, first withdrawal, bank change, unusual velocity or flagged account.
5. Create provider transfer with unique reference/idempotency key.
6. Mark paid only after provider status verification/webhook and reconciliation; a successful API response alone may mean queued/processing.
7. On failure, release the reserved amount once; on reversal, post compensating entries and open an exception.
8. Provide seller receipt/reference and transparent fee/net amount.

### 8.5 Settlement timing

Initial recommended policy (must be configurable and disclosed, not hard-coded):
- Direct delivery: release after buyer OTP confirmation or trusted delivery proof plus short fraud/return hold.
- Everneed hub: release after final consolidated parcel delivery, not when seller drops at hub.
- High-risk, COD, disputed or return-prone categories: longer reserve or manual release.
- Seller rejection/cancellation: restore inventory and reverse seller payable/commission/discount allocation idempotently.
- Partial delivery: release only delivered eligible lines, keeping affected lines reserved.

## 9. Coupons, promotions and cashback

### 9.1 Promotion types

- Public campaign code.
- Private targeted code (new buyer, win-back, VIP, location, category, seller, product).
- Automatic basket discount.
- Product/variant markdown (catalogue price; separate from coupon).
- Free or subsidised shipping.
- Bundle / buy-X-get-Y.
- Referral reward.
- Seller store coupon.
- Everneed marketplace coupon.
- Co-funded promotion.
- Cashback on completed order.
- Limited-time flash sale.
- Loyalty tier benefit (later).

### 9.2 Eligibility engine

Every rule can specify: start/end in explicit timezone, country/state/city, seller/store/product/category/variant, buyer segment, first-order status, plan, minimum basket, maximum discount, per-buyer cap, global cap, channel, payment method, new/existing customer, exclusions, stacking group, budget and funding source.

Default safety policy:
- One basket coupon per order unless admin explicitly enables a compatible stack.
- Product sale price + coupon is allowed only when rule says so.
- Free shipping cannot stack with another shipping subsidy unless campaign says so.
- Seller-specific coupon only discounts that seller's eligible items.
- Do not apply coupon to tax, shipping, hub fee or other fees unless the campaign expressly permits it.
- Reject self-referral, multiple accounts/device abuse, code enumeration and repeated failed attempts.

### 9.3 Funding and allocation

Each discount line records who funds it:
- Seller-funded: reduce seller settlement by the approved discount amount.
- Everneed-funded: debit platform promotion expense / marketing budget; seller receives agreed pre-discount eligible amount less normal commission.
- Co-funded: split exact amount by saved percentages or fixed amounts.
- Partner-funded: record partner receivable and campaign reference.

A discount is not revenue. Reserve campaign budget at checkout; consume only on confirmed paid order; release on payment expiry/cancellation; reverse proportionally on refund. Campaign must stop safely when its budget or usage cap is exhausted.

### 9.4 Cashback lifecycle

`eligible_order -> pending_award -> available_award -> reserved_for_checkout -> redeemed`
Other states: `reversed`, `expired`, `cancelled`.

- Award only on qualifying net merchandise value after discounts; exclude shipping, tax, refunded lines, gift cards and ineligible categories unless explicitly configured.
- Cashback becomes available after delivery and return/fraud hold.
- Store source order, eligible line allocation, rule version, funding entity, amount, expiry and cap.
- Redeem at checkout as a separate tender; do not call it a coupon or silently reduce product price.
- If source order is refunded/cancelled, reverse pending/available cashback. If already spent, recover from future promo credits or open a controlled receivable/negative promotional balance; never debit cash wallet without consent.
- Show earned, pending, available, used, reversed and expiring values separately.
- No cashback on the cashback-funded portion of the same order unless policy explicitly allows it.

## 10. Shipping and fulfilment pricing

Everneed has two principal routes:

- **Direct:** seller dispatches to buyer (seller may use an approved courier or own delivery).
- **Hub:** sellers drop their parcels at Everneed hub; Everneed checks, consolidates and dispatches one combined buyer parcel.

### 10.1 Buyer quote breakdown

Show each applicable line separately:
- Seller-to-hub first-mile (if charged to buyer; normally platform/seller cost, not automatically customer charge).
- Hub receiving/checking/handling fee.
- Packaging/consolidation fee.
- Hub-to-buyer last-mile courier charge.
- Direct seller delivery charge.
- Remote-area / out-of-zone surcharge.
- Heavy/oversize/fragile/insurance charge.
- COD collection fee where permitted and disclosed.
- Return pickup / reverse logistics charge where policy permits.
- Free-shipping subsidy and who funds it.

### 10.2 Rate engine inputs

- Origin and destination zone, distance/route, serviceability.
- Dead weight and volumetric weight (carrier divisor configurable).
- Parcel dimensions, number of parcels, fragile/hazardous classification.
- Delivery speed, service class, remote-area and insurance.
- Seller route eligibility, number of seller parcels, consolidation eligibility.
- Courier contract tariff, hub cost, fuel/peak surcharge and tax.
- Quote expiry and delivery SLA.

Use provider/carrier rate APIs where available; otherwise admin-managed rate cards. Save a shipping quote snapshot so the customer is not repriced after payment. If weight/dimensions change at hub, create a documented adjustment requiring buyer consent or absorb it under a clear Everneed policy; never silently charge the saved card.

### 10.3 Who earns shipping revenue?

Separate:
- Customer shipping charge.
- Amount owed to courier.
- Everneed hub handling/packaging fee.
- Seller delivery compensation (if seller performs delivery).
- Everneed shipping subsidy.
- Refundable/unearned shipping amount.

Only the explicit Everneed handling/service margin is Everneed revenue. Courier pass-through is a payable. If Everneed quotes a fixed delivery price and bears the cost risk, the difference is margin or loss, not hidden seller commission.

### 10.4 Shipping fee policy and fairness

- Show delivery cost before payment and explain route.
- No fee should appear after order confirmation without a documented buyer-approved change.
- Set free-shipping thresholds on eligible merchandise subtotal before/after discount explicitly.
- Avoid charging a buyer both a seller delivery fee and hub last-mile fee for the same leg.
- Split shipping allocation fairly across seller orders (weight/volume/parcel count or saved quote line allocation); define refund handling for partial cancellation.
- Keep prohibited/hazardous items out of unsupported routes.
- COD delivery cash, courier remittance and provider payments must reconcile independently.

## 11. Order-level money allocation example

Illustrative only (NGN):

| Component | Amount |
|---|---:|
| Store A merchandise | ₦20,000 |
| Store B merchandise | ₦10,000 |
| Buyer coupon | -₦2,000 |
| Hub delivery | ₦2,500 |
| Hub handling/packaging | ₦500 |
| Tax (if applicable) | calculated by tax rules |
| **Buyer total before tax** | **₦31,000** |

The ₦2,000 discount must be allocated to Store A / Store B based on eligible lines and funding source. The ₦3,000 shipping/handling is not automatically all Everneed revenue: courier cost and hub cost are posted as payables/expenses; only earned handling margin is revenue. Seller A and B receive separate seller-order statements, with commission, discount funding, seller-borne fees and reserve shown.

## 12. Refunds, cancellations, disputes and chargebacks

- Buyer requests refund against order or seller-order / line items.
- Validate delivered state, return window, proof, quantity, original payment and previous refunds.
- Approve full/partial refund with reason and allocation by merchandise, tax, shipping, promo and cashback.
- Send gateway refund against original provider transaction; track queued, pending, success, failed and reversed.
- Do not mark refunded until provider confirms; reconcile asynchronously.
- Refund-to-original-method is default. Refund-to-credit is opt-in, disclosed and legally approved.
- Seller payable is debited/reversed according to fault and policy; platform-funded discount and courier cost are handled separately.
- If seller already withdrew, create reserve/receivable/recovery process; do not allow silent negative available balance.
- Chargeback opens a case, freezes affected seller reserve, records evidence deadline, tracks provider dispute result and posts loss/recovery.
- Repeated duplicate webhooks must not duplicate refund, commission reversal, cashback reversal or stock restoration.

## 13. Admin and seller financial controls

### Seller dashboard
- Today/7-day/30-day sales, gross sales, net sales, orders and refunds.
- Pending earnings, available to withdraw, reserved/held, processing payouts and lifetime paid out.
- Per-order settlement statement with item revenue, discount funding, commission, fees, shipping, reserve and net.
- Payout methods, verification, withdrawal request, status, receipt and dispute/hold reason.
- Coupon performance and seller-funded campaign spend.
- Cashback liability only where seller is a funding party.
- Downloadable CSV/PDF statements and tax summaries.

### Buyer dashboard
- Orders and payment receipts.
- Saved cards/payment methods (masked, delete/default, consent record).
- Credit buckets and transaction statement.
- Coupons, referral codes, cashback pending/available/used/expired.
- Refund status and original payment method.
- Delivery charge breakdown and shipment tracking.

### Everneed admin finance console
- Gross merchandise value vs collected cash vs provider settlements.
- Seller payable pending/available/reserved/paid.
- Buyer cash liability and promo-credit liability (if enabled).
- Platform commission, subscription, delivery/handling revenue, promo spend and payment fees.
- Provider settlement and bank reconciliation.
- Withdrawals and refund approval queues, risk holds, failed/reversed transfers.
- Coupon budgets, co-funding, redemption fraud and cashback liabilities.
- Delivery partner invoices, COD cash remittance and shipping margin by route.
- Journal explorer, account trial balance, period close and audit export.
- Permissions by role; two-person approval for sensitive/high-value actions; no direct balance edit.

## 14. Provider and payment gateway strategy

### Initial Nigeria-first setup
- Paystack remains the initial card/transfer/USSD provider where the Everneed account is enabled for the channel and currency.
- Use provider-hosted checkout/authorization and verify server-side.
- Keep a provider adapter interface so Flutterwave or a bank/MMO partner can be added later without changing wallet/ledger business rules.
- Build capability registry by country, currency, method, minimum/maximum, settlement currency, fee schedule, refund support and payout support.
- Do not assume Paystack supports every country/currency or that displayed currency is settlement currency.
- Keep customer payment collection, provider settlement, seller payout and buyer wallet cash-out as distinct provider operations.
- Paystack split payments/subaccounts can split a transaction to platform and vendor accounts, but immediate provider split settlement may conflict with Everneed's delivery hold, refunds, rolling reserves, hub consolidation and multi-seller allocations. Do not enable automatic split settlement for marketplace orders until timing, fees, refund/reversal, subaccount eligibility and legal custody are verified. The initial architecture should collect through an approved marketplace merchant arrangement, journal the obligations and release seller payouts only when eligible, subject to legal/provider approval.
- Maintain sandbox and live keys separately; never copy a live key into staging.

### Provider event lifecycle
- Verify webhook HMAC on raw body.
- Durably insert a sanitized event into inbox before processing.
- Verify transaction through provider API; match reference, attempt, order, user, amount, currency, status and expected merchant account.
- Idempotently post settlement journal and mark inbox processed.
- Quarantine mismatched, unknown, duplicate, late or out-of-order events.
- Retry transient failures; never retry a terminal decline as if it were a new payment.
- Reconcile daily provider transaction, settlement, fee, refund, transfer and bank statement data.

## 15. Currency, tax and international expansion

- Store country, presentment currency, provider charge currency, settlement currency and accounting currency separately.
- Freeze FX quote/rate/source/time/markup at checkout; use a trusted provider or approved FX source. Do not reprice after payment.
- FX conversion is an explicit journalled trade with source and destination currency legs, rate, spread and realized/unrealized gain/loss.
- Currency exponent is currency-specific; NGN/KES often use zero decimal minor units in payment APIs, while other currencies may differ. Confirm provider-specific amount units; never assume exponent=2.
- Taxes must be configured by country/state/product category and seller legal status. Tax treatment, withholding, VAT collection/remittance and invoices require local tax advice.
- International launch requires local payment rails, payout capability, tax, consumer protection, FX, privacy and marketplace rules for each country. Do not simply switch the currency dropdown.

## 16. Risk, buyer verification and account activation

Risk controls should be progressive and proportionate:
- Level 0: browse; minimal personal data.
- Level 1: account + verified email/phone for normal checkout.
- Level 2: OTP delivery phone + address validation for COD/high-risk/first high-value order.
- Level 3: enhanced identity/provider checks for suspicious activity, high-value limits, wallet cash-out or applicable law.
- Seller level: store owner identity, business status/individual path, bank beneficiary match, required product/sector licences.
- Admin level: maker-checker and privileged-access MFA.

Signals: order velocity, repeated failed cards, mismatched account name, new device, unusual address, coupon/referral rings, chargeback history, high COD return rate, bank change immediately before payout and abnormal withdrawal timing. Risk decisions need explainable reason codes, expiry, human appeal and audit.

## 17. Reconciliation and financial close

Daily automated matching:
1. Paystack transactions vs Everneed payment attempts/orders.
2. Provider settlement batches vs bank credits and provider fees.
3. Seller payout requests vs provider transfer statuses and bank debits.
4. Refund records vs provider refunds and original payments.
5. COD cash recorded by courier/hub vs cash remitted to Everneed/bank.
6. Delivery partner invoices vs shipping quote allocations.
7. Promotion budget, coupon redemption, cashback award and reversal totals.
8. Journal trial balance by currency and entity.

Exceptions include missing provider settlement, unmatched bank credit, duplicate provider reference, amount/currency mismatch, partial transfer, payout reversed, refund not received, COD shortfall, unbalanced journal and orphaned wallet movement. Exception resolution requires reason, evidence, actor and compensating journal; never delete the exception.

## 18. Implementation roadmap

### FIN-00 — Audit and freeze existing contracts
- Inspect full definitions and ACL/RLS of payment, confirm, refund, payout, coupon, delivery and ledger RPCs.
- Document all current clients and provider webhook paths.
- Protect cards/token material and verify no client can read raw authorization codes.
- Map legacy `ledger_entries` and `seller_orders` to new journal without double-posting.
- Exit: signed-off data dictionary, transition map, threat model and no breaking changes.

### FIN-01 — Double-entry journal foundation
- Add accounts, journal transactions, journal lines, idempotency, balance checks and reversal references.
- Add posting RPCs restricted to service role/trusted backend and immutable-line guard.
- Add per-currency trial-balance tests and replay-safe migration.
- Exit: every test event balances; client roles cannot post or edit journal.

### FIN-02 — Payment attempt and collection hardening
- Formalize payment intent/attempt, provider adapter, channel/currency matrix and webhook inbox.
- Add bank transfer/USSD/hosted checkout lifecycle, timeout and late-payment handling.
- Test duplicate/out-of-order webhook, wrong amount/currency, wrong order, pending, decline, timeout and retry.
- Exit: every payment reconciles to exactly one order and one journal posting.

### FIN-03 — Multi-store allocation and seller payable
- Create immutable per-seller payment allocations and pending seller payable.
- Allocate commission, seller/platform discounts, gateway fee, tax and shipping.
- Add seller reserves and release rules by direct/hub route and partial delivery.
- Exit: parent order total equals all allocation components; no seller paid early.

### FIN-04 — Store wallet and seller withdrawals
- Build seller financial dashboard, verified payout destination, withdrawal request, maker-checker, provider transfer, status reconciliation.
- Exit: idempotent payout lifecycle; failed transfer restores reserved amount once; seller statements reconcile.

### FIN-05 — Buyer credits and payment instruments
- First release promotional/refund credits only after legal review; keep cash top-up/withdrawal disabled.
- Add credit lots, spend reservation, refund-to-credit opt-in and expiry/reversal.
- Tokenize saved cards safely; consent, delete and revoke.
- Exit: no negative promo balance; all credits traced to source and funding entity.

### FIN-06 — Coupons, promotions and cashback
- Build rules, funding allocation, campaign budget, redemption reservation, per-user cap and cashback lots.
- Exit: simultaneous use cap is atomic; promotion costs reconcile; refund reverses discounts/rewards correctly.

### FIN-07 — Shipping and hub finance
- Build zone/rate-card quote, volumetric weight, multi-seller parcel allocation, handling and courier payable.
- Support route-specific direct/hub fee, free shipping sponsor, COD collection and reverse logistics.
- Exit: buyer quote is immutable; every charge is allocated to courier/seller/Everneed correctly.

### FIN-08 — Refunds, disputes and chargebacks
- Gateway refund adapter, partial line allocation, seller debit/reserve, cashback reversal and evidence case.
- Exit: provider refund, order status and ledger balance agree under duplicate/retry cases.

### FIN-09 — Reconciliation, reporting and audit
- Provider settlement imports, bank matching, COD reconciliation, exception workbench and period close.
- Exit: trial balance matches provider and bank records; unresolved exceptions visible.

### FIN-10 — Regulatory partner and wallet activation
- Obtain legal advice and written provider/partner approval for stored-value product, safeguarding, KYC/AML, limits, terms and complaints.
- Activate cash wallet/top-up/withdrawal only after approvals, partner contract and independent security review.
- Exit: compliance sign-off and partner UAT; otherwise remain on credits-only design.

### FIN-11 — Controlled beta and expansion
- Staff/internal beta, selected sellers, low order limits, staged cohorts, daily reconciliation and rollback plan.
- Country-by-country certification before expanding currency, collection, settlement or wallet features.

## 19. Release gates

Never enable a feature because its UI exists. Each capability needs:
- Database migration and rollback/replay strategy.
- RLS, grants, SECURITY DEFINER search_path and service-only posting review.
- Unit, SQL integration, concurrency, idempotency and provider sandbox tests.
- Reconciliation evidence.
- Seller/buyer disclosure and support procedures.
- Admin permissions and audit trail.
- Staging acceptance and owner approval.
- Separate production approval.

## 20. References and regulatory caution

- CBN's public Payment Service Providers register lists licensed categories and providers, including switching/processing and mobile money operator categories.
- CBN's 2021 Mobile Money Services Framework states that Mobile Money Operators are to be licensed and lists wallet creation/management and e-money issuance among permissible MMO activities.
- Paystack's documentation describes subaccounts and transaction splits as mechanisms to split transaction settlement between a merchant and vendors. This is not by itself proof that Everneed may hold, pool, issue stored value or delay settlement as a regulated escrow service.
- Paystack's refund guidance notes provider transaction charges may not be refunded; fee treatment must be represented in refund economics.

This is an engineering/product architecture, not legal, tax or regulatory advice. Before offering cash wallet balances, pooled funds, P2P transfer, stored value or cash-out, obtain Nigeria-specific counsel and written confirmation from the regulated payment partner/CBN as applicable. A marketplace seller settlement ledger and a regulated consumer e-money wallet are different products.

## 21. Source links

- CBN Payment Service Providers register: https://www.cbn.gov.ng/PaymentsSystem/PSPs.html
- CBN Framework and Guidelines on Mobile Money Services in Nigeria (2021): https://www.cbn.gov.ng/Out/2021/CCD/Framework%20and%20Guidelines%20on%20Mobile%20Money%20Services%20in%20Nigeria%20-%20July%202021.pdf
- CBN Payments System Supervision: https://www.cbn.gov.ng/PaymentsSystem/index.html
- Paystack Split Payments: https://paystack.com/docs/payments/split-payments/
- Paystack Multi-split Payments: https://paystack.com/docs/payments/multi-split-payments/
- Paystack Subaccounts API: https://paystack.com/docs/api/subaccount/
- Paystack Refund guidance: https://support.paystack.com/en/articles/2127106


## 22. Additional staging audit observations (19 Nov 2026)

- RLS is enabled on the existing `cards`, `ledger_entries`, `offers`, `orders`, `payouts`, `refunds`, `seller_orders` and `store_payments` tables.
- `cards` has owner-read and owner-delete policies; no owner insert/update policy was found. Current Paystack Edge Function uses service-role access to read and upsert card authorization tokens. The owner-read policy must be considered together with the actual SQL table grants; the token column should be separated from user-visible card metadata or protected by a server-only table/view boundary.
- `offers` has public SELECT only for active automatic offers where `code IS NULL`, and admin management policy. Coupon lookup by code is performed server-side in the Paystack function.
- `orders` has authenticated owner/admin read and admin update policies; `payouts` are owner-store/admin readable; `refunds` are readable by buyer, relevant seller and admin; `ledger_entries` are owner-store/admin readable; `store_payments` are owner-store/admin readable.
- The current Paystack Edge Function's `create` path supports order creation for card, bank, WhatsApp and pay-on-delivery labels, but the actual `init/charge` path is restricted to snapshot-backed card orders. A full bank-transfer/USSD initiation and verification lifecycle is therefore not yet proven by this function.
- Existing coupon pricing selects the single highest-saving offer; campaign funding, seller-level allocation, per-customer caps, redemption reservation and cashback are not represented in the current `offers` contract.
- Existing currency mapping uses Paystack currency codes for selected countries, while the FX display/settlement model is not yet a fully approved country-provider capability matrix. No new international currency should be enabled based solely on a client display currency.
- No schema migration for wallets or journal was applied as part of this architecture document. The next code change should be FIN-00 audit and FIN-01 journal design/migration after full definitions, trigger effects, existing ledger semantics and migration replay have been reviewed.


## 23. FIN-00 function-level audit — verified gaps requiring replacement or wrapping

The following staging function definitions were inspected on 19 November 2026. These are legacy contracts; do not treat them as the final finance implementation.

### Payment confirmation
- `private.confirm_payment_core(order, reference, actor)` locks the order, marks it paid, releases eligible seller orders, inserts a legacy `sale` and `commission` ledger entry for each seller order, sends notifications and syncs order status.
- It does not post a balanced double-entry journal, provider settlement receivable, gateway fee, seller reserve, shipping/courier allocation, promotion funding or cashback award.
- New payment-attempt settlement validates provider reference, transaction ID, immutable checkout snapshot hash, order/user ownership, amount, currency and exponent; it quarantines mismatches as `reconciliation_required`. Preserve these controls when extending the payment flow.

### Payout
- `public.record_payout(store, amount, reference, period)` is an admin-only manual record operation. It checks the legacy `store_balance`, inserts a `payouts` row and a negative legacy ledger entry. It does not initiate a provider transfer or prove bank settlement. Do not label it an automated withdrawal system.
- Replace this with a request/approval/provider-transfer/reconciliation lifecycle. The old function may remain for controlled historical corrections only after permissions and audit are reviewed.

### Refund
- `public.refund(order, seller_order, amount, reason)` currently inserts a refund as `processed` immediately and posts legacy seller/commission ledger reversals. It does not call Paystack's refund API or await provider confirmation. This is not proof that the buyer received money.
- Separate refund decision from provider refund execution. Use requested/approved -> provider_pending -> succeeded/failed/reversed states, idempotency and provider verification. Only then mark the buyer-facing refund completed.

### Coupon redemption
- `public.redeem_offer(id)` atomically increments a campaign's global `used` counter if active and under its global limit. It does not by itself enforce per-buyer caps, budget reservations, seller/platform funding splits, expiry by lot or rollback/reversal policy. Couple redemption to order payment state and campaign budget in a transaction.

### Checkout and quote
- The immutable card checkout snapshot captures items, variants, pricing provenance, merchandise allocations, delivery fee and total. It currently records discount allocation proportionally across items; the new promotion engine must replace that generic allocation with funding-aware seller/platform allocation while preserving deterministic rounding.
- Current edge function creates orders for several payment labels, but its payment attempt `init/charge` route only permits `pm='card'`. Do not present bank transfer/USSD as enabled until their provider intent, reference matching, pending/expiry and reconciliation lifecycle is implemented.
- Current order creation accepts a single coupon and current offer selection chooses the best saving. It does not implement the complete campaign, multi-seller co-funding, per-user cap, cashback or shipping sponsorship model.

### Staging security notes
- RLS is enabled for the inspected financial tables. Owner/admin read policies exist for seller ledger, payouts and store payment records; buyer/seller/admin refund read policy exists; offers expose only active automatic offers to public SELECT.
- The `cards` table has an owner-read/delete policy while its provider token is consumed through service-role edge code. Verify the actual table/column grants and ensure card token material is never returned by a general card-list endpoint. The card authorization token is not a PAN/CVV, but is still a reusable credential and must be treated as secret.
- No wallet/journal migration has been applied. Do not create a buyer/store balance by updating a mutable numeric field.

### FIN-00 exit checklist
- Capture the exact definitions, ACL, search_path, trigger effects and caller expectations for `store_balance`, `ledger_guard`, `confirm_payment`, `cancel_order_for`, `record_payout`, `refund`, `redeem_offer`, delivery confirmation and payment recovery.
- Model legacy ledger entries and seller earnings without double-posting historical orders.
- Add regression tests for manual payout misuse, false-positive refund completion, coupon cap races and seller release timing.
- Only then add FIN-01 journal migrations on the feature branch, run migration replay/CI, and apply to staging through the controlled migration workflow.




## 24. FIN-00 completion — cancellation, delivery, recovery, triggers and ACL (19 Nov 2026)

The remaining function-level staging review is complete for the named paths. This closes the FIN-00 inspection checklist; it does not mean the financial capabilities themselves are implemented.

### Cancellation and partial seller-order refunds

- `public.cancel_order_for` is a SECURITY DEFINER wrapper with a fixed `public` search path and is executable by `service_role` (not by ordinary authenticated/anonymous clients in the inspected ACL). It delegates to `private.cancel_order_core`.
- `private.cancel_order_core` locks the parent order, checks buyer ownership unless the trusted caller supplies the admin path, prevents buyer cancellation after a seller has started, iterates eligible seller orders, restores variant or legacy stock, and marks the parent order cancelled.
- `private.cancel_so` restores inventory and, when a paid/released seller order is cancelled, computes a proportional paid share, inserts a refund row with status `approved`, reverses legacy sale/commission entries by changing their status, changes the parent payment status, and notifies the buyer that a refund is on its way.
- This cancellation path does **not** itself execute a Paystack refund. An `approved` refund row and a reversed seller ledger entry are not evidence of provider refund completion. The new refund orchestrator must pick up approved requests, call the provider idempotently, verify the provider result and only then complete the customer-facing refund state.
- The proportional calculation is a legacy fallback, not a sufficient allocation rule for the future system. It does not yet fully model item-level funded discounts, seller/platform promo shares, shipping refunds, tax or gateway fee treatment.

### Delivery confirmation and seller release

- `public.mark_delivered(order, code)` is SECURITY DEFINER with an empty search path and is executable by authenticated users. It requires a signed-in user, permits admin or the owning seller only for direct-route seller orders, rate-limits code attempts, checks the delivery code and calls `private.deliver`.
- `private.deliver` marks eligible seller orders and the parent order delivered, writes/updates the delivery proof record, and notifies/audits the event. It does not initiate a seller bank transfer or provider transfer.
- Payment confirmation sets `seller_orders.released=true` and an acceptance deadline immediately after payment confirmation. This flag is an operational release/acceptance signal in the legacy workflow; it must not be interpreted as funds being withdrawable or paid to the seller.
- FIN-01 and FIN-02 must define separate states for seller order acceptance, fulfilment completion, earnings pending, reserve, earnings available, withdrawal processing and provider-confirmed payout. Delivery is an input to the settlement policy, not a transfer instruction by itself.

### Payment recovery and trusted execution boundary

- Stale payment attempts use bounded recovery claims with `FOR UPDATE SKIP LOCKED`, per-attempt lease tokens, expiry, attempt limits and dead-letter/reconciliation states. Provider-event recovery has a similar leased and bounded retry model.
- Recovery claim/finish functions and `settle_verified_payment_attempt` are SECURITY DEFINER with an empty search path and service-role-only execute grants in the inspected ACL. Preserve this server-only boundary.
- `get_payment_attempt_recovery_context` is also service-role-only and returns only the fields needed by the recovery worker. Do not expose provider recovery context to buyer/seller clients.
- `settle_verified_payment_attempt` checks the immutable snapshot hash/version, order and user ownership, provider reference, provider transaction ID, exact minor-unit amount, currency and exponent. It treats duplicate same-transaction success idempotently and quarantines conflicting references, second successful charges, terminal-attempt success and paid-after-cancellation cases. This is a strong control and must remain intact when journal posting is added.

### Triggers, immutable legacy records and ACL observations

- Existing financial/order triggers inspected: `private.ledger_guard` protects `ledger_entries` against DELETE and edits to amount, kind, store, order, seller-order and currency; `orders_checkout_snapshot_immutable` protects the checkout snapshot; order and seller-order guards enforce their lifecycle invariants.
- The legacy ledger guard permits status transitions used by the old workflow (for example reversal/availability) while preventing changes to core amount/reference fields. The new journal must be stricter: posted journal headers and lines are immutable; corrections use compensating postings.
- The inspected execute grants place internal `private` helpers behind the postgres owner. Trusted payment confirmation, cancellation, delivery and recovery wrappers have role-specific execute grants; do not widen them as part of finance work without an explicit security test and least-privilege review.
- The inspected SECURITY DEFINER wrappers use fixed search paths (or an empty path for recovery/delivery); every new privileged RPC must use an empty search path and schema-qualify referenced objects.

### FIN-00 outcome

**Verified complete — audit only.**

The named legacy functions, triggers and execute ACLs have now been inspected. Known constraints to carry forward:

1. A payment-confirmed seller order is not a paid-out seller order.
2. An approved refund is not a provider-confirmed refund.
3. A delivery confirmation is not a seller transfer.
4. Legacy ledger reversals and proportional refund calculations are not a complete multi-seller accounting model.
5. Existing payment attempt validation and leased recovery protections must be preserved.

## 25. FIN-01 design contract — append-only double-entry journal

FIN-01's initial accounting foundation already exists in `supabase/migrations/033_double_entry_finance_journal.sql` and is present in Everneed staging. The current task is to audit and harden that implementation before integrating it with checkout, refunds or seller settlement. Do not create a duplicate journal migration.

### Initial schema boundary

- `private.financial_accounts`: stable account identity, account code, account class, owner scope, currency, normal balance, status and metadata. Unique account identity by legal entity + owner scope + purpose + currency. Do not create cross-currency accounts.
- `private.journal_transactions`: event ID, event type, source system, source reference, idempotency key, currency, actor, effective/posted timestamps, status and metadata hash. A unique idempotency constraint prevents the same business event from posting twice.
- `private.journal_lines`: transaction ID, account ID, currency, debit_minor and credit_minor, optional order/seller-order/payment/refund/payout references and a safe description. Amounts are positive BIGINT minor units; each line has exactly one non-zero side. Zero-value lines are prohibited.
- Balance snapshots are deliberately deferred. They can be introduced as rebuildable projections only after the journal posting contract is stable.

### Posting invariants

1. Every posted transaction has at least two lines and total debits equal total credits for its single currency.
2. Account currency, transaction currency and line currency must match exactly.
3. A transaction is created in a non-posted state, its lines are inserted through a private posting operation, and it becomes posted only after the balance check succeeds in the same database transaction.
4. A deferred constraint trigger or equivalent database-enforced posting gate must reject a posted transaction that has no lines or is unbalanced. A client-side check is not sufficient.
5. Posted transaction headers and lines cannot be updated or deleted. Reversal creates a new transaction with opposite entries and a reference to the original.
6. Idempotency is enforced by a unique key scoped to the source/event identity. Reuse with a different amount, currency, source reference or payload hash is an error, not a silent replay.
7. No direct INSERT/UPDATE/DELETE grants are given to anon or authenticated users. Only a narrowly scoped private posting function/service role can post; read access is exposed through owner-scoped safe views/RPCs later.
8. SECURITY DEFINER functions use `SET search_path TO ''`, fully qualify all relations/functions, validate the actor/source and reject unsupported currency/account combinations.
9. Journal posting must not automatically make seller funds withdrawable. Settlement policy and payout transfer are separate milestones.
10. Do not backfill historical legacy ledger rows as if they were new live transactions. FIN-01 should create the journal and tests; a separately reviewed migration plan must define opening balances and historical cutover without double-posting.

### Initial account families

Seed only the minimum NGN accounts required for controlled tests: provider clearing receivable, bank settlement asset, seller payable pending, seller payable available, marketplace commission revenue, payment processing expense, refunds payable and a controlled reconciliation/suspense account. The exact legal entity and account owner mapping must be explicit. Do not seed buyer cash-wallet liabilities or enable buyer top-ups in FIN-01.

### Required FIN-01 regression tests

- Balanced two-line and multi-line postings succeed.
- Unbalanced posting, single-line posting, zero/negative amount, mixed currency and account/currency mismatch fail.
- Duplicate idempotency with identical payload returns the original posting; changed payload is rejected.
- Posted headers/lines cannot be edited or deleted; compensating reversal succeeds and links to the original.
- anon/authenticated direct table writes and posting RPC execution are denied.
- service-role/private posting succeeds only for valid accounts and a permitted event type.
- Concurrent duplicate posting produces exactly one posted transaction.
- Existing checkout, payment-attempt, recovery, legacy ledger, seller-order and refund tests remain unchanged and pass.
- Migration replay on a clean database and staging apply both succeed without touching production.

**FIN-01 status:** initial migration 033 and regression test 033 already exist in the branch; staging migration history confirms version `033` (`double_entry_finance_journal`) is applied. Staging currently contains 96 seeded finance accounts and zero journal headers/lines, so no business transactions have been posted to this journal. The test `supabase/tests/033_double_entry_finance_journal_checks.sql` was executed against staging in a transaction and completed without an error; its fixtures were rolled back. Continue with a focused hardening review and expanded tests before any production integration.


## 26. FIN-01 implementation audit — migration 033 (19 Nov 2026)

The existing FIN-01 implementation was located in the current branch and checked against staging; it predates this documentation-only continuation.

### Verified staging state

- Migration history includes version `033`, name `double_entry_finance_journal`.
- `private.finance_accounts`, `private.finance_journals` and `private.finance_journal_lines` exist in staging.
- The chart currently seeds 16 account codes across six currencies (96 account rows). This is an account catalogue, not evidence that Paystack collection/settlement is enabled in all six currencies.
- Staging currently has zero journal headers and zero journal lines. The journal has not yet been wired into payment, refund, delivery, payout or wallet operations.
- Service role has SELECT but not INSERT/UPDATE access to the three private finance tables. Anon and authenticated have no SELECT access. Posting and reversal are exposed through service-role-only RPCs.
- The existing migration's test 033 was executed against staging inside its own transaction; it completed without an SQL error and rolled back its test journal entries.

### What migration 033 already does

- Creates private finance accounts, journal headers and journal lines using integer minor units.
- Restricts currencies to NGN, GHS, KES, ZAR, GBP and USD at the account/journal level.
- Posts through `public.post_finance_journal`, a SECURITY DEFINER function with an empty search path and service-role-only EXECUTE grant.
- Uses an advisory transaction lock and a request hash for idempotent replay; rejects changed payloads under the same source/idempotency identity.
- Requires at least two lines, positive integer amounts, configured account codes for the journal currency and equal debit/credit totals before returning.
- Prevents updates/deletes to journal headers and lines; corrections use a separate reversal RPC that copies the original lines with opposite directions.
- Exposes private tables to service_role for SELECT only; it does not grant direct service-role table writes.

### Hardening items before business integration

1. Add explicit length and format bounds for source type, source ID, idempotency key, currency and line-level references; keep error messages safe and bounded.
2. Add a database-level posted-state/balance invariant or formally document why the no-direct-write privilege boundary plus single posting RPC is the enforced invariant. Test that no alternate privileged path can insert incomplete headers/lines.
3. Extend tests for mixed/unsupported currency, missing account code, invalid JSON line shape, bigint overflow, zero/negative amount, too many lines, empty line arrays and metadata type validation.
4. Add explicit tests for reversal of missing journal, reversal-of-reversal, duplicate reversal, changed reversal key/reason, immutable line updates/deletes and direct-write denial for every client role.
5. Review whether all six seeded currency catalogues should remain, and document that account seed presence is not a provider/country capability flag.
6. Add a safe journal inspection RPC/view for authorized finance admins later; do not grant direct client SELECT on private journal tables.
7. Add a controlled integration design for payment success, provider fee, seller pending payable, delivery release, seller reserve, refunds and payout transfer. Never post seller payable as available merely because an order is paid or delivered.
8. Define legacy cutover/opening-balance policy before backfill. Never replay historical orders into the new journal without a source-event mapping and double-posting guard.

**FIN-01 implementation status:** initial schema and RPCs exist and are staged; integration into the marketplace financial lifecycle and the hardening items above remain in progress. No production migration or live money movement was performed.




### Expanded FIN-01 regression evidence — 19 Nov 2026

The existing `supabase/tests/033_double_entry_finance_journal_checks.sql` was expanded and re-executed against staging after the change. The transaction completed without an SQL error and rolled back its fixtures. Additional negative cases now cover unsupported currency, unknown account, zero/negative amount, invalid direction, non-array line payload, non-object metadata, more than 1,000 lines, reversal of a reversal, missing original journal, and UPDATE/DELETE attempts against posted journal lines and headers. The test continues to check service-role-only posting/reversal RPCs, client read denial, no direct service-role table writes, balanced posting, idempotent replay, changed-payload rejection and exact reversal entries.

This is staging regression evidence for the existing journal foundation. The CI workflow also runs test 033 after applying all migrations to its local Supabase database; the latest test commit still needs its own CI result before it is marked CI-verified.




## 27. FIN-01 input hardening — migration 034 (19 Nov 2026)

Added `supabase/migrations/034_finance_journal_input_hardening.sql` as a forward-only function replacement; migration 033 remains unchanged because it is already recorded in staging history.

The hardened service-only posting RPC now enforces:

- Source type: 1–64 characters, lower-case event identifier pattern.
- Source ID and idempotency key: 1–160 characters, trimmed, with control characters rejected.
- Currency: canonical uppercase supported code; lowercase/non-canonical input is rejected rather than silently normalized into a different idempotency identity.
- Description: 1–240 characters, trimmed.
- Metadata: JSON object only, maximum 16 KiB serialized.
- Lines: JSON array, 2–1,000 entries, maximum 512 KiB serialized.
- Each line must be an object containing only approved keys; account code and minor-unit amount have bounded formats, and optional store/order/seller-order references and descriptions have explicit length/type limits.
- Individual amounts remain positive integer minor units and must fit PostgreSQL BIGINT; overflow is rejected.

Test file `supabase/tests/034_finance_journal_input_hardening_checks.sql` adds negative cases for oversized source fields, idempotency keys, descriptions, metadata and line payloads, unexpected line keys, overlong references and BIGINT overflow, plus a valid bounded posting. The CI workflow now runs test 034 and the migration-order allow-list includes migration 034.

**Rollout status:** code and tests are committed to the draft feature branch. Migration 034 has not yet been applied to staging; wait for the full database workflow and inspect its result before applying. No journal business-event integration, wallet funding, payout automation or production deployment is included in this hardening migration.


The same limits now cover `reverse_finance_journal`: 1–160 character idempotency key, 1–240 character reason, no control characters, object metadata capped at 16 KiB, with the original-journal existence and no-reversal-of-reversal rules preserved. Test 034 includes negative and positive reversal cases.


## 28. FIN-01 staging rollout and FIN-02 accounting integration gate — 19 Nov 2026

### FIN-01 current verified state

- Latest PR head `01ee1c0811f07f3243e88c767f176f25b8b4c917` passed the full build workflow `44546455256`: database tests, app checks/token validation and Android APK build all succeeded.
- Migration `034_finance_journal_input_hardening.sql` was applied to the Everneed **staging** project only. The staging migration ledger records it as `20261119145018 / finance_journal_input_hardening`.
- The exact staging function signatures are `public.post_finance_journal(text,text,text,text,text,jsonb,jsonb)` and `public.reverse_finance_journal(uuid,text,text,jsonb)`.
- Both functions are SECURITY DEFINER with an empty search path. Staging privilege checks confirm EXECUTE is denied to `anon` and `authenticated`, and granted to `service_role`.
- `supabase/tests/034_finance_journal_input_hardening_checks.sql` was executed against staging and completed successfully. Its test transaction rolled back; no test postings were retained.
- Production remains untouched. PR #32 remains draft/open/unmerged.

### Schema naming correction

The implemented staging schema is `private.finance_accounts`, `private.finance_journals` and `private.finance_journal_lines`, with account identity keyed by `account_code + currency`. Earlier design text in section 25 that refers to `private.financial_accounts`, `private.journal_transactions` and `private.journal_lines` describes a conceptual model, not the deployed object names. The migration and staging schema are authoritative for implementation.

### FIN-02 — payment-event accounting integration contract

Do not wire accounting by simply adding a journal call to the existing payment-confirmation function. First implement a separately tested, idempotent event-to-journal mapper behind the trusted service boundary. The mapper must consume only verified persisted business state and must not accept client-supplied totals or arbitrary account codes.

| Event | Required accounting intent | Release restriction |
|---|---|---|
| Paystack payment verified | Debit provider clearing for gross collected; credit seller payable pending, platform commission revenue, delivery/handling liabilities or revenue, and any other explicitly allocated components so the journal balances to the verified gross | Never make seller payable available at collection |
| Provider fee confirmed/estimated under an approved fee policy | Debit payment-processing expense; credit provider clearing/fee payable according to the provider settlement statement | Do not invent a fee from a generic percentage; use provider-confirmed fee or a versioned, explicitly labelled estimate |
| Delivery milestone and reserve expiry | Reclassify eligible seller payable pending to seller payable available; separately allocate delivery partner payable and platform delivery revenue only from the immutable checkout/shipping allocation | Delivery confirmation alone is not a bank transfer; hold return/dispute reserve |
| Refund requested/approved | Record operational state only; no cash-out or completed-refund journal merely because an admin approved it | Await provider acceptance/confirmation or documented credit-to-account policy |
| Provider refund confirmed | Debit the correct original seller/platform/fee liability or approved refund expense allocation; credit provider clearing/refund payable as appropriate, linked to original payment and seller allocations | Partial refunds require line-level allocation; do not use full-journal reversal for partial amounts |
| Chargeback opened / won / lost | Record dispute exposure and later confirmed debit/credit with source references | Never duplicate the original refund or payment reversal |
| Seller payout requested | Move available seller payable to payout-in-transit only when an actual transfer is initiated and the provider returns a durable transfer reference | A request or admin approval is not a paid payout |
| Seller payout confirmed | Debit payout-in-transit/seller payable and credit bank/provider cash clearing based on confirmed transfer | Failed/reversed transfer must restore the correct seller payable |
| Reconciliation adjustment | Post only a reviewed, reason-coded, evidence-linked adjustment with dual approval above configured thresholds | No direct edits to posted journals or balances |

### Required source-of-truth and idempotency rules

1. Every event must reference a persisted payment attempt/provider event, order, seller order, refund or transfer record. Store the immutable source ID, event type, provider reference/transaction ID, currency, amount minor units and snapshot/version reference.
2. Reuse the payment-attempt settlement safeguards: verify provider reference, provider transaction ID, checkout snapshot hash, order/user ownership, amount, currency and currency exponent. A mismatch remains quarantined as `reconciliation_required`; it must not post money.
3. Use a stable event identity and deterministic idempotency key. A replay with identical payload returns the original journal; a changed payload under the same identity is an error and goes to reconciliation.
4. Build allocations from the immutable checkout snapshot and persisted seller-order amounts. Reconcile line totals to the provider-verified gross exactly in integer minor units. Deterministic rounding residuals must be assigned by a documented rule and tested.
5. Separate provider collection from provider settlement. A successful customer charge creates a provider-clearing asset/receivable; bank settlement is a separate confirmed event.
6. Keep legacy `ledger_entries` and the new journal in a controlled dual-write/compare period only after an explicit mapping and rollback plan. Do not backfill historical orders or silently post both legacy and new entries as independent revenue.
7. Do not create buyer cash-wallet liabilities, buyer top-ups, transfers, or cash-out in FIN-02. Those remain legally gated. Promotional credits/refund credits require their own approved liability and expiry/reversal policy.
8. Add tests for duplicate webhook delivery, recovery-worker replay, amount/currency mismatch quarantine, multi-seller split allocation, discount allocation, provider fee, zero delivery fee, hub/direct delivery, partial/full refund, chargeback, reserve release, payout pending/success/failure and concurrent event processing.
9. Add a reconciliation report that compares provider transaction gross, provider fees, net settlement, journal clearing balance, refunds, chargebacks and bank settlement. Differences must remain visible as exceptions; never auto-plug suspense without approval.

### FIN-02 exit criteria

- A reviewed event/account mapping document exists, including all account directions and multi-seller examples.
- A pure allocation function and SQL/RPC integration tests prove exact integer balance and deterministic rounding.
- Provider events are durably recorded and replay-safe; quarantined events cannot post.
- Journal entries reconcile to payment attempts and immutable checkout snapshots.
- Seller pending/available/reserved/processing/paid amounts reconcile by store and currency without using mutable dashboard balances as authority.
- Refund and payout statuses are tied to provider-confirmed state, not admin labels.
- Staging sandbox success, decline, pending, duplicate webhook, refund and transfer simulations pass before any customer-facing rollout.
- Finance/admin visibility and audit logs are in place before enabling operational payouts.

**Current FIN-02 status:** design contract only. No payment-confirmation, refund, seller-release or payout function has been modified to post to the journal. No Paystack refund/transfer request or live money movement has been performed.


## 29. FIN-02 implementation audit — checkout allocation blocker — 19 Nov 2026

### Verified implementation details

The live staging definitions and branch checkout migration were inspected before designing the journal integration:

- `public.create_order_with_snapshot(...)` creates schema-version-1 immutable snapshots. It records currency/exponent, FX provenance, gross/net merchandise minor units, allocated discount, delivery fee, total, and per-item gross/net refundable amounts.
- The snapshot does **not** currently include a frozen per-item commission amount, seller-payable amount, commission policy version, or seller-level financial allocation summary.
- The current checkout migration creates `seller_orders.subtotal`, `commission` and `earning` from base-price values. In `create_order`, `order_item_fees.commission_amount` is also calculated from the base line amount. The buyer checkout total is separately converted using the effective rate.
- Consequently, those seller-order and commission values cannot safely be posted as amounts in the buyer's checkout currency. The problem is especially material for non-NGN orders.
- The snapshot function currently sets the currency exponent to 2 for NGN, GHS, KES, ZAR, GBP and USD. FIN-02 must use the persisted snapshot exponent and exact minor-unit amounts; it must not infer a different exponent from a generic currency lookup.
- Existing `settle_verified_payment_attempt` validates the provider reference, transaction ID, payment-attempt ownership, order ownership, immutable snapshot hash/version, amount, currency and exponent. It quarantines mismatches as `reconciliation_required`. These checks are mandatory prerequisites and must remain unchanged in meaning.

### Required checkout allocation enhancement before posting

Add a forward-only checkout snapshot version that persists, at quote/order creation time:

1. The applied commission rate and commission-policy version for every order item.
2. Per-item merchandise gross, discount allocation, net merchandise amount, commission amount and seller payable, all as integer minor units in the order currency.
3. Seller-level grouped totals by store: merchandise net, commission, seller payable and any seller-funded promotion contribution.
4. Platform-funded promotion amount and delivery allocation, separated from seller merchandise payable.
5. A deterministic rounding policy: item allocations use integer minor units; per-seller and order totals must reconcile exactly; the final ordered item receives any documented residual.
6. Pricing provenance (FX rate/source/time, markup, policy version) already present in the snapshot, plus a financial-allocation policy version.
7. An explicit treatment of tax, if applicable, and a hard failure if the order includes an amount that cannot be attributed to a supported account/allocation.

The allocation must be computed from server-authoritative product/order-item fee rows and persisted seller/store ownership, not from browser payloads. The snapshot remains immutable after creation. Existing schema-version-1 orders must not be silently reinterpreted or retroactively journaled using today's commission rules.

### FIN-02 revised sequence

- **FIN-02A — Allocation snapshot:** implement schema-version-2 checkout snapshot with frozen seller/platform allocations and deterministic integer rounding; regression-test single seller, multiple sellers, mixed commission rates, official store zero commission, discounts, delivery fee, FX conversion, zero/negative edge cases and rounding residuals.
- **FIN-02B — Pure accounting mapper:** map only a verified payment attempt plus schema-version-2 snapshot into balanced journal lines. Validate that gross collected equals all allocations exactly. Do not write a journal if snapshot version is unsupported or any allocation is missing.
- **FIN-02C — Atomic payment settlement:** integrate journal posting with the successful payment-attempt settlement transaction only after 02A/02B tests pass. Payment state and journal posting must commit or roll back together. Preserve duplicate webhook/recovery idempotency and mismatch quarantine.
- **FIN-02D — Provider fees and bank settlement:** record provider-confirmed fee and net settlement separately from customer collection. Do not estimate fees as actual cash movement.
- **FIN-02E — Seller release, refunds and payouts:** implement separate pending/available/reserved/payout-in-transit states and provider-confirmed refund/transfer events.

### Release block

**Do not connect `private.confirm_payment_core` or `public.settle_verified_payment_attempt` to `post_finance_journal` yet.** Doing so with current schema-version-1 data or base-NGN seller-order totals risks wrong currency amounts, commission revenue and seller payable. No finance integration migration has been created or applied for this blocker. The next implementation should be FIN-02A, not a direct payment-settlement hook.


## 30. Promotion funding attribution — unresolved input to FIN-02A — 19 Nov 2026

The current `offers` catalogue stores offer type/value, minimum total, country, start/end dates and a global usage limit. It does not store a funding party, seller/store contribution, platform contribution, campaign budget reservation, per-buyer cap or redemption allocation. The checkout snapshot stores the total discount and proportional item discount allocation, but not who funded that discount.

This means a discount cannot safely be treated as a reduction of seller proceeds by default, nor can it be treated as an Everneed-funded subsidy by default. Either assumption changes seller payable and platform expense/revenue.

### Safe implementation rule

- Every schema-version-2 checkout allocation must identify the funding party for every discount minor unit: seller/store, Everneed/platform, or an explicitly funded split.
- A promotion with no persisted funding allocation is marked `funding_status = 'unallocated'` and is ineligible for automated financial journal posting.
- Do not infer funding from coupon ownership, offer creator, seller store association or the fact that the coupon is global.
- Existing schema-version-1 orders remain legacy and are not auto-posted into the new journal.
- A future migration should add explicit campaign funding rules and a redemption allocation record in the same transaction as coupon reservation/redemption. Budget reservation must be idempotent and reversible on order cancellation/payment failure.
- Until that exists, test the no-discount path and any explicitly funded promotion path separately. Do not enable coupon-backed seller settlement through FIN-02 without attribution.

This is a data-contract blocker, not a cosmetic reporting gap. FIN-02A must include a funding source and funding amount per allocation; FIN-02B must reject missing or inconsistent funding attribution.


## 31. Everneed unit economics and promotion funding policy — 19 Nov 2026

### Business objective
Everneed must be a sustainable marketplace and fulfilment operator, not a discount-funded intermediary. GMV is merchandise value passing through the marketplace; it is not Everneed revenue, cash available to spend, or profit. Seller proceeds, buyer funds, provider-clearing balances and restricted reserves are not Everneed operating income.

Everneed's commercial model may earn from distinct, disclosed value streams:
1. **Marketplace commission** on completed merchandise sales, using a versioned category/store/plan policy. The rate is a configurable business decision and must not be invented by a migration or silently changed for an existing order.
2. **Seller subscriptions and paid plans** for optional advanced capabilities, higher usage limits, premium analytics, teams, integrations and enhanced storefront tools. Basic seller access and the ability to list and fulfil within plan limits must remain usable.
3. **Delivery margin** only where Everneed actually coordinates or provides delivery, calculated from the buyer/seller delivery charge less the actual provider, rider, route and operational cost allocated to that delivery.
4. **Hub-service fees** for disclosed services such as receiving, consolidation, packaging, storage beyond an included period, special handling and oversized parcels. The charge must match a service actually supplied.
5. **Optional seller advertising and promotion products**, including sponsored placements, boosts and campaign tools. Paid placement must be labelled and measured; sellers must opt in and see the price before purchase.
6. **Optional value-added seller services** where a measurable service is delivered and the fee is disclosed in advance.

No revenue stream should be counted twice. A hub handling fee is not also delivery revenue unless two separately delivered services and their charges exist.

### Order contribution and pricing gate
For every order and seller consignment, calculate and retain a transparent contribution view before settlement: gross merchandise value and buyer-paid merchandise amount; seller-funded and platform-funded discounts separately; commission under the frozen policy; delivery charged, provider/rider cost and delivery margin; hub revenue and direct cost; payment-provider fee; applicable tax/withholding; refunds, chargebacks, insurance and other attributable costs; seller payable; platform revenue; marketing expense; and contribution after variable costs.

**Order contribution = Everneed-earned commission + earned service/delivery margin + attributable subscription/advertising revenue − payment fees borne by Everneed − delivery/hub direct costs borne by Everneed − platform-funded discount − other directly attributable costs.** Do not count seller-funded discount as an Everneed marketing expense. Do not count seller payable, GMV, buyer wallet liabilities or pending provider settlement as revenue.

A negative-contribution order or route must be visible and subject to a configurable policy: reprice the service, require an explicitly approved subsidy, route to an alternative fulfilment method, or stop checkout where lawful and commercially appropriate. Never silently make the seller absorb an Everneed operating loss. Any minimum contribution or margin threshold must be a versioned, disclosed policy and account for applicable pricing/tax rules; this specification assumes no numeric threshold.

### Promotion funding rules
- **Seller-created product/store discount:** seller-funded by default, only after the seller accepts the exact funding terms and amount.
- **Everneed-wide coupon or platform campaign:** not automatically Everneed-funded. It requires a named funding owner and reserved, approved marketing budget. It may instead be seller-funded by participating sellers or jointly funded by explicit agreement.
- **Joint campaign:** store each party's amount or deterministic percentage split, budget cap, eligible items/stores, period and redemption limits.
- **Legacy/unknown funding:** mark unallocated and prevent journal posting/settlement based on an assumed payer. Never retroactively assign funding to Everneed or sellers.
- **Cashback:** treat separately from a discount; define funder, recipient, liability/expense treatment, eligibility, expiry, reversal and budget reservation before launch.

Every promotion reservation/redemption must be atomic and idempotent. Reserve campaign budget and funding allocation with the order; release it on expiry/cancellation/payment failure; consume it only on the defined successful-payment event; reverse it with a linked compensating event on refund/chargeback. Enforce campaign/per-buyer caps, total budget, maximum discount, eligible categories/stores, minimum basket, date window and stacking rules. A global coupon is not proof that Everneed funds it.

### Operating-cost and cash protection
Maintain separately reported management reserves for (a) core operations/infrastructure (domain, hosting, Supabase, monitoring and software), (b) payroll and employee obligations, (c) hub/logistics equipment and working capital, (d) refunds/disputes/risk, (e) approved marketing, and (f) retained earnings/reinvestment. These are management allocations, not permission to treat restricted seller or buyer money as company cash. Reserve targets and release authority require management/finance approval; no fixed percentage is prescribed.

Use a rolling cash forecast including actual provider settlement timing, payout obligations, payroll, recurring infrastructure bills, hub rent/utilities, packaging inventory, rider/provider invoices, verification costs and tax obligations. Report unrestricted company cash separately from provider clearing, seller payables, buyer credits, campaign reservations and other restricted balances. Escalate forecast shortfalls before approving campaigns or new fixed costs.

### Required admin reporting and controls
The admin finance dashboard must distinguish GMV from platform revenue, gross margin from contribution, and contribution from net operating profit. Report by day/week/month, country/currency, category, seller, plan, payment method, delivery route and hub: commission/subscription revenue; delivery/hub charges, direct costs and margin; promotion spend by funder/campaign/redemption and remaining budget; provider fees/refund/chargeback losses and reconciliation exceptions; seller liabilities/payout status; operating expenses/payroll/cash forecast; order and route contribution; operating profit/loss; and reserve coverage.

Controls include role-restricted campaign budget approval; maker-checker approval for material adjustments; immutable policy/version snapshots; full audit trail; no client-supplied funding source; no campaign spend above reserved budget; and no journal entry from an unallocated discount. Thresholds, approval limits and commission schedules require owner/finance approval before activation.

### FIN-02A implementation consequences
The schema-v2 checkout snapshot must freeze the applied commission policy/version, item/store payable allocation, all discount funders and amounts, platform service/delivery allocations and rounding residual. It must not choose a commission rate, tax rule, delivery subsidy or campaign funder at runtime from mutable settings after order creation. If a cost or funding amount needed to calculate the order cannot be established, fail closed for the affected feature or route it for explicit review; do not invent a zero cost or hide a loss.

The next work is FIN-02A schema design and contract tests. This is not authorization to deploy pricing changes, enable campaigns, change seller commissions, execute transfers or alter production. Existing schema-v1 orders remain on their documented path.


## 32. FIN-02A deeper checkout function audit — 19 Nov 2026

A further read-only inspection of the staging definitions for `public.create_order(...)` and `public.create_order_with_snapshot(...)` refined the FIN-02A implementation requirements:

- The checkout function computes each seller's commission rate from persisted store override, category policy, plan discount and official-store status, then persists `order_item_fees.commission_rate` and `commission_amount`. The rate is therefore available as a source input, but the current commission amount is calculated from the pre-FX base line amount. It must not be treated as a buyer-currency amount.
- `seller_orders.subtotal`, `commission` and `earning` are also calculated from the base line amount. They are legacy major-unit values, not a safe buyer-currency journal allocation.
- The order line stores buyer-currency `line_total` rounded to two decimal places, while `unit_price` uses a display precision branch that rounds NGN and KES to zero decimal places. FIN-02A must use the authoritative persisted line total/quote provenance and exact minor-unit conversion; it must not reconstruct a payable by multiplying the display unit price by quantity.
- The order creation function currently calculates the total using `round((base merchandise − base discount) × effective FX rate + delivery fee, 2)`, while the snapshot function stores a currency exponent of 2 for the currently supported currencies. The version-2 allocation must explicitly reconcile every persisted order amount, FX conversion, item allocation and provider-verified total. It must not assume that a currency code or a rounded display field proves the monetary exponent or allocation.
- Current commission basis is the persisted pre-FX item line value and the commission rate is persisted per item, but no immutable policy-version identifier or FX-converted commission/seller-payable allocation is frozen. FIN-02A must define and snapshot the commission basis and version at order creation; a subsequent policy edit cannot alter an existing order.

### Commission and discount accounting rule to encode

For new schema-v2 orders, calculate the commission in the order currency from the frozen commission policy and the seller's funded merchandise consideration. Seller-funded discounts reduce the seller-funded merchandise consideration before commission is calculated. Platform-funded discounts do not reduce the seller's merchandise consideration or seller payable; they are recorded as a separate platform-funded customer discount/marketing cost. For split funding, apply the same rule to the seller-funded portion only. This prevents the seller from paying commission on a discount they funded while preventing an Everneed-funded coupon from silently reducing seller proceeds. The exact commission rate remains a separately approved, versioned business setting; this rule does not set a rate.

### Implementation boundary

FIN-02A must be implemented as a forward-only, explicitly versioned allocation path with regression coverage for the existing v1 checkout behavior. Do not silently retrofit v1 snapshots, rewrite historical seller-order amounts, or change the current create_order commission policy globally. Before migration, inspect all checkout callers, triggers, snapshot immutability constraints and function grants; preserve payment-attempt verification and the current mismatch quarantine. No production change is authorized.


### Staging immutability and privilege observations

- The staging `orders_checkout_snapshot_immutable` trigger calls `private.guard_order_checkout_snapshot()` before updates to snapshot, version or hash. Preserve this immutability contract for v2; create a snapshot once and never mutate it after checkout.
- Staging also has `orders_guard` and `seller_orders_guard` triggers. Their current definitions must be reviewed before changing order or seller-order write paths.
- The inspected staging grants show `create_order` and `create_order_with_snapshot` EXECUTE granted to `service_role` and `postgres`; no anon/authenticated EXECUTE grant appeared. Preserve the server-only boundary and re-verify exact ACLs after any forward migration.
- The function-definition search found no other public SQL function body invoking `create_order_with_snapshot`; application/Edge Function RPC callers still need a repository-wide source search before replacing or routing the checkout call.


## 33. FIN-02A deterministic allocation primitive — 19 Nov 2026

Added `supabase/migrations/035_fin02a_allocation_math.sql` and `supabase/tests/035_fin02a_allocation_math_checks.sql`.

The new private, immutable, non-API-executable helper `private.allocate_order_financial_items_v2(jsonb,bigint)` is a pure calculation primitive. It accepts server-prepared persisted item inputs (order item/store IDs, buyer-currency gross minor units, persisted commission rate and explicit seller/platform funding basis points) and the authoritative buyer-currency net merchandise total. It does not query or mutate orders, offers, budgets, wallets, journals or payouts.

Contract:
- 1–50 unique order item IDs; exact six-key object shape; positive integer minor-unit gross values within BIGINT; commission rate 0–100; funding basis points each 0–10,000 and summing to 10,000.
- Proportional discount allocation uses floor per item ordered by stable order-item ID; the final item receives the exact residual. This is independent of caller JSON array order.
- Within each item's discount, seller-funded share is floored by its basis points and platform-funded share receives the split residual. This deliberately prevents the platform from under-recording its subsidy by a rounding cent.
- Commission is rounded to the nearest minor unit on seller consideration after seller-funded discount only. Platform-funded discount does not reduce seller consideration or seller payable.
- Reconciliation invariant: total seller payable + commission = buyer net merchandise paid + platform-funded discount.
- The function is private and execution is revoked from PUBLIC, anon, authenticated and service_role. It is callable only by trusted database-owner/SECURITY DEFINER code in a later checkout integration.

Important boundary: this is the tested arithmetic primitive only. It is not yet called by `create_order_with_snapshot`, it does not yet persist a schema-v2 allocation snapshot, reserve campaign budgets, or alter payment/settlement behaviour. FIN-02A integration must first add authenticated seller funding consent, management-approved platform budgets, currency-specific reservations, immutable snapshot persistence and refund/cancellation release rules. Existing v1 orders remain untouched. Do not treat this migration as authorization to settle v2 orders or post finance journals.


## 34. FIN-02A allocation primitive staging verification — 19 Nov 2026

Migration `035_fin02a_allocation_math.sql` was applied to the Everneed staging Supabase project only using migration name `fin02a_allocation_math`. The complete `035_fin02a_allocation_math_checks.sql` contract test was then executed against staging successfully; its transaction rolled back all test work.

Post-application catalog checks confirm the function exists and EXECUTE is denied to `anon`, `authenticated` and `service_role`. It remains a private pure calculation primitive callable by trusted database-owner/SECURITY DEFINER code only. No order, offer, budget, payment, journal, seller balance or payout rows were changed. Production remains untouched.

The GitHub migration-file workflow passed for branch head `ffb6b6f5029d9950249935bf78458e5a52169831`. The Android/database build workflow was queued behind an earlier in-progress build at the time of this verification; do not mark the latest head CI-green until its own run completes.

Next FIN-02A tasks remain: explicit seller funding consent, management-approved currency-specific platform campaign budgets, atomic budget reservations and release, immutable financial allocation snapshot persistence, and wiring into the card checkout wrapper only after regression tests. The arithmetic helper alone does not make a discounted order settlement-ready.


## 35. FIN-02A seller funding consent and campaign budget controls — 20 Nov 2026

Migration `036_fin02a_offer_funding_controls.sql` adds isolated private records for per-offer/per-store seller funding consent, approved campaign budgets by offer and currency, and order-keyed budget reservations.

- Seller consent RPCs verify the authenticated user owns the store. Seller funding is stored in basis points (0–10,000); the remaining share is explicitly platform-funded. Consent can be revoked. Checkout integration must require current consent for the seller-funded share and an approved budget for any platform-funded share; no default or legacy offer funding is inferred.
- Admin budget approval RPC checks the authenticated profile role and requires a currency, amount in integer minor units and approval note. Budget is not allowed to fall below existing reserved + consumed amounts (table check constraint).
- Private reservation/consume/release functions are idempotent by order/offer/currency. They lock the budget row, reserve only within the approved ceiling, move held amounts to consumed after the payment-confirmation integration, and release holds only for pre-consumption cancellation/failure/expiry. Consumed campaign spend is not automatically reversed by a refund.
- Tables have no API-role grants; seller/admin changes use authenticated RPCs, while reservation lifecycle functions are private to trusted SECURITY DEFINER code. This migration is not wired into checkout or offer redemption.

Migration `037_fin02a_funding_audit_events.sql` adds append-only audit event tables and triggers for consent create/change/revoke and budget reservation hold/consume/release transitions. These records retain previous/new funding shares and lifecycle status changes. Audit tables are private and not API-readable.

### Staging validation

- Applied migrations 036 and 037 to Everneed staging only.
- Executed contract test `040_fin02a_offer_funding_controls_checks.sql` successfully; fixtures were rolled back. It covers idempotent reservation, budget ceiling rejection, consume/release transitions, event audit rows and API privilege boundaries.
- Existing orders, checkout, payment attempts, journals and seller balances were not changed. No campaign or seller consent was activated on a real offer. Production remains untouched.
- CI replay manifest and database workflow now include migrations 036/037 and test 040. Confirm current branch-head CI before declaring this checkpoint green.

**Remaining gate:** the controls are infrastructure only. Next implement immutable schema-v2 item/store financial allocation snapshot persistence with funding-source provenance and budget reservation IDs, then add checkout integration in a separate forward-only path. Do not enable promotion spend, settle schema-v2 orders or post journal entries until end-to-end tests prove funding, FX, rounding, budget reservation, cancellation and verified payment reconciliation.


## 36. FIN-02A immutable financial snapshot v2 persistence boundary — 20 Nov 2026

Migration `038_fin02a_snapshot_v2_storage.sql` adds a private immutable table for schema-v2 allocations and a service-role-only persistence RPC. The v2 record is separate from and does not overwrite checkout snapshot v1.

The persistence boundary validates schema/order identity, currency and exponent, policy provenance fields, per-item numeric shape and arithmetic (discount split, seller consideration, commission and seller payable), unique item IDs, aggregate totals and the balanced merchandise allocation invariant. It verifies the order is awaiting payment and has a v1 quote, that v2 currency/total/delivery/discount match the persisted quote, and that each item ID/store/gross/commission rate matches the stored order item and fee record. If platform-funded discounts exist, supplied campaign reservation IDs must belong to that order/currency, remain reserved, and sum exactly to the platform-funded discount. The snapshot is hashed on persistence and updates/deletes are blocked by a trigger.

This is a persistence/validation boundary—not a builder or checkout integration. The caller must still construct complete item and store allocation records from trusted persisted values, seller consent, versioned commission rules and quote FX provenance. The RPC is service-role-only; the private table is not API-readable. The current migration does not release/consume reservations or post journals. Schema-v1 orders/payment flows remain unchanged.

### Staging validation
- Migration 038 applied to staging only.
- Contract test 041 passed against staging with rolled-back fixtures, verifying table/trigger existence, API table/RPC privilege boundaries and rejection of malformed snapshot structure.
- Migration replay workflow passed on current head `9feb28032894dab680171a33d78ca6d520c1ad7d`; Android/database workflow was still queued at this checkpoint.
- Production untouched. No actual v2 snapshot, checkout, payment, journal or payout was created.

**Next:** implement a deterministic snapshot builder that calculates and cross-checks per-store aggregates, then a new checkout wrapper that creates order + v1 quote + v2 allocation + campaign reservations atomically. Run variant, promotion, concurrent budget, FX, rounding, payment retry/verification, cancellation/release and refund suites before enabling any v2 settlement path.


## 37. FIN-02A store allocation reconciliation guard — 20 Nov 2026

Migration `039_fin02a_store_totals_validation.sql` adds a private pure validator and an INSERT trigger on the v2 snapshot table. It compares every store's gross, seller/platform-funded discount, commission and seller payable totals against the item-level allocation JSON, rejects missing/duplicate store summaries and mismatched values, and blocks API-role execution of the validator.

- Applied migration 039 to staging.
- Contract test 042 passed in staging with rollback fixtures, covering correct multi-store totals, mismatch rejection, trigger presence and API-role privilege boundaries.
- This validates summaries supplied to the v2 persistence boundary; the deterministic builder and checkout integration remain unimplemented. Production untouched.


## 38. FIN-02A funding RPC least-privilege correction — 20 Nov 2026

A staging ACL audit after migrations 036–039 found that the human-facing seller-consent and admin-budget RPCs still inherited service-role EXECUTE through role grants. Their own `auth.uid()` checks would reject service-role calls without a user identity, but this was broader than the intended permission model.

Migration `040_fin02a_rpc_acl_tightening.sql` explicitly revokes EXECUTE from `service_role` on seller consent, consent revocation and campaign budget approval; these functions remain authenticated-only with ownership/admin checks. The service role retains EXECUTE only on the snapshot persistence RPC. Test 043 passed against staging after applying migration 040. This is a least-privilege hardening correction, not a checkout integration. Production untouched.


## 39. FIN-02A consent audit actor correction — 20 Nov 2026

A further audit review found the consent-history trigger was attributing a revoke/change event to the original consent owner instead of the current actor. Migration `041_fin02a_consent_audit_actor.sql` corrects attribution to `auth.uid()` when available, with the recorded consent owner as a system-context fallback. Test 044 passed on staging after migration. This closes an audit-identity defect; no business funding settings or offers were changed. Production untouched.


## 40. FIN-02A deterministic builder and card-checkout integration — 20 Nov 2026

Migration `042_fin02a_snapshot_builder_checkout_integration.sql` adds `orders.financial_offer_id` and the private deterministic builder `private.build_order_financial_snapshot_v2`. It reads the immutable v1 quote, persisted order items and frozen `order_item_fees.commission_rate`, and active seller funding consent. Missing seller consent means the platform-funded share is 100%; any non-zero platform share requires an explicit approved offer/currency budget. Seller-funded discounts reduce seller consideration before commission; platform-funded discount does not. The builder uses migration 035's minor-unit allocator, creates exact budget reservations, builds per-item and per-store totals, and persists v2.

The new service-only `public.create_order_with_financial_snapshot_v2` wrapper calls the existing `create_order_with_snapshot` (which remains the authority for stock, order, seller-order and offer redemption), saves the selected offer identity, and builds v2 in the same transaction. Any failure rolls back all of these. The Paystack Edge Function's card-create path now calls this v2 wrapper in the source branch; manual transfer/other legacy paths remain unchanged. The branch is not deployed.

### Atomic checkout fixture
- Test 046's deterministic builder fixtures validate both funding models with a 10% frozen commission: platform-funded case gross NGN 10,000 minor, buyer net 8,000, platform discount 2,000, commission 1,000, seller payable 9,000; seller-funded case seller discount 2,000, commission 800, seller payable 7,200.
- Test 048 executes the actual checkout wrapper using the seeded official store (zero commission by official-store policy) and asserts commission matches the persisted fee rate, seller payable reconciles, quote v1 and offer identity are stored, v2 is created and campaign reservation exactly equals platform discount 2,000. All fixtures rolled back.

## 41. FIN-02A campaign reservation lifecycle and quote identity hardening — 20 Nov 2026

Migration `043_fin02a_campaign_reservation_lifecycle.sql` adds an order transition trigger: when payment becomes paid, active campaign reservations are consumed atomically; when an unpaid order is cancelled, active reservations are released. Duplicate transitions are safe because the reservation functions are state-idempotent. A failed payment attempt alone does not release a hold, because retry may remain available; holds are released on cancellation/expiry only when the order actually transitions to cancelled. Automatic order-expiry policy/scheduler wiring remains pending.

Migration `044_fin02a_snapshot_quote_identity_guard.sql` strengthens the snapshot INSERT guard to match the v2 order/offer identity, currency/exponent, v1 quote gross/net, delivery, total and discount, plus reservation-ID references. It rejects any v2 snapshot whose parent quote or funding reservation references diverge.

- Tests 046–049 passed against staging: platform-funded and seller-funded builder cases; consume-on-paid and release-on-cancel lifecycle; actual atomic checkout wrapper; snapshot quote identity and ACL contract.
- Migrations 042–044 applied to staging only. CI migration manifest passes on head `6f9b34d42dcfb1607ab5e6516a5d2fb0867a36ed`; Android/database workflow pending.
- No production deployment, real checkout, order, payment, budget spend, journal posting or seller payout occurred. Staging fixtures were rolled back.

**Remaining gates:** test multi-item/multi-store rounding and foreign-currency FX; campaign redemption concurrency and insufficient-budget rollback; inventory/variant integration; cancel/expiry automation; verified Paystack success + duplicate webhook + refund/reconciliation; then a finance-approved migration plan for existing promotions. Do not activate seller settlement/journal posting from v2 until those gates pass.


## 42. FIN-02A card-only wrapper scope — 20 Nov 2026

Migration `045_fin02a_card_checkout_wrapper_scope.sql` adds an explicit `p_pm='card'` guard to the v2 atomic wrapper. This prevents service-role callers from accidentally using the new funding snapshot path for transfer, WhatsApp or other legacy payment methods while those flows remain unintegrated. Test 050 passed against staging; test 048 still passed through the actual card wrapper. Migration 045 is staging-only. Production untouched.
