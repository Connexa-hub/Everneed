# Finance Ledger and Payouts — Phase 3 Audit

**Date:** 2026-11-16  
**Branch:** `web-portal`  
**Database inspected:** Everneed-staging (`vjiadqygpyebpisxslbx`), read-only  
**Production:** Not queried or changed.

## 1. Verified current model

The current `public.ledger_entries` table is a seller subledger, not a double-entry general ledger. Its fields are:

- `id` (bigint), `store_id`, `order_id`, `seller_order_id`
- `kind`, `amount` (numeric major units), `currency`
- `status`, `note`, `created_at`

The ledger guard prevents deleting entries or editing amount, kind, store, order, seller-order or currency; corrections must be represented by reversing entries. The authenticated read policy allows a store owner to read their own store entries and admins to read all entries.

`public.store_balance(text)` calculates a seller balance by summing available sale/commission/refund/adjustment entries and all payout entries. It is a seller-facing balance calculation, not a balanced accounting journal.

`public.payouts` currently records a store, amount, currency, reference, method, paid timestamp, recorder and period. The `record_payout` RPC:
- requires the server-side admin gate and throttling;
- locks the store row;
- checks the requested amount against `store_balance`;
- inserts a payout record and a negative `payout` seller-ledger entry;
- sends a notification and audit record.

It does **not** initiate a bank transfer, call a payout provider, confirm delivery of funds, or reconcile a provider transfer. A payout row is a record of an administrator-entered payment, not proof of an automated transfer.

## 2. Staging data limitation

At the time of this read-only audit, staging contained:

| Table | Rows |
|---|---:|
| `ledger_entries` | 0 |
| `payouts` | 0 |
| `refunds` | 0 |
| `orders` | 0 |
| `private.payment_attempts` | 0 |

The schema and function contracts can be inspected, but there is no commerce history in staging to reconcile or use for an end-to-end accounting proof. Do not treat empty staging tables as proof that all historic balances reconcile.

## 3. Gaps before finance automation

1. No double-entry journal with debit/credit lines and a per-currency balanced-journal invariant.
2. No chart of accounts separating Paystack clearing, bank cash, seller payable, platform commission revenue, delivery revenue, taxes, refunds payable, fees and adjustments.
3. Seller balance is not yet derived from a general-ledger control account.
4. Payouts are manually recorded; there is no provider transfer request, idempotency key, transfer status lifecycle, provider webhook correlation or bank reconciliation.
5. Refund accounting is currently local bookkeeping and is not gated on Paystack's provider-confirmed refund state; see `PAYMENT_REFUND_AUDIT.md`.
6. Paystack settlement batches and fees are not reconciled to bank statements and the platform's journal.
7. The current ledger is major-unit numeric. Provider APIs use minor units, so every provider boundary needs explicit currency-exponent conversion and rounding rules.
8. The current ledger guard protects core identity/amount fields, but the finance journal should be append-only across all material fields, with reversals rather than mutation.

## 4. Target finance architecture — design only

### Journal core

- `accounts`: immutable account code, type, currency, owner/store scope and active state.
- `journal_transactions`: immutable source event, idempotency key, effective/posted timestamps, currency, source references and metadata.
- `journal_lines`: debit or credit amount in integer minor units, account, currency, optional store/order/seller-order attribution.
- Enforce at posting time that every journal transaction has at least two lines, all lines use one currency, total debits equal total credits, and amounts are positive integers.
- Enforce unique source-event/idempotency identity so retries cannot post twice.
- Never edit or delete posted journals. Correct errors with a linked reversal and replacement journal.
- Derive seller balances from seller-payable control-account movements; retain `ledger_entries` as a compatibility/read model until all clients and reports migrate.

### Core account groups

- Assets: Paystack clearing, bank cash, cash-in-transit and any approved hub inventory/custody accounts.
- Liabilities: seller payable by seller and currency, customer refund payable, tax payable, delivery partner payable and customer funds held.
- Revenue: platform commission, delivery revenue, seller promotion/advertising revenue and other approved platform fees.
- Contra-revenue/expenses: refunds, payment processing fees, chargebacks, operational delivery cost and approved adjustments.

These are account categories, not an instruction to recognize revenue before the relevant delivery, return and settlement policies are agreed.

### Payout lifecycle

A future payout request should be separate from a provider transfer:

`requested → risk/eligibility review → approved → queued → submitted → processing → paid`

Terminal/exception states should include `failed`, `reversed`, `cancelled` and `reconciliation_required`.

- Freeze the requested amount and destination snapshot when approved.
- Check available seller payable under a row lock; prevent concurrent overdraw.
- Submit a provider transfer with a stable idempotency/reference.
- On timeout, verify the same provider reference; never create a second transfer just because the response was lost.
- Only verified provider completion should debit seller payable and credit the cash/clearing account.
- Failed or reversed transfers must release/reinstate the seller payable through explicit journal entries.
- Keep bank details private and never expose them through seller-facing read models.

### Reconciliation

- Import provider settlement and transfer events idempotently.
- Match charge transaction IDs/references, fees, refunds, transfers and settlement batches.
- Reconcile Paystack clearing to actual bank credits, with an exception queue for unmatched, partial, duplicate and delayed items.
- Provide a period close report by currency: opening balance, movements, closing balance, provider clearing balance, bank balance and unresolved differences.

## 5. Decisions intentionally not assumed

Before implementation, confirm:
- when seller funds become withdrawable (delivery, return-window expiry, or another milestone);
- whether seller payouts are on-demand, scheduled, threshold-based, or hybrid;
- the payout provider and supported destination countries/currencies;
- how delivery fees, taxes, Paystack fees, chargebacks and hub handling costs are allocated;
- whether hub-held goods/cash require separate inventory and custody subledgers.

Until these policies are approved, the existing manual payout RPC should not be represented as automated settlement and no automated payout migration should be applied.

## 6. Release boundary

This is a read-only audit and target design. No migration, journal table, payout worker, provider transfer, scheduler or production action was created or executed for Phase 3.
