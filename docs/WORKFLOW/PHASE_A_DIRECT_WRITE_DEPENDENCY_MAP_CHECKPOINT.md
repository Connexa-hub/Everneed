# Phase A — Direct-write dependency map checkpoint

**Date:** 25 Nov 2026  
**Status:** preliminary, read-only inventory; not migration-ready  
**Target:** Everneed-staging only. Production Everneed01 is read-only and untouched.

This checkpoint captures verified browser/shared client call sites found on `web-portal`. It is intentionally not a complete app/Edge Function/RPC/trigger/ACL map. It does not authorize privilege changes.

## Verified direct REST write call sites

| Table | Caller / file | Operations observed | Purpose / constraints to preserve | Remediation direction |
|---|---|---|---|---|
| `stores` | `web/assets/js/setup.js` | INSERT, UPDATE by id | Create/update seller store during setup; insert sets owner and draft state. Upload then updates logo/cover. Owner/status/approval/slug/official fields remain backend protected. | Narrow INSERT/UPDATE column grants and owner RLS; protected fields not client-writable. Consider RPC for setup mutations. |
| `stores` | `web/assets/js/settings.js` | UPDATE by id | Seller storefront profile and `storefront_details` sections. Store guard currently allows owner-editable storefront fields. | Map columns individually; exclude owner, slug, approval, activation, official/demo, status. |
| `store_applications` | `web/assets/js/setup.js` | INSERT, UPDATE by store_id | Seller onboarding application/business name, then plan selection and policy acceptance/submission through RPCs. | Restrict writable application fields and owner rows; preserve submit/decision state through RPC. |
| `products` | `web/assets/js/workspace.js` | INSERT, UPDATE by id | Create/edit/copy drafts; photo metadata; later request review status. | Keep seller-owned draft edits only; backend controls publish/review and protected fields. Review transitions should be RPC-only. |
| `product_private` | `web/assets/js/workspace.js` | INSERT, UPDATE by product_id | Product compliance reference for seller-owned products. | Preserve owner-scoped, narrow field access; avoid granting arbitrary private data writes. |
| `store_private` | `web/assets/js/settings.js` | INSERT, UPDATE by store_id | Owner-configured pickup address, direct delivery and delivery zones. | Narrow columns + owner RLS; assess PII exposure and use RPC if mutation semantics need audit. |
| `notifications` | `web/assets/js/notify.js` | UPDATE by id | Set recipient's `read_at` timestamp; also batch mark-read. | Column-only update grant for read state; recipient-only RLS. |
| `profiles` | `shared/supa.js` | UPDATE self via `patchProfile`; Auth metadata update via `setUserData` | Profile fields and auth user metadata. Direct call sites need further mapping. | Map fields; role/email/identity/security fields must stay protected. Prefer supported profile RPC for sensitive updates. |

## Client write surface

The shared wrapper in `shared/supa.js` provides:
- `Supa.insert(table, body)` → REST POST
- `Supa.patch(table, id, body)` → REST PATCH by id
- `Supa.patchBy(table, column, value, body)` → REST PATCH by predicate
- `Supa.patchProfile(body)` → authenticated profile PATCH
- `Supa.rpc(name, args)` and `Supa.fn(name, body)` → RPC/Edge Function routes
- `Supa.upload(file, folder)` → Storage object POST (Storage grants/policies are out of scope for this public-table ACL pass)

No direct delete wrapper was found in the current shared client.

## Server-side / non-browser dependency noted

`supabase/functions/paystack/index.ts` uses server-side service credentials for provider/payment operations, including order updates, saved-card authorization reads, and reusable authorization upserts. This is not a reason to preserve equivalent anon/authenticated grants. Keep the service role path and validate payment lifecycle/reconciliation separately.

## Read paths to include in full dependency map

Observed client reads include public/owner-scoped REST reads for stores, store applications, products, product-private compliance/review metadata, store-private settings, store plans, and profiles. RPC reads include `my_store_entitlements`, `my_seller_orders`, `seller_product_capabilities`, `seller_product_category_schema`, `seller_plan_catalog`, `my_access`, and policy/plan/onboarding functions. RLS and intentional public-read rules must remain intact.

## ACL migration gate — not yet satisfied

Before drafting a migration:
1. Inventory every direct mutation/read in web/shared/native/Android packaged web bundle and Edge Functions; search by wrapper and raw REST/storage/fetch paths.
2. Inventory RPC EXECUTE privileges and function/trigger dependencies; separate caller identity from service-role writes.
3. Map every table/column to effective grants, RLS predicates, owner/scope, business state, and intended operation.
4. Capture sequence, default ACL (postgres and supabase_admin), views/security-invoker, storage and realtime as separate scopes.
5. Write regression tests for least-privilege grants, anon/authenticated forbidden writes (including TRUNCATE), protected columns, cross-owner denial, and expected supported flows.
6. Run CI/migration replay and staging functional tests before applying any grant changes.

**Safety:** No ACLs or data changed during this checkpoint. No migration is drafted or applied. Production remains untouched.