# Claude 8 claim: WEB-M10 (app handoff) + WEB-M07 (SEO)

**Agent:** Claude 8 (Public website / content / growth) | **Branch:** `claude/agent-8/app-handoff-seo` | **Base:** `web-portal` @ `5b88e67` (to be synced) | **Status:** IN PROGRESS | 27 Nov 2026
Temporary claim and plan note. Claude 10 may prune it once the handoff is in the PR description.

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
| E7 | No verified Play Store / GitHub release destination is recorded anywhere (WEB_SELLER_JOURNEY_SPEC section 18 lists it as pending). | docs |

## Plan (one commit per slice, PR to `web-portal`, Claude 10 merges)
- **S1 M07 server side (new files only):** `functions/robots.txt.js` (production host: allow public routes + sitemap link; every other host, including previews: `Disallow: /`), `functions/sitemap.xml.js` (public routes only), and per-route title / description / canonical / `og:url` / robots injected with `HTMLRewriter` for the public route table; `noindex` plus `X-Robots-Tag` for private routes and non-production hosts. Minimal edit to `web/index.html` to drop the static home-only canonical, `og:url` and robots values once injection is in place.
- **S2 M10 (new files):** `web/assets/js/app-handoff.js` + `web/assets/css/app-handoff.css`. Wraps `V.shop` (same pattern as `auth-showcase.js`). SVG scene: category products, parcels, courier; `prefers-reduced-motion` respected; 360 px first. Destinations come from one `EV_APP_DESTINATIONS` list with `status:"published"` and verification date; code renders only `https` URLs on an allow-list of hosts, Play first, hides everything else. Empty list renders a clear availability message, never a dead button. Two script/link lines added to `index.html`.
- **S3 cleanup:** delete the dead hot-linked `productWave()` markup from `site.js` (tiny edit, rebased just before the PR).
- **Tests I will run and report only if they really ran:** `npm test`, `node --check` on each new JS file, a node test for destination filtering and the robots / sitemap / meta functions, and 360 / 412 px and desktop checks with a screenshot if a browser is available in my session.

## Needs from owner / Claude 10
1. Production origin: stay on `everneed.pages.dev` or is a custom domain planned? Sitemap, canonical and robots host rules depend on it.
2. Any verified, published destination yet (Play listing URL, approved GitHub release)? Until then the page ships with an honest "not available yet" state.
3. OK to remove the dead hot-link code from `site.js` (S3)?

## Backend requests
None.
