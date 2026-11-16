# Legacy Payment Paths — Read-only Audit

**Date:** 2026-11-16  
**Branch:** `web-portal`  
**Database inspected:** Everneed-staging (`vjiadqygpyebpisxslbx`), read-only  
**Production:** Not queried or changed.

## 1. RPC privilege boundaries

The staging catalog confirms:

| RPC | Client access | Finding |
|---|---|---|
| `confirm_payment(text,text,uuid)` | service_role only | Legacy settlement wrapper; calls `private.confirm_payment_core` |
| `confirm_received_for(text,uuid)` | service_role only | Delivery-confirmation helper; Edge Function checks the signed-in user's order ownership before calling |
| `create_order(...)` | service_role only | Legacy order creation; caller is the authenticated Paystack Edge Function |
| `create_order_with_snapshot(...)` | service_role only | Snapshot-backed order creation for current card checkout |
| `admin_confirm_payment(text,text)` | authenticated | Function performs server-side `need_admin()` check |
| `report_payment(text,text)` | authenticated | Function checks `auth.uid()` against the order owner and only records a transfer report |
| `cancel_order_for(...)` | service_role only | Wrapper around private cancellation core |
| `apply_rental_payment_for(...)` | service_role only | Wrapper around private rental-payment core |

The private `confirm_payment_core` is not SECURITY DEFINER and has no client execution grant. It is reached through trusted wrapper functions.

Migration 032 changes the function-level `search_path` to empty for the four service-role wrappers whose bodies already use fully qualified references: `confirm_payment`, `confirm_received_for`, `cancel_order_for`, and `apply_rental_payment_for`. This is a search-path hardening change only; it does not alter grants or business behaviour. Migration 032 is source-only and not applied to staging.

The legacy `create_order` routine remains SECURITY DEFINER with `search_path=public` and has many unqualified table/function references plus a temporary table. It is service-role-only. It needs a separate careful refactor rather than a blind `ALTER FUNCTION ... SET search_path = ''`.

## 2. Saved-card token access

The public `cards` table contains a Paystack authorization `code`. It is not readable by authenticated clients:

- Authenticated users have column-level SELECT only for `id, brand, last4, exp, bank, at`.
- Authenticated users cannot SELECT the `code` column.
- The service role can read the authorization code.
- RLS policies restrict safe card metadata reads and deletion to the card owner.

The Paystack Edge Function uses the service role to read the authorization code for server-side charges. Do not expose this column to the browser or grant table-wide SELECT.

## 3. Current pay-on-delivery / delayed saved-card flow

The current Edge Function explicitly uses the legacy path for `card_later`:

1. Checkout validates that the customer selected one of their saved card IDs.
2. The Edge Function calls `create_order`, not `create_order_with_snapshot`, for `card_later`. The order therefore has no immutable checkout snapshot. The current `create_payment_attempt` RPC also accepts only `pm='card'`, so the 029–031 recovery worker cannot claim or settle this legacy delayed-charge path.
3. When the customer confirms receipt, the Edge Function calls service-only `confirm_received_for`; that function marks the order delivered.
4. Only after delivery is marked does the Edge Function call `chargeSaved`.
5. `chargeSaved` recalculates the price using the current pricing/FX path, updates `orders.total`, `orders.currency` and `orders.discount`, then calls Paystack `/transaction/charge_authorization`.
6. The reference is generated as `en_<order-id>_<Date.now()>`; this path does not create a `payment_attempts` row or use the new immutable snapshot/attempt RPC lifecycle.
7. The admin `charge_later` action calls the same `chargeSaved` path again, generating another reference.

### Risks

- The amount/currency can be recalculated after checkout and the order row is mutated immediately before charging.
- A provider timeout after Paystack accepted the charge can leave no durable attempt record. A retry creates a new reference and can risk a second charge.
- Delivery is marked complete before payment is confirmed. A failed charge therefore leaves an order delivered but unpaid.
- Admin retries can create another charge reference rather than verify the original one.
- The flow bypasses the immutable checkout snapshot, payment-attempt idempotency, durable settlement and recovery worker.

This path is not part of the current 029–031 recovery implementation. Do not assume the new recovery worker protects `card_later` orders yet.

## 4. Recommended migration design — not implemented

Before changing this flow, preserve the user's current product choice only if the delayed saved-card charge is explicitly retained. If retained:

1. Create a checkout snapshot for `card_later` orders at checkout, including the exact currency/amount, saved-card ID, delayed-charge mode, consent timestamp and policy version.
2. Create a payment attempt only after the customer confirms delivery, with a stable idempotency key tied to the order and delayed-charge event.
3. Use the attempt's persisted reference/amount/currency for Paystack `charge_authorization`; never recalculate the amount after checkout.
4. On retry, reuse and verify the same attempt/reference. Never generate a new reference while an earlier attempt is initializing, pending or unresolved.
5. Settle only through the verified attempt/snapshot RPC path.
6. Keep delivery state separate from payment state. Delivery confirmation must remain true even if the charge fails; the unpaid state must be visible to the customer/admin and must not release seller earnings.
7. Keep admin retries on the same attempt/reference. A new attempt is allowed only after the old one is conclusively failed or explicitly reconciled.
8. Add an audit trail for customer consent, delayed charge initiation, provider result, retries and any admin exception.

The business decision to retain or remove pay-on-delivery must be confirmed before this implementation changes customer-facing behaviour. No UI or backend flow was changed by this audit.

## 5. Current release boundary

- Staging was queried read-only for this audit.
- Migration 029 is recorded in staging due the former automatic workflow; that trigger is disabled and now requires manual dispatch with explicit `APPLY`.
- Migrations 030–032 and the recovery Edge Function remain source-only.
- No payment recovery function is deployed or scheduled.
- Production was not queried or changed.
