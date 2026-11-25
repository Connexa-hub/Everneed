# Four-agent frontend integration review — 25 November 2026

**Owner:** ChatGPT coordinator (Codex in the new workspace naming)
**Branch:** `web-portal`
**Reviewed head:** `6224113bd25a9b80d3075b936beaf671b26655fa`
**Scope:** review of Claude 2's onboarding audit and proposed four-Claude roster against `AI_PROTOCOL.md`, `ROLES_AND_ACCESS_PROPOSAL.md`, `EVERNEED_UNIVERSAL_PLATFORM_ARCHITECTURE.md`, both design-system documents, and the current tracker.
**Status:** REVIEW COMPLETE; implementation tasks remain open. This document does not approve the proposed roster or change the accepted architecture.

## 1. Executive decision

The four-lane model is a useful division of work, but it is not yet a complete delivery system. Keep it as a **proposed team plan** until the owner confirms agent availability and the source-of-truth decision for the shopper app. Do not treat the roster as authority to change another lane's files.

The most important correction is to distinguish:
- **Current reality:** the shopper app (root `index.html`, `js/*`, `css/*`) and the web portal (`web/`) are separate frontends. The APK currently packages the root shopper app.
- **Near-term bridge:** package the seller web workspace into the APK as a separate route/shell, with deterministic environment, route handling, session coordination and Android Back behaviour.
- **Target architecture:** one shared platform core and design language across Customer, Merchant, Platform Ops/Admin, Support, Finance, Dispatcher, Hub, Courier and POS shells. A seller bundle alone does not complete this target or make the shopper UI shared.

The accepted roles contract says the phone app and web use the same code (`web/`). That statement is not true of the current repository layout. Record this as an architecture gap and obtain an explicit owner decision on the migration path; do not silently declare the two frontends unified.

## 2. Four-Claude lanes — corrected responsibilities

| Lane | Primary ownership | Required outputs | Must not do |
|---|---|---|---|
| **Claude 1 — Merchant experience and design system** | Seller setup, catalogue/editor, seller home, orders, inbox, notifications, plans/settings; `ds.css` / `ds.js` and seller UI tests | Complete seller journey with real loading/empty/error/success states; reusable components and tokens; 360–412 px + desktop evidence; design-system release notes | Invent backend data or permission keys; build a second component/toast/picker system; expose team/role controls before backend enforcement |
| **Claude 2 — App shell and integration** | Capacitor/native bridge, Android lifecycle/Back, web-in-app packaging, route base, environment stamping, shared-session coordination, app shell/context switcher | Reproducible APK assembly; route/reload/back-forward tests; session refresh/logout contract; native plugin adapters; staging-vs-production bundle assertions | Decide access policy; duplicate business rules; infer production config from hostname; claim web-in-app is complete without physical-device evidence |
| **Claude 3 — Shopper/customer experience** | Discovery, product/store pages, cart, checkout, payment UI, order history/tracking/reviews, customer account flows | End-to-end shopper journey on staging; shared status/money/API contracts; accessible and fast screens; visual alignment with shared tokens and seller/admin surfaces | Create separate status, currency, auth/session, payment or icon conventions; represent unimplemented tracking/ETA/POD as live |
| **Claude 4 — Platform operations and public experience** | Admin operations, support/finance/dispatch/Hub UI, public site and help content, accessibility/performance quality tooling | Real admin workflows, public pages, role-aware navigation, keyboard/screen-reader checks, performance budgets and cross-surface QA report | Treat sample-data previews as live; create role permissions; enable refund/payout/dispatch actions without backend contract and authorization |
| **Codex / ChatGPT — Backend and release assurance** | Supabase schema/migrations/RLS/RPC/Edge Functions, API and status contracts, security tests, CI database gates, integration review | Versioned contracts and stable error/status names; staging fixtures; authorization tests; migration/release evidence; review of frontend data assumptions | Design or silently rewrite the UI; apply production changes without explicit owner approval |

**Availability caveat:** Claude 1 was recorded as unavailable in the audit; Claude 3 and Claude 4 were recorded as joining. Their lane assignments are therefore proposed until each agent confirms availability. If any is unavailable, the owner must reassign the lane explicitly; do not leave work silently unowned.

## 3. Shared contracts that prevent four separate products

Create/maintain one source of truth for each cross-surface concern:

1. **Identity and session:** one documented session key, refresh lock, token adoption and logout propagation across shopper and seller shells. Native Google Sign-In is an adapter, not a second user/session system. Browser OAuth remains the web path.
2. **Environment:** CI build metadata selects staging for every non-`main` build and production only for reviewed `main` release builds. No hostname inference inside Capacitor. Add CI assertions that the staging artifact contains the staging Supabase ref and cannot contain the production URL.
3. **Permissions:** accepted `platform.*`, `store.*` and future `logistics.*` vocabulary only. Backend authorization is authoritative. UI uses the central gate registry and never invents role names or keys.
4. **Data/API:** one documented API/RPC catalogue with exact names, arguments, response fields, errors and required permission keys. No parallel ad-hoc calls or frontend-owned status transitions.
5. **Statuses and money:** central status definitions and country-aware money/number/date formatting. Keep amounts as integer minor units or the exact backend representation; do not reimplement commission, seller payable, delivery fee or refund calculations in the UI.
6. **Design:** generated `css/tokens.css` is the colour/mode/palette source; bundled fonts and the six palettes (emerald, gold, indigo, ocean, rose, violet) remain shared. `docs/DESIGN_SYSTEM.md` governs app tokens/components; `docs/PRODUCT/DESIGN_SYSTEM.md` governs the seller/admin component layer. The latter must consume the shared tokens and fonts, not fork colours, typography or motion. Agree component ownership before adding shared components.
7. **Native capabilities:** camera, geolocation, notifications, browser, app lifecycle and future offline work are accessed through adapters (planned `shared/native.js`), never directly from each screen. Permission prompts are contextual and explain why.
8. **Truthful UI:** real backend data, real empty state, or explicit MOCK/not available. Never show invented counts, balances, delivery ETAs, payment success or staff capabilities.
9. **Accessibility and performance:** shared quality gates across all shells, not Claude 4's final-only task. Every lane owns its screens; Claude 4 maintains the cross-surface audit and CI tooling.

## 4. Corrections to Claude 2's proposed plan

- **X2-01/X2-02 are prerequisites, not the complete integration.** Bundle assembly and environment stamping need route-prefix support, deep-link/reload handling, shared session refresh coordination, logout propagation, ownership/context gate and Android Back handling before the seller shell is considered usable.
- **Do not assume a Cloudflare rewrite exists in Capacitor.** Test direct route open, reload, nested navigation, back/forward and Android Back in the actual APK. A route-prefix setting must be a runtime feature, not a fragile package-time string replacement.
- **Do not copy only `shared/*.js` and assume the bundle is complete.** Validate every script, stylesheet, font, icon sprite and runtime asset referenced by `web/index.html`; fail the build on any missing dependency. Validate the final APK contents as well as the intermediate `www/seller/` directory.
- **Avoid two independent Supabase refresh loops.** Define a single lock/adoption protocol and race tests for refresh in either shell, simultaneous startup, logout in either shell and token expiry while navigating.
- **Do not show the Shop / My Store switch based on client-side guesses.** Wait for the agreed ownership/context lookup and preserve the legacy fallback exactly as the accepted roles contract specifies until `my_access()` exists.
- **Keep `ds-team.js` and `ds-dispatch.js` prototypes behind the prototype flag, labelled MOCK, with actions disabled until the role and logistics contracts are implemented and tested.
- **Do not treat the four design systems as independent.** App tokens and seller/admin components must share the same palette, font, spacing, touch target, icon and reduced-motion rules. The current two design documents are complementary layers, not permission to fork the visual language.
- **Reconcile the delivery-policy document.** `SHARED_FEATURE_DELIVERY_POLICY.md` is absent from `web-portal` (the audit says it exists on PR #41 only). Do not cite it as an accepted branch contract until it is reviewed and merged through the protocol.
- **PR hygiene:** the team workspace lists stale Google sign-in PRs as candidates to close. Do not close them automatically; preserve them as references until their commits are confirmed represented and the owner approves closure.

## 5. Work sequence and acceptance gates

### Gate 0 — owner/team alignment
- Confirm the four Claude agents are actually available and accept their lanes.
- Decide whether the current separate shopper frontend is a temporary bridge or whether/when it will move to the shared `web/` source. Until decided, keep both working and align their contracts/tokens.
- Confirm whether short-lived `claude-N/*` branches and PRs are allowed. Current `AI_PROTOCOL.md` requires direct work on `web-portal`; the team workspace's branch proposal cannot override it.

### Gate 1 — app integration (Claude 2, Codex review)
- Build and verify seller bundle from the exact Cloudflare asset-copy contract.
- Add runtime route base and test nested routes, reload, history and Android Back.
- Establish one cross-shell session lock/adoption/logout protocol.
- Add context/ownership gate backed by the agreed backend contract.
- Verify staging environment is selected by build stamp and production URLs are absent from staging artifacts.
- Install and test on the owner's Hot 70; verify no production project is contacted.

### Gate 2 — customer and merchant flows (Claude 1 + 3)
- Merchant: setup/resume, product create/edit/photo upload/submit, store status, orders, fulfilment, inbox, settings and notifications.
- Customer: browse/search, seller identity, product detail, cart, checkout, payment confirmation, order history, tracking, reviews, recovery and account settings.
- Test a full staging buyer → seller → hub/dispatch journey with seeded records; do not fake missing records.

### Gate 3 — admin, support and public site (Claude 4)
- Implement operations screens against published RPCs and permission gates.
- Hide/disable unavailable financial, refund, dispatch and role-management actions with explicit reasons.
- Complete public pages, help/support/legal navigation and SEO metadata without weakening privacy/security.

### Gate 4 — cross-surface quality (all lanes; Claude 4 coordinates)
- 360 px, 390/412 px and desktop widths; no horizontal overflow.
- Light, dark and AMOLED across all six palettes; contrast tests for every theme.
- Touch targets >=44 px; keyboard/focus, screen reader labels, 200% text and reduced-motion checks.
- Low-end Android (Hot 70 target) startup, memory/scroll behaviour and weak-network performance; no heavy assets or unnecessary scripts.
- Loading, empty, retry, permission-denied, offline, stale-session and server-error states.
- CI green, final APK installed, browser preview checked, real staging database confirmed. Only then mark DONE.

## 6. Google Sign-In release note

The owner has confirmed the current test APK's native Google Sign-In now works. The Android OAuth fingerprint that matches that test APK is valid for that signing certificate. It is **not a permanent guarantee for production** if the Play/App signing or release keystore differs. Before production:
- establish and protect the stable release signing key;
- register the release certificate SHA-1 against package `com.everneed.store` in the same Google Cloud project;
- retain the Web OAuth client ID as the native plugin's server client ID; keep the Android client registration separate;
- verify the Play App Signing certificate too if Play distribution is used;
- test the exact release-signed artifact and Supabase production callback/config before launch.
Never commit keystore material or secrets.

## 7. Open owner decisions

1. Confirm the four-Claude roster and whether Claude 1 is available.
2. Confirm the target path for unifying the shopper app with the shared `web/` frontend; recommended: keep current shopper app stable while the seller shell is proven, then migrate in controlled phases.
3. Confirm whether to amend `AI_PROTOCOL.md` to permit short-lived agent branches. Until then, its single `web-portal` branch rule wins.
4. Confirm whether stale Google Sign-In PRs are to be closed after their useful commits are verified on `web-portal`.

## 8. Evidence and limitations

Reviewed:
- `AI_PROTOCOL.md`, `WEBSITE_TRACKER.md`;
- `CLAUDE_TEAM_WORKSPACE.md`, `CLAUDE_2_AUDIT_2026-11-25.md`;
- `EVERNEED_UNIVERSAL_PLATFORM_ARCHITECTURE.md`, accepted `ROLES_AND_ACCESS_PROPOSAL.md`;
- `docs/DESIGN_SYSTEM.md`, `docs/PRODUCT/DESIGN_SYSTEM.md`;
- current branch head and latest two commits.

Not tested in this review: browser/device UI, current CI run logs, actual APK contents for the seller bundle proposal, real staging buyer-to-seller E2E, and release signing configuration. The audit by Claude 2 also states it did not perform a visual/device test. Do not mark the team plan or affected tracker tasks DONE based on this document alone.
