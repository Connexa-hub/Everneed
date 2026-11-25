# Store ownership lookup and staging order test data — 25 November 2026

**From:** ChatGPT / Codex (backend and integration)
**To:** Claude frontend / app
**Branch:** `web-portal`
**Status:** ANSWERED for current ownership lookup; staging order fixtures pending owner choice.
**Environment inspected:** Everneed-staging `vjiadqygpyebpisxslbx` only. Production was not queried or changed.

## 1. Current call that tells the app a user owns a store

The current app implementation is in `js/merchant/merchant.js`, function `load()`:

```js
var uid = Supa.uid();
q("/rest/v1/stores?select=*&owner_id=eq." + enc(uid), "GET", true)
```

This is an authenticated PostgREST read against `public.stores`, filtered by `owner_id = auth.uid()` (the signed-in Supabase user UUID). If a row is returned, the current app treats it as the user's owned store and loads `store_private`, `store_applications`, `products`, `product_private` and notifications.

**Do not confuse this with a dedicated RPC.** The current owner lookup is the table read above; it is not `my_access()`.

## 2. Future universal access call

R23 / `ROLES_AND_ACCESS_PROPOSAL.md` was accepted on 25 November. The target function is:

```sql
public.my_access()
```

It will return all active platform/store contexts, role templates, canonical permission keys and scoped store metadata for the caller. It replaces owner-only inference once implemented and verified.

**Staging verification:** `public.my_access()` currently does not exist (catalog query returned 0 matches). Do not call it or build the current screen assuming it is deployed. Preserve the current owner lookup as compatibility behaviour until the backend migration and tests are delivered. A missing function must not be treated as "no store" or as an authorization grant.

## 3. Everneed-staging data snapshot

Read-only inspection of `vjiadqygpyebpisxslbx` on 25 November:

| Entity | Count |
|---|---:|
| `stores` | 3 |
| `products` | 1 |
| `orders` | 0 |
| `seller_orders` | 0 |
| `my_access()` function | absent |

Existing staging stores:
- `Testing` — approved, activation live, owner-bound.
- `Shopflow` — approved, activation live, owner-bound.
- `EverNeed` official store — approved, activation verification_required, no owner.

Only published product found:
- `Wallpaper` — price NGN 30,000, stock 10, in Shopflow.

Therefore the zero-order observation is correct. Seller order queue and customer order history cannot currently be validated against real order rows.

## 4. Safe test-data policy

No orders were inserted by this inspection. Before creating fixtures, the owner must choose which scenario is required:

- **Unpaid checkout fixtures:** use the real checkout creation path and keep payment status `awaiting_payment` / `awaiting_transfer`. These exercise customer order history and admin pending-payment views, but seller order visibility may remain gated until payment is verified/released.
- **Simulated-paid seller queue fixtures:** only on staging, and only when clearly identified as test/simulated payment. Must use the approved payment confirmation/settlement path and verify all finance journal, seller-order release, inventory and audit side effects. Never write `released=true`, payment status, ledger rows or balances directly to manufacture a live-looking order.
- **Full workflow fixtures:** require a designated staging buyer account, seller owner account, exact order route (direct or hub), and a test-only payment method/provider path. Do not use real payment credentials or claim a real payment occurred.

A product stock reservation is a side effect of checkout. The existing Shopflow Wallpaper has stock 10; fixture creation must record stock before/after and use cancellation/expiry cleanup where appropriate. Do not create multiple orders without a fixture manifest and cleanup plan.

## 5. Request back to Claude

- Use the existing owner lookup above for today's seller entry flow.
- Treat `my_access()` as planned/unavailable until a later handoff marks it deployed.
- Build the order screens with honest empty states. Do not fabricate orders in the UI.
- Once fixtures are approved and inserted, test customer history, admin orders and seller order queue with the actual visibility/payment lifecycle.

## 6. Not done

- No order or seller-order rows were created.
- No product stock was reserved or changed.
- No payment was reported or confirmed.
- No schema, migration, RLS, RPC or production setting was changed.
- No test user credentials or secrets were accessed.
