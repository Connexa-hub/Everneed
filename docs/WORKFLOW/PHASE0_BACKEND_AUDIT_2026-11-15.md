# Phase 0 backend audit — 15 November 2026

**Scope:** read-only review of the `web-portal` branch and the connected `Everneed-staging` Supabase project.  
**Development branch head reviewed:** `203b8f674f45d87aed10a49ecb40e3b4c325a375`.  
**Staging project:** `Everneed-staging`, ref `vjiadqygpyebpisxslbx`, PostgreSQL 17.  
**Production boundary:** no production database, production branch, payment transfer, or live customer data was changed.

## Ownership boundary

- **Claude:** seller dashboard, admin dashboard, website design, seller onboarding flow, responsive presentation, UI/UX verification and owner-directed visual revisions.
- **ChatGPT coordinator:** database architecture, migrations, financial journal, Paystack lifecycle, refunds, settlement, hub custody, delivery proof, RLS/RPC security, backend contracts and tests.

Backend work must expose stable APIs and data contracts for Claude's screens. Do not duplicate or take over the visual implementation.

## Staging state verified

- Supabase project is active and healthy.
- Migration history contains versions `000` through `025`, including the recovered historical sequence and development migrations.
- Migration `025_storefront_details_seller_grant` is already applied to staging.
- The next migration version is **026**, after rechecking migration history at implementation time.
- The staging `paystack` Edge Function is ACTIVE v1 with `verify_jwt=false`; its source matches the repository function reviewed.
- The `pg_cron` extension is available but not installed; `cron.job` does not exist. No database schedule for `run_scheduled_jobs()` or `release_earnings()` is configured.
- Staging has almost no commerce fixtures: no orders, seller orders, products, refunds, payouts or ledger entries were present in the table inventory. Functional finance tests remain outstanding.

## Confirmed foundations

- Parent orders and separate seller orders.
- Hub receipt, item inspection, consolidation and dispatch functions.
- Seller earnings ledger and manual payout records.
- Refund and dispute tables.
- Delivery record and customer delivery-code confirmation.
- RLS on the marketplace tables.
- Store, profile, order and seller-order guard triggers.
- Store status transitions and activation checks are protected by server-side logic.
- Card authorization codes are not granted to authenticated clients; only safe card metadata columns are selectable.
- The seller's order RPC filters by store ownership and hides customer phone/address for hub-routed orders.

## Findings requiring remediation

### P0 — Payment attempts are not independently tracked

The checkout Edge Function can initialize more than one Paystack transaction for the same order. There is no dedicated customer payment-attempt/transaction table with a unique provider reference and lifecycle status. The `settle()` function returns success when the order is already paid, without reconciling a second distinct successful provider transaction.

**Risk:** a customer may complete multiple successful attempts while the database records only the first settlement. The additional provider charge can become an unallocated/unreconciled receipt.

**Required design:** immutable payment-attempt records; unique provider references; order/user/currency/amount matching; webhook event idempotency; explicit duplicate-payment handling and refund/reconciliation queue. Do not mark an order paid from an uncorrelated reference.

### P1 — Refund RPC is an internal record, not a provider refund

`public.refund()` inserts a refund row directly with status `processed` and writes ledger adjustments. It does not call Paystack. The seller-order allocation also needs a strict per-package/item cap; the current cumulative limit is checked against the parent order total.

The paid seller-order cancellation path (`private.cancel_so()`) creates an `approved` refund and notifies admins that it is due, but does not execute a provider refund.

**Required design:** requested → approved → provider-pending → provider-confirmed/failed; provider reference and idempotency key; item/package-level caps; immutable journal reversals only after confirmed provider outcome.

### P1 — Pay-on-delivery mixes delivery and collection states

The customer receipt action calls `confirm_received_for()` and marks the order/seller packages delivered before `chargeSaved()` is attempted. A failed card charge therefore leaves a physically delivered order with payment outstanding. Earnings are not immediately released by this path, but the order lifecycle is ambiguous.

Additionally, `chargeSaved()` recalculates the amount using current product prices and current FX rather than an immutable checkout price snapshot.

**Required design:** preserve the accepted checkout amount/currency; separate delivery proof, payment collection and payout eligibility; implement retry/failure/dispute states. Never silently reprice an already accepted order.

### P1 — Delivery code is weakly protected

The current code is four digits and stored in plaintext in `order_secrets`. The RPC has a per-user rate limit, but the code has a small search space and no stored hash/expiry/attempt lifecycle.

**Required design:** stronger cryptographically random code, protected storage (hash or encrypted secret with a narrowly scoped buyer retrieval flow), expiry, attempt counter/lockout, one-time consumption and auditable verification event. Preserve the customer-only visibility contract.

### P1 — Financial ledger is not double-entry

`ledger_entries` is a single-sided seller subledger. Its trigger prevents editing/deleting monetary identity fields, which is a good immutability control, but there are no chart-of-accounts, balanced journal entries, platform cash/receivable/liability accounts or reconciliation records.

Seller sale and commission values are stored in base NGN while customer order item totals can be converted to the shopper's currency. The accounting contract must explicitly state whether seller balances remain NGN or are denominated in each seller's settlement currency. The current payout model does not provide FX snapshots or cross-currency settlement accounting.

**Required design:** append-only double-entry journal, balanced per-currency postings, locked FX quote/rate/source/time, rounding rules, seller payable liability, platform revenue/fees, provider clearing account, reversals and reconciliation.

### P1 — Hub custody is not yet a consignment system

The current `deliveries` table has one row per parent order (`order_id` is unique). Seller packages can be checked and consolidated, but there are no independent consignment/package custody records or append-only custody events.

**Required design:** consignment and parcel entities, package identifiers/barcodes, custody handoffs, inspection evidence, exception cases, consolidation manifests and delivery evidence. Support one consolidated parcel or multiple disclosed parcels.

### P1 — Scheduled release/auto-confirm is not operationally evidenced

`release_earnings()` releases pending seller ledger entries after the configured delivery hold. `run_scheduled_jobs()` also auto-confirms delivery after the configured period. However, staging has no installed `pg_cron` extension or `cron.job` table. An external scheduler was not verified.

**Required design:** select and document one scheduler; add monitored execution, retries and last-success visibility. Decide the customer-protection policy for automatic delivery confirmation, including dispute/exception holds, before it can make funds payout-eligible.

## Security and performance review

- Supabase Security Advisor reports 36 authenticated-callable SECURITY DEFINER functions. The high-risk finance/admin RPCs inspected enforce `private.need_admin()`; seller and customer RPCs use ownership/order checks. These warnings are not proof of an exploit, but the exposed RPC set needs a continuing function-by-function authorization test.
- Two SECURITY DEFINER functions are callable anonymously: `store_reply_stats()` (aggregated per-store response metrics, minimum three chats) and `support_sla_public()` (public support SLA targets). These appear intentionally public; keep their return values minimal and reviewed.
- `public.kv` and `public.rate_limits` have RLS with no policies by design (service-only).
- Auth leaked-password protection is disabled in staging; enable it in the Supabase Auth configuration.
- Performance Advisor reports 31 unindexed foreign keys, 18 RLS init-plan warnings, 12 multiple-permissive-policy warnings, one table without a primary key (`rate_limits`) and six unused indexes. Staging has almost no commerce workload, so unused-index findings are not a sound basis for dropping indexes. Prioritise indexes for actual order, seller-order, ledger and reconciliation query paths; optimise RLS expressions in a separate measured pass.

## Recommended implementation sequence

1. **026 — Payment lifecycle contract:** payment attempts, provider references, idempotency and immutable checkout price/currency snapshot. Add regression tests for repeated initialization, duplicate webhooks, wrong owner, wrong amount/currency, late success and duplicate successful charges.
2. **027 — Financial journal:** accounts, journal transactions and postings; balanced per-currency entries; seller payable and platform revenue mapping; migration/backfill from the legacy ledger without deleting it.
3. **028 — Refund lifecycle:** provider refund execution, partial item/package allocation, provider confirmation and reversal postings.
4. **029 — Consignment custody:** consignment/parcel records, package identifiers, custody events and evidence.
5. **030 — Delivery and payout eligibility:** stronger delivery proof, explicit payment state, dispute holds and scheduled release controls.
6. **031+ — Paystack transfers and reconciliation:** recipient verification, payout batches/items, transfer webhooks, retry policy and provider-confirmed paid state.
7. **Admin backend contracts:** publish stable queries/RPCs for Claude's admin UI; Claude remains the owner of dashboard design and interaction.

Migration numbering is provisional. Recheck staging migration history and repository order before creating each migration.

## Test gates before real money

- Three sellers, one customer checkout, one or multiple consignments.
- Payment attempt initialized twice; only one valid attempt paid.
- Duplicate and out-of-order webhooks.
- Exact amount/currency/reference/user matching.
- Pay-on-delivery charge failure and successful retry.
- Customer delivery confirmation, courier code confirmation, expired/wrong/reused code.
- Missing/damaged package and partial cancellation.
- Partial/full refund with provider failure and later confirmation.
- Seller payable balances, commission, delivery fee, FX and rounding.
- Transfer pending/success/failure/duplicate events and reconciliation.
- Buyer/seller/admin negative-access isolation.
- No finance migration or automated transfer reaches production without separate review and owner approval.

## Safety statement

This audit used read-only GitHub and staging database inspection. No migration was applied, no staging data was changed, no Paystack transaction/refund/transfer was initiated, and production `main` / live Supabase project were not touched.
