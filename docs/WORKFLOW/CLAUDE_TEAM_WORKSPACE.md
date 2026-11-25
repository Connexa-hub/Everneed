# Claude team workspace: roster, lanes, claims and handoffs

**Created:** 25 Nov 2026 by Claude 2. **Status of this split: PROPOSED, owner to confirm.**
**Rules:** `AI_PROTOCOL.md` still governs. This file is the day-to-day board for the four Claudes and Codex. Append to it; do not rewrite another agent's rows.
**Audit behind this plan:** `CLAUDE_2_AUDIT_2026-11-25.md`.

## 1. Roster

| Name | Lane | Status |
|---|---|---|
| Claude 1 | Seller workspace (web) and owner of the design system `ds.css` / `ds.js` | Last commit 25 Nov 00:48 UTC (WEB-S22 part 25). ChatGPT/Codex noted "Claude unavailable" the same day: confirm. |
| Claude 2 | App shell, web-in-app integration, session/env/native bridge, cross-surface design review | Active |
| Claude 3 | Shopper app screens (root `index.html` + `js/*`) | Joining |
| Claude 4 | Admin console operations, public website, accessibility and performance | Joining |
| Codex | Backend: Supabase, migrations, RLS/RPC, Edge Functions, CI database jobs, contracts. (`AI_PROTOCOL.md` calls this agent "ChatGPT".) | Active |
| Owner | Tie-breaker, device testing (Infinix Hot 70), dashboard settings, production approval | |

Sign every commit and doc edit with your name (`Claude 2:` prefix in the message or a `Co-Authored-By` line).

## 2. Lanes and file ownership

A file has one owner. Others change it only by (a) a handoff request below, or (b) a tiny additive change with a note in the commit message.

| Owner | Files and areas |
|---|---|
| **Claude 1** | `web/assets/js/{workspace,ds-seller,ds-editor,setup,setup-art,plans,seller-flow,inbox,chat,notify,me,settings}.js`, `ds.css`, `ds.js`, `forms.css`, `setup.css`, seller parts of `portal.js`; tests `tools/web-seller-tests/` |
| **Claude 2** | `tools/package-*.mjs`, `tools/check-*package*.mjs`, `tools/prepare-android.mjs`, `capacitor.config.json`, `android/**` (Java side shared with Codex for plugins), app jobs in `.github/workflows/build.yml`, `js/config.js`, `js/supa.js`, `js/auth.js`, `shared/config.js`, `shared/supa.js`, `web/assets/js/{ds-app,appshell,boot}.js`, `core.js` router base-path |
| **Claude 3** | root `index.html`, `js/{app,shop,store,cards,payments,banners,opts,guide,country,motion,mode,busy,stores}.js`, `css/{app,components,mode,motion}.css`, `js/merchant/*` (until retired in favour of the web seller shell) |
| **Claude 4** | `web/assets/js/{admin,ds-admin,ds-dispatch,ds-team,ds-access,site,home,how,pages,kb,auth-showcase,mock}.js`, public page content in `web/index.html`, accessibility/performance tooling |
| **Codex** | `supabase/**`, `functions/**`, `shared/sql/`, `.github/workflows/{migrations-check,staging-db,staging-reset,payment-recovery-manual}.yml`, `docs/WORKFLOW/DB_CONTRACT.md`, SQL tests |
| **Shared (note required)** | `web/index.html` script/link lists (append inside your own commented block), `shared/{icons,art,geo,turnstile}.js`, `package.json`, `css/tokens.css` (generated: `npm run tokens`), `WEBSITE_TRACKER.md` (edit only your own rows) |

## 2a. Alignment with the platform architecture and roles contracts (added by Claude 2 after reading them)

Sources: `EVERNEED_UNIVERSAL_PLATFORM_ARCHITECTURE.md` (planning contract), `ROLES_AND_ACCESS_PROPOSAL.md` (ACCEPTED), `OFFICIAL_STORE_ADMIN_CONTRACT.md`, previews `ds-access.js`, `ds-team.js`, `ds-dispatch.js`. My first draft of this file was written before reading them; the lanes below now follow them.

**What the contracts fix for every frontend lane**
1. **One shared frontend.** The roles contract (section 7) says the phone app and the web are the same code (`web/`). The architecture lists app shells (Customer, Merchant, Platform Ops/Admin, Support, Finance, Dispatcher, Hub, Courier, POS) over one core: identity, memberships, permission checks, design system. Web-in-app (Phase 0) is therefore the foundation every shell needs, not a side task.
2. **Two planes, permission keys.** `platform.*` and `store.*` (and `logistics.*` for dispatch). The server decides; the UI only reflects. Controls go through `EVAccess.gate(name, legacy)` and its one `GATES` table in `ds-access.js`. Never invent a key; a rename is a `GATES` edit. Missing `my_access()` means today's owner/admin behaviour, nothing inferred.
3. **No role-management UI in the real menu until backend enforcement exists** (owner decision 8.6g). `ds-team.js` and `ds-dispatch.js` stay behind `?proto=1`, labelled MOCK, with actions disabled and the reason shown.
4. **Dispatch and the delivery hub use today's vocabulary only** (`deliveries.mode` direct|hub, `deliveries.status`, `seller_orders.status`) until Codex publishes the logistics shipment/leg/event contract (architecture phase D). The UI never writes a status; a transition is an RPC that checks actor, scope and state.
5. **Staging first; production only with owner approval.** Official store `everneed-official` is a platform-owned store: preserve its id and slug; use `store.*` keys scoped by `store_scope`.
6. **Mock honesty.** Anything not backed by a real function is MOCK in code and UI. Missing backend shows "not available", never a fake success.
7. **View-as/impersonation is off** (owner decision 3). No frontend work on it.

**Lanes by app shell (supersedes the descriptions in the roster where they differ)**

| Shell (architecture) | Claude | Real now | Waits for backend |
|---|---|---|---|
| Merchant: store, catalogue, orders, finance, store team | 1 | S05-S12, plan, settings | `my_access`, `team_*` RPCs, `store_members` |
| Platform Ops/Admin, Support, Finance, **Dispatcher and Hub workspaces** | 4 | AD08-AD19, hub board over existing `hub_receive`/`hub_consolidate`/`dispatch` | logistics contract (phase D), `staff_*`, `audit_log_list` |
| Customer: discovery, cart, checkout, orders, **tracking timeline** | 3 | APP-03..05 on existing RPCs | tracking events, POD, ETA |
| **App shells and native bridge**: web-in-app, context switcher, Back/lifecycle, **Courier shell** (location sharing, POD camera, offline queue), later POS terminal shell | 2 | Phase 0, then native adapters over Capacitor plugins already installed (`camera`, `geolocation`, `local-notifications`, `app`, `browser`) | courier jobs and POD contract, idempotent offline commit contract |

Architecture invariants that shape my lane: location sharing only for active duty or assigned jobs; courier offline actions are queued locally and revalidated and committed idempotently by the server; native features sit behind adapters (`shared/native.js`, to come) so no screen calls a plugin directly.

## 3. Work split (in dependency order)

### Phase 0: web inside the app (Claude 2 leads; unblocks owner device testing)
| ID | Task | Owner | Needs |
|---|---|---|---|
| X2-01 | One assembly script: copy `css/tokens.css`, `css/fonts.css`, `fonts/`, `js/theme.js`, `shared/*.js` into the web tree exactly as the Cloudflare workflow does, then stage `www/seller/`. Strengthen `check-seller-package.mjs` to fail if any script or stylesheet referenced by `web/index.html` is missing. | Claude 2 | none |
| X2-02 | Seller bundle environment from `BUILD.branch`, never hostname (issue #34). CI assertion: non-`main` bundle contains the staging ref and no live URL. | Claude 2 | Codex review of CI assertion |
| X2-03 | Real route-prefix support in `core.js` instead of package-time string patching; browser test for routes, links, reload, back/forward. | Claude 2 | Claude 1 informed (core.js is shared) |
| X2-04 | Shared session: refresh lock across both clients, logout propagation, tests. | Claude 2 | none |
| X2-05 | Ownership gate and Shop / My Store switch; Android Back handling. | Claude 2 | Codex R-C2-01 |
| X2-06 | Staging APK from `web-portal`; owner device checklist (see section 6). | Claude 2 + Owner | CI green |

### Phase 1: seller and admin MVP screens (web, then inherited by the app through Phase 0)
| ID | Task | Owner |
|---|---|---|
| S5 | Seller orders list, actions, delivery code (`WEB-S05`..`S07`) | Claude 1 |
| S8 | Earnings, payout history, plan, settings, notifications panel, skeletons (`WEB-S08`..`S12`, rest of `S22`) | Claude 1 |
| S23-UI | Photo upload error states in the product editor once Codex finds the root cause | Claude 1 |
| A1 | Admin orders monitor and payment confirmation (`WEB-AD08`) | Claude 4 |
| A2 | Hub board and dispatch (`WEB-AD09`, builds on `ds-dispatch.js` preview) | Claude 4 |
| A3 | Refunds and disputes (`WEB-AD10`, `AD11`); hide any action whose provider workflow does not exist | Claude 4 |
| A4 | Remaining admin: store terms, payouts, plans, banners, audit log, users/roles (`AD05`, `AD12`..`AD19`) | Claude 4 |

### Phase 2: shopper app
| ID | Task | Owner |
|---|---|---|
| B1 | Account recovery and email-confirmation return (`APP-03`) | Claude 3 |
| B2 | Checkout, Paystack and multi-seller order UI verification on staging test keys (`APP-04`), order history, tracking, reviews (`APP-05`) | Claude 3 |
| B3 | Shopper visual alignment with `ds-*` tokens (colour, type, icons, motion) without a framework change; barcode/image-search fallbacks (`APP-09`) | Claude 3 with Claude 1 review |
| B4 | Retire `js/merchant/*` once the web seller shell is reachable in the app | Claude 3 after X2-05 |

### Phase 3: public site and quality
| ID | Task | Owner |
|---|---|---|
| M1 | Public site pages (`WEB-M` TODO rows), legal and support essentials | Claude 4 |
| Q3 | Accessibility pass (`WEB-Q03`), Lighthouse and script-count pass (`WEB-Q04`: 32 scripts load in sequence) | Claude 4 |
| Q-A | Cross-surface design review of every merged UI change at 360 px, light/dark/AMOLED, six palettes | Claude 2 |

### Backend (Codex), ordered by what unblocks the Claudes
1. Seed realistic **staging-only** test data: orders, order items, hub states, refunds, a test admin and sellers (staging has 0 orders; FIN-07 test admin missing).
2. `WEB-S23` root cause for seller photo upload failure.
3. CI Phase 2: two failing public-visibility assertions.
4. Answer R-C2-01 (below) and the open R1-R9 requests from `SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md`.
5. Refresh the stale tracker rows (Edge Function versions, baseline).
6. Advisor items: `private.*` search_path, three anon-callable definers, owner toggles leaked-password protection (`WEB-F10`).

## 4. Rules for four Claudes working at once

1. **Pull first and read this file and the newest handoffs before every push** (`AI_PROTOCOL.md` rule 1 and AI-to-AI rule 1).
2. **Claim before starting:** add a row to section 5 (status `IN PROGRESS`, branch), then push that one-line change.
3. **Keep commits small and scoped to your lane.** Do not mass-format, rename or move another lane's files.
4. **Shared design system:** `ds.css` / `ds.js` belong to Claude 1. Others add tokens or components through a handoff, not by editing. Never create a second palette, icon set or toast/sheet system.
5. **Same words everywhere:** statuses, permission keys, RPC names and error codes exactly as in `DB_CONTRACT.md`. Mark anything not backed by a real function `MOCK` in code and in the UI.
6. **Frontend never decides security; backend never decides design.**
7. **Never claim DONE without evidence** (CI link, screenshots at 360 px and desktop, and device result where relevant).
8. **Handoff to the next agent:** fill the template in section 5 the moment you stop, even mid-task.

## 5. Claims and handoff log (append newest at top)

Handoff template: Summary, Files changed, Contracts (fields, events, permission keys, errors), Mock vs live, Tests run, Not tested, Risks, Needs from others (R-number, status), Needs owner decision.

### Open requests between agents
| ID | From | To | Ask | Status |
|---|---|---|---|---|
| R-C2-01 | Claude 2 | Codex | Which existing RPC or RLS-safe query should the app use to decide "this account owns a store" before opening the seller shell (candidates: `my_store_entitlements`, `stores` filtered by owner)? Please name it in `DB_CONTRACT.md`. | OPEN |
| R-C2-02 | Claude 2 | Codex | Staging-only seed data (orders in each state, hub items, refund and dispute rows, one test admin, two sellers) so S05/S06 and AD08-AD11 can be built against real responses. | OPEN |
| R-C2-03 | Claude 2 | Codex | Review the CI assertion design for X2-02 (staging bundle must not contain the live project URL; live config only on the `main` path). | OPEN (after X2-02 draft) |
| R-C2-04 | Claude 2 | Claude 1 | Confirm you are available, and that `core.js` may gain a route-base setting (X2-03). Confirm which of `ds-app.js` / `appshell.js` you still edit. | OPEN |
| R-C2-05 | Claude 2 | Claude 3, 4 | Read `CLAUDE_2_AUDIT_2026-11-25.md` and `DESIGN_SYSTEM.md`, then claim your first rows below. | OPEN |

### Claims
| Task | Owner | Branch | Status | Notes |
|---|---|---|---|---|
| X2-01 | Claude 2 | `claude-2/seller-bundle-assembly` (PR #44, draft) | IN PROGRESS | Assembly script + boot check pushed; CI result pending. Not in APK yet. |
| X2-02 | Claude 2 | `claude-2/seller-bundle-assembly` (PR #44, draft) | IN PROGRESS | Environment from build stamp; live project removed from non-main bundles; `EV_ENV` in `shared/config.js`. |

### Handoff entries
- **25 Nov 2026, Claude 2 (second entry): X2-01/X2-02 pushed as draft PR #44.**
  Summary: `tools/assemble-seller-bundle.mjs` builds `www/seller/` (web tree plus the shared files the Cloudflare build copies in); `tools/check-seller-bundle.mjs` verifies it; CI "Install and test" runs both. Environment now comes from the stamped build; non-main bundles contain no live project reference.
  Files: `shared/config.js` (adds `EV_ENV`), two new tools, `.github/workflows/build.yml` (one step). `web/` untouched, `core.js` untouched.
  Contracts: bootstrap sets `EV_NATIVE_SELLER`, `EV_SESSION_KEY="en_sess"`, `EV_BASE="/seller"`, `EV_ENV`. `ds-app.js` already reads `EV_NATIVE_SELLER` (Claude 1) and `shared/supa.js` already reads `EV_SESSION_KEY` and adopts the newer stored session (Claude 1, tested in `supa-session.js`). The shopper `js/supa.js` has no adoption yet (X2-04).
  Tests run: local assemble+check for `web-portal` and `main` builds; three negative cases fail correctly; `node tools/check.mjs`; `tools/web-seller-tests/run.js` 22 pass, 0 fail.
  Not tested: GitHub Actions run, any device, whether Capacitor falls back to root `index.html` for `/seller/...`, `/api/geo` absence in the app.
  Risks: `EV_BASE` is declared but nothing reads it until X2-03; the bundle is deliberately not in the APK or linked from the shopper UI.
  Needs: Claude 1 answer to R-C2-04 before I edit `core.js`; Codex R-C2-01 (ownership lookup), R-C2-03.
- **25 Nov 2026, Claude 2:** audit complete, no code changed. See `CLAUDE_2_AUDIT_2026-11-25.md`. Not tested: deployed preview visuals, any device behaviour, CI logs.

## 6. Device checklist for the first web-in-app APK (owner, Infinix Hot 70)

Staging ribbon visible; shopper app unchanged; My Store appears only for a store owner; seller Home and Products render with styles and icons; opening a seller route and pressing Back returns to the previous screen, and Back on seller Home returns to the shopper app; app restart keeps the session; sign out in either shell signs out both; no request goes to the live Supabase URL.

## 7. Needs owner decision

1. **Branching.** `AI_PROTOCOL.md` says everyone commits to `web-portal`. With four Claudes plus Codex pushing at once, direct pushes will collide. *Option A:* keep one branch. *Option B (recommended):* short-lived `claude-N/<task>` branches, small PRs into `web-portal`, merged by the owner or Codex after CI. Needs your yes because it changes protocol rule 1.
2. **One frontend or two?** `SHARED_FEATURE_DELIVERY_POLICY.md` (on PR #41 only) says web is the shared source and the app packages it. Today the shopper app is a separate codebase. *Recommended for the MVP:* keep both, bundle seller under `/seller` (Phase 0), revisit moving the shopper UI to the shared web code after the first owner device test. Please confirm, and confirm that the policy file may land on `web-portal`.
3. **Stale PRs.** #36, #40, #42, #43 (Google sign-in generations) and #33: close, or keep as reference?
4. **Name.** Use "Codex" in the docs in place of "ChatGPT"?
