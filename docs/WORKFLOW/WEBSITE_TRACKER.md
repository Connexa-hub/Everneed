# Everneed project tracker — app and website

**Last updated:** 12 Nov 2026 — public RPC security hardening started; production remains untouched.
**Rules:** `AI_PROTOCOL.md`. **Database map:** `DB_CONTRACT.md`. **Live vs staging:** `ENVIRONMENTS.md`.
**Website hosting:** Cloudflare Pages, connected to GitHub with `main` as the production branch. **Development branch:** `web-portal` for both app and website. All confirmed work is merged to `main` through pull requests.

This tracker covers the shared Everneed platform: Android app, public website, seller portal, admin console, shared code and backend. One row per task, one line per row, so multiple contributors can update separate tasks without conflicting.
Status words: `TODO`, `IN PROGRESS`, `PARTIAL`, `BLOCKED`, `NEEDS OWNER`, `DONE`.
Priority: **P0** do first, **P1** core product, **P2** important, **P3** later.

## Scoreboard
| Area | Done | Partial | In progress | Blocked | Needs owner | Todo | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Foundation (F) | 7 | 1 | 1 | 0 | 4 | 5 | 18 |
| Public site (M) | 5 | 0 | 0 | 0 | 0 | 6 | 11 |
| Accounts (A) | 4 | 0 | 0 | 0 | 0 | 2 | 6 |
| Seller portal (S) | 2 | 2 | 0 | 0 | 0 | 12 | 16 |
| Admin console (AD) | 5 | 1 | 0 | 0 | 0 | 13 | 19 |
| Shared with the app (X) | 2 | 0 | 0 | 0 | 0 | 5 | 7 |
| App audit (APP) | 1 | 4 | 0 | 0 | 0 | 6 | 11 |
| Quality (Q) | 0 | 0 | 0 | 0 | 0 | 4 | 4 |
| **All** | **26** | **8** | **1** | **0** | **4** | **53** | **92** |

Update this table when you change a status.

## Next up (in order)
1. `WEB-F16` Harden public guest-support and waitlist RPCs, add negative tests, and verify on staging. Production remains unchanged until owner approval. The owner has already added `STAGING_DB_URL`.
2. `WEB-F08` Remove the committed debug keystore safely and replace the CI signing setup; coordinate the one-time reinstall/rotation impact with the owner.
3. `WEB-F11` Create the first admin account (owner action).
4. `WEB-F09` Schedule and verify the background jobs. Needs a migration numbered 016, tested on staging first.
5. `APP-06` and `WEB-S05`/`WEB-S06`: seller order queue on both clients (the first real money flow).
6. `APP-10` Run real-device app smoke tests and record the results.

---

## F. Foundation
| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-F01 | Fix syntax errors that blanked home and store chat | P0 | DONE | `mock.js`, store chat page | owner | web-portal | `e7db758`, `abd356a` |
| WEB-F02 | Responsive admin and portal shell (no sideways scroll on phones) | P0 | PARTIAL | `css/shell.css` | Claude | web-portal | `784cfdf`. Code is in place; still needs owner verification on a real phone before DONE. |
| WEB-F03 | Boot diagnostic screen on blank or broken page | P0 | DONE | `js/boot.js`, `index.html` | Claude | web-portal | `d41cfb2`, `964f5dd`, `1e2828c` |
| WEB-F04 | CI: syntax check, file references, global names | P0 | DONE | `.github/workflows/web-checks.yml`, `tools/check.mjs` | Claude | web-portal | `npm test` and token consistency passed; full Install/test, Database tests and APK build all passed on released main run `43147699406`. Database job remains configured `continue-on-error: true` and is not a release gate yet. |
| WEB-F05 | Deploy on Cloudflare Pages | P0 | DONE | Cloudflare Pages project `everneed`, GitHub integration | owner | main | Git integration and production branch `main` verified; successful deployment confirmed on merge commit `c816c1b`. |
| WEB-F06 | Release confirmed app and website changes from `web-portal` to `main` through reviewed PRs | P0 | DONE | git, GitHub Actions, Cloudflare Pages | owner + project coordinator | web-portal | PR #3 merged 12 Nov 2026 as `0bca163`; main run `43147699406` passed Install and test, Database tests and APK. The database job is currently non-blocking by workflow configuration. |
| WEB-F07 | Recover the eight missing applied migration SQL files into `supabase/migrations/` | P0 | DONE | live `supabase_migrations.schema_migrations`, `DB_CONTRACT.md`, `MIGRATION_RECOVERY.md` | Claude (at owner's request) | web-portal | Recovered verbatim from the live migration table (commits `c9b9e1c`, `9ba80b1`, `504dbd3`, `0aaf8be`). Sizes match the stored SQL. Renamed `002a`, `002b`, `003a` to `0030`, `0031`, `0040` (`9c4174c`) because the Supabase CLI skips file names with letters in the number; git hashes identical, so content unchanged. All 19 live records now have a file. `.github/workflows/migrations-check.yml` enforces the naming and order. Not DONE until F07b passes. `shared/sql/011_website_sync.sql` is superseded by `012`; retire it under X07 after F07b. |
| WEB-F07b | Prove the migration chain: replay the recovered history on an empty database and compare all stored SQL | P0 | DONE | `supabase/migrations/`, `supabase_migrations.schema_migrations`, `.github/workflows/staging-reset.yml` | ChatGPT coordinator | web-portal | Reset run `43234686076` succeeded against staging only. The redundant `016_signup_profile_fields.sql` was removed because `0030_signup_profile_fields.sql` already maps to live version `20261029134730`. All 19 repository migrations were compared with live stored statements; executable SQL matches after comment/whitespace normalization. Staging/live columns, policies and RLS sets match; four function-definition differences are comments only. The no-op `016` metadata row was safely removed from staging; staging and repository now both contain the same 19 migration versions. Live remains unchanged with its 19 original migration records. |
| WEB-ENV01 | Turn on the staging environment (project `Everneed-staging`, ref `vjiadqygpyebpisxslbx`, created, empty) | P0 | NEEDS OWNER | `.github/workflows/staging-db.yml`, `shared/config.js` (`STAGING_READY=false`), `ENVIRONMENTS.md` | owner | web-portal | Owner: (1) copy the Session pooler connection string, (2) add it as GitHub secret `STAGING_DB_URL`, (3) run the "Staging database" workflow. Then Claude compares staging with live, and a PR flips `STAGING_READY` to `true`. Until then every address uses live, as before. Staging also needs Auth redirect URLs, the `media` bucket check and test users (`ENVIRONMENTS.md`). |
| WEB-F08 | Remove `keystore/` from git and rotate the key | P0 | NEEDS OWNER | `keystore/`, `.github/workflows/build.yml` | owner | | Debug key is committed and CI ships a debug build. Use GitHub Secrets. |
| WEB-F09 | Schedule background jobs (install `pg_cron`, add a migration) | P0 | TODO | `run_scheduled_jobs`, `release_earnings`, `expire_rentals`, `support_sla_sweep` | | | Nothing runs on a timer today, so earnings never release and rentals never expire. Next available migration slot is 016; the duplicate catch-up file was removed because signup-profile fields are already covered by `0030_signup_profile_fields.sql`. Test on staging first. |
| WEB-F10 | Turn on leaked-password protection | P1 | NEEDS OWNER | Supabase Auth settings | owner | | One toggle in the dashboard. Do it on staging too. |
| WEB-F11 | Create the first admin account | P0 | NEEDS OWNER | `profiles` (0 rows) | owner | | Sign up on the site, then set `role='admin'` for that profile. Needed to test every admin task. |
| WEB-F12 | Fix stale hint in admin waitlist empty state | P3 | TODO | `admin.js` | | | It tells people to apply `shared/sql/011_website_sync.sql`, but the table already exists. |
| WEB-F13 | Split dense one-line JS into readable modules | P2 | TODO | `core.js`, `portal.js`, `chat.js` | | | One file per PR. Never reformat in the same commit as a behaviour change. |
| WEB-F14 | Content-Security-Policy | P3 | TODO | `_headers` | | | Only after F13. Inline scripts and styles must be removed first. |
| WEB-F15 | Real URLs instead of `#/` routes (+ `_redirects`) | P2 | TODO | `core.js` router | | | Needed for SEO and shareable store links. |

## M. Public site
| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-M01 | Home page (hero, showcase, calculator, FAQ) | P1 | DONE | `home.js`, `mock.js` | owner | web-portal | Working again after F01. |
| WEB-M02 | Sell and Pricing pages | P1 | DONE | `site.js`, reads `store_plans` | | | Pricing shows "announced at launch" until plans have prices. |
| WEB-M03 | Help, Support, About | P2 | DONE | `site.js`, `kb.js` | | | |
| WEB-M04 | Early-access waitlist form | P1 | DONE | `join_waitlist` | | | |
| WEB-M05 | Theme and colour page | P2 | DONE | `core.js` appearance | | | |
| WEB-M06 | Legal pages: Terms, Privacy, Cookies, Returns, Seller agreement | P1 | TODO | source text in `docs/LEGAL/` | | | Needed before real launch. Footer links must go somewhere. Have a lawyer review. |
| WEB-M07 | SEO: titles, Open Graph, sitemap, robots | P2 | TODO | `index.html`, `_redirects` | | | Depends on F15 for real value. |
| WEB-M08 | Public storefront page | P1 | TODO | `public_stores`, `public_products` | | | Cover, logo, rating, product grid, follow, chat button. |
| WEB-M09 | Public product page | P1 | TODO | `public_products`, `public_reviews`, `product_ratings` | | | Gallery, "Sold by", delivery estimate. |
| WEB-M10 | Web cart and checkout | P2 | TODO | `create_order`, `paystack` edge function | | | Today shoppers are sent to the app. Do after M08 and M09. |
| WEB-M11 | Order tracking page | P2 | TODO | `order_tracking` | | | Buyer enters order id and delivery status. |

## A. Accounts
| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-A01 | Sign up and sign in | P0 | DONE | `site.js`, `supa.js` | | | |
| WEB-A02 | Role redirect (admin to console, seller to portal) | P0 | DONE | `fixes.js`, `site.js` | | | |
| WEB-A03 | Session refresh and sign out | P0 | DONE | `supa.js` | | | |
| WEB-A04 | Theme saved to profile | P2 | DONE | `theme.js` | | | |
| WEB-A05 | Forgot and reset password | P1 | TODO | Supabase Auth `/recover` | | | No reset flow exists. |
| WEB-A06 | Email confirmation landing and redirect URLs | P1 | TODO | Supabase Auth URL settings | | | Add the Cloudflare URL (and custom domain) to the redirect list, on live and on staging. |

## S. Seller portal
| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-S01 | Dashboard with real KPIs and "needs attention" | P1 | PARTIAL | `portal.js` | | | Basic counts only. Add orders, earnings, 14-day trend. |
| WEB-S02 | Store setup, 5 steps, submit for review | P0 | DONE | `submit_store`, `store_applications`, `store_private` | | | |
| WEB-S03 | Products: create, edit, submit for review | P1 | PARTIAL | `products`, `product_private`, `media` bucket | | | One image, no variants, no stock alerts. |
| WEB-S04 | Multi-image, variants, size charts | P1 | TODO | `products`, `size_charts` | | | |
| WEB-S05 | Orders list with filters | P1 | TODO | `my_seller_orders` | | | New, Preparing, Ready, Handed over, Done, Issues. |
| WEB-S06 | Order actions: accept, ready, hand over | P1 | TODO | `seller_transition` | | | Show acceptance countdown. |
| WEB-S07 | Confirm delivery with 4-digit code | P1 | TODO | `mark_delivered` | | | |
| WEB-S08 | Earnings and ledger | P1 | TODO | `store_balance`, `ledger_entries` | | | Available, pending, released. CSV export. |
| WEB-S09 | Payout history | P2 | TODO | `payouts` | | | |
| WEB-S10 | Plan and rental | P2 | TODO | `choose_plan`, `store_plans`, `store_subscriptions`, `apply_rental_payment` | | | |
| WEB-S11 | Store settings: holiday mode, delivery areas, pickup address | P2 | TODO | `stores`, `store_private` | | | |
| WEB-S12 | Notifications centre | P2 | TODO | `notifications` | | | Approvals, change requests, payouts. |
| WEB-S13 | Messages (inbox) | P1 | DONE | `inbox.js`, `chat_*` | | | |
| WEB-S14 | Reply to reviews | P3 | TODO | `reviews` | | | |
| WEB-S15 | Bulk product import (CSV) | P3 | TODO | `products` | | | |
| WEB-S16 | Offers and discounts | P3 | TODO | `offers` | | | |

## AD. Admin console
| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-AD01 | Overview KPIs | P1 | PARTIAL | `admin.js` | | | 4 counts. Add orders today, GMV, open disputes, SLA breaches. |
| WEB-AD02 | Applications: approve, reject | P0 | DONE | `approve_store`, `reject_store` | | | |
| WEB-AD03 | Product review: publish, ask for changes | P0 | DONE | `review_product` | | | |
| WEB-AD04 | Stores: suspend, reinstate | P1 | DONE | `suspend_store`, `approve_store` | | | |
| WEB-AD05 | Store terms: commission and trusted flag | P1 | TODO | `set_store_terms` | | | |
| WEB-AD06 | Waitlist with CSV export | P2 | DONE | `waitlist` | | | |
| WEB-AD07 | Support inbox and settings | P1 | DONE | `inbox.js`, `support_*` | | | |
| WEB-AD08 | Orders monitor and confirm bank-transfer payments | P1 | TODO | `orders`, `admin_confirm_payment`, `cancel_order` | | | |
| WEB-AD09 | Hub board: receive, consolidate, dispatch | P1 | TODO | `hub_receive`, `hub_consolidate`, `dispatch`, `deliveries` | | | |
| WEB-AD10 | Refunds | P1 | TODO | `refund`, `refunds` | | | |
| WEB-AD11 | Disputes | P2 | TODO | `disputes` | | | |
| WEB-AD12 | Seller payouts | P1 | TODO | `record_payout`, `payouts`, `store_balance` | | | |
| WEB-AD13 | Plans and rentals management | P2 | TODO | `store_plans`, `store_subscriptions`, `apply_rental_payment_for` | | | |
| WEB-AD14 | Banners, collections, offers | P2 | TODO | `banners`, `collections`, `offers` | | | |
| WEB-AD15 | Audit log viewer | P2 | TODO | `audit_log` | | | |
| WEB-AD16 | Finance reports and commission | P2 | TODO | `ledger_entries` | | | |
| WEB-AD17 | Users and roles | P2 | TODO | `profiles` | | | |
| WEB-AD18 | Review moderation | P3 | TODO | `reviews` | | | |
| WEB-AD19 | Platform settings | P3 | TODO | `settings` | | | |

## X. Shared with the app
Goal: the app and the website use the same files, labels, money rules and look.

| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-X01 | Shared config, icons, art, Supabase client copied at build | P0 | DONE | `shared/*.js`, build copy step | | | The build copy step is the contract. Any new shared file is picked up automatically (`cp shared/*.js`). |
| WEB-X02 | Design tokens and fonts from the app | P0 | DONE | `css/tokens.css`, `css/fonts.css`, `js/theme.js` | | | Six palettes, light, dark, AMOLED. |
| WEB-X03 | `shared/api.js`: one list of database calls with names and argument shapes | P1 | TODO | `DB_CONTRACT.md` | | | Stops the app and web from each inventing their own call. |
| WEB-X04 | `shared/status.js`: order, product and store status names, labels and colours | P1 | TODO | | | | Today each side has its own. |
| WEB-X05 | `shared/money.js`: currency and country formatting (6 countries) | P1 | TODO | `shared/config.js` | | | Web is NGN only. |
| WEB-X06 | App uses `shared/` instead of duplicated config, Supabase client and icons where appropriate | P2 | TODO | `js/`, `shared/` | | web-portal | App and website are developed in this same branch; coordinate through this tracker. See APP-08. |
| WEB-X07 | Retire `shared/sql/`, use `supabase/migrations/` only | P1 | TODO | | | | After F07b. |

## APP. App audit
| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-APP01 | Audit the existing Android app in this repository and create an app-specific implementation backlog | P0 | PARTIAL | `index.html`, `js/`, generated Capacitor Android project, `capacitor.config.json`, `package.json` | ChatGPT coordinator | web-portal | Static source audit completed; see APP-02 to APP-11 below. Shopper catalogue, product/store pages, cart/checkout, account, seller onboarding/product forms and admin moderation code exist. APK builds, but no device UI/live account/payment flow has been verified. Android project is generated by CI, not committed. |
| APP-02 | Remove client-side admin privilege from the legacy local sign-in fallback | P1 | DONE | `js/app.js`, `js/config.js` | ChatGPT coordinator | web-portal | Changed the legacy local sign-in fallback to always set `admin:false`; only the authenticated Supabase profile role grants admin in the active auth flow. App-script syntax and website checks passed in run `43148892539`; Install/test, database tests and APK all passed in run `43148892529`. |
| APP-03 | Complete account recovery and email-confirmation return flow | P1 | TODO | `js/auth.js`, Supabase Auth redirects | | web-portal | Email/password and email-code paths exist; password recovery/reset and a complete confirmation landing/redirect flow are not present in the app code. |
| APP-04 | Verify buyer checkout, Paystack and multi-seller order creation end to end | P0 | PARTIAL | `js/app.js`, `js/payments.js`, `js/cards.js`, `supabase/functions/paystack/` | | web-portal | App calls the Paystack edge function for checkout/coupons/cancellation and saved-card actions. SQL tests cover two sellers producing one hub-routed order, but live provider/webhook/device checkout is unverified. Test on staging with Paystack test keys. |
| APP-05 | Verify buyer order history, payment states, delivery tracking, cancellation and reviews | P1 | PARTIAL | `js/app.js`, `js/shop.js`, `js/store.js`, `supabase/migrations/` | | web-portal | UI and call sites exist for order list/details, payment report, received confirmation and verified-purchase reviews; confirm status mapping and live RLS against the current database. |
| APP-06 | Implement seller order queue, delivery transitions, earnings and payout history in the app | P0 | TODO | `js/merchant/merchant.js`, seller-order RPCs, ledger tables | | web-portal | Current seller surface covers store application, basic dashboard and single-image product create/edit/review only; no seller order or earnings/payout screens found. |
| APP-07 | Complete admin operations for hub handling, refunds, disputes and seller payouts | P1 | TODO | `js/admin.js`, `js/adminx.js`, `js/admin-sellers.js` | | web-portal | Admin code includes seller/product moderation and some order/payment/offer tools; full hub, refund, dispute and payout workflows remain to be implemented and tested. |
| APP-08 | Consolidate app config, Supabase client, status and money helpers into shared modules, and let test builds use staging | P1 | TODO | `js/config.js`, `js/supa.js`, `shared/`, `index.html`, `.github/workflows/build.yml` | | web-portal | App currently loads `js/config.js` and `js/supa.js` (live database hard-coded); the parallel `shared/config.js` and `shared/supa.js` are not loaded by the app. Goal: one config, release builds from `main` use live, test builds from `web-portal` use staging with a visible ribbon. Until then the website on staging and the app are on different databases (`ENVIRONMENTS.md`). |
| APP-09 | Complete barcode fallback and image-based product search | P2 | PARTIAL | `js/app.js`, Capacitor camera permissions | | web-portal | Barcode scan depends on browser `BarcodeDetector` support; image matching explicitly displays a Stage 2 placeholder. Add graceful fallback or connect a supported search service. |
| APP-10 | Run real-device app smoke tests and record install, permissions and core flows | P0 | TODO | Android APK, GitHub Actions build, test checklist | | web-portal | CI builds a debug APK successfully, but no evidence yet for install/upgrade, 360–412px layout, camera/location/notifications, sign-in, checkout or seller flows on a physical Android device. |
| APP-11 | Complete app accessibility and performance pass on low-to-mid Android devices | P2 | TODO | `css/`, `js/`, Capacitor build | | web-portal | Verify touch targets, contrast, keyboard/focus, image weight, startup and scroll performance on real devices and weak mobile data. |

## Q. Quality
| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-Q01 | RLS test: seller A cannot read or change seller B | P1 | TODO | `tests/` | | | Needs 4 test users: admin, seller A, seller B, buyer. Do it on staging. |
| WEB-Q02 | Smoke test: sign up, apply, approve, list product, publish | P1 | TODO | | | | Do after F11 and ENV01, on staging. |
| WEB-Q03 | Accessibility pass (focus, labels, contrast, 200% text) | P2 | TODO | | | | |
| WEB-Q04 | Performance pass (Lighthouse, image sizes, script count) | P3 | TODO | | | | 11 scripts load in sequence today. |

---

## Change log (newest first)
| 12 Nov 2026 | ChatGPT coordinator | WEB-F16: added migration 016 with per-IP/per-email rate limiting, keyed pseudonymous subjects, consistent guest ID validation, closed-session protection, empty search_path and explicit RPC grants. Staging migration run 43241479974 passed; read-only checks confirm migration 016, pepper and function ACLs. Added SQL regression tests and wired them into CI. Production remains untouched; full local DB test rerun still pending. |
| Date | Who | What |
|---|---|---|
| 12 Nov 2026 | ChatGPT coordinator | Staging reset run `43234686076` succeeded. Removed redundant `016_signup_profile_fields.sql` and its no-op staging history row. All 19 migrations were compared to live stored SQL; executable bodies match after comment/format normalization. Schema, policy and RLS parity verified; four function differences are comments only. Migration checker run `43237645367` passed after fixing version-prefix sorting. WEB-F07/F07b marked DONE. Live Everneed01 was not reset. |
| 12 Nov 2026 | Claude | Renamed recovered migrations `002a`, `002b`, `003a` to `0030`, `0031`, `0040` (the Supabase CLI skips letter names); added `migrations-check.yml`. Created the staging project `Everneed-staging` (ref `vjiadqygpyebpisxslbx`, free tier, empty), `staging-db.yml` (refuses to run against live), staging selection in `shared/config.js` (off by default via `STAGING_READY=false`) and `ENVIRONMENTS.md`. Nothing applied to either database. |
| 12 Nov 2026 | Claude | WEB-F07: recovered the eight missing migration SQL files verbatim from the live `supabase_migrations.schema_migrations` table (`011` to `015` and the three unnumbered ones). Sizes verified against the stored text. Updated `DB_CONTRACT.md` and `MIGRATION_RECOVERY.md`; added WEB-F07b (replay test). Read-only on the database. Also repaired literal `\n` characters in this change log. |
| 12 Nov 2026 | Project workflow | PR #6 merged as `dfeaf27`; `web-portal` is synchronized with the released `main` history. All three PR6 CI jobs passed. |
| 12 Nov 2026 | Project coordinator | Started WEB-F07 recovery: confirmed live migration versions 011–015, captured read-only table/function/RLS/trigger evidence in `MIGRATION_RECOVERY.md`, and marked drift IN PROGRESS. No live DB changes. |
| 12 Nov 2026 | Project workflow | PR #3 merged as `0bca163`; `web-portal` is the development branch for app and website, `main` is reviewed release/Cloudflare production. All three release CI jobs passed on main run `43147699406`. |
| 12 Nov 2026 | Project coordinator | Hardened legacy local sign-in so it cannot grant admin; all CI jobs passed on `web-portal` commit `2a2796c`. |
| 12 Nov 2026 | Project workflow | Static Android app audit recorded in `DB_CONTRACT.md`; app backlog APP-02 to APP-11 added. No database migrations applied. |
| 12 Nov 2026 | Project workflow | Synced existing `main` checker and roadmap fixes into `web-portal` through PR #2. |
| 12 Nov 2026 | Claude | Created tracker, protocol and database contract. Merged `web-portal` into `main`. Added `shell.css`, `boot.js`, `web-checks.yml`, `_headers`. |
| 12 Nov 2026 | owner | Fixed `mock.js` and store chat syntax errors; added Cloudflare packaging workflow. |
