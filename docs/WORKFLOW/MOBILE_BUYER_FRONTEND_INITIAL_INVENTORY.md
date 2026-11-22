# Mobile Buyer Frontend — Initial Repository Inventory

**Audit date:** 22 November 2026  
**Branch inspected:** `feature/variant-checkout` (PR #32, draft, target `web-portal`)  
**Scope:** Read-only repository inventory following the decision to resume buyer-app frontend work.

## Executive finding

Everneed's buyer experience is present as a vanilla JavaScript application under the repository root (`index.html`, `js/`, `css/`, `shared/`). It is configured for Capacitor Android (`@capacitor/android` 6 and `capacitor.config.json`), but a native `android/` project is not committed in this branch; CI generates the Android project. Therefore, the correct next task is to continue and improve the existing buyer frontend, not start a separate native app or replace the current stack.

The website/public portal in `web/` is a separate surface. The customer shopping UI is the root app and is intended to be app-first. APK packaging remains paused.

## Evidence-based inventory

| Area | Files/evidence | Initial finding |
|---|---|---|
| App entry | `index.html` | Root SPA loads app modules in a fixed script order and mounts into `#app`; tabs, sheets and busy/offline UI elements exist. |
| Core buyer logic | `js/app.js` | Large legacy-style SPA; country context, product catalogue, cart, checkout, orders/account and admin paths appear in the same module. Requires a focused review and incremental refactoring, not a rewrite. |
| Product page | `js/shop.js` | Existing product page includes image gallery, variant/option selection, size guide, reviews and order tracking. Product details include maker/address/origin/shipping-from/weight/dimensions/material/SKU when present. Preserve and test these. |
| Payments registry | `js/payments.js` | Current visible registry includes bank transfer, WhatsApp order, card/Paystack, and “pay when delivered” using saved-card charging. Do not assume all paths are supported or safe for the new settlement policy. Audit each against backend and policy; disable/guard any unsupported option rather than presenting it as a verified launch payment method. |
| Store/data layer | `js/store.js` | Supabase-backed data path with local-storage fallback, products, banners, orders, collections, size charts, ratings, offers, saved cards and public stores. Offline/local fallback must be audited so test/mock records cannot be confused with real orders. |
| Configuration | `js/config.js`, `js/supa.js`, `shared/config.js`, `shared/supa.js` | Environment and Supabase client configuration split across app/shared files. Readiness task APP-08 is documented: Android test builds must use staging, production release uses live. Current configuration is not yet verified to be staging-safe. |
| Capacitor | `package.json`, `capacitor.config.json` | Capacitor 6 Android, geolocation, local notifications, camera, AdMob and status-bar packages declared. Android wrapper is generated in CI; `webDir` is `www`. Confirm package installation/build flow before native work. |
| Styling | `css/app.css`, `css/components.css`, `css/tokens.css`, `css/fonts.css` | Existing token-driven UI/theme system; preserve tokens and palettes, avoid framework migration. |
| Tests | `tests/`, `tools/check.mjs`, workflow files | Inspect test coverage for buyer flows and add acceptance tests as features are made functional. Current inventory does not establish app E2E coverage. |
| Web portal | `web/` | Separate public website/seller/admin portal; continue its roadmap in parallel. It does not replace app checkout. |

## Critical risks and blockers to address before sandbox checkout

1. **APP-08 environment split:** documentation says the Android app currently uses a live database configuration. Confirm exact current code and make staging explicit before app checkout testing. Never test against production.
2. **Checkout contract:** the existing checkout UI/order/payment paths predate the newly hardened immutable quote/snapshot and verified payment journal work. Map and migrate the UI to the backend's authoritative quote/attempt contracts; do not assume the old client path is compatible.
3. **Payment methods:** bank transfer, WhatsApp and saved-card “pay when delivered” exist in the code registry. Their operational state and policy must be individually verified. Hide or mark unavailable any path not fully backed by safe backend handling. Do not add wallet UI as if wallet funding/withdrawal/payment is complete.
4. **Cart and price authority:** client-side cart totals and discounts may be presentation-only. Checkout must fetch/revalidate server-side totals, inventory, discounts, currency and quote identity before creating a payment attempt.
5. **Order states:** the existing app has legacy status labels/tracking logic. Reconcile these with current order/seller-order/hub/payment states; avoid showing paid or delivered based solely on client mutation.
6. **Multi-seller checkout:** prove store-grouped cart, seller allocation, package/order identities and delivery quote before accepting a multi-store checkout.
7. **Staging test accounts/data:** establish staging buyer account and safe seed products/stores; do not use real customer data.
8. **Native permissions/plugins:** camera, geolocation, notification and ads packages are present. Review permission prompts and whether each is needed in buyer flow; don't request permissions on launch without a clear feature reason.

## Recommended implementation work packages

### APP-FE-01 — Frontend inventory and design map
- Map routes/views, module responsibilities, data flows, existing components and missing states.
- Record screen-by-screen existing/partial/missing status.
- No large rewrite; preserve known working features.
- **Acceptance:** inventory and sequence reviewed; key routes identified; risks listed.

### APP-FE-02 — App environment and staging safety (APP-08)
- Centralize/verify environment selection so preview/dev/test uses staging and release uses production only through a controlled release config.
- Add an unmistakable staging indicator in app UI.
- Verify app auth, product/store/order reads and Edge Function calls target staging.
- Ensure no production payment key/config is bundled in test builds.
- **Acceptance:** evidence from a staging app session and configuration test; no production requests.

### APP-FE-03 — Discovery/search/storefront
- Home/category/search, filters/sort, store pages and pagination/loading/error/empty/offline states.
- Seller/store identity, verification only if source-backed.
- **Acceptance:** staging products/stores browsable without mock/live confusion.

### APP-FE-04 — Product detail completeness
- Images, SKU, description, manufacturer, attributes/material/origin/weight/dimensions, variant/size guide, stock, seller, price/currency, delivery/returns information.
- **Acceptance:** variants and stock validated, item selection is unambiguous, all existing detail features regression-tested.

### APP-FE-05 — Cart and multi-store grouping
- Quantity/variant editing, store grouping, remove/edit, stale-price/stock handling, transparent subtotal/discount/fees.
- **Acceptance:** cart can be revalidated server-side and totals reconcile to quote.

### APP-FE-06 — Address and delivery
- Saved/new address, supported coverage, delivery method, hub/direct options only when backend enabled, fee/ETA from server.
- **Acceptance:** unsupported address/method cannot proceed and user sees reason.

### APP-FE-07 — Quote and checkout
- Server quote/snapshot and identity; currency, item/store allocations, platform discounts, delivery and total; re-quote on expiry/change.
- **Acceptance:** immutable quote contract is respected and stale checkout fails safely.

### APP-FE-08 — Paystack staging flow
- Initialize with server-side persisted payment attempt; handle redirect/return, pending, success, failure, cancellation, verification, retry and recovery.
- **Acceptance:** no client-only success; settled order and one balanced journal confirmed from staging; duplicate webhook/verify safe; mismatch quarantined/rejected.

### APP-FE-09 — Orders/tracking/account/support
- Order list/detail, store/package grouping, accurate status milestones, account/address/preferences and support.
- **Acceptance:** data reflects server truth and regression coverage passes.

## Recommended immediate Claude task

Start with APP-FE-01 and APP-FE-02 together: complete the route/screen inventory and inspect the current config environment selection. Produce a short findings summary and proposed small implementation PRs, then fix staging isolation before buyer checkout changes. Do not begin payment E2E until the staging app target is proven.

## Scope boundaries

- Continue web portal work in parallel.
- Do not enable APK workflows or generate a release APK in this checkpoint.
- No production deployment, live payment, live migration or use of real customer data.
- No framework/native rewrite without owner approval.
- This document is an initial source-based inventory, not a full interactive app audit; files have not been executed on-device in this pass.
