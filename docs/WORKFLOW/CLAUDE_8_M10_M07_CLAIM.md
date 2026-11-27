# Claude 8 claim: WEB-M10 (app handoff) + WEB-M07 (SEO)

**Agent:** Claude 8 (Public website / content / growth) | **Branch:** `claude/agent-8/app-handoff-seo` | **Base:** `web-portal` @ `5b88e67` (to be synced) | **Status:** IN PROGRESS | 27 Nov 2026
Temporary claim and plan note. Claude 10 may prune it once the handoff is in the PR description.

## Owner answers (27 Nov 2026)
1. **Not production yet.** `everneed.pages.dev` is a temporary address. A custom domain has not been bought or set up.
2. **No Play Store listing yet.** No verified destination of any kind exists.
3. Removing the dead hot-link code from `site.js` (S3): not answered, still open for Claude 10.

### What this changes in the plan
- No host is the "production" host today. Until a domain is configured, **every host must serve `Disallow: /` and `noindex`**. No sitemap is published yet.
- The production origin becomes a single setting (`PUBLIC_SITE_ORIGIN`, a Pages environment variable), not a hard-coded value. Unset means noindex everywhere and no canonical. Setting it later switches on robots allow, sitemap and canonicals without a code change.
- M10 ships with the empty-destinations state only: an honest "The app is not published yet" message, plus sign-up and waitlist actions that already exist. No store buttons until a destination is verified.

## Scope (from TEAM_BOARD.md, Claude 8 row)
1. WEB-M10: web-to-app handoff page. Only verified, published download destinations. No web cart or checkout.
2. WEB-M07: per-page titles, sitemap, robots.
3. Replace hot-linked showcase images on the auth screens with Everneed's own assets.

Staging only. No backend, schema, RLS, RPC, payment or finance changes. No edits to `shared/config.js`, `core.js`, `workspace.js`, `admin.js`, `android/` or any file another agent owns.

## Evidence (read from `web-portal` @ `0178766`)
| # | Finding | Where |
|---|---|---|
| E1 | `/shop` already exists as a text-only page: no scene, no destinations, honest "not displayed until verified" note. M10 upgrades this route. | `web/assets/js/site.js` `V.shop` |
| E2 | The 4 hot-linked auth images (magnific, rawpixel x2, productshotai) are already replaced at runtime by inline SVG art from `auth-showcase.js` (loaded last in `index.html`). The URLs remain as dead code in `productWave()` and would load if the override regex ever stops matching. Tracker rows A01/A08 saying "still hot-linked" are stale. | `site.js` `productWave()`, `auth-showcase.js` |
| E3 | `<link rel="canonical" href="https://everneed.pages.dev/">` is static on every route, so every inner page declares the home page as canonical. | `web/index.html` |
| E4 | `og:url` / `og:image` point at the preview host `web-portal.everneed.pages.dev` while canonical points at `everneed.pages.dev`. | `web/index.html` |
| E5 | `<meta name="robots" content="index,follow">` is static on every route including `/portal`, `/admin`, `/account`, `/sign-in`. No `robots.txt`, no `sitemap.xml`. Preview deployments (staging data) are indexable. | `web/index.html`, `web/` |
| E6 | Same title and description for every route in the static HTML. Client-side titles exist only after JS runs. | `web/index.html`, `site.js` `pub()` |
| E7 | No verified Play Store / GitHub release destination exists (owner confirmed: no Play Store yet). | docs, owner |

## Plan (one commit per slice, PR to `web-portal`, Claude 10 merges)
- **S1 M07 server side (new files only):** `functions/robots.txt.js` (host-aware: `Disallow: /` unless `PUBLIC_SITE_ORIGIN` matches the request host), `functions/sitemap.xml.js` (public routes only; empty or 404 while the origin is unset), and per-route title / description / canonical / `og:url` / robots injected with `HTMLRewriter` for the public route table; `noindex` plus `X-Robots-Tag` for private routes and unconfigured hosts. Minimal edit to `web/index.html` to drop the static home-only canonical, `og:url` and robots values once injection is in place.
- **S2 M10 (new files):** `web/assets/js/app-handoff.js` + `web/assets/css/app-handoff.css`. Wraps `V.shop` (same pattern as `auth-showcase.js`). SVG scene: category products, parcels, courier; `prefers-reduced-motion` respected; 360 px first. Destinations come from one `EV_APP_DESTINATIONS` list (empty today); code renders only `https` URLs on an allow-list of hosts, Play first, hides everything else. Empty list renders the "not published yet" message, never a dead button. Two script/link lines added to `index.html`.
- **S3 cleanup (pending Claude 10 OK):** delete the dead hot-linked `productWave()` markup from `site.js` (tiny edit, rebased just before the PR).
- **Tests I will run and report only if they really ran:** `npm test`, `node --check` on each new JS file, a node test for destination filtering and the robots / sitemap / meta functions, and 360 / 412 px and desktop checks with a screenshot if a browser is available in my session.

## Suggestions for Claude 10 (outside my lane, with evidence)
These came from my read-only audit of both Supabase projects and the repo. I changed nothing.

**A. Buying the domain has knock-on work (owner + backend + Claude 2).** Not part of M10/M07, but the domain switch will break these unless planned:
1. `supabase/functions/public-forms/index.ts` only accepts hosts matching `*.everneed.pages.dev` for Origin and Turnstile hostname checks. A custom domain would be rejected (403). Needs a backend change and a Turnstile widget hostname update.
2. Supabase Auth Site URL and redirect list, and Google OAuth redirect URIs (tracker WEB-A06), must add the new domain on staging and live.
3. `shared/config.js` selects environment by hostname (regex for the pages.dev preview). A new domain must be added deliberately. Note `localhost` (Capacitor WebView) also resolves to staging there. PR #44 is the existing fix for non-main builds; confirm it covers this file.
4. Cloudflare Pages: add the custom domain, set `PUBLIC_SITE_ORIGIN`, and re-fetch social previews (WhatsApp caches).

**B. Production vs staging drift (backend / owner decision).** Everneed01 (production) is at migration `015_support_sla_public`. `web-portal` and Everneed-staging are about 60 migrations ahead (payment lifecycle, finance journal, catalogue). The production `paystack` function is v4, staging v14. Production does not have the public-form hardening (migrations 016-018), so `join_waitlist` and `support_guest_*` are callable by `anon` without the Turnstile gate. Production currently holds 3 users/profiles, 1 store and 8 products, 0 orders, so reconciling before launch is cheap. Do not merge PR #31 to `main` until the production schema is reconciled, because Cloudflare deploys `main`.

**C. Repo and staging do not match.** About 19 staging migrations (`20261119141116` to `20261122140408`: variant checkout, `fin02a_*`, `fin03`) are not in `supabase/migrations/` on `web-portal`; the repo has 3 newer ones (`20261123030000`..`050000`) that staging does not list. `staging-reset.yml` would lose the first group.

**D. Branch protection.** `main` and `web-portal` are unprotected (GitHub API: `protected:false`). Already on the owner list in TEAM_BOARD; flagging that it is still off.

**E. Hygiene items (low risk).** `.gitignore` only ignores `*.keystore` (add `*.jks`, `.env*`, `local.properties`, `google-services.json`); `anon` still has table-level write/TRUNCATE grants on many tables (RLS blocks writes; defense-in-depth only; Phase A plan already covers it); `payment-recovery` Edge Function exists in the repo but is deployed on neither Supabase project.

**F. Verified OK (no action):** money RPCs (`refund`, `record_payout`, `admin_confirm_payment`, `set_store_terms`, `hub_*`, `dispatch`) all begin with `private.need_admin()`; every table has RLS and no write policy is open to everyone; the five public views are `security_invoker`; no private keys or live secrets found; `paystack` verifies the HMAC-SHA512 signature and re-verifies with Paystack before settling.

## Backend requests
None for M10 / M07. Items in section A.1 and B are for ChatGPT/Codex via Claude 10.
