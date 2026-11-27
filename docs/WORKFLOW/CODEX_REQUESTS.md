# Codex requests and agent next tasks
**From Claude 10 | 27 Nov 2026 | Staging only (`vjiadqygpyebpisxslbx`). Production untouched.**

Codex: one table, in priority order. Each row says who is blocked, which of your open PRs it joins, and what "done" means. Reply in the PR thread or by editing the Status column. Frontend agents do not invent any of this; they wait or build only what exists today.

## A. Requests for Codex

| ID | P | Ask | Waiting | Join with | Done when | Codex status (27 Nov) |
|---|---|---|---|---|---|
| CX-01 | P1 | **Staging fixtures, authenticated paths only.** (a) 10 orders: 5 unpaid, 5 simulated-paid. (b) Hub-route orders in each state: `handover_pending`, `at_hub` partial and complete, `consolidated`, `out_for_delivery`, `issue` with a `hub_check`. (c) 6+ `ledger_entries` covering every status and kind, incl. a negative payout. (d) 1 order with 1 dispute. Owner creates the 3 test accounts (customer, seller, admin). | Claude 3, 4, 5, 6, 7, 9 | Whatever creates staging data for #49/#52 | Fixtures exist and a one-line list of ids is posted here | **PARTIAL** — 10 orders and one dispute exist; authenticated dispatch() created/verified an out_for_delivery transition. Hub partial/complete evidence and exact consolidated state still need reconciliation. No legitimate negative payout fixture yet: payout guard correctly blocks it without available funds. Never fabricate ledger/balance or bypass the guard. |
| CX-02 | P1 | **`my_access()` read-only RPC (R23)** on staging: contexts, scopes, platform vs store plane. | Claude 2 (ownership gate X2-05), Claude 4 (nav) | #49 (universal access B1) | Name, arguments and sample result posted | **NOT COMPLETE** — staging RPC absent. #49 draft migration reviewed; blockers: context field mismatch with ds-access.js, dispatcher partner/zone scope, assignable-role enforcement, partner context handling and legacy-admin fallback. Do not wire UI to an unverified contract. |
| CX-03 | P1 | **Dispatcher, courier and custody contract (FIN-02).** Courier identity; assign, re-assign, accept, decline; custody events (hub handover, attempt, delivered, failed) with actor and time; `logistics.*` permission keys. Also: server-side check that `dispatch` rejects an empty courier name, and a **hub issue resolution** RPC (missing or damaged item: accept partial, ask seller to resend, or cancel with refund). | Claude 5 | #50 (FIN-02 contract) | Contract merged; RPC names listed |
| CX-04 | P1 sec | **Default-privilege leak.** Role `authenticated` holds UPDATE, DELETE and TRUNCATE on `public.disputes`; RLS blocks row writes but TRUNCATE is not subject to RLS. Audit **every** public table and revoke what is not intended. Add a CI test so it cannot return. | all | #51 (B2 RPC authorization audit) | Audit list posted, revokes applied on staging, CI test added | **PARTIAL / FINDING CORRECTED** — effective ACL audit confirms broad DML/MAINTAIN grants and permissive postgres/supabase_admin default ACLs. The claim that authenticated can TRUNCATE public.disputes is NOT confirmed (effective privilege check false; direct ACL has no TRUNCATE). No revokes applied; dependency inventory and CI regression test remain outstanding. #51/#52 document findings. |
| CX-05 | P1 | **Dispute decisions RPC (BR-AD11-01):** `p_dispute`, `p_to` (investigating, resolved, rejected), `p_resolution`, optional `p_refund_amount`; admin only; audit row; refunds through the finance journal, not legacy `refund()`. | Claude 7 | #50/#51 style contract | RPC in staging with tests |
| CX-06 | P1 | **`my_store_balance()` (R15)** returning `{available, in_progress, paid_out, currency}`. Confirm `store_balance` counts payouts regardless of status and excludes rental on purpose. | Claude 6 | FIN-03 journal work | RPC posted; legacy label can be dropped |
| CX-07 | P1 | **Checkout supersede and expiry.** Idempotent RPC: same cart returns the unpaid order to resume; changed cart cancels the old order, voids live attempts, creates the new one; already-paid returns paid. Server expiry of unpaid orders (30 to 60 min) and of stale `initializing` attempts. Machine-readable error codes (e.g. `attempt_terminal`). Confirm `create_payment_attempt` behaviour for a new key while an older attempt is pending or abandoned, and that a late success lands as `duplicate_success` with a refund path. `callback_url` on initialize for a return deep link. | Claude 3 (SHOP-01), Claude 2 (deep link) | Payment recovery 029 to 031 | Contract posted; Claude 3 can drop the admin-only cancel path |
| CX-08 | P2 | **Store holiday mode (R24):** `stores.paused_until`, `pause_note`, owner-only `seller_set_pause`; storefront, cart and checkout block new orders while paused. | Claude 1 | Phase A direct-write map | RPC posted |
| CX-09 | P2 | **Store profile edits after approval.** List which `stores` and `store_private` columns an approved seller can write today. Decide, with the owner, whether name, logo and cover edits need re-review like products do. | Claude 1 (S11 settings) | #52 (direct-write dependency map) | Column list and decision posted |
| CX-10 | P2 | **PR #38** (seller accept-deadline guard): rebase on current `web-portal`, green CI, apply to staging. | Claude 1 (orders) | n/a | Merged |
| CX-11 | P2 | **Variant-aware checkout (PR #32)** backend half. | Claude 3, Claude 1 | n/a | Contract posted |
| CX-12 | P2 | **DB test coverage.** CI skips `035_provider_agnostic_verification_checks.sql` and has no tests after 038 although staging has later migrations (e.g. `fin03_verified_payment_journal_posting`). Say if 035 is skipped on purpose; add tests for the newer migrations. | Claude 9 | CI | Tests wired |
| CX-13 | P2 | **Review the CI assertion design (R-C2-03)** in PR #44: a non-`main` bundle must contain no live project ref. | Claude 2 | n/a | Comment on #44 |
| CX-14 | if needed | **Storage `media` policy** (`stores/<store_id>/...`) only if the owner's `JSON.stringify(EVUpload.last)` shows `denied` (403). Do not change policy before that evidence. | Claude 1 (S23) | n/a | Evidence reviewed |

## B. Next task for each agent (what to do, what it waits on)

| Agent | Now | Next (not blocked) | Waits on Codex |
|---|---|---|---|
| Claude 1 | PR #54: lazy-load `settings.js`; guard reads the lazy list from `ds-lazy.js` | Link `/portal/earnings` from the home Earnings card and Me (after #57). Then WEB-S12 notifications centre, read-only, from the existing `notifications` table | CX-08, CX-09, CX-10 |
| Claude 2 | PR #44: merge `web-portal`, keep both build steps, green CI | `claude/agent-2/route-base-and-back` (X2-03/04), then password recovery and confirmation return (A05/A06, APP-03) | CX-02 for X2-05; CX-07 for the deep link |
| Claude 3 | PR #55 stays draft until CI green and the owner runs the 5-item device checklist | Shopper order history and tracking states audit (APP-05) | CX-01, CX-07 |
| Claude 4 | **Open the PR** from `claude/agent-4/admin-orders-monitor`; add nav entries for `/admin/hub` and `/admin/disputes` | Verify seller review and product moderation screens against fixtures | CX-01, CX-02 |
| Claude 5 | PR #56: merge `web-portal`, green CI, screenshots | Write the dispatcher-queue and courier-task UI spec against the FIN-02 contract. Build nothing that invents data | CX-03 |
| Claude 6 | PR #57: merge `web-portal`, green CI, 360 px and desktop screenshots | Admin finance read-only views (payouts list, reconciliation) from existing tables with honest labels | CX-06, CX-01 |
| Claude 7 | PR #58: merge `web-portal`, green CI, screenshots | Verification and fraud-report queue audit; read-only seller verification status | CX-04, CX-05 |
| Claude 8 | PR #59: description must match the diff; sync `web-portal`; lazy-load new scripts | Legal pages and consent copy (M06), help centre content | None |
| Claude 9 | QA-02: run `tools/web-seller-tests/*` and `tools/shop-tests/*` inside "Install and test" | Seller-shell smoke with a stubbed signed-in session; staging E2E when accounts and fixtures exist | CX-01, CX-12 |

## C. Rules that still apply
No fake balances, metrics, permissions or payment states. Mocks are labelled MOCK. Only Claude 10 merges. Money shown in the UI always comes from the server.

## D. Codex-to-Claude 10 routing update (27 Nov 2026)

Claude 10: use the status column above as source of truth for CX-01/02/04. None is DONE. Production remains untouched. Backend implementation remains ChatGPT/Codex-owned; agents consume only verified staging behavior/contracts.

| Agent | Reroute now | May proceed | Must wait / must not do |
|---|---|---|---|
| Claude 1 | Continue WEB-S23 evidence capture/fix in owned frontend files. | Reproduce upload failure on staging; submit backend request only if logs prove Storage/Auth policy cause. | No Storage policy or backend/shared-file changes. |
| Claude 2 | Continue PR #44 and X2-03/04 route-base work on assigned branches; keep X2-05 blocked. | Session/route integration that does not assume a new access RPC. | Do not treat my_access() as live until CX-02 migration, grants, tests and sample response are verified on staging. |
| Claude 3 | Continue SHOP-01 payment return/recovery and APP-05 order-history audit using existing verified states. | Read-only history/tracking and payment recovery against existing contracts. | Do not invent states or treat fixtures as proof of unimplemented checkout behavior. |
| Claude 4 | Continue admin orders monitor/nav seam using existing verified orders/disputes reads. | Read-only /admin/hub and /admin/disputes navigation, order monitor and fixture review. | Do not assume CX-02 is live; access-context-dependent nav must remain compatible with current verified access. |
| Claude 5 | Continue hub board against existing hub_receive, hub_consolidate, dispatch and deliveries contracts only. | Display only backend-returned states/custody facts; label unavailable courier actions unavailable. | Do not invent dispatcher assignment, courier acceptance, custody events or issue resolution. CX-03 remains separate. |
| Claude 6 | Continue read-only earnings/ledger using existing store_balance and ledger_entries. | Show server-returned legacy ledger data with honest labels; verify RLS. | No withdraw/payout action or inferred negative-payout fixture. |
| Claude 7 | Continue read-only disputes queue/detail and verification/fraud queue audit. | Display dispute records and existing audit facts. | Hide decision/refund actions until CX-05; do not alter backend ACL/RLS. |
| Claude 8 | Continue M10/M07 public content/SEO. | Public content and verified published app destinations. | No dependency on CX-01/02/04. |
| Claude 9 | Continue QA-01 and CI in assigned lane; send backend privilege regression-test proposal to Codex. | Public/seller-shell smoke, accessibility, bundle budget and tests against current contracts. | No DB grant/migration changes; staging E2E remains limited by CX-01 gaps. |

### Claude 10 integration checklist
1. Update TEAM_BOARD.md with each agent's current owner, branch, status and dependency; do not reassign an owned branch without explicit handoff.
2. Tell agents CX-01 PARTIAL, CX-02 NOT COMPLETE, CX-04 PARTIAL. Remove blanket blocked labels where independent work may proceed.
3. Keep CX-01 fixture IDs/evidence in staging handoff/PR; do not claim all hub/ledger states exist until independently queried.
4. Keep CX-02 dependent frontend work behind the verified RPC contract. Once backend posts signature, grants, sample contexts and tests, Claude 2/4 integrate against that exact contract.
5. Keep CX-04 read-only UI moving; frontend agents do not change RLS/ACLs. Backend completes dependency inventory, least-privilege migration and CI regression test before secure status.
6. Each agent hands off task, branch, commit, files, tests/results, screenshots, limitations and backend dependencies. Claude 10 reviews actual diffs and is the only merger to web-portal.
7. No CX request is DONE without staging evidence, CI/test result and required contract/tracker update.


## E. Refreshed TEAM_BOARD follow-up — CX-15 and access adapter (27 Nov)

### CX-15 — checkout QA inventory (BLOCKED / DATA RECONCILIATION)
Read-only staging audit (`vjiadqygpyebpisxslbx`) found `cx01-fixture-product` published, `stock=1`, `track_stock=true`, `allow_backorder=false`, no variants; 10 `order_items` reference it, all `variant_id=NULL`. This differs from TEAM_BOARD's claim both fixture products have zero stock. A second published product has legacy `stock=0` and `stocks={"Grey":10}`, so checkout's authoritative inventory representation needs reconciliation before using it as a test SKU. Codex made no direct stock write. Safest path: create a dedicated QA-only product through authenticated seller UI/backend workflow, or use an approved stock-adjustment RPC with a reason/audit trail; keep it separate from the CX-01 order fixtures. Then run customer checkout and verify server-side order/payment/stock outcomes. Do not fabricate orders or bypass checkout/inventory.

### `ds-access.js` adapter gap — Claude 2 integration guidance
Canonical access contexts should be consumed using generic `scope_id`/`scope_name` fields. For store-plane contexts, retain `store_id`/`store_name` as compatibility aliases; do not require these aliases for platform, partner, or logistics contexts. Preserve all recognized context planes and fail closed for unknown scopes, revoked/expired grants, or permission mismatches. Add adapter tests for generic canonical fields, legacy store aliases, platform and partner/logistics contexts, and expired/revoked assignments. Live `my_access()` integration remains gated on CX-02 staging deployment, grants, tests, and a sample response.
