# Everneed public roadmap

**Audience:** founders, contributors, sellers, partners, reviewers and AI coding agents  
**Status date:** 2026-11-19  
**Canonical product:** Nigeria-first multivendor digital commerce platform  
**Current integration branch:** `feature/variant-checkout` (draft PR #32 against `web-portal`)  
**Development/staging Supabase:** `vjiadqygpyebpisxslbx`  
**Production Supabase:** `zpgasfweaixwsktlueje` — protected; no changes authorised by this roadmap.

This is the public, concise milestone register. It separates verified work from work in progress and planned work. A file, screen, migration or passing unit test is not proof that a complete customer-facing workflow is operational. Status changes require evidence linked in the repository or a recorded test/deployment result.

## How to read and update this roadmap

- **DONE** means the stated scope has evidence and its acceptance criteria are met.
- **IN PROGRESS** means implementation or validation is underway; do not advertise it as complete.
- **BLOCKED** means a dependency or failing check prevents safe progression.
- **PLANNED** means approved direction, not implemented work.
- **PROPOSED** means an idea requiring product/owner approval.
- Dates are omitted unless a committed delivery date is approved. Milestones are ordered by dependency, not promised calendar dates.
- Update this file, the detailed [master strategy roadmap](docs/STRATEGY/MASTER_ROADMAP.md), the [project tracker](docs/WORKFLOW/WEBSITE_TRACKER.md), and relevant technical contract in the same change when status materially changes.
- Never add secrets, personal identity data, payment credentials, private seller data or internal production access details here.

## Product mission and operating model

Everneed begins as a shared marketplace where independent sellers manage their own stores and products while shoppers discover and purchase through Everneed. The platform owns the shared customer experience, marketplace rules, payment/order orchestration and admin controls. Multi-seller orders are intended to be split into seller-specific fulfilment units while preserving a coherent customer order. Delivery and seller settlement promises must match the implemented and tested operating model.

**Priority rule:** trustworthy marketplace transactions first; expansion into advertising, advanced logistics, analytics and additional countries only after core workflows are stable and demand is validated.

## Milestone register

| ID | Milestone | Status | Exit evidence / acceptance criteria | Main dependencies |
|---|---|---|---|---|
| EV-00 | Company, governance and project controls | IN PROGRESS | Accurate company/legal status, decision log, branch/environment rules, public roadmap and product status maintained | Founder decisions; legal advice where needed |
| EV-01 | Customer marketplace and web portal | IN PROGRESS | Customer discovery, account, product detail, cart, checkout, order tracking; seller onboarding/store/product/order tools; admin review and audit flows pass end-to-end | Auth, catalogue, backend policies |
| EV-02 | Rich seller product catalogue and seller plans | IN PROGRESS | Complete structured product editor, category-specific attributes, variants, media, pricing, stock, product status and plan entitlements; seller cannot exceed plan or access another store | Catalogue schema, storage, plan enforcement, mobile QA |
| EV-03 | Payment and order integrity | IN PROGRESS | Server-side price/variant validation; successful, failed, pending and duplicate webhook paths; immutable payment/order snapshots; reconciliation and refund paths proven in sandbox; no false paid orders | Checkout migrations, security CI, staging rollout, Paystack sandbox |
| EV-04 | Seller identity and store verification | PLANNED | Prembly sandbox integration for supported checks; secure evidence handling; status transitions, idempotency, audit trail and manual review; non-CAC sellers have a documented alternative path where legally appropriate | EV-03 payment baseline; Prembly endpoint/payload validation; sandbox wallet/API access |
| EV-05 | Security, reliability and recovery | IN PROGRESS | RLS/RPC boundary tests, role isolation, secret hygiene, webhook signature verification, backup/restore exercise, monitoring and incident process | EV-01 to EV-04 |
| EV-06 | Seller operations, settlement and admin control plane | IN PROGRESS | Seller order queues and transitions; auditable commission/ledger; prompt settlement eligibility rules; actual provider transfer/reconciliation; admin can manage Everneed's own official store with controlled privileges | Payment integrity, finance ledger and payout provider support |
| EV-07 | Controlled seller/customer validation | PLANNED | Invited cohort completes meaningful listings, paid orders, fulfilment and support; measurable feedback and operational evidence | EV-01 to EV-06 |
| EV-08 | Controlled beta launch | PLANNED | Limited market/category rollout with support coverage, customer/seller policies, monitoring and rollback/pause process | EV-07; launch readiness approval |
| EV-09 | Repeatable growth and monetisation | PLANNED | Seller activation/retention, customer repeat rate, GMV, net revenue, contribution margin and acquisition channels measured | Beta evidence |
| EV-10 | Funding and strategic partnerships | PLANNED | Evidence-backed investor materials, financial assumptions, use of funds and accurately represented partnership status | Product and market evidence |
| EV-11 | Ecosystem and geographic expansion | PROPOSED | Each new service/market has validated demand, operating owner, compliance, localisation and unit economics | Stable core marketplace |

## Active engineering checkpoint — 19 November 2026

### Payment and variant checkout (EV-03)

**Current verified state**
- Draft PR [#32](https://github.com/Connexa-hub/Everneed/pull/32) remains open and unmerged on `feature/variant-checkout`, based on `web-portal`.
- Full web/install and database CI jobs passed on head `4d65c8191b8f5b74c804a9e6bc9bf83361f2d140`, including variant checkout contract test 039, Phase 2 checks, public/authenticated RPC security, buyer/seller/admin RLS isolation, payment attempt/recovery, finance journal, seller entitlement/quota and catalogue regressions.
- Six previously missing checkout/security migrations were applied successfully to Everneed staging project `vjiadqygpyebpisxslbx`. The ledger now records all six; the order-item variant snapshot columns are present.
- Staging ACL verification confirms anonymous access remains enabled for the seller-safe `seller_plan_catalog()`, while anonymous access is denied for `seller_product_category_schema(text)` and internal `private.products_guard()`. Authenticated sellers retain the category-schema RPC.
- Reviewed Paystack Edge Function source from this branch is deployed to staging as version 13. It retains `verify_jwt=false` because it validates signed Paystack webhooks itself and authenticates user requests in the function.
- Production project `zpgasfweaixwsktlueje` was not changed. No PR merge or live payment was performed.

**Still not proven / do not claim**
- No complete Paystack sandbox transaction has yet been confirmed end to end.
- Webhook replay, decline, pending, wrong amount/currency, invalid/inactive variant, concurrent stock reservation and cancellation/restoration still need controlled sandbox or transaction-wrapped tests.
- Android APK build succeeded in CI run 44540581382 (build 1219); artifact `everneed-apk` is available from the run's Artifacts section.
- Keep variant purchasing disabled for customers until staging acceptance tests pass.

**Next acceptance sequence**
1. Run controlled Paystack sandbox checkout tests, including success, decline/failure, pending and duplicate webhook delivery.
2. Test wrong amount/currency, invalid/inactive variant, stock race and cancellation/restoration without using live funds.
3. Reconcile payment attempts, immutable checkout snapshots, seller orders, inventory movements, refunds and finance journal.
4. Confirm the Android APK workflow completes and publish its artifact link for device testing.
5. Record evidence in the tracker and keep PR #32 draft until owner-approved review.

### Prembly verification (EV-04)

**Current state**
- Prembly MCP connection is confirmed in Sandbox environment.
- Sandbox endpoint discovery now lists BVN, NIN, phone, CAC, TIN and other checks. Read-only catalogue calls succeeded; Nigeria BGC fallback categories include Identity, Education, Employment and Criminal checks. Exact per-endpoint request schemas and commercial applicability still need verification.
- The sandbox wallet was previously reported as ₦0.00. No verification transaction has been made and no Prembly integration is wired into Everneed.
- Do not invent endpoint IDs, payload fields, prices or response mappings.

**Next acceptance sequence**
1. Inspect the provider's currently available endpoint-discovery documentation and obtain exact sandbox operation IDs, payload schemas, response fields, pricing and wallet requirements.
2. Inspect Everneed's provider-neutral verification schema, RPCs, Edge Functions and secret names without exposing secret values.
3. Implement provider calls server-side only, with idempotency, rate limiting, safe redaction, audit events and controlled status transitions.
4. Support manual review and an appropriate non-CAC seller path; BVN/NIN must not be represented as proof of CAC incorporation.
5. Test approved, rejected, pending, provider-error, duplicate and retry outcomes in sandbox.
6. Obtain explicit approval before funding a wallet or incurring any live verification spend.

## Cross-cutting product quality requirements

- Mobile-first: support 360–412 px screens, low-mid Android hardware, older WebViews, low bandwidth and bright outdoor conditions.
- Use strong contrast, lightweight assets and clear loading, empty, error and retry states.
- Touch targets should be at least 44 px where practical.
- Keep seller identity visible on product listings and product detail pages.
- Preserve existing detailed product fields; do not simplify the product editor into a name/price-only form.
- Enforce permissions and plan entitlements on the server, not only by hiding UI controls.
- Treat admin capabilities as privileged, auditable operations.
- Keep secrets server-side and never commit credentials.

## Rules for AI agents and contributors

This section is deliberately explicit so other AI systems can safely continue the project.

1. Read this file, [AI protocol](docs/WORKFLOW/AI_PROTOCOL.md), [environment guide](docs/WORKFLOW/ENVIRONMENTS.md), [database contract](docs/WORKFLOW/DB_CONTRACT.md) and [project tracker](docs/WORKFLOW/WEBSITE_TRACKER.md) before editing.
2. Verify the current branch, commit SHA, PR state, CI status, staging migration ledger and deployed Edge Function version before making assumptions.
3. Treat repository code, migration files, tests and documentation as separate evidence types. Do not infer a deployed feature from code presence.
4. Make additive, reviewed database changes. Keep migration filenames, replay manifest and staging migration history aligned.
5. Use staging for integration tests. Do not reset, seed test fixtures into, deploy functions to or apply development migrations to production.
6. Never merge PRs, deploy production, enable live payments, send real transfers or spend on live identity checks without explicit owner approval.
7. Never print, copy into docs, or request credentials in chat. Inspect secret names/configuration only; keep values in the secret manager.
8. Report exact test names and results. Distinguish passed, failed, skipped, pending and not run.
9. Do not bypass failing security tests by weakening assertions or broadening anonymous grants. Diagnose the exact function and least-privilege fix.
10. When a task is blocked, state the blocker and the smallest safe next action. Do not claim success without tool-confirmed evidence.

## Source-of-truth documents

- [Detailed business strategy and stage roadmap](docs/STRATEGY/MASTER_ROADMAP.md)
- [Project tracker and current engineering status](docs/WORKFLOW/WEBSITE_TRACKER.md)
- [AI collaboration and repository protocol](docs/WORKFLOW/AI_PROTOCOL.md)
- [Environment separation and release controls](docs/WORKFLOW/ENVIRONMENTS.md)
- [Database schema/security contract](docs/WORKFLOW/DB_CONTRACT.md)
- [Variant checkout backend contract](docs/WORKFLOW/VARIANT_CHECKOUT_BACKEND_PHASE.md)
- [Seller product catalogue backend handoff](docs/WORKFLOW/SELLER_PRODUCT_CATALOG_BACKEND_HANDOFF.md)

---

**Roadmap integrity statement:** this document describes the intended sequence and the evidence currently available as of its status date. It is not a launch announcement, service guarantee, funding claim or certification of security/compliance.

- The exact variant checkout regression file 039 was also executed against Everneed staging after migration rollout; it completed successfully and its transaction rolled back all test fixtures. This validates the variant pricing, invalid/inactive selection rejection, stock reservation, backorder handling, one-time cancellation restoration and immutable checkout snapshot against the staging schema.


## Financial operating system workstream — 19 November 2026

- Added [Marketplace Money Flow & Payments Architecture](docs/FINANCE/MARKETPLACE_MONEY_FLOW.md), covering buyer checkout/payment methods, seller settlement wallet, buyer credits, withdrawal lifecycle, coupons/promotions/cashback, direct/hub shipping, refunds, risk, reconciliation and international currency controls.
- Staging audit confirms legacy orders/seller_orders/ledger_entries/payouts/refunds/offers/cards/payment-attempt infrastructure exists, but no buyer/store wallet account tables or complete double-entry journal are present. Do not describe wallets as live.
- Finance implementation is planned as FIN-00 through FIN-11. Priority is journal and payment integrity, then seller allocations/withdrawals, credits, promotions, shipping and reconciliation.
- Cash wallet top-up, P2P transfer and buyer cash-out are gated on Nigerian legal review and a licensed partner; launch with non-transferable promotional/refund credits only if the structure is approved.

- FIN-00 staging function audit is now recorded in the finance architecture: current payout RPC only records a manually completed payout, refund RPC marks refunds processed without executing the provider refund, payment confirmation posts legacy single-entry sale/commission rows, and coupon redemption only increments a global usage counter. These must be replaced/wrapped before calling payouts, refunds or promotions end-to-end complete.




## 19 November 2026 — finance audit completion and CI checkpoint

- Current draft PR #32 head: `2e0b9554f9b27352d2b16f8ff597786b37d8815c`, base `web-portal`. The PR remains open and draft; it has not been merged.
- GitHub Actions at this head: **Migration files — success** (run 44543116567); **Build Android app — success** (run 44543116525, build 1231). These results do not constitute Paystack end-to-end acceptance.
- FIN-00 function-level audit is complete and recorded in `docs/FINANCE/MARKETPLACE_MONEY_FLOW.md` sections 22–24. It includes cancellation/refund side effects, delivery confirmation, seller release semantics, payment recovery, trigger effects and execute ACLs.
- Key distinction: the legacy `seller_orders.released` flag is set at payment confirmation, but it is not a payout or proof of seller funds being withdrawable. Delivery confirmation also does not trigger a seller bank transfer. An approved refund is not proof that the provider returned funds.
- FIN-01 double-entry journal contract is documented in section 25. It remains a design contract; no journal/wallet migration has been applied as part of this step. The next implementation must add database-enforced per-currency balancing, immutable posted entries, idempotency and least-privilege posting, with regression tests before staging rollout.
- Staging only; production remains untouched. Do not merge, deploy production, initiate live payments/transfers or fund verification without explicit owner approval.




## FIN-01 discovery correction — 19 Nov 2026

The existing branch already contains `supabase/migrations/033_double_entry_finance_journal.sql` and `supabase/tests/033_double_entry_finance_journal_checks.sql`. Staging migration history confirms version 033 is applied. The three private journal tables exist, with 96 seeded account rows and zero posted journal headers/lines. Test 033 was executed against staging in a transaction and completed without an SQL error; its test postings were rolled back. Therefore FIN-01 is not an unstarted schema task: its foundation is implemented and staged, while hardening and integration with payment/refund/seller settlement remain outstanding. See finance architecture sections 25–26. The seeded currency accounts are not a declaration that all six currencies are enabled for payment or settlement.




## FIN-01 hardening update — 19 Nov 2026

Migration `034_finance_journal_input_hardening.sql` now bounds journal source identifiers, idempotency keys, descriptions, metadata size, line payload size, line object keys, references and BIGINT amount inputs. Dedicated regression test `034_finance_journal_input_hardening_checks.sql` and the CI workflow step have been added. This is committed to the draft feature branch; CI must pass before applying migration 034 to staging. The journal is still not connected to payment, refund, wallet or payout events.


## Finance checkpoint — 19 November 2026

- FIN-01 migration 034 (journal posting/reversal input hardening) is applied to Everneed staging only; migration history, function security settings and service-role-only execution were verified.
- Full CI on PR head 01ee1c0811f07f3243e88c767f176f25b8b4c917 passed, including database regressions 033/034 and Android APK build (workflow 44546455256).
- Test 034 executed against staging successfully with rollback-based fixtures. No business journal postings were created.
- FIN-02 is the next workstream: design and test verified payment-event accounting, provider clearing/fees, seller pending and available payable, delivery allocation, refunds, chargebacks and provider-confirmed payouts. Existing payment confirmation/refund/payout functions are not yet journal-integrated.
- PR #32 remains draft/open/unmerged. Production and live money movement remain untouched.
- See docs/FINANCE/MARKETPLACE_MONEY_FLOW.md sections 27–28 for evidence, event mapping and release gates.


## FIN-02A implementation gate — 19 November 2026

- Audit found checkout snapshot v1 does not freeze commission and seller-payable allocations in the order currency. Seller-order subtotal/commission/earning and order-item commission rows are currently based on base-price values, while buyer checkout totals may be FX-converted.
- Do not journal those base-currency seller amounts as foreign-currency values. This would misstate seller payable and platform revenue.
- Next step is schema-version-2 immutable checkout allocation snapshot with item and seller-level integer minor-unit totals, commission policy version, discount funding and deterministic rounding.
- Only after FIN-02A passes should FIN-02B map verified snapshot allocations to balanced journal lines and FIN-02C integrate posting atomically into payment settlement.
- Detailed evidence and acceptance cases: docs/FINANCE/MARKETPLACE_MONEY_FLOW.md section 29. No payment-settlement function has been changed and no new finance integration migration has been applied.


- FIN-02A must also persist promotion funding attribution (seller/store vs Everneed/platform vs split). Current offers and checkout snapshots do not record who funds discounts. Unattributed discounts must not be journaled or silently deducted from seller proceeds. See finance architecture section 30.


## 19 Nov 2026 — Everneed sustainable unit-economics policy
- Everneed is a profit-conscious marketplace and fulfilment business. GMV, seller proceeds, buyer funds and provider-clearing balances are not Everneed revenue or unrestricted operating cash.
- Approved potential revenue streams: versioned marketplace commission; optional seller subscriptions/advanced tools; delivery margin only on managed deliveries; disclosed hub receiving/consolidation/packaging/storage/special-handling fees; opt-in labelled seller advertising/boosts; and separately disclosed value-added services.
- Seller-funded discounts are the default for seller-created promotions, subject to seller acceptance. Platform-wide offers are not automatically Everneed-funded: require a named funder, explicit seller participation or a reserved management-approved marketing budget. Joint funding must store each party's exact allocation. Unallocated legacy offers cannot be journaled or silently assigned to either party.
- Calculate contribution after provider fees, delivery/hub direct costs, platform-funded discounts, refunds/chargebacks and other attributable costs. Negative contribution must be visible and subject to a versioned pricing/subsidy/fulfilment gate; no arbitrary commission rate or minimum margin is introduced without owner/finance approval.
- Admin reporting must separate GMV, platform revenue, seller liabilities, contribution, operating expenses, unrestricted cash and reserves for infrastructure, payroll, logistics, risk, marketing and retained earnings. Restricted seller/buyer funds must never finance company overhead.
- Full policy, calculations, campaign controls and FIN-02A consequences: docs/FINANCE/MARKETPLACE_MONEY_FLOW.md section 31. No production change, commission change, transfer or campaign activation is authorized by this documentation.
