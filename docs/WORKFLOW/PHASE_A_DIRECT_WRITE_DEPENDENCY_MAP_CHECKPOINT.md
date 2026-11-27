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

## Native/app bundle note

The native app uses the shared seller web bundle/session. The additional `js/mode.js` direct REST call is a read-only store lookup filtered by `owner_id`; it does not add a table write. `js/theme.js` adds the profile settings write noted above. This repo search found no direct `Supa.delete` wrapper/call pattern; that is not proof there are no raw fetches or other paths.

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

## 27 Nov — CX-04 staging ACL snapshot (read-only)

Effective table grants were re-queried in Everneed-staging. The full per-table privilege result is grouped below; only anon/authenticated grants are included. This is catalog evidence, not a statement that every grant is reachable through PostgREST.

- anon: 21 tables with INSERT/UPDATE/DELETE (banners, category_attributes, collections, offers, orders, product_inventory_movements, product_links, product_media, product_price_tiers, product_variant_private, product_variants, products, profiles, public_products, public_reviews, public_stores, reviews, settings, size_charts, auto_offers and product_ratings). SELECT is present on most, but not on reviews. 5 tables additionally have REFERENCES/TRIGGER/TRUNCATE (auto_offers, product_ratings, public_products, public_reviews, public_stores).
- authenticated: 36 tables with INSERT/UPDATE; 37 with DELETE. Includes support/configuration tables and client-side product/store workflows; **do not blanket-revoke**. 5 tables additionally have REFERENCES/TRIGGER/TRUNCATE (auto_offers, product_ratings, public_products, public_reviews, public_stores). Sensitive tables such as orders, disputes, products, profiles, messages, support_queue, stores and store_private require dependency-specific narrowing.
- The specific disputes table grants to authenticated are SELECT, INSERT, UPDATE, DELETE and MAINTAIN. Direct ACL expansion shows no authenticated TRUNCATE on disputes (service_role does hold it). The earlier CX-04 wording claiming authenticated TRUNCATE on disputes is not confirmed by the current staging ACL; keep that claim corrected. Authenticated MAINTAIN is still excessive.
- `has_table_privilege` and ACL expansion confirmed MAINTAIN effective on 44 public objects for authenticated and 17 for anon. TRUNCATE is effective on five objects per client role, and the exact object list from the direct ACL snapshot is auto_offers, product_ratings, public_products, public_reviews, public_stores. Use direct ACL expansion/effective checks to reconcile information_schema counts; don't rely on one catalog view alone.

### Default ACLs
Both `postgres` and `supabase_admin` have broad default table privileges in public, including INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER and MAINTAIN to anon/authenticated/service_role. Default sequence ACLs also include SELECT/UPDATE/USAGE; default function EXECUTE is broad. The exact owner/schema coverage must be reconciled with Supabase-managed schemas before remediation. This is a confirmed default-ACL concern.

### Remaining Phase A gate
Raw REST/fetch, complete Android packaged path, RPC and trigger dependency mapping, Edge Function operations, per-column grants, default ACL owner/schema scope and CI negative tests are not yet complete. No staging grants or default ACLs changed. Production remains untouched.
