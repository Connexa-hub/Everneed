# EVERNEED
## Master Business Strategy & Execution Roadmap

**Document type:** Company strategy and execution plan  
**Document status:** Working roadmap  
**Business status:** Founder-led startup; not yet registered with Nigeria's Corporate Affairs Commission (CAC)  
**Product starting point:** Everneed multivendor marketplace  
**Project reference branch:** `web-portal`  
**Initial market:** Nigeria  
**Planning horizon:** Foundation through initial market launch and early growth  
**Last updated:** November 2026

---

## 1. Purpose of This Roadmap

This document translates Everneed's company vision into an ordered, practical execution plan.

Everneed's long-term ambition is to become a digital commerce ecosystem. Its immediate job, however, is to establish a trustworthy and usable multivendor marketplace, validate that real sellers and customers need it, and prove that the business can operate sustainably.

This roadmap is intended to:

- Keep company, product and commercial priorities aligned.
- Prevent premature expansion into too many services.
- Separate verified progress from plans and assumptions.
- Give the founder and collaborators a shared sequence of work.
- Provide a basis for monthly reviews and future investor discussions.

It is a strategic plan, not a claim that the listed milestones have already been achieved.

## 2. Strategic Direction

### Company positioning

**Everneed — A Digital Commerce Ecosystem.**

### Strategic sequence

1. Establish the company foundation.
2. Make the initial marketplace operational and trustworthy.
3. Validate the marketplace with a controlled group of sellers and customers.
4. Establish repeatable seller acquisition and customer growth.
5. Develop sustainable revenue and operational capacity.
6. Expand into additional commerce services only when the marketplace justifies them.

### The core strategic rule

**Marketplace first. Ecosystem expansion second.**

Seller tools, advertising, logistics services and integrations are potential extensions. They must not distract from making the initial marketplace useful, safe and commercially viable.

## 3. Product and Business Scope

Everneed has two connected product surfaces in its current project direction.

| Product surface | Primary purpose | Initial priority |
|---|---|---|
| Everneed Marketplace | Customer product discovery, seller stores and shopping | Critical |
| Everneed Web Portal | Public information, seller onboarding and management, administration | Critical |

The web portal is the business operating interface around the marketplace. It should support the people and processes needed to run the marketplace, not become a disconnected product.

### Initial marketplace capabilities to validate

- Customer registration, sign-in and account management.
- Approved seller stores and published product discovery.
- Seller applications and onboarding.
- Seller product submission and review.
- Product availability, pricing and stock integrity.
- Cart and checkout across multiple sellers.
- Payment confirmation and order creation.
- Seller-specific order handling and customer order visibility.
- Notifications and support processes.
- Administrative review, moderation and auditability.
- Clear seller, customer and administrator permissions.

These are target capabilities and acceptance areas. Their presence in code, a screen or a database migration does not by itself prove that a complete workflow works.

### Operating model to validate

The intended marketplace model is that independent sellers operate their own stores while Everneed provides the shared platform and customer experience.

The business must define and test:

- Who is responsible for fulfilment and delivery for each order.
- How multi-seller orders are split and tracked.
- How platform commissions and seller balances are calculated.
- How refunds, cancellations, disputes and failed payments are handled.
- How seller verification and product moderation work.
- What customer support can resolve and what must be escalated.

Do not advertise a fulfilment or delivery promise until the operating process and responsible parties are established.

## 4. Roadmap at a Glance

| Stage | Focus | Exit condition |
|---|---|---|
| 0 | Company foundation and control | Foundational decisions and records are maintained |
| 1 | Marketplace and portal completion | Critical workflows pass agreed acceptance tests |
| 2 | Security and operational readiness | Access, payments, data and recovery checks pass |
| 3 | Seller and customer validation | Real users complete meaningful marketplace activity |
| 4 | Controlled beta launch | Support and operations can handle live usage |
| 5 | Repeatable growth and monetisation | Acquisition, retention and unit economics are measured |
| 6 | Funding and strategic partnerships | Evidence-backed case and clear use of funds |
| 7 | Ecosystem expansion | Core marketplace is stable and expansion has validated demand |

Stages may overlap where appropriate, but later-stage expansion must not be treated as a substitute for earlier-stage evidence.

---

## 5. Stage 0 — Company Foundation and Control

**Objective:** Establish the basic company direction, decision-making records and operating discipline.

### Workstreams

**Company identity and documentation**
- Maintain the company foundation profile.
- Confirm the vision, mission and positioning.
- Document the business model and assumptions.
- Maintain a decision log for major company decisions.
- Keep legal status accurate in all company materials.

**Legal and administrative preparation**
- Research the appropriate CAC registration structure and requirements.
- Clarify founder ownership, intellectual property ownership and any future equity arrangements before bringing in co-founders or investors.
- Establish appropriate business records, financial recordkeeping and contractual templates.
- Review applicable Nigerian obligations with qualified professionals as the business moves toward trading.

**Project governance**
- Use `web-portal` as the current reference branch for web-portal reviews.
- Record the commit or release being reviewed.
- Maintain a product status document that distinguishes verified, in-progress, planned and proposed work.
- Keep technical implementation decisions with the development workflow and assigned developer.

### Exit conditions

- Company positioning and current legal status are documented accurately.
- Major business decisions have a record.
- The current product scope and reference branch are identified.
- A clear product acceptance checklist exists.

**Status:** Foundational documentation started. Other items require confirmation and execution.

---

## 6. Stage 1 — Complete the Initial Marketplace and Web Portal

**Objective:** Turn the current development work into a coherent product that can be tested end to end.

### Workstream A: Customer marketplace

Validate the complete customer journey:

1. A visitor can discover approved stores and published products.
2. A customer can create an account and sign in.
3. Product details, seller identity, price and availability are understandable.
4. Cart contents and totals are accurate.
5. Checkout handles the selected products and sellers correctly.
6. Payment outcomes are handled reliably.
7. The customer can see the resulting order and its status.
8. Customer support and cancellation/refund paths are understandable.

### Workstream B: Seller portal

Validate the complete seller journey:

1. A prospective seller can submit an application.
2. The seller receives clear application status information.
3. An approved seller can establish or manage a store.
4. The seller can submit products with required details.
5. Product review and publication states are clear.
6. The seller can manage permitted inventory and order tasks.
7. Notifications and account settings work as intended.
8. A seller cannot access another seller's private information.

### Workstream C: Administration

Validate that authorised administrators can:

- Review and decide seller applications.
- Review products and moderation cases.
- Manage approved stores and relevant platform records.
- Review waitlist submissions where applicable.
- Perform privileged actions through protected server-side operations.
- See useful outcomes and audit information.

The latest `web-portal` code review found seller and admin interfaces and Supabase integration in the codebase. It did not establish that all live workflows are complete or secure. The waitlist SQL script also requires deliberate database setup; its presence in the repository does not mean it has run.

### Workstream D: Multi-seller commerce

Treat multi-seller checkout as a core marketplace requirement, not a cosmetic feature.

Acceptance tests should cover:

- One customer checkout containing products from multiple sellers.
- A single customer-facing parent order with correctly separated seller packages or sub-orders.
- Correct item, quantity, price, commission and total calculations.
- Correct seller-specific visibility and access.
- Clear delivery, fulfilment and tracking responsibility.
- Correct behaviour when one seller's package is delayed, cancelled or refunded.

### Exit conditions

- Critical customer, seller and administrator journeys pass end-to-end tests.
- Payment and order states reconcile correctly.
- The multi-seller order model is demonstrated with test data.
- No known cross-seller data exposure remains.
- The product status record identifies any accepted limitations.

**Status:** In progress; completion is not yet verified.

---

## 7. Stage 2 — Security, Reliability and Operational Readiness

**Objective:** Protect customers, sellers and the business before inviting real users.

### Required checks

**Identity and permissions**
- Verify role assignment and server-side authorisation.
- Test customer, seller and administrator access separately.
- Test that one seller cannot read another seller's private orders, drafts, customer details or financial records.
- Confirm public access is limited to intended published content.
- Review Supabase Row Level Security (RLS) policies and privileged functions.

**Payments and financial integrity**
- Recalculate prices and totals on trusted server-side code.
- Verify payment webhook signatures and event handling.
- Make payment and order processing safe against duplicate events.
- Never store raw payment card numbers or security codes.
- Reconcile successful, failed, pending and refunded payments against order records.
- Document commission, seller balance and payout calculations before enabling real payouts.

**Data and application security**
- Review secrets and environment configuration.
- Confirm public client keys are protected by correctly configured access policies.
- Validate and safely render user-supplied content.
- Review file upload types, sizes and permissions.
- Check security headers, session handling and account recovery.
- Establish backups and a tested recovery procedure.

**Reliability and user experience**
- Test on affordable Android devices and narrow mobile screens.
- Test slow and interrupted network connections.
- Check loading, empty, error and retry states.
- Check accessible text, contrast, keyboard/focus behaviour and touch target sizes.
- Monitor application errors and critical service failures.

**Operations**
- Define customer support ownership and escalation.
- Define seller onboarding and moderation procedures.
- Define fulfilment, cancellation, refund and dispute procedures.
- Prepare incident response and administrator access procedures.

### Exit conditions

- Critical security tests pass.
- Payment and order reconciliation tests pass.
- Backup and recovery procedures are documented and exercised.
- Support and operational responsibilities are assigned.
- No unresolved critical issue blocks controlled testing.

**Status:** Required before public launch; verification pending.

---

## 8. Stage 3 — Seller and Customer Validation

**Objective:** Prove that the marketplace solves a real problem for a focused initial market.

### Initial market

Start in Nigeria. Select a manageable initial seller and customer segment rather than attempting nationwide coverage immediately.

### Seller validation

- Interview potential independent retailers and small businesses.
- Identify their current sales channels and operational pain points.
- Test whether the store setup and product listing process is understandable.
- Record objections to fees, fulfilment, trust, payments and onboarding.
- Recruit an initial group of sellers who are willing to actively maintain their stores.

### Customer validation

- Test product discovery and seller trust with prospective customers.
- Observe whether customers understand who sells each product.
- Test the checkout and delivery information before accepting live orders.
- Collect feedback after completed test or beta transactions.
- Record why customers abandon checkout or do not return.

### Suggested first validation targets

These are proposed learning targets, not current traction or guaranteed outcomes:

| Measure | Initial target |
|---|---:|
| Onboarded sellers | 20 |
| Active stores | 10 |
| Published products | 200 |
| Early customers | 100 |
| Completed transactions | 50 |

Define each measure before reporting it. For example, an active store should have a published product and recent seller activity; a completed transaction should be paid and fulfilled according to the agreed definition.

### Exit conditions

- Real sellers can onboard without constant founder intervention.
- Customers can complete and understand the shopping journey.
- Feedback identifies the most important improvements.
- There is evidence of genuine demand, not just registrations or social-media interest.
- Fulfilment and support issues are understood.

**Status:** Planned; targets have not been achieved or verified.

---

## 9. Stage 4 — Controlled Beta Launch

**Objective:** Introduce the marketplace to a limited audience while retaining the ability to monitor and correct problems.

### Launch approach

- Begin with invited sellers and a defined customer group.
- Limit categories or geographic coverage if operations require it.
- Publish clear seller, payment, delivery, returns and support information.
- Monitor orders and payment outcomes daily during the early beta.
- Keep a record of customer complaints, seller issues and incidents.
- Pause new onboarding or transactions if a critical safety, payment or fulfilment issue appears.

### Launch materials

Prepare:
- Public website and marketplace messaging.
- Seller onboarding guide.
- Customer shopping and support guide.
- Seller terms and customer-facing policies reviewed for applicable law.
- Frequently asked questions.
- Support contact and escalation process.
- Launch announcement and product demonstrations.

### Exit conditions

- Beta transactions can be fulfilled and supported.
- Critical issues are resolved within an agreed response process.
- Customers and sellers understand the platform's current limitations.
- The team has enough evidence to decide whether to widen access.

**Status:** Planned; no public launch is claimed.

---

## 10. Stage 5 — Repeatable Growth and Monetisation

**Objective:** Build repeatable acquisition and retention while validating that marketplace economics can work.

### Seller growth

- Build a clear seller value proposition.
- Develop a repeatable outreach and onboarding process.
- Use seller referrals where they produce qualified active stores.
- Focus on seller quality, product completeness and fulfilment reliability.
- Track seller activation and retention, not only sign-up counts.

### Customer growth

- Publish honest product demonstrations and seller stories.
- Use social content to explain how the marketplace works.
- Build referral and repeat-purchase experiments.
- Improve search, product discovery and trust signals.
- Measure customer acquisition and repeat behaviour.

### Monetisation experiments

Test pricing carefully and transparently:

- Seller subscription or store rental options.
- Commission on eligible completed transactions.
- Paid product promotion.
- Advertising opportunities.
- Optional business services.

Do not introduce fees before understanding seller value, customer impact, payment costs, support costs and competitor alternatives.

### Core business metrics

Track at least:

- Active sellers and active stores.
- Published and available products.
- Customer registrations and active customers.
- Orders created, paid, fulfilled, cancelled and refunded.
- Gross merchandise value (GMV).
- Net platform revenue.
- Average order value.
- Repeat purchase rate.
- Seller retention.
- Customer acquisition cost where measurable.
- Contribution margin after variable costs.
- Support volume and fulfilment performance.

Do not treat GMV as Everneed revenue. Report gross transaction value, platform revenue and costs separately.

### Exit conditions

- Seller and customer acquisition channels can be compared.
- Retention and repeat activity are measured.
- Revenue streams have been tested with real users.
- The business understands its major variable costs.
- There is a credible path toward sustainable contribution economics.

**Status:** Planned; requires market evidence.

---

## 11. Stage 6 — Funding and Strategic Partnerships

**Objective:** Pursue funding and partnerships when Everneed can explain its product, market evidence, team needs and use of funds.

### Investor readiness

Prepare:

- Company profile and legal status.
- Product overview and verified product status.
- Market problem and target segment.
- Demonstrable product journey.
- Seller, customer and transaction evidence.
- Business model and pricing assumptions.
- Financial forecast with explicit assumptions.
- Competitor and market analysis.
- Team and hiring plan.
- Funding requirement and use-of-funds plan.
- Key risks and mitigation plan.

### Partnership priorities

Potential partner categories include:

- Payment providers.
- Logistics and delivery operators.
- Seller communities and trade associations.
- Business support organisations.
- Technology and infrastructure providers.
- Startup programmes and investors.

Partnerships should solve a defined business need. Do not present discussions, applications or introductions as signed partnerships.

### Exit conditions

- Investor materials are supported by verifiable data.
- Financial assumptions are documented.
- Funding amount and use of funds are justified.
- Partnership status and obligations are accurately recorded.

**Status:** Preparation can begin after core product and market evidence improve; fundraising outcomes are not assumed.

---

## 12. Stage 7 — Ecosystem Expansion

**Objective:** Add services that strengthen the marketplace and respond to validated seller or customer needs.

Potential expansion sequence:

1. Improve seller operations and business tools.
2. Introduce measured promotional and advertising products.
3. Integrate logistics partners where fulfilment demand supports it.
4. Add commerce integrations and operational services.
5. Evaluate new markets and localise payments, policies and operations.

Every proposed expansion should have:

- A validated user problem.
- A clear owner and operating model.
- Cost and revenue assumptions.
- Legal and regulatory review where needed.
- A product and technical feasibility assessment.
- A measurable pilot and decision gate.

International expansion must account for local company and tax requirements, consumer protection, payments, privacy, logistics, currency and customer support.

**Status:** Long-term direction; not part of the immediate launch scope.

---

## 13. Responsibilities and Working Model

### Founder

The founder leads:

- Company direction and final strategic decisions.
- Business model and commercial priorities.
- Seller and partner relationships.
- Hiring and resource allocation.
- Funding and investor engagement.
- Approval of major product scope changes.

### Application development

Claude is the primary application development assistant in the current workflow. Technical implementation tasks should be expressed as clear requirements and acceptance criteria and passed through that development workflow.

### Business strategy and documentation

ChatGPT supports:

- Company strategy and roadmap.
- Business and product documentation.
- Review of the connected GitHub project as requested.
- Gap identification and milestone tracking.
- Recruitment, growth and funding preparation.
- Investor and partnership materials.

GitHub remains the source of truth for committed project files and code. A code change is not considered a completed business capability until the relevant workflow has been tested.

---

## 14. Progress Reporting Rules

Every roadmap item and monthly report must use one of these labels:

| Label | Meaning |
|---|---|
| **Verified complete** | The outcome has been tested or otherwise evidenced |
| **In progress** | Work has started but the exit condition is not met |
| **Planned** | Approved for future execution but not started |
| **Proposed** | An idea awaiting a decision |
| **Blocked** | Cannot proceed until a stated dependency is resolved |

A commit, user interface, database migration or passing static check is useful evidence, but it does not automatically prove that a complete live workflow is operational.

Monthly progress reports should record:

- Reporting period and project commit reviewed.
- Milestones completed with evidence.
- Work in progress.
- Blockers and risks.
- Seller, customer and transaction metrics.
- Decisions required from the founder.
- Priorities for the next reporting period.

---

## 15. Immediate Priorities

The next execution cycle should focus on the following order:

1. Maintain the company foundation documents and decision log.
2. Review the current `web-portal` branch and record the exact commit under review.
3. Create or update a product status and acceptance checklist based on the current code.
4. Validate customer, seller and administrator workflows against the live Supabase environment.
5. Resolve critical multi-seller checkout, order, payment, access-control and fulfilment gaps.
6. Prepare seller onboarding and operational policies.
7. Recruit a small initial seller-validation group only when the product can safely support the intended test.
8. Measure results and decide whether to proceed to controlled beta.

The order may be adjusted when evidence reveals a critical dependency, but growth campaigns and ecosystem expansion should not outrun product readiness.

## 16. Roadmap Review and Change Control

This roadmap should be reviewed monthly and whenever a major product, legal, market or funding decision changes the company's direction.

Changes should be recorded in the company decision log with:

- Date.
- Decision.
- Reason and supporting evidence.
- Expected impact.
- Owner.
- Follow-up date or success measure.

The roadmap is a living strategy document. Updates should preserve the distinction between what Everneed has verified, what it is currently building and what it intends to do later.

---

## Closing Direction

Everneed's ambition is to become a digital commerce ecosystem, but its credibility will be earned through execution.

The first proof is not the number of features or the size of the vision. It is whether real sellers can operate successfully, customers can shop with confidence, transactions can be fulfilled reliably and the business can create sustainable value.

**Build the marketplace. Prove the model. Grow the ecosystem.**


---

## Public milestone status sync — 19 Nov 2026

The repository-root [public roadmap](../../ROADMAP.md) is the concise milestone register for contributors and AI agents. This master document remains the detailed business strategy and staged execution plan.

Current engineering priorities are payment/order integrity first, followed by seller verification integration:

- **Payment and variant checkout:** implementation is on draft PR #32 (branch feature/variant-checkout) against web-portal. Paystack Deno type-check passed; test 039 and 93 Phase 2 checks were reported passing in earlier CI evidence. A subsequent authenticated-RPC boundary run identified an unexpected anonymous-executable SECURITY DEFINER routine. A diagnostic assertion has been committed to name the routine and ACL. Full CI is not yet green.
- **Staging rollout:** variant checkout migrations have not been applied to Everneed-staging, and the updated Paystack Edge Function has not been deployed there. No end-to-end Paystack sandbox payment/webhook reconciliation is confirmed. Keep variant purchase disabled.
- **Prembly:** sandbox connection and targeted BVN/NIN/phone/CAC endpoint discovery are confirmed. Sandbox wallet previously reported ₦0.00. No verification transaction or production integration is confirmed. Build only after payment baseline and schema review.
- **Release safety:** PR #32 remains draft. Production database and production Edge Functions are unchanged by this work.

Do not promote these statuses based on source-code presence. Require CI output, staging migration ledger/catalogue checks, deployed function version and recorded end-to-end sandbox evidence. See ROADMAP.md for milestone IDs, acceptance criteria and AI-agent continuation rules.


## 19 Nov 2026 — Variant checkout CI and staging rollout checkpoint

- Draft PR #32 head `4d65c8191b8f5b74c804a9e6bc9bf83361f2d140` passed web/install and database CI, including variant checkout, authenticated/public RPC boundaries, RLS isolation, payment recovery and finance-journal regressions. The APK build job is still running.
- Six missing checkout/security migrations were applied to Everneed staging only. Schema and ACL checks confirmed the variant snapshot columns, public seller-safe plan catalogue, authenticated-only seller category schema, and private trigger helper boundary.
- Reviewed Paystack Edge Function from `feature/variant-checkout` deployed to staging as version 13. End-to-end sandbox transaction/webhook/reconciliation tests remain outstanding; no live payment has been made.
- Prembly capability categories are known, but endpoint discovery returned no concrete operation IDs or payload schemas. No Prembly request has been sent; no wallet spend was made.
- Production remains untouched; PR #32 remains draft/open/unmerged.


## 19 Nov 2026 — Android build and Prembly discovery update

- Android APK job in CI run 44540581382 completed successfully. Build 1219 was uploaded as artifact `everneed-apk` (9.48 MB ZIP); use the run's Artifacts section to download it.
- Prembly endpoint registry is now visible in Sandbox and lists BVN Basic/with face/phone, NIN Basic/with face, phone, CAC Basic/Advanced, TIN and other checks. Read-only wallet lookup confirms ₦0.00 NGN, active and unlocked. No identity/business verification request was sent.
- Nigeria BGC check-type fallback lists Identity, Education, Employment and Criminal. The sandbox system package catalogue includes an Entry Package with Identity and NIN items; catalogue prices are indicative sandbox data only, not an approved production pricing commitment. The attempted package-detail lookup returned 404; no package was created.
- Next Prembly work: confirm exact API request schemas and whether plan-based seller verification should use direct identity endpoints or BGC package/candidate flows. Keep non-CAC/manual review path. No wallet funding or verification spend without owner approval.


## 19 November 2026 — Marketplace financial operating system

A detailed engineering and product specification is now maintained in [MARKETPLACE_MONEY_FLOW.md](../FINANCE/MARKETPLACE_MONEY_FLOW.md). It covers payment orchestration, double-entry accounting, seller settlement, buyer credit, promotions/cashback, shipping/hub pricing, refunds, disputes, reconciliation, buyer activation and payout risk controls.

The staging audit found existing order/payment/payout/refund/offer records and a legacy single-entry ledger, but no buyer/store wallet accounts or complete double-entry journal. This is a design and implementation workstream, not a claim that wallets or withdrawals are already available. The implementation sequence is FIN-00 through FIN-11. A general-purpose buyer cash wallet, P2P transfers and cash withdrawals remain gated on Nigeria-specific legal review and a regulated partner. The initial marketplace should not custody or issue stored value without approval.




## 19 Nov 2026 — finance audit and CI status correction

The current engineering checkpoint supersedes earlier in-progress notes above where they conflict: PR #32 head `2e0b9554f9b27352d2b16f8ff597786b37d8815c` has passed the Migration files workflow (44543116567) and Android build workflow (44543116525). PR #32 remains draft/open/unmerged. The six checkout/security migrations and reviewed Paystack function version 13 are recorded as applied/deployed to staging only in the PR validation record; sandbox end-to-end payment/webhook/reconciliation acceptance remains pending.

The FIN-00 function-level audit is complete. Cancellation, delivery, recovery, trigger and ACL findings are in `docs/FINANCE/MARKETPLACE_MONEY_FLOW.md` sections 22–24. FIN-01 journal design is documented in section 25 but has not been migrated. Do not interpret seller-order release or delivery as a seller payout, or an approved refund as a provider-confirmed refund. Production remains untouched.




## 19 Nov 2026 — FIN-01 migration discovery correction

The branch already includes `033_double_entry_finance_journal.sql` and its regression test. Staging migration history confirms version 033 is applied; the private journal tables exist with 96 seeded accounts and zero posted journals/lines. The staging test ran successfully inside a rollback transaction. FIN-01's journal foundation is therefore implemented and staged, but it is not integrated with checkout, refunds, seller release or payout execution. The current work is to harden migration 033 and expand negative/security tests before business-event integration. See `docs/FINANCE/MARKETPLACE_MONEY_FLOW.md` sections 25–26.




## 19 Nov 2026 — FIN-01 migration 034

Added forward-only migration 034 to harden the staged double-entry journal RPC against oversized/malformed requests. Added dedicated regression test 034 and CI execution. Pending full database CI before staging apply. The journal is still not integrated with Paystack payment confirmation, refunds, seller settlement or buyer/store wallets. Refer to finance architecture section 27.


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


## FIN-02A deeper checkout audit — 19 Nov 2026
- Read-only staging inspection confirms current per-item commission rates are persisted, but commission amounts and seller-order subtotal/commission/earning are calculated in base currency; they cannot be posted as buyer-currency values.
- `order_items.unit_price` uses zero-decimal display rounding for NGN/KES while `line_total` is stored at two decimals. New allocation must use authoritative persisted line totals and quote provenance, never reconstruct totals from display unit price × quantity.
- Schema-v2 should calculate commission in buyer order currency using the frozen policy. Seller-funded discounts reduce seller-funded merchandise consideration before commission; platform-funded discounts do not reduce seller proceeds and are separately attributed to Everneed. This defines a fair commission basis without inventing a commission rate.
- FIN-02A must be a forward-only versioned path. Preserve v1 orders and existing payment verification/quarantine. Inspect all callers, triggers, grants and immutability controls before migration. See finance architecture section 32.


## FIN-02A allocation math added — 19 Nov 2026
- Added migration 035 with a private immutable pure helper for integer-minor-unit per-item allocations, explicit seller/platform discount funding basis points, commission on seller consideration after seller-funded discount, deterministic residuals and reconciliation.
- Added SQL tests 035 for multi-item proportional allocation, split funding, exact totals, input validation and order-independent results; CI now runs this suite and migration replay validates the new file.
- Scope is intentionally limited: no checkout caller, v2 snapshot persistence, campaign budget reservation, payment settlement, seller release or journal posting is connected yet. See finance architecture section 33.


## 19 Nov 2026 — FIN-02A staging checkpoint
- Migration 035 applied to Everneed staging only; SQL contract test 035 executed successfully and rolled back fixtures.
- Catalog confirms private allocation helper exists; EXECUTE denied to anon, authenticated and service_role. No order/payment/journal/payout data changed; production untouched.
- Migration-file workflow passed at head ffb6b6f. Android/database CI was queued behind an earlier build; verify the latest head before claiming CI-green.
- Next: seller consent, approved currency budgets, atomic reservations/release, immutable financial allocation snapshot and checkout integration.


## 20 Nov 2026 — FIN-02A funding controls checkpoint
- Added migrations 036/037: seller per-offer/store funding consent (owner-verified RPC), admin-approved currency-specific campaign budget, idempotent order-keyed atomic reservation/consume/release, and append-only consent/reservation event audits.
- Added contract test 040 and CI invocation; staging migrations applied and test ran successfully with rollback fixtures. Existing checkout, payments, journals and balances untouched; production untouched.
- Controls are not connected to offers/checkout yet. Next: immutable v2 allocation snapshot persistence and a separately tested checkout integration path. See finance architecture section 35.


## 20 Nov 2026 — FIN-02A snapshot-v2 persistence boundary
- Added migration 038: immutable private v2 financial snapshot storage and service-role-only validation/persistence RPC. Checks per-item arithmetic, aggregate reconciliation, persisted quote consistency, item/store identity and campaign reservation references; v1 snapshot remains separate.
- Added SQL test 041 and CI invocation. Migration applied to staging; contract test passed with rollback fixtures. No checkout integration, v2 snapshots, payments, journals or payouts created; production untouched.
- Current migration replay workflow passed on head 9feb280; Android/database workflow is still pending. See finance architecture section 36.
- Next gate: deterministic v2 builder/store aggregation and atomic checkout wrapper integration with regression coverage.


## 20 Nov 2026 — FIN-02A store totals reconciliation guard
- Migration 039 adds a private pure validator + insert trigger to verify each store allocation summary exactly matches item-level amounts in v2 snapshots. Missing/duplicate stores and mismatched totals reject.
- Test 042 executed successfully against staging with rollback fixtures; migration applied. Checkout remains unconnected and production untouched.
- See finance architecture section 37. Next remains deterministic v2 builder + atomic checkout integration and full payment/promotion regressions.


## 20 Nov 2026 — FIN-02A ACL correction
- Staging ACL review found service_role EXECUTE on seller consent and admin campaign-budget RPCs. Although auth.uid checks would reject calls without user identity, permissions were broader than intended.
- Migration 040 explicitly removes service_role EXECUTE from those three human-facing RPCs. Test 043 passed on staging. Authenticated role retains intended access; snapshot persistence remains service-role-only. Production untouched.
- See finance architecture section 38.


## 20 Nov 2026 — FIN-02A consent audit actor fix
- Migration 041 corrected the seller-consent audit trigger to record the current actor (auth.uid()) rather than only the original consent owner. Test 044 passed against staging.
- No campaign consent/offer state changed; production untouched. See finance architecture section 39.


## 20 Nov 2026 — FIN-02A atomic card checkout builder milestone
- Migrations 042–044: atomic card-checkout v2 builder/wrapper, reservation consumption on paid and release on unpaid cancellation, and strict v2 parent-quote/offer/reservation identity guard.
- Edge Function source now routes card-create through the new wrapper; legacy transfer/manual paths remain unchanged. Not deployed.
- Staging tests 046–049 passed: platform subsidy, seller-funded discounts, actual wrapper with rollback fixtures, payment-consume/cancellation-release lifecycle, and quote identity checks. Staging-only, fixtures rolled back, no production or real payment activity.
- Migration workflow passed at head 6f9b34d; Android/database CI pending. Finance architecture sections 40–41.
- Next: multi-store/FX rounding, concurrency and insufficient-budget rollback, failed/expired attempt handling, variants, verified Paystack duplicate/refund/reconciliation, before journal/settlement activation.


## FIN-02A fixture clarification
- The full atomic wrapper test 048 uses the baseline seeded Everneed official store (official-store commission is 0 by policy), and asserts the commission matches the persisted fee rate and seller payable reconciles. The explicit 10% math scenarios are in builder test 046. Platform budget reservation remains 2,000 minor units. All fixture rows rolled back.


## 20 Nov 2026 — FIN-02A card-only guard
- Migration 045 restricts the atomic v2 wrapper to `p_pm='card'`, so legacy transfer/other checkout methods cannot enter the new funding path accidentally. Test 050 passed staging; actual card wrapper fixture 048 still passed.
- Migration 045 applied staging-only. Production untouched. See finance architecture section 42.


## 21 Nov 2026 — FIN-02A rounding regression
- SQL test 051 covers multi-store allocation, mixed seller/platform discount funding, deterministic residual rounding, and store/payable reconciliation. Staging execution succeeded after test assertion correction; no data persisted. CI wiring added; full workflow pending. Finance section 43.


## 21 Nov 2026 — FIN-02A campaign budget failure atomicity
- Test 052 exercises insufficient platform campaign budget and verifies the atomic checkout rolls back order/reservation/budget mutations. Staging execution passed; fixture rolled back. CI wired. Finance section 44.


## 21 Nov 2026 — FIN-02A aggregate budget reservation guard
- Test 053 verifies aggregate reservations stay within campaign budget (600 accepted; second 600 rejected against 1,000), leaving exactly one active hold. Staging passed; fixtures rolled back; CI wired. Concurrent stress remains a separate gate. Finance section 45.


## 21 Nov 2026 — FIN-02A concurrent reservation guard
- Test 054 runs two concurrent database sessions competing for campaign budget; staging confirmed only one 600 hold accepted against 1,000. Fixture cleaned; CI wired. Finance section 46.


## FIN-02A checkpoint — 21 Nov 2026
- Latest full database CI passed tests 033–054, including concurrency reservation safety and insufficient-budget rollback; install/check passed. APK job was in progress at checkpoint.
- New contract test 055 covers FX quote provenance, currently supported exponent-2 currencies, and snapshot v2 quote identity. Staging execution passed with rollback fixtures; CI rerun pending for this newer commit.
- Zero-decimal currencies remain unsupported until end-to-end pricing, quote, allocation, Paystack, refund and settlement minor-unit handling is updated.
- FIN-02A remains staging/draft only. No production deployment, live payment, journal posting, seller settlement or wallet activity.


## Android build pause — web-first development
- Android APK CI job is temporarily disabled (`if: false`) while Everneed development is web-only. Web app checks, database tests, and migration validation continue normally.
- Re-enable APK builds only when the user explicitly resumes Android work. This is a temporary CI pause, not deletion of Android project assets or native functionality.


## FIN-02A expiry-worker design gate — 21 Nov 2026
- Campaign holds are already released on unpaid cancellation via trigger 043; test 047 covers this lifecycle. No automatic expiry worker exists yet.
- Before building/activating one: approve a configurable expiry period; block cancellation for initializing/pending/processing/succeeded/reconciliation-required payment attempts; use bounded `SKIP LOCKED` batches; ensure cancellation and hold release are atomic/idempotent; test concurrent workers and race conditions.


## Finance implementation checkpoint — 22 Nov 2026
FIN-02A unpaid-order expiry worker is now drafted as migration 056 with test 056 and CI wiring. It uses a caller-supplied cutoff (no unapproved timeout), a bounded batch and `SKIP LOCKED`; payment attempts that are unresolved, succeeded or reconciliation-required block cancellation. It routes cancellations through the existing cancellation core, so inventory and campaign holds retain their existing atomic lifecycle. Source branch only; CI re-run, staging validation and expiry policy approval remain gates. Scheduling stays disabled.


## FIN-02A expiry worker staging checkpoint — 22 Nov 2026
Migration 056 was applied to Everneed staging after the corrected database CI passed. Test 056 then passed on staging using rollback fixtures, including aged unpaid cancellation, failed-attempt eligibility, paid/recent exclusion, active/succeeded/reconciliation blockers, idempotency and ACL. Service-role-only access confirmed. Scheduling remains disabled until the owner approves expiry policy; production remains untouched. Re-run CI for this documentation update.

## FIN-03 Paystack verification hardening — 22 Nov 2026
Read the Paystack direct verification/webhook flow and migrations 026–031. Audit found direct settlement did not explicitly match the provider metadata payment_attempt_id to the persisted attempt (the recovery worker already performed that check). Edge Function source now enforces order/user/attempt identity and exact amount/currency before settlement. Not deployed; CI/type-check and sandbox acceptance remain open. No production payment activity.

## FIN-03 verified settlement journal checkpoint — 22 Nov 2026
The verified card settlement now atomically posts the immutable v2 financial allocation into the double-entry journal (migration 057). Clean replay/full DB CI and staging rollback test 057 passed at head `a7b0d3f576df03f78010b79926c003531beed2db`; migration `20261122140408` is applied to staging only. Mapping separates Paystack clearing, platform-funded promotions, seller payable, commission and delivery-fee-held. Duplicate settlement is idempotent and missing journal accounts fail closed. Six currency account seeds verified; rollback fixtures left no test journal rows. Production untouched; no live payments, Edge deployment, provider settlement, refund or payout.

Next finance gates: sandbox Paystack end-to-end/reconciliation; policy approval for commission recognition and delivery allocation; FIN-04 provider-confirmed refunds and immutable item/store refund allocations; then seller settlement/payout integration. Keep draft PR, production and APK work paused.
