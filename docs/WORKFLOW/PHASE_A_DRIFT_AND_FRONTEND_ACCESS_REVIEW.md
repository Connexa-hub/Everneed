# Phase A continuation — migration drift and frontend access-client review

**Date:** 25 November 2026  
**Target:** Everneed01 production read-only; Everneed-staging migration history; repository `web-portal`  
**Status:** Audit only. No database, secrets, or production changes.

## 1. Migration-history comparison

Everneed01 records migrations through `015_support_sla_public` (timestamped history, with early foundation and cleanup entries). Everneed-staging records the same logical baseline through 015, but then includes additional migration groups through `20261122140408_fin03_verified_payment_journal_posting`.

Staging-only logical groups include:
- public RPC security and authenticated RPC boundary hardening (016–018)
- regional policy, store verification gate and policy acceptance (019–022)
- managed seller categories and storefront public details (023–025)
- payment lifecycle, checkout snapshots, attempt/recovery and legacy search-path fixes (026–032)
- double-entry finance journal (033) and later finance hardening/allocation/funding/snapshot lifecycle
- seller onboarding entitlements/quotas and trial/plan selection/approval
- provider-neutral seller verification foundations and cleanup
- seller notification contract and trigger ACL
- product catalogue/taxonomy, variants, inventory movements, product editor entitlements, admin store context, and catalogue trigger ACL hardening
- verified-payment journal posting (FIN03)

This is not a small patch backlog. Production requires a dependency-aware rollout plan and compatibility review. The migration ledger alone does not prove that all staging migrations are safe to apply to production.

## 2. Latest Claude frontend commits reviewed

Latest branch commits:
- `25518f70`: lazy-load product editor to reduce initial bundle cost (WEB-S22 part 21)
- `b4f9bbd0`: access client with safe fallback and centralized permission-gate table (WEB-S22 part 22)

Files reviewed:
- `web/assets/js/ds-access.js`
- `web/assets/js/ds-lazy.js`
- `tools/web-seller-tests/ds-access.js`
- `tools/web-seller-tests/ds-lazy.js`
- `web/index.html`

### Positive findings
- Access client explicitly treats `my_access()` as server-provided capability data; it does not fabricate permissions.
- Missing RPC/network failure returns unavailable and callers can retain legacy behavior, documented as temporary compatibility.
- Contexts are limited to platform/store planes; store IDs are matched when requested.
- Expired assignments are excluded.
- The test file covers missing RPC, network failure, permissions, scope, plane separation, wildcard grants, aliases, expiry, session reset.
- Product editor is lazy-loaded only on product route, uses same-folder URL, caches load, and falls back to old portal route on load error.
- Index now loads lazy loader and access client as dedicated modules.

### Review cautions / contract blockers
1. **Fallback is compatibility, not security.** When `my_access()` is unavailable, UI gates return the legacy value. Backend authorization remains authoritative. Do not claim the new role system is enforced until server RPC/RLS enforcement exists.
2. **No production or staging `my_access()` implementation verified.** UI availability remains false until the RPC exists. Backend Phase A inventory and schema/RPC design must precede permission-management UI.
3. **Permission-key aliases are temporary.** The gate table accepts variants such as `store.catalogue.write` and `store.catalog.edit`; choose one canonical namespace in the backend contract and remove compatibility aliases once migrations and tests are aligned.
4. **Context switch UI is not security boundary.** Active-context state only affects presentation; every request and mutation must independently authorize its context and resource.
5. **Wildcard matching deserves a focused regression review.** Confirm server-side wildcard semantics exactly match frontend matching and that wildcards cannot imply write/admin keys.
6. **Current access-client test files have been inspected but not executed in this environment.** CI/test results are not claimed.
7. **Lazy loading is a performance change only.** It does not prove product-editor behavior or route E2E; confirm script order, URL handling, CSP compatibility, and real product route in preview.

## 3. Release boundary

- Everneed01 production remains unchanged.
- Everneed-staging remains unchanged during this audit.
- No role assignment, ownership classification, migration, or access change has been made.
- `web-portal` remains development branch; `main` remains protected for owner-approved PR review/merge.

## 4. Next audit sequence
1. Reconcile every repository migration with both project ledgers and categorize additive, destructive, data-backfill, ACL/RLS, dependency and environment-specific changes.
2. Inspect complete SECURITY DEFINER inventory, effective EXECUTE grants, fixed search_path, auth/ownership checks, and API-exposed schema configuration in Everneed01.
3. Build actor/resource/action matrix and cross-store threat tests.
4. Review order/payment/ledger/payout/dispatch lifecycle and current delivery model.
5. Produce staged compatibility rollout with rollback and tests; production migration only after explicit owner approval.
