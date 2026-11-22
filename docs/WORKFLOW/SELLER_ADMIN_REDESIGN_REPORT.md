# Seller workspace and admin console redesign: frontend report (WEB-S22)

**Branch:** `web-portal`, staging only. No database change, nothing deployed to production, PR #31 untouched, no plan price, limit or activation rule changed.
**Design system:** `docs/PRODUCT/DESIGN_SYSTEM.md`. **Backend requests:** `SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md`, section "Seller and admin experience redesign" (R1 to R9).
**Status: PARTIAL.** The design system and the feedback system are done, and the main admin screens (overview, applications, stores, product review, Everneed Store) are rebuilt; the remaining admin pages are restyled only. Several seller screens are not rebuilt yet (see "Not done").

## What changed

| Commit | Files | Change |
|---|---|---|
| `7bd269e`, `5a82d18` | `web/assets/css/ds.css`, `web/assets/js/ds.js`, `tools/check-ds-contrast.mjs`, `docs/PRODUCT/DESIGN_SYSTEM.md` | Design system layer: tokens (type, space, radius, motion), components (card, row, stat tile, segmented control, chip, plan badge, status ring, avatar, buttons, picker, sheet, confirm, action sheet, toast, banner, empty state, gate, skeleton, progress, success), one 24-grid icon sprite (87 icons: the 49 in the shared set plus 38 new), 25 original category illustrations, motion (stagger, count-up, press, view transitions, long-press actions). |
| `0a287cc` | `web/assets/js/ds-admin.js`, `tools/web-seller-tests/ds.js` | Admin console rebuilt as cards on top of `V.admin` (`admin.js` is not edited). 28 new page-builder tests. |
| `6c8bd04` | `web/index.html` | Three added lines: `ds.css`, `ds.js`, `ds-admin.js`. Social-preview tags untouched. |

### Fixed for the owner's list
1. **Admin as an app.** New overview (hero, "Needs attention" rows, stat tiles with count-up, a stores-live ring), sections as cards, workspace switcher, bottom sheets on phones and centred dialogs on larger screens.
2. **Rich cards.** Application cards (cover, logo, plan badge, categories, owner avatar, Approve and Reject), store cards (cover or accent tint, logo, plan badge, state chip, subscription facts, Suspend, Reinstate, View), product review cards (image or category art, seller, price, stock, registration number, Publish, Ask for changes). Long-press a card on touch to open its actions in a sheet.
3. **Tabs never clip.** Every `.tabs`, `.so-tabs` and new `.ds-seg` is a scroll-snap control with edge fades; the active tab is scrolled into view; with more than four tabs a button opens a bottom-sheet switcher (verified on the five-tab Everneed Store workspace). This also upgrades the seller products status tabs without editing `workspace.js`.
4. **Feedback system.** Stacked toasts (swipe to dismiss, timer bar, Undo when a caller passes one, lifted to the top while a sheet is open), banners (info, success, warning, error, with action), bottom sheet (drag handle, half and full snap, focus trap, Escape, scroll lock, inert page, focus restored), confirm sheet with a required reason, action sheet, skeletons, illustrated empty states, success and progress. `Core.toast`, `Core.ask` and `Core.empty` now use it, so every existing screen gets it.
5. **No raw selects.** Every native `<select>` on public, seller and admin pages becomes a searchable sheet picker (the native select stays hidden in the form, so values, `required` and `change` keep working). Category selects show art tiles with a selected-count badge, recents and animated selection. Hierarchy (parent then child) and multi-select chips with counts are built into `DS.pick` and wait for `collections.parent_id` data (R3) to show parents.
6. **Icons.** One line set (1.8 stroke, 24 grid, inline sprite). No emoji is used by the new UI (the old emoji in `collections.icon` is not displayed).
7. **Imagery.** 25 original transparent SVG illustrations, all 22 current categories map to one (test), no photos.
8. **Motion.** Transform and opacity only; reduced-motion switches everything off; shared-element navigation uses the View Transitions API where it exists.
9. **Everneed Store workspace** at `/admin/store` (switcher: Platform or Everneed Store): overview from `admin_store_workspace_context('everneed-official')` (real counts and module readiness), products, orders, messages, and a Staff and roles tab. Roles (owner, operations, support, catalogue, finance) are shown as "Planned roles, not active" because `staff_members` does not exist; if the table appears, the tab lists its real rows. Add product is disabled with a stated reason.

### Honesty choices worth knowing
- A failed query is shown as a warning or an error with Try again. It is never shown as zero or as "All clear". (A test caught this in my first draft.)
- Large money shows compact (`₦2.45M`, full value on hover and in `title`) so it cannot clip on a 360 px phone.
- Per-store product and order counts, exact order totals, and message counts are not shown, because the aggregates (R1) do not exist yet. The pages say so.
- Admin order totals are still limited to the latest 1,000 orders and say so.

## Part 2 (22 Nov 2026): seller home and products list
`web/assets/js/ds-seller.js` wraps `V.portal` after `seller-flow.js`. It draws the live-store home and the products list as cards and passes every other route (product editor, orders, plan, verification) to the existing pages untouched. Home: stat tiles, to-do rows (new orders, rejected, low stock, drafts), plan ring from `my_store_entitlements`, recent orders. Products: cards with photo or category art, status chips, filter chips with real counts, search, submit, duplicate, restore (existing `wsub`, `wdup`, `wrest`) and a confirm sheet before archive (`ds-arch`). Failures show a warning or an error with retry, never an empty or all-clear state. Growth tools and bulk tools use the plan flags from `seller_product_capabilities()`: a module the plan lacks shows an upgrade card; an included one says its data is not available yet (R5, R7). If the flags cannot be read, nothing is shown. The old multi-select bulk bar on the list is not carried over; it returns when R5 exists.
Tests: `node tools/web-seller-tests/ds-seller.js` (12 pass). Browser: Chromium at 360 px, light and dark, stubbed data: no script errors, no sideways scroll, no control under 44 px. Not tested: a real signed-in seller on staging, real devices.

## Part 3 (22 Nov 2026): owner feedback, navigation speed, workspace split, product editor
- **Slow navigation (cause and fix).** My page-transition handler held the screen frozen until the next page had loaded; count-up rewrote text every frame and retriggered the page enhancer each time. Both removed or fixed; the enhancer now reacts only to added elements; the tapped tab turns active at once with a thin progress bar; admin reads are cached for 20 seconds and any action or Try again clears the cache. Measured in Chromium with 300 to 400 ms stubbed latency: active tab changes within 30 ms, a repeat visit to a cached admin page draws in single-digit milliseconds. Real-network speed on staging is not measured.
- **Platform and Everneed Store.** The choice is remembered (`localStorage`, per browser). Platform: tabs Overview, Sellers, Review, Store, Inbox, and every platform and store page opens. Everneed Store only: tabs Overview, Products, Orders, Messages, Staff; every platform route (including admin.js pages) and the inbox redirect to the store; the switcher is the only way back. This is a front-end separation. Database access for admins is unchanged; real store-scoped staff access needs R2.
- **Product editor.** Section nav (Basics, Specs, Photos, Pricing, Stock, Variants, Shipping, Publish), specifications from `category_attributes` for the chosen category (inherits parents), saved into `products.attributes` with the types the database trigger checks (number, boolean, multiselect array, string); required specifications block "Submit for review" with a message; plans without `category_attributes_enabled` see an upgrade card; publish checklist; volume pricing shown as not available (no schema). Small edit to `collect()` in `workspace.js`. Verified in Chromium: choosing Beauty shows its fields, saving a draft sent `{"skin_type":["Dry"],"volume":50}`.
- Tests: ds.js 32, ds-seller.js 17, existing 22 all pass.

## Tests actually run
- `node tools/web-seller-tests/ds.js`: **28 of 28 pass** (art mapping for all 22 categories, no unclassed SVG shape, no emoji in icons, money formatting, HTML escaping in every builder, banner roles, overview numbers, all-clear and failure behaviour, applications, stores filters and actions, review, Everneed Store tabs, staff honesty, switcher, action-name prefix).
- `node tools/web-seller-tests/run.js` (existing): **22 of 22 pass**.
- `node tools/check-contrast.mjs`: 666 checks pass. `node tools/check-ds-contrast.mjs` (new): 414 checks pass across all 18 themes (6 palettes x light, dark, AMOLED); a negative test shows it fails when it should. The first draft's white-on-red danger button was caught and replaced.
- `node --check` on every script in `web/assets/js` and `tools/*.mjs`: all pass.
- **Real browser (headless Chromium via Playwright), real `index.html`, real `core.js`, `appshell.js`, `admin.js`, data layer stubbed with staging-shaped rows:** 8 admin routes at 360 px in light, dark and AMOLED with no script errors, no sideways scroll, no raw select and no control under 44 px; public pages (`/`, `/sell`, `/sign-in`, `/how-it-works`) and seller pages (`/portal`, products, add product, orders, settings, inbox, `/me`) with no script errors and no raw select. Interaction checks: picker select and close, Escape returns focus, inert page, toast cap and Undo, required-reason confirm, tab switcher, store filter and search, context switcher, link navigation through the view-transition path. A test page at 360 and 1100 px with screenshots checked layout in light, dark and AMOLED.
- Size: ds.css about 6 KB, ds.js plus ds-admin.js about 22 KB gzipped, about 28 KB in total against the 60 KB budget.

## Not done (be clear before calling this finished)
Seller side, not rebuilt yet (home and products list are done, see Part 2): the product workspace sections (basics, specs from `category_attributes`, variants, price tiers, stock, shipping, media, publishing), orders, the Messenger-style two-pane inbox, notifications panel, plan screen, Me and settings. They already get the new toasts, sheets, pickers, tab control and empty states automatically, but their layouts are the old ones (the add-product page still has its old sticky action bar overlapping the tab bar on a phone).
Admin side: the plan limits and verification cases tabs, waitlist, support settings and messages are still `admin.js` pages, only restyled. The platform plan-gated modules (`DS.gate`) exist but no seller screen uses them yet.
Also not done: skeleton loaders are not yet shown while a route loads (the component exists, the router has no loading hook); swipe-to-reveal on cards (long-press is built); the Everneed Store workspace has no editing, because staff access and product workflow functions do not exist (R2, R5).

## Could not test
- **Real devices.** No physical Android phone, tablet or desktop browser other than headless Chromium. Please check on 360, 390 and 412 px Android: sheet drag and snapping, toast swipe, tab fades and snapping, long-press, keyboard and screen-reader behaviour, and the view-transition morph (it ran without error, but I did not judge its look).
- A real signed-in admin and seller session against staging (the data layer was stubbed with staging-shaped rows; the RPC `admin_store_workspace_context` and table reads were checked against staging's definitions and policies, not called as an admin).
- Cloudflare deploy of this branch and CI results (CI does not run the web tests; they run from the repo root).

## Open backend requests (details in the handoff)
R1 `admin_overview_stats()`, `admin_store_directory()`, activity feed, application queue. R2 `staff_members` and role RPCs, staff-scoped RLS for the official store. R3 `collections.icon_key` and `art_key`, category schema fields. R4 messaging and push items. R5 `bulk_update_products`, `duplicate_product`, `import_products`, `validate_product_for_review`, product workflow RPCs. R6 documented `seller_transition` and `my_seller_order`. R7 sales summary, top products, inventory alerts. R8 media storage with thumbnails. R9 notes (`approve_store` plan carry-over).

## Next steps for the frontend
1. (Done, Part 2.) 2. The product workspace sections. 3. Messenger-style inbox (needs R4 for urgent and needs-reply). 4. Loading skeletons through a router hook. 5. Rebuild plan limits and verification cases as cards once the owner has checked this on devices.
