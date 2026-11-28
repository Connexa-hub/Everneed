# Team board: Claude 1-9, Codex and Claude 10
**Owner: Claude 10 (integration controller) | Refreshed 27 Nov 2026 | Staging only (`vjiadqygpyebpisxslbx`). Production untouched.**

Single source for who does what. Find your row below, do **Now**, then **Next**. Backend asks live in `docs/WORKFLOW/CODEX_REQUESTS.md`.

## Rules for every builder
1. Read `AI_PROTOCOL.md`, `PROJECT_STANDARD_AND_ROADMAP.md`, and your task's contract before coding.
2. Work on your own branch. Before opening or updating a PR, **merge latest `web-portal` into it** (no force-push). Never push to `web-portal` or `main`. `web-portal` is protected: PR only, and "Install and test" plus "Database tests" must pass.
3. Staging only. Never touch production. No secrets, tokens or test passwords in code, commits, logs, screenshots or PR text. The owner gives test credentials to your session privately.
4. Do not edit `supabase/`, RLS, RPCs, payment or finance logic. Missing backend means a BACKEND REQUEST to Claude 10. Never fake balances, metrics, permissions or payment states. Mocks are labelled MOCK.
5. Do not edit files another agent owns (below). New pages go in new files, loaded lazily through `ds-lazy.js`. **Eager bundle budget is 225 KB gzipped; CI fails above it.**
6. Report only tests that really ran. UI changes need 360 px and desktop screenshots. Update **your own row in this file**, not `WEBSITE_TRACKER.md`.
7. The PR description must match the diff. Hand off with: task ID, branch, head SHA, files, tests and results, screenshots, limitations, backend dependencies, ready YES/NO. Claude 10 reviews the diff and is the only one who merges.

**File ownership:** `admin.js`, `ds-admin.js` routing/nav = Claude 4. `workspace.js`, `ds-seller.js`, `ds-editor.js` = Claude 1. `shared/supa.js`, `shared/config.js`, `ds-app.js`, `ds-access.js`, `appshell.js`, `android/`, native auth = Claude 2. Root `js/` shopper app = Claude 3.

## Merged so far
#48 S23 photo upload (Claude 1) · #53 QA-01 smoke, axe, budget (Claude 9) · #46 CI `merge_group` + PR template · #60 Codex requests · #50 FIN-02 contract proposal (Codex)

## Staging facts now available (from Codex CX-01, see `docs/WORKFLOW/CX01_STAGING_FIXTURES.md` once #62 merges)
- Existing Auth test accounts: customer (email unconfirmed), admin, seller **Shopflow**, seller **Testing**. Passwords stay with the owner.
- 10 fixture orders: CX01-01 to 05 unpaid (`awaiting_transfer`); CX01-06 to 10 simulated-paid, covering handover pending, partial hub receipt, consolidated, out for delivery or delivered, and a damaged-item hub issue.
- 22 legacy ledger rows: sale, commission, refund; pending, available, reversed. **No payout, adjustment or rental rows exist** and Codex will not fabricate them.
- 1 open dispute on CX01-10. 1 simulated refund of NGN 1,000.
- **Both fixture products now have 0 available stock**, so shopper checkout cannot be tested on them (CX-15 below).
- Codex fixed two real bugs on staging: `hub_receive()` (wrong notify helper) and `dispatch()` (blocked state transition). Rejecting an empty courier name is in PR #62.

## Codex status (backend owner)
| ID | Status |
|---|---|
| CX-01 fixtures | Mostly done on staging. Negative payout row not possible. PR #62 (draft) waits on #61 |
| CX-02 `my_access()` | Draft in PR #49. **Not applied to staging.** Codex found two gaps: output uses `scope_id/scope_name` but `ds-access.js` reads only `store_id/store_name`; protected-role guard to add |
| CX-03 dispatcher contract | Design merged (#50). Implementation comes after B1 |
| CX-04 privileges | TRUNCATE, TRIGGER, REFERENCES revoked on staging, CI test added in PR #61 (draft). Broad DML and default ACLs still open |
| CX-05 to CX-14 | No update yet |
| **CX-15 (new)** | Add fresh stock or a dedicated QA product for shopper checkout tests, since fixtures consumed the 10 units |

## Assignments
| Agent | PR / branch | State |
|---|---|---|
| Claude 1 | #54 `claude/agent-1/s11-store-settings` | CI FAILED: eager budget 229.8 KB vs 225 KB |
| Claude 2 | #44 `claude-2/seller-bundle-assembly` | Merge conflict with `web-portal` in `build.yml`; no CI on current head |
| Claude 3 | #55 `claude/agent-3/checkout-payment-return` | Draft; waiting on CI and owner device checklist |
| Claude 4 | `claude/agent-4/admin-orders-monitor` | Pushed, **no PR opened** |
| Claude 5 | #56 `claude/agent-5/hub-board` | Draft; not yet verified against real data |
| Claude 6 | #57 `claude/agent-6/seller-earnings` | Draft; needs screenshots |
| Claude 7 | #58 `claude/agent-7/admin-disputes` | Draft; needs screenshots |
| Claude 8 | #59 `claude/agent-8/app-handoff-seo` | Draft; description does not match diff |
| Claude 9 | QA-02 #72 `claude/agent-9/ci-run-seller-tests` | **Ready for review, CI green.** QA-01 (#53) merged. Next: seller-shell smoke |

## What each agent does now
**Claude 1.** Now: in #54, load `settings.js` through `ds-lazy.js` (route `/portal/settings/*`) and make the `scripts-wired.js` guard read the lazy list from `ds-lazy.js` instead of a hard-coded array. Do not raise the budget. Merge `web-portal`, get CI green. List which `stores` and `store_private` columns an approved seller can write (CX-09). Next: with the Shopflow seller account, verify the orders screens (S05/S06) against fixtures CX01-06 to 10; then link `/portal/earnings` once #57 merges; then WEB-S12 notifications centre, read-only.

**Claude 2.** Now: merge `web-portal` into #44, keep **both** `build.yml` steps (yours and QA-01's), push, get CI green; optional hardening: honour `window.EV_ENV` only when `window.EV_NATIVE_SELLER===true`. Then: in `ds-access.js`, accept the generic `scope_id`/`scope_name` from `my_access()` and keep `store_id`/`store_name` as aliases for store-plane contexts, do not drop partner contexts, and add a test using the shape in PR #49. Do not call `my_access()` live until Codex applies it to staging. Then `claude/agent-2/route-base-and-back` (X2-03/04), then password recovery (A05/A06, APP-03).

**Claude 3.** Now: keep #55 in draft; merge `web-portal`, CI green, ask the owner to run the 5-item device checklist with Paystack **test** keys. Next: use the unpaid fixtures CX01-01 to 05 (customer account) to check resume, expired and cancelled states. New orders cannot be placed on the fixture products until CX-15. Then the order history and tracking audit (APP-05).

**Claude 4.** Now: **open the PR** from `claude/agent-4/admin-orders-monitor` to `web-portal` (seam, orders monitor, WEB-F12), merge `web-portal` first, CI green. The seam unblocks Claude 5, 6, 7. Then add nav entries for `/admin/hub` and `/admin/disputes`. Next: verify seller review and product moderation against the fixtures with the admin account.

**Claude 5.** Now: #56: merge `web-portal`, CI green, screenshots. Read `docs/WORKFLOW/LOGISTICS_DISPATCH_CONTRACT_PROPOSAL.md` (merged via #50): current hub board uses only existing RPCs; show no assignment acceptance, custody scan, live route or POD. Verify the board against fixtures CX01-06 to 10 (partial receipt, consolidated, out for delivery, damaged item) now that Codex fixed `hub_receive` and `dispatch`. Next: UI spec for dispatcher queue and courier tasks against the future `logistics_*` RPCs; build nothing that invents data.

**Claude 6.** Now: #57: merge `web-portal`, CI green, 360 px and desktop screenshots. Test the screen against the 22 fixture ledger rows: refunds are negative, three statuses, mixed kinds. Payout, adjustment and rental rows do not exist, so show the empty and unavailable states honestly. Next: admin finance read-only views (payouts list, reconciliation) with honest labels.

**Claude 7.** Now: #58: merge `web-portal`, CI green, screenshots at 360, 412 and desktop. Verify the detail view against dispute `4d095dbf-de88-4f41-b73e-ba82dfaa1be9` (order CX01-10). Next: verification and fraud-report queue audit, read-only.

**Claude 8.** Now: #59: update the description to match the 12 changed files, merge `web-portal`, lazy-load any new scripts, delete the claim doc and record status here. The handoff page shows only destinations that exist today. Next: legal pages and consent copy (M06), help centre content.

**Claude 9.** Done (28 Nov): QA-02 in PR #72 (CI green, awaiting Claude 10 review): `tools/qa/run-tests.mjs` runs every file in `tools/web-seller-tests` (required) and `tools/shop-tests` (optional until #55 merges) inside "Install and test"; 9 files pass in 0.4 s; results appear in the QA PR comment. After it merges, tests from #55, #56 and #58 run with no CI edit. Now: seller-shell smoke with a stubbed signed-in session (session key and shape from `shared/supa.js`), and route list updates for new public pages (e.g. #59 handoff). Next: staging E2E (WEB-Q02) when the owner supplies test credentials; real-device checks (APP-10). Open for Claude 1: #54 is 0.6 KB over budget when measured on its head (`settings.js` eager); see the lazy-load note in the Claude 1 row.

## Owner actions outstanding
- Give test credentials (customer, admin, Shopflow, Testing) privately to the sessions that need them. Never commit them.
- Turn on the S23 phone check: after a failed photo upload run `JSON.stringify(EVUpload.last)` in the console and send it to Claude 10.
- Hot 70 device test of APP-13 native Google sign-in.
- Policy decision (CX-09): should approved sellers' name, logo or cover edits need re-review?

## Known PR sprawl (nothing closed without owner OK)
#36, #40, #43 (native Google sign-in; APP-13 already on `web-portal`), #41 (superseded by #44), #42 (Claude 3 ports the payment part), #32 (variant checkout, backend-blocked), #38 (seller accept deadline, backend).
