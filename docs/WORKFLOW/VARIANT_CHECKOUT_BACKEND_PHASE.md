# Variant-aware checkout and inventory reservation — backend phase

**Status:** implementation drafted on `feature/variant-checkout`; migration/test committed, review and CI/staging validation pending.  
**Target branch:** `feature/variant-checkout` based on `web-portal`.  
**Environment:** staging only. Do not deploy or merge to `main`.

## Why this is required

The catalogue foundation now stores product variants, per-variant prices, stock, SKUs, option values, and variant images. The current checkout still reads `products.price` and reserves `products.stock` / legacy `products.stocks`; it does not accept or validate a variant. The current cancellation path restores legacy product stock through `private.stock_add`. Therefore a catalogue variant must not be presented as purchasable until checkout, order snapshots, inventory reservation, and cancellation/refund handling are variant-aware.

## Input contract

Each checkout line keeps the product id in `id` and may include `variant_id` (UUID). The client must not send a trusted price, SKU, stock quantity, discount, or option labels as authority.

- If the product has active variants, checkout requires an active variant belonging to that product/store.
- If a product has no active variants, the existing legacy line contract (`id`, `qty`, optional `size`) remains valid.
- A variant line's displayed option values are informational; the database reads them from `product_variants.option_values`.
- Qty must satisfy product min/max order quantity and the checkout hard limit.
- The product must be published and the store live, and country restrictions remain enforced.
- Price is resolved server-side from the variant's sale price only when its configured sale window is active; otherwise from variant price. Product price remains the fallback only for non-variant products.
- Variant stock uses an atomic, row-locked decrement. A race that leaves insufficient stock must fail the entire checkout transaction.
- `track_stock=false` or a NULL stock count is treated as untracked, consistent with the legacy nullable stock convention. Backorders are allowed only when the variant says so.
- Legacy product stock/size stock must not be decremented for variant lines.

## Order and payment snapshots

Persist the selected variant on `order_items` (nullable FK plus immutable SKU/options snapshots) and in the order's immutable checkout snapshot. Include variant ID, SKU, options, quantity, unit price, line totals, and refund allocation. Payment amount/currency/hash validation remains unchanged and must still match the snapshot.

The order JSON line returned by checkout should contain `variant_id`, `variant_sku`, and `variant_options` in addition to the existing fields so mobile and web clients can render the purchased choice. Existing line fields and order status/payment lifecycle must remain backward compatible.

## Reservation and restoration

- Reservation must occur inside the checkout transaction and be audited in `product_inventory_movements` with reason `checkout_reservation` and order reference.
- Persist a per-line reservation marker so cancellation restoration is idempotent and historical rows without a marker are not incorrectly incremented.
- Cancel/reject seller order: restore variant stock once if a tracked reservation was made. For non-variant lines retain the existing `private.stock_add(product,size,qty)` path.
- A successful seller order, payment confirmation, delivery, or normal status update must not restore inventory.
- If a cancellation is followed by a payment/refund reconciliation, payment and refund safeguards remain authoritative; inventory restoration is not payment confirmation.

## API / function compatibility

The current public checkout wrapper `create_order_with_snapshot` calls `create_order`; keep existing signatures and privileges unless the implementation deliberately introduces a compatibility wrapper. No client-side change should be required for legacy product lines. Review direct callers and RPC EXECUTE grants before replacing any function.

## Required regression tests

1. Legacy non-variant product checkout still works and stock is reserved exactly as before.
2. Variant checkout uses variant price (including active sale window), never the client price.
3. Variant SKU/options/ID are returned and saved in both order item and immutable payment snapshot.
4. Wrong product/variant pair, inactive variant, unpublished product, closed store, and country restriction are rejected.
5. Variant-required product with no variant selection is rejected.
6. Qty min/max/hard limit is enforced.
7. Concurrent buyers cannot oversell tracked stock; one loses with insufficient stock.
8. Untracked, NULL-stock, and permitted backorder behaviour is deterministic.
9. Failure at any point rolls back stock, order rows, fees, seller orders, and offer redemption.
10. Seller cancellation/rejection restores a variant reservation once, not twice; legacy size stock restoration remains.
11. Snapshot hash and Paystack amount/currency integrity checks remain valid.
12. Seller and admin RLS/RPC boundaries remain enforced; no client may update variant stock directly to bypass the audit RPC.

## Implementation sequence

1. Add order-item variant and inventory-reservation snapshot fields.
2. Update `create_order` for variant validation, server price selection, atomic stock reserve, and per-line snapshots.
3. Update `create_order_with_snapshot` to include variant fields and preserve immutable hash/allocation rules.
4. Add one-time variant inventory restoration to seller-order cancel/reject flow.
5. Add transaction-wrapped CI regression tests and staging checks.
6. Update `DB_CONTRACT.md`, `WEBSITE_TRACKER.md`, and this handoff with actual tested status.

Do not enable the frontend variant purchase path until the backend and test matrix are green.


## Implementation status

- Draft migration: `supabase/migrations/20261119042700_variant_checkout_inventory.sql`.
- Adds `order_items.variant_id`, `variant_sku`, `variant_options`, `inventory_reserved`, and `inventory_restored`.
- Updates `create_order` to resolve server-side variant prices and sale windows, require a selected active variant when the product has active variants, enforce quantity bounds, reserve tracked stock atomically, and persist item snapshots.
- Updates `create_order_with_snapshot` to preserve variant identity, SKU/options and reservation state in the immutable quote.
- Adds internal `private.restore_variant_order_item` and updates cancellation to restore reserved variant stock once while retaining legacy restoration.
- Test 039 and CI invocation are added; migration replay manifest updated on this branch.
- **Not staging-applied.** SQL replay/tests are not yet confirmed. Keep variant purchasing disabled until validation.


## CI-discovered official-store visibility fix

A full local migration replay uncovered a pre-existing public visibility regression in the newer seller entitlement `private.store_live()`: its subscription/entitlement JOIN unintentionally required the official Everneed store to have a seller subscription. Migration `20261119042710_official_store_live_entitlement_bypass.sql` preserves the official-store exception while leaving all non-official seller activation, verification and subscription gates intact. Regression assertion was added to test 039. CI is being rerun on a temporary validation PR because the original CI run stopped in Phase 2 before test 039.
