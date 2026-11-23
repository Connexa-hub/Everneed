# Native seller workspace packaging — implementation checkpoint

**Branch:** `feat/seller-app-packaging-layer` (based on `web-portal`)  
**Status:** Seller bundle now stages with a route-prefix and asset isolation adapter. Not yet activated by shopper navigation; shared session synchronization and ownership checks remain.

## Implemented in this slice
- Build script copies seller workspace to `www/seller/` without overwriting shopper entrypoint.
- Native-only bootstrap defines `EV_NATIVE_SELLER=true` and shared session key `en_sess`.
- Seller assets are rewritten to the dedicated `/seller/assets/` namespace and favicon paths.
- Packaged seller router normalizes `/seller/<seller-route>` back to its seller route and prefixes generated navigation links.
- Smoke test checks staged assets, bootstrap, and route/asset adapter markers.
- Android build workflow stages and runs the seller package check.

## Current boundaries / caveats
- The public web source is unchanged; this adapter is injected into the packaged copy only.
- The seller package is not yet linked from shopper UI and does not yet enforce store ownership before entry.
- Shopper `js/supa.js` now adopts the newest stored `en_sess` before checking expiry/refreshing, and on a refresh failure it checks for a newer session before clearing local state. This is a basic cross-shell synchronization guard; a true concurrent refresh lock and session-flow tests remain needed.
- Android Back, seller-to-shop switching, sign-out propagation, and actual APK/device validation are still pending.
- The packaging smoke test has been added but its CI execution is pending confirmation.

## Next steps
1. Validate the route adapter with a browser/CI test for routes, hash redirects, links, and asset requests.
2. Add a shared refresh coordination mechanism and tests for session adoption, stale-token races, logout propagation, and auth failures.
3. Add authenticated store ownership lookup, seller entry, and no-store onboarding redirect.
4. Add Shop/My Store switching and Android Back handling.
5. Build staging APK and test on Infinix Hot 70.

No hosted Supabase settings/migrations, main branch, or production deployment was changed.
