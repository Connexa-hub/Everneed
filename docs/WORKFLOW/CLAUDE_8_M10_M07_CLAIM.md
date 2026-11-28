# Claude 8: WEB-M10 (app handoff) + WEB-M07 (SEO). TASK HANDOFF for Claude 10

**Agent:** Claude 8 (Public website / content / growth) | **Branch:** `claude/agent-8/app-handoff-seo` | **PR:** #59 (draft) | **Status:** BUILT, awaiting CI + review | **Ready for review:** NO (see "Not verified")
Temporary note for Claude 10. Prune it on merge. Answer the questions below by editing this section or commenting on PR #59; I will pick it up next session.

## Questions and requests for Claude 10 (please answer)
1. **`site.js` dead code (my task item 3).** The 4 hot-linked auth images (magnific, rawpixel x2, productshotai) are already overridden at runtime by `auth-showcase.js`, but their URLs still sit in `productWave()` in `web/assets/js/site.js`. Deleting that block is a small edit in a file I do not own. **May I delete it, or will you?** Until then the item is functionally done, not clean.
2. **Wire my tests into CI.** `node --test tools/web-public-tests/*.test.mjs` (21 tests) is not in any workflow. Please add it to "Install and test", or tell Claude 9 to include it in QA-01. Needs Node 20+ (all files are `.mjs`).
3. **Verify the Function on the Cloudflare preview** (I have no browser or network in my session). After the preview of #59 builds:
   `curl -s https://<preview>/sell | grep -E "<title>|robots|canonical"` should show the Sell title, `content="noindex,nofollow"` and no canonical.
   `curl -s https://<preview>/robots.txt` should print `Disallow: /`. `curl -sI https://<preview>/sitemap.xml` should be 404. Also open `/shop` at 360 px (see Not verified).
4. **Relay to ChatGPT/Codex (BACKEND REQUEST, for the future domain).** `supabase/functions/public-forms/index.ts` only accepts hosts matching `*.everneed.pages.dev` for the Origin check and the Turnstile hostname check, so a custom domain would be rejected (403). When the owner buys a domain: add it to the allowed hosts, to the Turnstile widget hostnames, to Supabase Auth Site URL / redirect URLs (WEB-A06) and Google OAuth redirect URIs, and add it to the hostname rules in `shared/config.js` (Claude 2's file).
5. **Owner actions to list on the board.** (a) Set the Pages variable `PUBLIC_SITE_ORIGIN` on the production deployment once a domain exists; until then everything stays noindex by design. (b) Add a verified entry to `DESTINATIONS` in `web/assets/js/app-handoff.js` only after a store listing is live and the owner confirms it.
6. **Please do not merge PR #31 (`web-portal` to `main`) before the production database is reconciled.** Details in "Suggestions for Claude 10" below.

## What was built
Commits: `02a666b` (M07), `2faa13d` (M10), `5782343` (board row), plus the earlier claim docs and the branch sync merge.
- **M07:** `functions/_lib/seo.mjs`, `functions/robots.txt.js`, `functions/sitemap.xml.js`, `functions/_middleware.js`, `web/_routes.json`, and `web/index.html` (static robots default `noindex,nofollow`; the home-only canonical removed because it declared the home page as canonical on every route). Nothing is indexable until `PUBLIC_SITE_ORIGIN` is set. The middleware returns the untouched response on any error.
- **M10:** `web/assets/js/app-handoff.js` + `web/assets/css/app-handoff.css` wrap `Core.V.shop` (`/shop`). Empty `DESTINATIONS`, so the page says "Not published yet" with early access and create-account / My account. No store buttons, no cart or checkout. Future destinations must pass an allow-list (https, exact host, Play package `com.everneed.store`, GitHub releases path, verification date); Google Play first. Animated SVG scene in design tokens; still unless motion is allowed.
- **Tests:** `tools/web-public-tests/{seo,functions,app-handoff}.test.mjs`.
- Not touched: `site.js`, `core.js`, `shared/config.js`, `workspace.js`, `admin.js`, `android/`, `supabase/`.

## Tests that really ran (my session, Node 22)
`node --test tools/web-public-tests/*.test.mjs`: 21 of 21 pass. `node --check` on every new script: pass. Both page states rendered: SVG well-formed, tags balanced.

## Not verified
- CI result on the latest head (not readable from my session when I wrote this).
- Any browser check: no 360/412 px or desktop screenshots, no axe, no contrast check of the scene in light / dark / AMOLED, tap targets set to 48 px in CSS but unmeasured.
- The `HTMLRewriter` code path (runs only on Cloudflare). Covered only by the fail-safe test.
- `npm test` (it checks the shopper app, which this PR does not touch).

## Owner answers (27 Nov 2026)
1. Not production yet. `everneed.pages.dev` is temporary. No custom domain bought or set up.
2. No Play Store listing yet. No verified destination of any kind exists.

## Evidence (read from `web-portal` @ `0178766`)
| # | Finding | Where |
|---|---|---|
| E1 | `/shop` already existed as a text-only page with an honest "not displayed until verified" note. M10 upgrades that route. | `site.js` `V.shop` |
| E2 | The 4 hot-linked auth images are overridden at runtime by inline SVG from `auth-showcase.js`; URLs remain as dead code. Tracker rows A01/A08 ("still hot-linked") are stale. | `site.js` `productWave()` |
| E3 | Static `<link rel="canonical" href="https://everneed.pages.dev/">` on every route made every page canonical to home. Fixed in this PR. | `web/index.html` |
| E4 | `og:url` / `og:image` pointed at the preview host while canonical pointed at `everneed.pages.dev`. Middleware now uses the request origin. | `web/index.html` |
| E5 | `robots` was `index,follow` on every route including `/portal`, `/admin`, `/account`, `/sign-in`; no `robots.txt` or `sitemap.xml`; previews (staging data) were indexable. Fixed in this PR. | `web/index.html` |
| E6 | One title and description for every route in the static HTML. Fixed for crawlers by the middleware. | `web/index.html` |

## Suggestions for Claude 10 (outside my lane, with evidence)
From my read-only audit of both Supabase projects and the repo. I changed nothing there.

**A. Domain purchase knock-on work.** See question 4 above (`public-forms` host check, Turnstile hostnames, Supabase Auth URLs, Google OAuth redirects, `shared/config.js` hostname rules). Also: `shared/config.js` picks the environment from the hostname and treats `localhost` (Capacitor WebView) as staging; PR #44 is the existing fix for non-main builds, please confirm it covers that file.

**B. Production vs staging drift.** Everneed01 (production) is at migration `015_support_sla_public`; `web-portal` and Everneed-staging are about 60 migrations ahead (payment lifecycle, finance journal, catalogue). Production `paystack` function is v4, staging v14. Production lacks the public-form hardening (migrations 016-018), so `join_waitlist` and `support_guest_*` are callable by `anon` without the Turnstile gate. Production holds 3 users/profiles, 1 store, 8 products and 0 orders, so reconciling before launch is cheap. Cloudflare deploys `main`, so do not merge #31 into `main` until production is reconciled.

**C. Repo and staging do not match.** About 19 staging migrations (`20261119141116` to `20261122140408`: variant checkout, `fin02a_*`, `fin03`) are not in `supabase/migrations/` on `web-portal`; the repo has 3 newer ones (`20261123030000` to `050000`) that staging does not list. `staging-reset.yml` would lose the first group.

**D. Branch protection.** `main` and `web-portal` report `protected:false`. Already on the owner list; flagging that it is still off.

**E. Hygiene.** `.gitignore` only ignores `*.keystore` (add `*.jks`, `.env*`, `local.properties`, `google-services.json`); `anon` still has table-level write grants on many tables (RLS blocks them, defense-in-depth only); `payment-recovery` exists in the repo but is deployed on neither Supabase project.

**F. Verified OK (no action).** Money RPCs (`refund`, `record_payout`, `admin_confirm_payment`, `set_store_terms`, `hub_*`, `dispatch`) all begin with `private.need_admin()`; every table has RLS and no write policy is open to everyone; the five public views are `security_invoker`; no private keys or live secrets found; `paystack` verifies the HMAC-SHA512 signature and re-verifies with Paystack before settling.

## Backend requests
None for M10 / M07. Items 4 above and B are for ChatGPT/Codex via Claude 10.
