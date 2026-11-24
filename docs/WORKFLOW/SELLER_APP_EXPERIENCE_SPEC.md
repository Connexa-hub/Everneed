# Seller app experience (from the owner's screen recording, 23 Nov 2026)

Owner: Claude (design and front end), tracker WEB-S22. Backend asks go to `SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md`. Staging only.

## What the recording shows
A phone seller app (another brand's, used only as a reference for structure and feel; no names, icons or artwork are copied):
- **Frame:** avatar, store logo and name, bell on top. A floating bottom bar: round Search, a pill with Home / Orders / Products / Menu, a round assistant button. A floating "plan" pill with days left while on a trial.
- **Menu:** full-screen, black, large bold labels with expandable groups; gear, quick-action pill and close at the bottom.
- **Search:** full screen, tabs All / Orders / Products / Customers, recent searches, skeleton rows while loading, "no results" state.
- **Lists:** screen title with a dropdown to sibling screens, + and more buttons, status tabs, search + sort + filter row, rows with thumbnail, bold title, stock and variant count, status dot.
- **Detail:** product page as stacked cards (status, media strip, title, price, publishing, options, variants, inventory, organisation rows); an actions sheet (duplicate, preview, archive, red delete).
- **Settings:** "App settings" (push notifications, biometric unlock) and "Store settings" (General, Plan, Billing, Users, Roles, Security, Payments, Checkout, Customer accounts, Shipping and delivery...).
- **Home:** "Get ready to sell" checklist with progress, plan upsell card, true empty states with a black pill button.

## Decision (owner, 23 Nov): web first, app packaging later
The app (repo root) and the web seller workspace (`web/`) are separate codebases. The new shell is built in the web seller code, reachable on a phone with `?shell=app` (remembered; `?shell=web` turns it off) and switched on automatically inside the native app later. Nothing changes for desktop or for sellers who do not opt in.

## Built (slice 1, `web/assets/js/ds-app.js`, `ds.css`)
Floating bar (Search, Home, Orders, Products, Menu, Messages with unread badge), store header, trial pill (days left from `store_subscriptions`, hidden otherwise), full-screen menu (Home, Orders, Products with All products and Add product, Messages, Plan, Settings; gear, Add product, close), search (products and orders from live data, recent searches kept on the device only, skeleton while loading, true empty and no-results states). The product editor hides the bar so its action bar owns the bottom. Existing screens (Home, Products, Orders, Messages, Plan, editor) are reused unchanged.

## Deliberately not shown (no backend yet, nothing faked)
Customers list, Growth, Discounts, Content, Markets, Credit, Analytics reports, Collections, Inventory locations, Purchase orders, Transfers, Stock counts, Gift cards, Scan inventory, Users and Roles. They appear in the menu only when a real contract exists. The backend asks are R13 to R22 in `SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md` (team and roles, customers, payouts, push preferences, collections, discounts, analytics, inventory depth, admin search, platform staff and audit); gift cards, markets, credit, purchase orders, transfers and stock counts are deliberately not requested.

## Slice 2 (done)
Screen titles are a tap target that opens a "Go to" sheet (Home, Orders, Products, Messages, Plan, Store settings, Account). Home has a "Get ready to sell" checklist (also on the normal layout) built only from what the store record really holds: first product, logo, cover, about or tagline, opening hours, returns, pickup address; it disappears when complete. The menu now has Store settings (the existing `/portal/settings` sections) and Account.

## Admin and the official store (done, same shell)
On phone width with `?shell=app`, signed-in admins get the same frame. Header: avatar, a workspace button (Platform or Everneed Store) and the bell. Bar: workspace circle, pill with three tabs and Menu, messages circle.
- **Platform:** tabs Overview, Sellers, Review; menu adds the Everneed Store group (Overview, Products, Orders, Messages, Staff) and Inbox.
- **Everneed Store only:** tabs Overview, Products, Orders; menu Messages, Staff, Account. No platform link anywhere, and platform routes still redirect to the store (the rule from `ds-admin.js`). This is front-end separation only; real store-scoped staff access needs backend request R2.
- Menu footer has a Switch workspace button instead of Add product.

## Slice 3 (done): product rows
In the phone shell each product is one row (thumbnail, name, price, variants and stock, status chip) with a ⋮ button that opens an actions sheet (Submit for review, Edit, Duplicate, Archive or Restore). The sheet runs the card's own buttons, so there is one set of actions and no duplicated logic.

## Slice 4 (done): loading skeletons and app hooks
- Skeleton: tapping a tab or bar item keeps the old page for 180 ms (so fast or cached visits never flash), then shows a skeleton until the new page is drawn. Reduced motion keeps the old page dimmed instead. The tap feedback now also covers the floating bar.
- **Hooks for the packaged app (agreed with ChatGPT's PR #41 plan):** `window.EV_NATIVE_SELLER===true` switches the phone shell on by default; the menu then starts with **Shop**, which calls `EVSeller.exit()` (default `location.assign("/index.html#/")`, or your own `window.EV_EXIT_SELLER(to)`); a lost session calls `EVSeller.exit("login")` instead of routing to a seller sign-in page that does not exist in the bundle; `EVSeller.back()` closes the menu or search overlay and returns `true` if it consumed Android Back, otherwise `false` so the app can go back in seller history, and from seller Home exit to shopping.

## Next slices
1. Product detail as stacked cards (the editor already has section cards and a section nav).
2. Settings screen split into App settings (push notifications, biometric unlock: needs native plugins) and Store settings (General, Plan, Billing).
3. Shop / My store mode switch for a seller using the app.
4. App packaging (ChatGPT): bundle the web seller workspace into the app build, hand the signed-in session across, set the native flag so `ds-app.js` switches on.

## Needs the owner
Real-device check of the floating bar, safe areas and the Android back button; those cannot be tested here.

## Session hand-over contract (shopper app to bundled seller workspace)
Agreed direction (owner, 23 Nov 2026): the shopper signs in once in the app, shops, taps Seller / My store, and the bundled seller workspace opens already signed in. It works whichever sign-in method was used (email code, password, or ChatGPT's native Google flow, PKCE through Capacitor Browser and the `com.everneed.store://auth/callback` return), because they all end as the same stored session.

1. **One stored session.** The app's session (`en_sess`: `access_token`, `refresh_token`, `expires_at`, `uid`) is the single source of truth. The seller workspace is bundled into the app build and served from the same origin, so it can read it directly. No token travels in a URL.
2. **Web side (done, WEB-S22):** `shared/supa.js` now honours `window.EV_SESSION_KEY`. The app build sets `window.EV_SESSION_KEY="en_sess"` before loading it. It also takes the newest stored session before using or refreshing, since refresh tokens are single use and two clients refreshing separate copies would log each other out. Tested in `supa-session.js`.
3. **App side (ChatGPT, not done):**
   - Bundle `web/` into `www/seller/` in the app build (staging config for non-main builds), set the native flag so `ds-app.js` is on by default, and open it from the "Seller" entry.
   - The app's own `js/supa.js` must do the same before refreshing: re-read `en_sess` and use the newest, and re-read it when returning from the seller workspace to shopping.
   - Sign out must clear `en_sess` once, which signs out both.
   - Show "Seller" only for an account that owns a store; otherwise route to the open-a-store flow.
   - Android back button: inside the seller workspace go back within it, and from its Home return to the shopping experience.
4. **Not changed:** the app's Google sign-in itself, redirect URLs, or any production setting.

## Shop / My store switch lives in the app (slice 5)

Shopping exists only in the app, so the switch is in the app frontend (`js/mode.js`, `css/mode.css`), not in the web seller bundle.

- Shown on the Me page, and on the in-app admin dashboard for admins, only in the native app (Capacitor) or with `?mode=1` for testing, and only when signed in.
- Right-hand button label: **My store** (owns a store), **Admin** (profile role admin), **Sell** (signed in, no store yet). Owner or admin: sets `localStorage en_mode=seller` and goes to `/seller/index.html`. No store: goes to the existing open-a-store flow `#/m`.
- No token is passed. The seller bundle reads the same `en_sess` session (`EV_SESSION_KEY`), so nobody signs in twice.
- Boot: once per app launch (`sessionStorage en_mode_boot`), if `en_mode=seller` and signed in, the app replaces to `/seller/index.html`. A broken bundle cannot trap the person: the launch guard only fires once and the seller shell's Shop button (`EVSeller.exit`) sets `en_mode=shop`.
- For ChatGPT (packaging): keep the entry as `/seller/index.html` (Capacitor serves the shopper `index.html` for unknown extensionless paths, so a reload on `/seller/portal` can load the wrong page); the seller router adapter must map `/index.html` after stripping `/seller` to the seller home; Android Back should call `window.EVSeller.back()` first and only then the app's own back.
- Not tested: real device (owner), the packaged `/seller/` bundle itself (tested here with a stub page).
