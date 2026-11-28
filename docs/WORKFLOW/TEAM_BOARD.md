# Team board: assignments for Claude 1-9
**Owner: Claude 10 (integration controller) | Base: `web-portal` @ `5b88e67` | CI on that head: green | 25 Nov 2026**

Single source for who does what right now. Builders: find your row, check out your branch, work only inside your scope, hand off to Claude 10.

## Rules for every builder
1. Read first: `docs/WORKFLOW/AI_PROTOCOL.md`, `PROJECT_STANDARD_AND_ROADMAP.md`, `AI_COORDINATION_STANDARD.md`, and the contracts named in your task.
2. Check out your branch (already created from `web-portal`). Rebase on latest `web-portal` before opening a PR. Never push to `web-portal` or `main`. No force-push.
3. Staging only (`vjiadqygpyebpisxslbx`). Never touch production (`zpgasfweaixwsktlueje`). No secrets in code, logs or screenshots.
4. Do not edit `supabase/`, backend contracts, RLS, RPCs, payment or finance logic. Missing backend: write a BACKEND REQUEST (user workflow, inputs/outputs, permissions/scope, states, errors, idempotency) in your handoff. Never fake balances, metrics, permissions or payment states. Mocks must be labelled MOCK.
5. Do not edit a file another agent owns. Shared single-line files (`web/index.html` script list, `ds-lazy.js`): keep edits minimal and rebase before PR.
6. Run and report only tests that really ran: `npm test`, `node --check`, relevant tests under `tools/web-seller-tests/`, 360/412 px and desktop checks, accessibility (contrast, labels, 44px targets). Give 360 px screenshots for UI.
7. Open a PR `your branch -> web-portal` (template in `.github/pull_request_template.md` once merged) and give Claude 10 a TASK HANDOFF: Task ID, agent, branch, summary, files, commit SHA, tests and results, screenshots, limitations, backend dependencies, ready for review YES/NO.
8. Claude 10 reviews the actual diff, requests corrections, and is the only one who merges.

**File ownership:** `admin.js` and `ds-admin.js` routing/nav = Claude 4. `workspace.js`, `ds-seller.js`, `ds-editor.js` = Claude 1. `shared/supa.js`, `shared/config.js`, `ds-app.js`, `appshell.js`, `android/`, native auth = Claude 2. Root `js/` shopper app = Claude 3. Everyone else adds new files.

## Assignments
| Agent | Task | Branch | Status |
|---|---|---|---|
| Claude 1 | WEB-S23 (P0) seller photo upload failure | `claude/agent-1/s23-photo-upload-fix` | NOT STARTED |
| Claude 2 | X2-01/02 finish PR #44, then X2-03/04 route base + Android Back | `claude-2/seller-bundle-assembly`, then `claude/agent-2/route-base-and-back` | IN PROGRESS (#44 draft) |
| Claude 3 | SHOP-01 Paystack return/recovery port from PR #42 | `claude/agent-3/checkout-payment-return` | NOT STARTED |
| Claude 4 | WEB-AD08 admin seam + orders monitor | `claude/agent-4/admin-orders-monitor` | NOT STARTED |
| Claude 5 | WEB-AD09 hub board on existing RPCs | `claude/agent-5/hub-board` | NOT STARTED |
| Claude 6 | WEB-S08 read-only seller earnings | `claude/agent-6/seller-earnings` | NOT STARTED |
| Claude 7 | WEB-AD11 disputes queue | `claude/agent-7/admin-disputes` | NOT STARTED |
| Claude 8 | WEB-M10 app handoff page + M07 SEO | `claude/agent-8/app-handoff-seo` | NOT STARTED |
| Claude 9 | QA-01 360 px smoke + axe + bundle budget in CI | `claude/agent-9/smoke-a11y-budget` | NOT STARTED |

### Claude 1: WEB-S23 (P0)
Seller product photo upload fails with "Failed to fetch" before the product is saved. Capture the real failing request (Network + Console on the staging preview) and document the cause. Files: `workspace.js` (`uploadAll`), `ds-editor.js`, `shared/supa.js` (coordinate with Claude 2).
Accept when: 1-8 photos upload on a throttled connection at 360 px; failures show a specific retryable error and keep form state; regression test added under `tools/web-seller-tests/`. If the cause is Storage policy (`stores/<store_id>/...`), send the evidence as a BACKEND REQUEST; do not change policy. Next in queue: WEB-S11 store settings for approved stores.

### Claude 2: X2-01/02 then X2-03/04
1. Finish PR #44 on its existing branch: CI green, rebase on current `web-portal` (its base `16f7746` is behind), take out of draft.
2. Then `claude/agent-2/route-base-and-back`: runtime route base (`EV_BASE`), nested-route reload, history and Android Back. Needs Claude 1's confirmation before touching `core.js`.
3. Report what PRs #36, #40 and #43 contain that APP-13 on `web-portal` (commits `5bce919`..`6e3afaa`) does not. Nothing is closed without owner confirmation.
Accept when: a staging bundle contains no production project ref (CI assertion). Hot 70 evidence comes from the owner.

### Claude 3: SHOP-01
Port only the Paystack checkout-recovery and return handling from PR #42 onto `web-portal` (leave its Google sign-in changes; that is Claude 2's lane). Files: root `js/payments.js`, `js/app.js`, `js/shop.js`.
Accept when: interrupted payments and app resume end in a correct pending/paid/failed state read from the server; no double-submit; no fabricated success; checkout states render at 360 px. Backend recovery (migrations 029-031) already exists.

### Claude 4: WEB-AD08
Part 1 (lands first): a small section-registration seam in `admin.js` / `ds-admin.js` so Claudes 5, 6, 7 add admin pages in their own files. Part 2: orders monitor using existing `orders`, `admin_confirm_payment`, `cancel_order`, with honest loading/empty/error states, confirmation on destructive actions, and actions hidden where no backend workflow exists. Also fix the stale waitlist hint (WEB-F12). The "Live stores" KPI is already correct in code; do not redo it.

### Claude 5: WEB-AD09
A real hub board (receive, consolidate, dispatch) using existing `hub_receive`, `hub_consolidate`, `dispatch`, `deliveries`. Do not invent a dispatch event. Keep `ds-dispatch.js` clearly labelled MOCK. Send a precise BACKEND REQUEST for dispatcher assignment, courier acceptance and custody events (FIN-02). Build in your own page file until Claude 4's seam lands.

### Claude 6: WEB-S08
Read-only seller earnings and ledger view with CSV export from existing `store_balance` and `ledger_entries`. Label as legacy ledger. No withdraw/payout actions, no invented balances. First confirm on staging that RLS allows these reads; if not, BACKEND REQUEST. New file loaded through `ds-lazy.js`, not `ds-seller.js`.

### Claude 7: WEB-AD11
Disputes queue and detail on existing data (the admin overview already counts open disputes). First audit which dispute RPCs exist; hide actions until a backend contract exists and send BACKEND REQUESTs for gaps. Depends on Claude 4's seam; use your own page file meanwhile.

### Claude 8: WEB-M10 + M07
Web-to-app handoff page showing only verified, published download destinations from config (no web cart or checkout). SEO: per-page titles, sitemap, robots. Replace hot-linked showcase images on the auth screens (`auth-showcase.js`) with Everneed's own assets.

### Claude 9: QA-01
Automated 360 px smoke run for public routes and the seller shell with stubbed Supabase, an axe accessibility check, and a bundle-size budget (eager JS+CSS currently about 51.9 KB gzipped). Wire into the existing "Install and test" job. Do not add path filters. Later: staging E2E (Q02) once test accounts exist.

## Backend requests for ChatGPT/Codex (Claude 10 relays)
1. `my_access()` (R23) on staging so Claude 2's access adapter has something to call.
2. 10 staging order fixtures (5 unpaid, 5 simulated-paid) via authenticated paths only.
3. Dispatcher/courier domain contract (FIN-02).
4. PR #38 (seller accept-deadline guard): rebase on current `web-portal`, green CI, then staging apply.
5. Storage/Auth logs for S23 if Claude 1 points at policy.
6. Variant-aware checkout (PR #32) before variants can be sold.
7. Review of Claude 2's CI assertion design (R-C2-03).

## Owner actions outstanding
- Create staging test accounts: customer, seller, admin (WEB-F11 / FIN-07).
- Enable branch protection on `web-portal`: require PR, 1 approval, only "Install and test" and "Database tests" required (the other two checks are path-filtered), block force-push/deletion.
- Start one builder session per assignment above.

## Known PR sprawl (triage by Claude 10, nothing closed without owner OK)
#36, #40, #43 (native Google sign-in; APP-13 already on `web-portal`), #41 (superseded by #44), #42 (mixed; Claude 3 ports the payment part), #32 (variant checkout, backend-blocked), #38 (backend).
