# Seller app packaging implementation plan

**Branch:** feat/seller-app-packaging-layer  
**Target:** web-portal only; staging app packaging. No production deployment or hosted migrations.

## Goal
Ship the existing seller workspace inside the Capacitor shopper APK without copying it over the shopper app, breaking seller web routes, or allowing two Supabase clients to refresh the same refresh token independently.

## Architecture decision
- Keep shopper entrypoint at `www/index.html`.
- Package the seller website as a separate entrypoint under `www/seller/`.
- Serve it from the same WebView origin, so the existing `en_sess` session is shared; never put access/refresh tokens in URLs.
- Prefix seller route navigation with `/seller` and normalize the prefix inside the seller router. Static seller assets remain in the dedicated `/assets/` namespace already used by the website; verify collisions before packaging and fail on collision rather than silently overwriting.
- The native app opens the seller entrypoint only after server-side store ownership is confirmed. Accounts without a store go to the existing seller application route.
- The web seller shell's `ds-app.js` must be explicitly enabled in the packaged seller build. Website opt-in and desktop behavior stay unchanged.

## Session safety contract
1. `en_sess` is the shared persisted session key.
2. Before refreshing, each client re-reads the latest session from storage.
3. The app re-reads the seller-updated session when returning to shopper mode.
4. Logout clears the shared session once and both shells react to the auth-state change.
5. Never duplicate refresh tokens in separate persistent keys or pass tokens via URL/query/hash.

## Routing and navigation
- Shopper -> Seller entry is a normal authenticated action.
- Seller route URLs are scoped under `/seller/`; routes such as `/seller/portal/orders` map internally to the seller router's `/portal/orders`.
- Seller links, form actions, legacy hash routing, history navigation and redirects must preserve the seller prefix.
- Android Back first uses seller history; seller Home returns to shopper shell. Avoid trapping users in the seller shell.

## Implementation sequence
1. Add a staging packaging script and unit/static tests that verify the seller bundle exists, entrypoint injection, routes are prefixed, no collisions, and the shopper files remain untouched.
2. Implement a seller-specific routing adapter in the packaged seller entry (not in the public web app).
3. Implement shared-session refresh synchronization in shopper and seller clients, with tests for stale copies and refresh re-entry.
4. Add a store-ownership check and Shop/My Store switch UI.
5. Add Capacitor back-button behavior and lifecycle session refresh.
6. Run CI and build the staging APK; owner tests the installed build on Infinix Hot 70.

## Acceptance criteria
- Shopper root entry and assets remain identical to the current build.
- Seller workspace is reachable only after login and store ownership validation.
- The seller shell loads without missing scripts/styles or route escapes to shopper screens.
- Session survives switching both directions and does not invalidate due to concurrent refresh.
- Logout ends both shells.
- No hosted DB migration, Supabase configuration, production branch, or production deployment is changed.
