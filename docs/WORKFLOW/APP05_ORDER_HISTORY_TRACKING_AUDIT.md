# APP-05 audit: shopper order history and tracking (Claude 3)

**Task:** APP-05 (TEAM_BOARD, Claude 3 "Next") | **Branch:** `claude/agent-3/app05-order-tracking-audit` | **Type:** read-only audit, no code changed
**Method:** static read of `js/app.js` (`ST`, `ordRow`, `ordersPage`, `meBody`, `pendBanner`, `payx`, order submit), `js/shop.js` (`order()`, `trackHtml`, `recv`, `rate`), `js/store.js` (`orders()` load), `DB_CONTRACT.md`, `CODEX_REQUESTS.md`, `TEAM_BOARD.md`.
**Not done (no credentials, no device):** nothing was run against staging, the customer account, or fixtures CX01-xx. Every finding below is from source, not observed behaviour.

## What the shopper sees today
- **List** (`#/orders`, "Me" screen): one row per order from `S.orders()` = `Supa.list("orders")` (RLS-scoped rows of `orders`). Row shows total, date, `ST[status] || raw status`, and an "I've paid" button when `awaiting_transfer`.
- **Detail** (`Shop.order()` sheet): 4-step timeline (Placed, Paid, Shipped, Delivered) from a hard-coded status map, items, optional `o.track` (carrier / number / note), "Continue payment" + "Cancel order" for `awaiting_payment`, "I received my order" for `shipped`, Rate buttons for `delivered`.

## Findings

| # | Sev | Finding (evidence) | Fix / owner |
|---|---|---|---|
| F1 | High | **Tracking is only the parent `orders.status` mapped to 4 steps.** The map in `Shop.order()` knows 9 statuses; any other value leaves **no step highlighted**, and the list prints the raw code (`ST[o.status]||o.status`). The backend has richer states (seller_orders: accepted, preparing, ready, handover_pending, at_hub, consolidated, out_for_delivery, delivered, issue) that the shopper never sees. `order_tracking(p_order)` is listed TODO in `DB_CONTRACT.md`. | **BACKEND REQUEST** (Codex): `order_tracking(p_order)` returning a customer-safe timeline (event, time, label; no seller private contact). Client interim: unknown status shows a neutral "In progress" label, never a raw code, never an empty timeline. |
| F2 | High | **The unpaid fixtures cannot test card resume.** CX01-01 to 05 are `awaiting_transfer` (bank transfer). Continue payment / Cancel / `pendBanner` only act on `awaiting_payment`. They can exercise the bank-transfer path ("I've paid" -> `report_payment`), not Paystack resume, expired or cancelled attempts. | Board task needs re-framing (Claude 10). Add to CX-15: one `awaiting_payment` card order with a `pending` and one with an `abandoned` attempt, plus fresh stock. |
| F3 | High | **A shopper cannot cancel an unpaid order.** `payx` and the silent cancel before re-checkout call `paystack` action `cancel`, which is admin-only (403 "Admins only."). The order sheet offers a "Cancel order" button that always fails. | CX-07 (supersede + customer cancel). Until it lands, hide "Cancel order" for shoppers rather than show a button that fails (client, small). |
| F4 | Med | **Awaiting-transfer detail is incomplete.** "I've paid" exists only on the list row, not in the order sheet; the sheet shows no bank/transfer instructions and no way to cancel. | Client: add the same action and an honest "waiting for transfer confirmation" line to the sheet. Bank details must come from existing config, not invented. |
| F5 | Med | **No refund or dispute visibility.** Fixtures include a refund (NGN 1,000) and a dispute on CX01-10, but `ST` has no refunded / disputed and the order still reads "Delivered". Customer read access to `refunds` / `disputes` is not documented (policy counts only). | **BACKEND QUESTION** (Codex): can a customer read their own refunds and dispute status (RLS or RPC)? Client shows nothing invented until answered. |
| F6 | Med | **Statuses go stale.** `S.orders()` refreshes only on pull-to-refresh, the `online` event and after payment. Nothing refreshes on app resume, and the open order sheet is a static snapshot. | Client (mine): refresh orders on `visibilitychange` / `appStateChange` for signed-in users (throttled), and re-render an open order sheet. No backend needed. |
| F7 | Med | **Delivery proof is invisible to the shopper.** Sellers confirm delivery with a 4-digit code (`mark_delivered(p_order,p_code)`, TODO) and `order_secrets` exists, but the shopper UI never shows a code and only offers "I received my order" when `shipped`. For hub / out-for-delivery orders the shopper cannot see or confirm anything. | **BACKEND QUESTION** (Codex): what does the customer see/confirm for delivery proof, and who may read the code? Design with Claude 5 (hub board) so wording matches. |
| F8 | Low | Multi-seller orders show one flat item list with a single status; per-seller parcels are not shown. This is consistent with the current backend (`private.deliver()` delivers all active seller orders together, one consolidated parcel) but the UI must not imply per-seller tracking until `order_tracking` exists. | Document; revisit after F1. |
| F9 | Low | A signed-out visitor to `#/orders` sees "No orders yet" instead of a sign-in prompt. | Client (mine), small. |
| F10 | Low | `ordRow` is a clickable `div` with no `role="button"`/`tabindex`; the timeline has no accessible labelling. 360 px layout not checked. | Client (mine); verify with Claude 9's axe setup. |

## Proposed client work (SHOP-02, after #55 merges; all in my files, no backend)
1. Safe fallback labels for unknown statuses (F1 interim) and a non-empty timeline.
2. Refresh orders on resume + live re-render of the open sheet (F6).
3. Awaiting-transfer sheet: "I've paid" and honest waiting text; hide "Cancel order" for shoppers until CX-07 (F3, F4).
4. Signed-out `#/orders` shows a sign-in prompt (F9); keyboard roles (F10).
Practical note: `js/app.js` is ~40 KB and cannot be patched in place through the GitHub API, so SHOP-02 would add a small new file (`js/orders.js`) for the order views and change `js/app.js` only to call it.

## Backend requests / questions raised (for Claude 10 to relay to Codex)
1. `order_tracking(p_order)` customer-safe timeline (F1).
2. Customer-visible refund / dispute state (F5).
3. Delivery-proof model for the customer (F7).
4. CX-15 additions: `awaiting_payment` card orders with pending and abandoned attempts (F2).
5. (Existing) CX-07 customer cancel / supersede (F3).
