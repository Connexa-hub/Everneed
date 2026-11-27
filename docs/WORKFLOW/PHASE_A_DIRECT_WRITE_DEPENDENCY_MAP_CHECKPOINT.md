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

## 27 Nov — CX-04 staging ACL snapshot (read-only; reconciled)

A second catalog check using `aclexplode` plus `has_table_privilege` corrected the earlier snapshot. The `information_schema.role_table_grants` view alone was not reliable for inferring direct/effective ACLs in this case.

- Effective `MAINTAIN`: 44 public tables for `authenticated`; 17 for `anon`. This is a broad high-privilege grant and requires remediation.
- Effective table-level `TRUNCATE`: **none confirmed** for `anon` or `authenticated` in the reconciled privilege check. Do not claim client TRUNCATE on the five previously listed tables based on the earlier view.
- `public.disputes`: direct ACL expansion confirms `authenticated` has SELECT, INSERT, UPDATE, DELETE and MAINTAIN; `has_table_privilege(...,'TRUNCATE')` is false. RLS still restricts rows, but MAINTAIN is excessive and DML grants must be evaluated against dependencies.
- Reconciled current privilege totals from the effective check: anon SELECT/INSERT/UPDATE/DELETE each 16 tables; authenticated SELECT 49, INSERT 31, UPDATE 31, DELETE 32 tables. These totals do not equal direct-grant counts because role inheritance and ACL/catalog views differ; use effective checks for the regression assertions.
- The earlier 21/36/37 counts and five-table TRUNCATE claim are retained only as a historical catalog-view result and are not the accepted effective privilege baseline.

### Default ACLs
Earlier default-ACL inspection reported broad defaults for `postgres` and `supabase_admin`. This needs a fresh owner/schema-filtered `pg_default_acl` + `aclexplode` audit before migration; do not treat that snapshot as a final scope map.

### Remaining Phase A gate
Raw REST/fetch, complete Android packaged path, RPC and trigger dependency mapping, Edge Function operations, per-column grants, default ACL owner/schema scope and CI negative tests are not complete. No staging grants or default ACLs changed. Production remains untouched.

## 27 Nov — wrapper/caller second pass (web-portal)

- `shared/supa.js` supports REST GET/POST/PATCH and RPC/Edge Function calls; no DELETE wrapper. Observed writes remain in the caller list above, plus the seller product status transitions detailed below.
- The older root `js/supa.js` wrapper also exposes `upsert`, `del`, and generic `q(path, method)`. Repository search found no direct `Supa.del`, `Supa.upsert`, or generic `Supa.q` mutation call sites; this is a search result, not proof no dynamically constructed/raw mutation exists.
- `web/assets/js/workspace.js` writes `products.status` directly for seller review submission (`pending_review`), bulk review, archive and restore; product edit/create fields are also REST writes. These are real dependencies to preserve or replace with narrowly scoped RPCs/column grants. Review submission should not be treated as publish authority; published/rejected outcomes remain server/admin-controlled.
- `js/theme.js` writes profile `settings` preferences using self-profile PATCH; `shared/supa.js` also exposes Auth user-metadata PUT, but no caller for that helper was located during this pass.
- Storage upload dependency: shared seller image uploader writes to the `media` bucket at `stores/<store-id>/<timestamp>.<ext>` using authenticated REST. Separate Storage policies and upsert semantics must be audited independently; do not conflate them with table grants.
- Edge Function `paystack` uses service-role Supabase client for provider-confirmed order/payment operations and saved-card authorization. `public-forms` uses service-role client only to call allowlisted RPCs after Turnstile/origin/rate-limit validation. Service-role writes do not justify client-role DML.
- Root app wrapper exposes table `DELETE`, upsert and generic methods, but direct mutation call-site searches were empty for `Supa.del`, `Supa.upsert`, `Supa.q`; the root app code needs raw `fetch` and indirect call review before this can be considered complete.

### Next mapping tranche
Review raw fetch/REST in all web and root `js/` modules; auth/profile paths; Storage policies; RPC EXECUTE and SECURITY DEFINER signatures/bodies; trigger tables/functions; views and sequence grants; Android packaged bundle and build-generated copies. Only after this inventory, define column-level grants and replacement RPCs, then stage a narrow revocation migration with rollback and client-flow regression tests.

## 27 Nov — default ACL scope confirmed (read-only)

The owner/schema-scoped `pg_default_acl` + `aclexplode` query confirms entries specifically for **`postgres` and `supabase_admin` in `public`** (not all schemas), each granted to anon, authenticated and service_role:

- Tables (`r`): SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN.
- Sequences (`S`): SELECT, UPDATE, USAGE.
- Functions (`f`): EXECUTE.

These are future-object defaults and are separate from existing effective ACLs. They are a high-priority remediation target, but any ALTER DEFAULT PRIVILEGES change must be owner-specific and replay-tested; preserve required service-role defaults and any intentional public RPCs through explicit allowlists. No defaults changed.
