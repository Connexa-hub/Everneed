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
