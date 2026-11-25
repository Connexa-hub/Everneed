# Claude 2 onboarding audit (25 Nov 2026)

**Author:** Claude 2 (frontend: app shell and web-in-app integration)
**Scope:** read-only audit of `web-portal` at `377879c`, GitHub issues/PRs, and Supabase (staging `vjiadqygpyebpisxslbx`, live `zpgasfweaixwsktlueje`, read-only). No code, database or production change was made.
**Companion:** `CLAUDE_TEAM_WORKSPACE.md` (roster, lanes, claims, handoffs).

## 1. What was read (honest coverage)

- **Read in full:** `AI_PROTOCOL.md`, `README.md`, `MANIFEST.txt`, issue #34, `NATIVE_GOOGLE_SIGNIN_CLAUDE_HANDOFF.md`, `.github/workflows/build.yml`, `cloudflare-pages-package.yml`, `capacitor.config.json`, `package.json`, `js/config.js`, `shared/config.js`, root `index.html`, `web/index.html`, `web/_redirects`, PR #41 (body and full diff), all 42 PR titles/branches, last 30 commits.
- **Read in part:** `ENVIRONMENTS.md` (first ~9 of 13 KB), `WEBSITE_TRACKER.md` (header, baseline, scoreboard, next-up, S/AD/X/APP/Q tables; the 575-line change log only by headings), `PRODUCT_ROADMAP.md` (phases 0-3), `MASTER_ROADMAP.md` (first sections), `SELLER_ADMIN_REDESIGN_REPORT.md` (first ~5 of 17 KB).
- **Seen by title only:** the other ~55 documents (finance/payment contracts, strategy, legal, funding, team). Not yet read: `SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md` (R1-R9), `SELLER_APP_EXPERIENCE_SPEC.md`, `DESIGN_SYSTEM.md`. Each Claude should read the ones in its lane.
- **Not done:** no visual review of the deployed preview (pages are JavaScript-rendered; owner screenshots needed), no device test, no CI log reading.

## 2. Why the web portal does not work inside the app

The shopper app and the web portal are **two separate frontends**:

| | Shopper app (root) | Web portal (`web/`) |
|---|---|---|
| Entry | `index.html`, `js/*`, `css/app.css` | `web/index.html`, `web/assets/*` |
| Routing | hash (`#/cart`) | real paths (`/portal/orders`) via `history.pushState` |
| Config | `js/config.js`, environment from CI-stamped `BUILD.branch` | `shared/config.js`, environment from page **hostname** |
| Supabase client | `js/supa.js` | `shared/supa.js` |
| Reaches the APK? | Yes | **No** |

Findings, in order of severity:

1. **The APK never contains `web/`.** The APK job runs `cp -r index.html favicon.svg favicon.png css js data fonts www/` (`build.yml`); `capacitor.config.json` has `webDir: "www"`. Seller, admin and all `ds-*` screens are absent from every APK built from `web-portal`.
2. **PR #41's seller bundle would boot broken even if activated.** `web/assets/js` and `web/assets/css` in git do **not** contain `config.js, supa.js, icons.js, art.js, geo.js, turnstile.js, theme.js, tokens.css, fonts.css`; the Cloudflare workflow copies them in at build time. `tools/package-seller.mjs` copies `web/` as-is and never runs that copy, and `tools/check-seller-package.mjs` only asserts `ds-app.js` and `ds.css`. `web/index.html` loads all of those files, so the first missing one stops the boot.
3. **Environment selection by hostname is unsafe inside Capacitor.** In the WebView the host is `localhost`, so `shared/config.js` selects **staging** for every build, including a future `main` release. Issue #34 forbids hostname detection inside an APK. The shopper app already uses `BUILD.branch`; the seller bundle must too. (Capacitor 6 default host is `localhost`; confirm on device.)
4. **Path routing needs a server rewrite that Capacitor does not provide.** Cloudflare uses `_redirects` (`/* /index.html 200`). In the app, a reload on `/seller/portal/orders` will most likely fall back to the **root** `index.html` (shopper app). PR #41 patches `core.js` by string replacement at package time: fragile and untested in a browser. Needs a real route-prefix setting in `core.js` plus a browser test. (Unverified on device.)
5. **No Android Back handling** anywhere in `js/*` (no `App.addListener('backButton')`).
6. **Two session writers.** Both read `en_sess`; PR #41 adds session adoption in `js/supa.js` but there is no refresh lock. Two clients refreshing the same token will log the user out.
7. **No ownership gate and no Shop / My Store switch** yet.
8. **PR #41 is a draft on its own branch**; `SHARED_FEATURE_DELIVERY_POLICY.md` (web-first, package into app) exists only there, not on `web-portal`.

## 3. Frontend design state (Claude 1 work)

- Design system `ds.css` / `ds.js`, feedback system, sheet pickers, scroll-snap tabs, 87-icon sprite, 25 category illustrations (WEB-S22 parts 1-25, `7bd269e`..`32c18ec`).
- Admin console rebuilt as cards (`ds-admin.js`); Everneed Store workspace; team/staff and dispatcher previews with sample data behind a flag (`ds-team.js`, `ds-dispatch.js`); seller home and products list (`ds-seller.js`); product editor sections; setup wizard redesign (`setup.js`).
- Tests: `tools/web-seller-tests/*`, `tools/check-ds-contrast.mjs`.
- **Not done:** seller orders (S05-S07), earnings (S08), inbox redesign, notifications panel, plan screen, Me/settings, skeleton loaders, and all `WEB-AD08`..`AD19` admin operation screens.
- The shopper app's look (`css/app.css`, `components.css`) has **not** adopted the `ds-*` system; it is a different visual language from the web portal.
- Still needs owner check on real Android devices.

## 4. Backend and environment state (for Codex)

- Staging: 50 public tables, RLS on all. Row counts: **0 orders, 0 order items, 1 product, 3 stores, 4 profiles**. Seller/admin order screens cannot be exercised with real data.
- Staging migrations: legacy 000-033 plus 38 timestamped through `20261122140408_fin03_verified_payment_journal_posting`. Edge Functions: `public-forms` v14, `paystack` v14. **Tracker still says v3 / v1: stale.** Live runs `paystack` v4 only.
- Staging security advisors: 47 `authenticated`-callable SECURITY DEFINER functions (RPC design; guards covered by regression suites), 3 anon-callable (`seller_plan_catalog`, `store_reply_stats`, `support_sla_public`), 4 `private.*` functions with mutable `search_path`, leaked-password protection **off** (WEB-F10, owner), `kv`/`rate_limits` RLS-without-policy (intentional).
- Tracker records CI Phase 2 failing two public-visibility assertions on `0b2aad4`; not re-checked here.
- `WEB-S23` (seller photo upload `Failed to fetch`) open with Codex.
- Issue #34 (APP-08 P0) is partly done: `js/config.js` selects staging unless `BUILD.branch==="main"`. Not done: shared-module consolidation, CI assertions that the staging bundle has no live URL, and the seller bundle's config (finding 3).

## 5. Pull requests

42 PRs; 31 are merged/closed sync housekeeping. Open:

| PR | Purpose | Note |
|---|---|---|
| #31 | `web-portal` to `main` release | open, unmerged; production gate |
| #32 | variant-aware checkout (draft) | backend + UI |
| #36, #40, #42, #43 | four generations of Google sign-in | #43 stale; implemented directly on `web-portal` (`ce62229`..`b07f3d1`). Close candidates once owner confirms. |
| #38 | seller accept-deadline guard | backend |
| #41 | seller packaging layer (draft) | see section 2 |

## 6. Roadmap alignment

`PRODUCT_ROADMAP.md` order: baseline, secure foundation, seller onboarding/catalogue, customer discovery/shopping, then orders/payments. Tracker "next up": seller fulfilment MVP (S05/S06), admin operations MVP (AD08-AD11), real-device checks, owner test gate, release gate on PR #31. `CLAUDE_TEAM_WORKSPACE.md` follows that order and adds "web in the app" as the first unblock, so the owner can test seller flows on the Infinix Hot 70.
