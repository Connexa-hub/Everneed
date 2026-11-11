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
