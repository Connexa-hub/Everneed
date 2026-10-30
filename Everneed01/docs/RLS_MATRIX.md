# Access matrix (Phase 2)

S = select, I = insert, U = update, D = delete. "own" = rows tied to the signed-in user (or the store they own).
"fn" = only through a server function. Admin has read access to everything; admin writes go through functions except where noted.

| Table | Anonymous | Customer | Merchant | Admin |
|---|---|---|---|---|
| `stores` | S approved and live stores (public columns only) | same | S own (any status), I own draft, U own profile fields, submit via fn | S all; status changes via fn |
| `store_private` | none | none | S/I/U own (no commission, trust, note) | S all; terms via fn |
| `store_applications` | none | none | S/I/U own until decided | S all; decision via fn |
| `store_plans` | none | none | S active | S/I/U/D |
| `store_subscriptions`, `store_payments` | none | none | S own | S all; writes via fn |
| `products` | S published, live store | same | S/I/U/D own (cannot publish) | all |
| `product_private` | none | none | S own; U compliance ref | S all; review via fn |
| `orders` | none | S own | none | S, U (guarded) |
| `order_secrets` (delivery code) | none | S own | none | S |
| `seller_orders` | none | none (use `order_tracking()`) | S own, only after payment; changes via fn | S |
| `order_items` | none | S own | S own store's, after payment | S |
| `order_item_fees` | none | none | S own store's | S |
| `deliveries` | none | S own | none (direct sellers use `mark_delivered`) | S |
| `ledger_entries`, `payouts` | none | none | S own store | S; writes via fn, ledger append-only |
| `refunds` | none | S own | S own store's | S; writes via fn |
| `disputes` | none | S own, I on own order | S own store's | S |
| `notifications` | none | S own, U read flag | S own, U read flag | S |
| `audit_log` | none | none | none | S |
| `reviews` | S (no user ids) | S, I/U/D own | same | D |
| `settings` | S country rows | S country rows | S country rows and `hub` | all |
| `offers` | S automatic offers | same | same | all |
| `rate_limits`, `kv` | none | none | none | none (service only, RLS on with no policies on purpose) |
| storage `media` | read | read | upload under `stores/<own store id>/` | all |

Merchants never read `orders`, customer profiles, or another store's rows. `my_seller_orders()` gives the merchant view with this privacy rule: hub orders show first name and city only; direct orders show full name, phone and address only after the seller has accepted.
Tests: `supabase/tests/phase2_checks.sql` (91 checks) and `supabase/tests/local/concurrency.sh` (parallel last-unit race).
