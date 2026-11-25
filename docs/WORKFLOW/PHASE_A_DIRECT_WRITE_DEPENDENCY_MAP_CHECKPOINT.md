# Phase A — Direct-write dependency map checkpoint

**Date:** 25 Nov 2026  
**Status:** preliminary, read-only inventory; not migration-ready  
**Target:** Everneed-staging only. Production Everneed01 is read-only and untouched.

This checkpoint captures verified browser/shared client call sites found on `web-portal`. It is intentionally not a complete app/Edge Function/RPC/trigger/ACL map. It does not authorize privilege changes.

## Verified direct REST write call sites

| Table | Caller / file | Operations observed | Purpose / constraints to preserve | Remediation direction |
|---|---|---|---|---|
| `stores` | `web/assets/js/setup.js` | INSERT, UPDATE by id | Create/update store name/tagline/about/accent; later categories/country/state/city; logo/cover URLs. Insert sets owner and draft. | Narrow INSERT/UPDATE column grants and owner RLS; protected fields not client-writable. Consider RPC for setup mutations. |
| `stores` | `web/assets/js/settings.js` | UPDATE by id | Seller storefront profile and `storefront_details` sections. Store guard currently allows owner-editable storefront fields. | Map columns individually; exclude owner, slug, approval, activation, official/demo, status. |
| `store_applications` | `web/assets/js/setup.js` | INSERT, UPDATE by store_id | Insert application with store_id/business_name; update business_name. Plan, policy acceptance and submission use RPCs. | Restrict writable application fields and owner rows; preserve submit/decision state through RPC. |
| `products` | `web/assets/js/workspace.js` | INSERT, UPDATE by id | Product fields/body (including name, category, SKU-like fields, images/options/stock/pricing/description); copies start as drafts; edit path also PATCHes `status=pending_review`. | Keep seller-owned draft edits only; backend controls publish/review and protected fields. Review transitions should be RPC-only. |
| `product_private` | `web/assets/js/workspace.js` | INSERT, UPDATE by product_id | Product compliance reference for seller-owned products. | Preserve owner-scoped, narrow field access; avoid granting arbitrary private data writes. |
| `store_private` | `web/assets/js/settings.js`; `web/assets/js/setup.js` | INSERT, UPDATE by store_id | Settings writes pickup address, direct-delivery enablement and delivery zones; setup step writes seller contact phone. | Narrow columns + owner RLS; assess PII exposure and use RPC if mutation semantics need audit. |
| `notifications` | `web/assets/js/notify.js` | UPDATE by id | Set recipient's `read_at` timestamp; also batch mark-read. | Column-only update grant for read state; recipient-only RLS. |
| `profiles` | `shared/supa.js`; `js/theme.js` | UPDATE self via `patchProfile`; Auth metadata update via `setUserData` | Theme preference save writes `settings` JSON (mode/palette/AMOLED) to profile. Auth metadata helper exists; callers still need full inventory. | Column/field allowlist; role/email/identity/security fields protected. Prefer supported profile RPC for sensitive updates. |

## Native/app bundle note\n\nThe native app uses the shared seller web bundle/session. The additional `js/mode.js` direct REST call is a read-only store lookup filtered by `owner_id`; it does not add a table write. `js/theme.js` adds the profile settings write noted above. This repo search found no direct `Supa.delete` wrapper/call pattern; that is not proof there are no raw fetches or other paths.\n\n## Client write surface

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