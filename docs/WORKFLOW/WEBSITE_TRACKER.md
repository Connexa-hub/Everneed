# Everneed project tracker — app and website

**Last updated:** 12 Nov 2026 — claimed the Android app audit under WEB-APP01.
**Rules:** `AI_PROTOCOL.md`. **Database map:** `DB_CONTRACT.md`.
**Website hosting:** Cloudflare Pages, connected to GitHub with `main` as the production branch. **Development branch:** `web-portal` for both app and website. All confirmed work is merged to `main` through pull requests.

This tracker covers the shared Everneed platform: Android app, public website, seller portal, admin console, shared code and backend. One row per task, one line per row, so multiple contributors can update separate tasks without conflicting.
Status words: `TODO`, `IN PROGRESS`, `PARTIAL`, `BLOCKED`, `NEEDS OWNER`, `DONE`.
Priority: **P0** do first, **P1** core product, **P2** important, **P3** later.

## Scoreboard
| Area | Done | Partial | In progress | Blocked | Needs owner | Todo | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Foundation (F) | 4 | 1 | 1 | 0 | 3 | 6 | 15 |
| Public site (M) | 5 | 0 | 0 | 0 | 0 | 6 | 11 |
| Accounts (A) | 4 | 0 | 0 | 0 | 0 | 2 | 6 |
| Seller portal (S) | 2 | 2 | 0 | 0 | 0 | 12 | 16 |
| Admin console (AD) | 5 | 1 | 0 | 0 | 0 | 13 | 19 |
| Shared with the app (X) | 2 | 0 | 0 | 0 | 0 | 5 | 7 |
| App audit (APP) | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| Quality (Q) | 0 | 0 | 0 | 0 | 0 | 4 | 4 |
| **All** | **22** | **4** | **2** | **0** | **3** | **48** | **79** |

Update this table when you change a status.

## Next up (in order)
1. `WEB-F06` Complete the reviewed `web-portal` → `main` release PR after CI and owner confirmation.
2. `WEB-F07` Recover and commit live migrations 011 to 015 before further database changes.
3. `WEB-F08` Remove the committed debug keystore safely and replace the CI signing setup; coordinate the one-time reinstall/rotation impact with the owner.
4. `WEB-F11` Create the first admin account (owner action).
5. `WEB-F09` Schedule and verify the background jobs.
6. `WEB-APP01` Audit the app already in this repository and add an evidence-based app backlog.

---

## F. Foundation
| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-F01 | Fix syntax errors that blanked home and store chat | P0 | DONE | `mock.js`, store chat page | owner | web-portal | `e7db758`, `abd356a` |
| WEB-F02 | Responsive admin and portal shell (no sideways scroll on phones) | P0 | PARTIAL | `css/shell.css` | Claude | web-portal | `784cfdf`. Code is in place; still needs owner verification on a real phone before DONE. |
| WEB-F03 | Boot diagnostic screen on blank or broken page | P0 | DONE | `js/boot.js`, `index.html` | Claude | web-portal | `d41cfb2`, `964f5dd`, `1e2828c` |
| WEB-F04 | CI: syntax check, file references, global names | P0 | DONE | `.github/workflows/web-checks.yml`, `tools/check.mjs` | Claude | web-portal | `1a08f8e`. `npm test` and token consistency passed in GitHub Actions run `43146674947`; full APK and database jobs are still running. |
| WEB-F05 | Deploy on Cloudflare Pages | P0 | DONE | Cloudflare Pages project `everneed`, GitHub integration | owner | main | Git integration and production branch `main` verified; successful deployment confirmed on merge commit `c816c1b`. |
| WEB-F06 | Release confirmed app and website changes from `web-portal` to `main` through reviewed PRs | P0 | IN PROGRESS | git, GitHub Actions, Cloudflare Pages | owner + project coordinator | web-portal | Single development branch for both clients. Branches intentionally differ between releases; merge only after CI and confirmation. |
| WEB-F07 | Export live migrations 011 to 015 into `supabase/migrations/` | P0 | TODO | live DB, `DB_CONTRACT.md` | | | Drift: chat, support, waitlist, plans exist only live. Delete `shared/sql/011_website_sync.sql` once exported. |
| WEB-F08 | Remove `keystore/` from git and rotate the key | P0 | NEEDS OWNER | `keystore/`, `.github/workflows/build.yml` | owner | | Debug key is committed and CI ships a debug build. Use GitHub Secrets. |
| WEB-F09 | Schedule background jobs (install `pg_cron`, add a migration) | P0 | TODO | `run_scheduled_jobs`, `release_earnings`, `expire_rentals`, `support_sla_sweep` | | | Nothing runs on a timer today, so earnings never release and rentals never expire. |
| WEB-F10 | Turn on leaked-password protection | P1 | NEEDS OWNER | Supabase Auth settings | owner | | One toggle in the dashboard. |
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
| WEB-A06 | Email confirmation landing and redirect URLs | P1 | TODO | Supabase Auth URL settings | | | Add the Cloudflare URL (and custom domain) to the redirect list. |

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
| WEB-X06 | App uses `shared/` instead of duplicated config, Supabase client and icons where appropriate | P2 | TODO | `js/`, `shared/` | | web-portal | App and website are developed in this same branch; coordinate through this tracker. |
| WEB-X07 | Retire `shared/sql/`, use `supabase/migrations/` only | P1 | TODO | | | | After F07. |

## APP. App audit
| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-APP01 | Audit the existing Android app in this repository and create an app-specific implementation backlog | P0 | IN PROGRESS | `index.html`, `js/`, generated Capacitor Android project, `capacitor.config.json`, `package.json` | ChatGPT coordinator | web-portal | Static audit started from main after PR #3 release. APK CI is green; app UI/device and real-database flows still require verification. |

## Q. Quality
| ID | Task | Pri | Status | Database / files | Owner | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WEB-Q01 | RLS test: seller A cannot read or change seller B | P1 | TODO | `tests/` | | | Needs 4 test users: admin, seller A, seller B, buyer. |
| WEB-Q02 | Smoke test: sign up, apply, approve, list product, publish | P1 | TODO | | | | Do after F11. |
| WEB-Q03 | Accessibility pass (focus, labels, contrast, 200% text) | P2 | TODO | | | | |
| WEB-Q04 | Performance pass (Lighthouse, image sizes, script count) | P3 | TODO | | | | 11 scripts load in sequence today. |

---

## Change log (newest first)
| Date | Who | What |
|---|---|---|
| 12 Nov 2026 | Project workflow | Standardized `web-portal` as the only development branch for both app and website; `main` is the reviewed release and Cloudflare production branch. Added app audit task; corrected Cloudflare and branch statuses. |
| 12 Nov 2026 | Project workflow | Synced existing `main` checker and roadmap fixes into `web-portal` through PR #2. |
| 12 Nov 2026 | Claude | Created tracker, protocol and database contract. Merged `web-portal` into `main`. Added `shell.css`, `boot.js`, `web-checks.yml`, `_headers`. |
| 12 Nov 2026 | owner | Fixed `mock.js` and store chat syntax errors; added Cloudflare packaging workflow. |
