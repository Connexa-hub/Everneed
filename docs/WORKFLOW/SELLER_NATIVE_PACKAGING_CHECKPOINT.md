# Native seller workspace packaging — implementation checkpoint

**Branch:** `feat/seller-app-packaging-layer` (based on `web-portal`)  
**Status:** asset staging implemented; route/session activation intentionally not enabled.

## What this change does
- Adds `tools/package-seller.mjs`, a repeatable build-time staging script.
- Copies the web seller workspace to `www/seller/`, isolated from shopper files.
- Inserts a bootstrap marker setting `window.EV_NATIVE_SELLER=true` and `window.EV_SESSION_KEY="en_sess"`.
- Adds `tools/check-seller-package.mjs` smoke assertions.
- Android build workflow now stages and checks this package after shopper assets are copied.

## Why it is not launched yet
The seller workspace uses root-relative URLs and server routes such as `/portal`, `/inbox`, `/me`, and `/assets`. Opening `www/seller/index.html` as-is would resolve those paths at the app root and could route into the shopper shell or fail to load assets. The native route adapter must first introduce an isolated seller path namespace and normalize routes/assets without changing desktop website URLs.

## Next implementation tasks
1. Implement an app-only route adapter mapping seller workspace paths into a namespaced local path, while keeping the original website route paths untouched.
2. Confirm app root and seller workspace navigation/back behaviour (seller Home returns to shopper app; back within seller follows seller history).
3. Update app session client to adopt the latest shared `en_sess` before refresh and when returning from seller.
4. Add Seller / My Store entry, with store ownership lookup and onboarding redirect.
5. Add sign-out shared-session test.
6. Add route/session tests and verify Android APK build + Hot 70 device testing.

No live Supabase settings or migrations were changed. No production/main changes were made.
