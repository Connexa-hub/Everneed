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
Customers list, Growth, Discounts, Content, Markets, Credit, Analytics reports, Collections, Inventory locations, Purchase orders, Transfers, Stock counts, Gift cards, Scan inventory, Users and Roles. They appear in the menu only when a real contract exists (see handoff R1 to R12 and the open requests below).

## Next slices
1. Screen titles with a sibling dropdown; products rows in the recording's style (variants count, available stock); Home "Get ready to sell" checklist from existing activation data.
2. Settings screen split into App settings (push notifications, biometric unlock: needs native plugins) and Store settings (General, Plan, Billing).
3. Shop / My store mode switch for a seller using the app.
4. App packaging (ChatGPT): bundle the web seller workspace into the app build, hand the signed-in session across, set the native flag so `ds-app.js` switches on.

## Needs the owner
Real-device check of the floating bar, safe areas and the Android back button; those cannot be tested here.
