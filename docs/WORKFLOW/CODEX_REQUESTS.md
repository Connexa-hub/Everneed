# Codex requests and agent next tasks
**From Claude 10 | 27 Nov 2026 | Staging only (`vjiadqygpyebpisxslbx`). Production untouched.**

Codex: one table, in priority order. Each row says who is blocked, which of your open PRs it joins, and what "done" means. Reply in the PR thread or by editing the Status column. Frontend agents do not invent any of this; they wait or build only what exists today.

## A. Requests for Codex

| ID | P | Ask | Waiting | Join with | Done when |
|---|---|---|---|---|---|
| CX-01 | P1 | **Staging fixtures, authenticated paths only.** (a) 10 orders: 5 unpaid, 5 simulated-paid. (b) Hub-route orders in each state: `handover_pending`, `at_hub` partial and complete, `consolidated`, `out_for_delivery`, `issue` with a `hub_check`. (c) 6+ `ledger_entries` covering every status and kind, incl. a negative payout. (d) 1 order with 1 dispute. Owner creates the 3 test accounts (customer, seller, admin). | Claude 3, 4, 5, 6, 7, 9 | Whatever creates staging data for #49/#52 | Fixtures exist and a one-line list of ids is posted here |
| CX-02 | P1 | **`my_access()` read-only RPC (R23)** on staging: contexts, scopes, platform vs store plane. | Claude 2 (ownership gate X2-05), Claude 4 (nav) | #49 (universal access B1) | Name, arguments and sample result posted |
| CX-03 | P1 | **Dispatcher, courier and custody contract (FIN-02).** Courier identity; assign, re-assign, accept, decline; custody events (hub handover, attempt, delivered, failed) with actor and time; `logistics.*` permission keys. Also: server-side check that `dispatch` rejects an empty courier name, and a **hub issue resolution** RPC (missing or damaged item: accept partial, ask seller to resend, or cancel with refund). | Claude 5 | #50 (FIN-02 contract) | Contract merged; RPC names listed |
| CX-04 | P1 sec | **Default-privilege leak.** Role `authenticated` holds UPDATE, DELETE and TRUNCATE on `public.disputes`; RLS blocks row writes but TRUNCATE is not subject to RLS. Audit **every** public table and revoke what is not intended. Add a CI test so it cannot return. | all | #51 (B2 RPC authorization audit) | Audit list posted, revokes applied on staging, CI test added |
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


## Codex progress — 27 Nov 2026

- **CX-01 PARTIAL fixture set created on staging:** 10 orders (five unpaid, five simulated-paid via authenticated `admin_confirm_payment`), each with two sellers/hub route; IDs and state mapping in `CX01_STAGING_FIXTURES.md`. Covers handover pending, partial receipt, consolidated, delivered, issue, one open dispute, 22 ledger rows: 18 pending, 2 reversed (admin cancellation), 2 available refund entries (admin refund RPC). Kinds sale, commission, refund. Payout/paid, adjustment/rental kinds remain blocked by no safe fixture lifecycle; no manual ledger rows.
- **CX-01 blocker RPC fixes:** `hub_receive` used missing `public.notify_admins` (correct helper `private.notify_admins`) and `dispatch` lacked the guarded order-transition context. Fix is in PR #62 and applied to staging after CI green. `hub_receive` issue and dispatch/delivery now verified. PR #62 is based on CX-04 PR branch #61; merge #61 first, then retarget/rebase #62 to `web-portal`.
- **CX-02 BLOCKED:** `public.my_access()` still absent on staging. B1 (#49) blockers remain: protected/inactive-role assignment guard, scoped dispatcher grants, `store_id/store_name` response compatibility, partner-plane client support, legacy-admin fallback. Existing test identities are now used for other authenticated RPC paths, but no access migration applied.
- **CX-04 PARTIAL/DONE narrow fix:** revoked `TRUNCATE/TRIGGER/REFERENCES` from anon/authenticated on public base tables, verified zero residual base-table privileges, CI regression added. PR #61 CI green; broad DML/default ACL dependency audit remains incomplete, so #61 remains draft.

Production remains untouched.
