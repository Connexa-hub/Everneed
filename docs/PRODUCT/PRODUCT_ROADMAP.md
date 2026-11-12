# EVERNEED
## Product Roadmap

**Document type:** Product delivery roadmap  
**Document status:** Working roadmap; subject to founder review  
**Project reference branch:** `web-portal`  
**Initial market:** Nigeria  
**Last reviewed:** November 2026

---

## 1. Purpose

This roadmap sets the order in which Everneed should deliver, validate and expand its product.

It is a prioritisation document, not a promise of release dates. Work should move between phases only when the previous phase has the evidence required to do so. A feature is not complete merely because a screen, database table, migration or code path exists.

The roadmap is organised around the product's central objective: make a dependable multivendor marketplace work for customers, sellers and the Everneed operating team before expanding into a wider commerce ecosystem.

## 2. Roadmap Rules

1. **Marketplace before ecosystem expansion.** Protect the core customer and seller journey from distraction.
2. **Security before scale.** Resolve access-control, payment and data-integrity risks before increasing transaction volume.
3. **Evidence before status claims.** Mark work complete only after the relevant tests or operational checks pass.
4. **Mobile-first delivery.** Prioritise practical performance on affordable Android devices and limited mobile data.
5. **Operational readiness is part of product readiness.** Do not launch a workflow that the team cannot support.
6. **No invented dates or commitments.** The founder should approve target dates after scope, dependencies and capacity are understood.

## 3. Priority Definitions

| Priority | Meaning |
|---|---|
| P0 — Launch critical | Required for a safe, usable initial marketplace |
| P1 — Important | Material improvement to marketplace operations, trust or customer experience |
| P2 — Growth | Helps acquisition, retention, seller productivity or commercial performance after the core works |
| P3 — Expansion | New business lines, markets or advanced capabilities |

## 4. Phase 0 — Product and Technical Baseline

**Priority:** P0  
**Exit condition:** The team has one reliable picture of the current application, backend, deployment and outstanding risks.

### Work

- Reconcile the root README with the active product architecture and current `web-portal` branch.
- Inventory the customer app, web portal, admin console, shared code, Supabase schema/functions and deployment configuration.
- Identify the authoritative Supabase project and the migrations/functions actually deployed.
- Separate working production features from mockups, demonstrations, legacy code and unfinished flows.
- Remove obsolete product instructions and any unwanted legacy fulfilment integrations from the active product, build and documentation.
- Establish repeatable development, test, preview and release procedures.
- Create a feature status register with evidence and named owners.

### Acceptance evidence

- A current architecture and deployment map.
- A reproducible build and test process.
- A reviewed migration/function inventory.
- A documented list of critical defects, security risks and blockers.
- No unresolved ambiguity about which branch is the product reference.

## 5. Phase 1 — Secure Marketplace Foundation

**Priority:** P0  
**Exit condition:** Customer, seller and admin identities and data boundaries are proven to work.

### Work

- Complete customer, seller and admin authentication flows.
- Implement reliable session persistence, expiry, refresh and sign-out.
- Enforce role and ownership checks in database policies and server-side functions.
- Ensure anonymous visitors can access only approved stores and published products.
- Ensure sellers can access only their own store, products, private information and permitted operational records.
- Protect bank details, identity references and other private seller information.
- Review storage access and uploaded media ownership.
- Add auditable administrative actions for sensitive decisions.
- Add meaningful loading, empty, validation, permission-denied and error states.

### Acceptance evidence

- Automated tests for anonymous, customer, seller and admin access.
- Explicit cross-seller isolation tests: Seller A cannot read or change Seller B's private records.
- Tests for unauthorised role changes and privileged RPC calls.
- Storage access tests for seller-owned and private files.
- A documented security review with resolved P0 findings.

## 6. Phase 2 — Seller Onboarding and Catalogue

**Priority:** P0  
**Exit condition:** A seller can apply, receive a decision and publish a compliant product through a controlled process.

### Work

- Complete seller account and store application.
- Validate store name, slug, contact, location and selected categories.
- Securely collect only the verification and payout information actually required.
- Complete save-draft, submit, review, approve, reject-with-reason and resubmission paths.
- Complete seller store profile and public storefront.
- Complete product create, edit, draft, submit, review, publish, reject, archive and restore flows.
- Validate price, stock, image, category and description on the server.
- Support product options such as sizes and colours only where the customer app and stock model can handle them consistently.
- Add clear review status and seller notifications.
- Define prohibited products, compliance checks and seller listing rules.

### Acceptance evidence

- A real test seller can complete onboarding from beginning to end.
- An administrator can review the application and communicate a decision.
- Only approved stores and published products appear publicly.
- Sellers cannot manipulate approval states or publish directly through unauthorised requests.
- Product edits, stock changes and archive/restore behaviour are tested.

## 7. Phase 3 — Customer Discovery and Shopping

**Priority:** P0  
**Exit condition:** Customers can reliably find a product, identify its seller and prepare a valid order.

### Work

- Complete customer registration, sign-in and account recovery.
- Complete home feed, categories, store discovery and product detail.
- Make seller attribution clear on every product.
- Complete search and practical filters.
- Display accurate price, currency, product options and stock state.
- Complete cart persistence and cart editing.
- Support products from multiple sellers in one cart.
- Provide clear delivery coverage and checkout eligibility.
- Optimise image loading, caching, skeleton states and low-data behaviour.
- Test layouts on common 360–412 px Android screens and older WebViews.

### Acceptance evidence

- A customer can discover a published product and identify its seller.
- Unpublished, rejected, archived and unauthorised products cannot be purchased.
- Cart totals match validated product and option prices.
- Out-of-stock or unavailable options cannot be ordered.
- Shopping remains usable under slow or interrupted network conditions.

## 8. Phase 4 — Checkout, Payments and Order Integrity

**Priority:** P0  
**Exit condition:** A customer can pay through an enabled method and the platform creates correct, traceable order records.

### Work

- Implement server-side cart and price recomputation.
- Validate product availability and stock at order creation.
- Define the parent-order and seller-package/sub-order data model.
- Implement multi-seller checkout with one customer-facing order and separate seller fulfilment records.
- Define payment initiation, pending, successful, failed, cancelled and refunded states.
- Verify provider callbacks/webhooks cryptographically and safely.
- Make webhook processing idempotent so repeated events do not duplicate orders or payments.
- Reconcile provider references, customer payment, platform commission and seller earnings.
- Define cancellation, refund, partial refund and stock-restoration rules.
- Avoid storing raw card details; use the payment provider's secure tokenisation flow where applicable.
- Add transaction and order audit history.

### Acceptance evidence

- A test checkout with items from three sellers creates one parent order and three correctly linked seller packages.
- The customer sees the correct total and order status.
- Each seller sees only their own package and the minimum customer details needed to fulfil it.
- Tampered client-side prices are rejected.
- Duplicate or invalid webhook events do not create duplicate payment or order effects.
- Failed and cancelled payments do not leave orders incorrectly marked as paid.
- Refund and stock-restoration scenarios pass.

## 9. Phase 5 — Seller Fulfilment and Customer Order Experience

**Priority:** P0  
**Exit condition:** Orders can be fulfilled, tracked and resolved using a documented operating process.

### Work

- Complete seller order views and seller-specific status transitions.
- Define seller acceptance, preparation and handover deadlines.
- Implement hub-assisted and direct-delivery eligibility rules.
- Define package identity, custody, receiving and dispatch records for hub-assisted orders.
- Provide customer-facing order and package status.
- Implement delivery confirmation and proof-of-delivery controls.
- If delivery codes are used, bind them to the correct order/package and protect against reuse or guessing.
- Define lost, damaged, delayed, refused and failed-delivery handling.
- Define returns, disputes, refunds and customer support escalation.
- Build the operational dashboard and notifications needed to manage exceptions.

### Acceptance evidence

- A test order can move through seller preparation, handover, dispatch and delivery.
- Status changes are authorised and recorded.
- Proof of delivery is linked to the correct order/package.
- A failed delivery can be escalated and resolved without corrupting payment or stock records.
- Hub and delivery capabilities are advertised only in locations where operations are actually available.

## 10. Phase 6 — Controlled Beta and Marketplace Operations

**Priority:** P0  
**Exit condition:** A limited group of sellers and customers can use the marketplace with support and measurable service quality.

### Work

- Select a limited launch area based on seller supply, customer demand and feasible fulfilment coverage.
- Onboard a controlled seller cohort and verify their catalogue quality.
- Prepare customer support, seller support, incident handling and escalation procedures.
- Run internal test transactions before inviting external beta users.
- Monitor checkout success, payment reconciliation, fulfilment time, cancellations, refunds and complaints.
- Review seller activation, product publication and customer repeat usage.
- Establish incident response, backups, recovery and rollback procedures.
- Collect structured seller and customer feedback and prioritise defects.

### Suggested validation targets

These are proposed targets for founder approval, not current achievements or guaranteed forecasts:

- 20 onboarded sellers.
- 10 active stores.
- 200 published products.
- 100 early customers.
- 50 completed transactions.

Targets should be adjusted to the selected launch area and operational capacity. Transaction quality and successful fulfilment matter more than sign-up totals alone.

### Acceptance evidence

- A documented beta report with actual metrics.
- No unresolved critical security or payment defects.
- Support processes have handled real test or beta issues.
- Marketplace and fulfilment economics have been measured.
- Founder approval to expand beyond the controlled cohort.

## 11. Phase 7 — Reliability, Retention and Commercial Readiness

**Priority:** P1  
**Exit condition:** The marketplace demonstrates repeatable customer value and a commercially understandable operating model.

### Work

- Improve search relevance, category navigation and product discovery using measured behaviour.
- Add customer favourites, saved stores or other retention features only where evidence supports them.
- Improve seller analytics and operational reporting.
- Establish transparent seller terms, fees, commission and payout schedules.
- Measure contribution margin separately for marketplace and delivery operations.
- Improve support response times and self-service help.
- Improve performance, crash reporting, accessibility and release quality.
- Evaluate seller acquisition and customer acquisition channels.
- Test pricing and monetisation with sellers before committing to a permanent structure.

### Acceptance evidence

- Repeat purchase and seller retention are measured over a meaningful period.
- Revenue, payment fees, refunds, support costs and fulfilment costs can be reconciled.
- Commercial terms are documented and communicated before being charged.
- The founder can make expansion decisions using reliable product and operating data.

## 12. Phase 8 — Growth Capabilities

**Priority:** P2  
**Entry condition:** Core marketplace transactions and operations are stable.

Potential work, subject to prioritisation:

- Seller subscription plans and enhanced storefront features.
- Promoted products and sponsored placements with clear labelling.
- Seller campaigns, coupons and promotions.
- Seller analytics and catalogue tools.
- Referral and loyalty programmes.
- Bulk product import and export.
- Improved notifications and customer communications.
- Business partnerships and integrations.
- More advanced support and moderation tools.

Each capability should have a clear user problem, expected benefit, operating cost, privacy impact and success metric before development begins.

## 13. Phase 9 — Delivery Network and Geographic Expansion

**Priority:** P2–P3  
**Entry condition:** The first market has repeatable demand, proven fulfilment and positive or improving unit economics.

### Work

- Expand service coverage gradually within the first market.
- Evaluate hub locations using order density, travel time, cost and service quality.
- Compare owned, rented, partner-operated and carrier-based fulfilment options.
- Introduce delivery partner integrations only when commercially and operationally justified.
- Assess additional Nigerian cities before entering another country.
- Evaluate Ghana, Kenya and South Africa as potential later markets.
- Consider the United Kingdom and United States only after local legal, payment, tax, currency and operating requirements are understood.

### Acceptance evidence

- A market-entry case with demand, seller supply, operating costs and compliance requirements.
- Confirmed local payment and fulfilment capability.
- Customer support and dispute processes appropriate to the market.
- A tested expansion pilot before wider rollout.

No additional city, country, hub or delivery network is assumed to be selected or operational by this roadmap.

## 14. Phase 10 — Wider Digital Commerce Ecosystem

**Priority:** P3  
**Entry condition:** The marketplace is established and the founder has evidence that adjacent services solve meaningful customer or seller problems.

Potential future directions:

- Expanded business-management tools for sellers.
- Advertising and merchant promotion services.
- Commerce integrations and partner services.
- More extensive logistics and fulfilment coordination.
- Additional digital services that complement the marketplace.

These are strategic options, not committed delivery items. Each requires its own product brief, business case, owner and approval.

## 15. Cross-Phase Quality Requirements

The following standards apply throughout the roadmap:

### Security and privacy
- Database and server-side authorisation.
- Least-privilege access.
- Protection of identity, bank and customer information.
- Secure secrets management.
- Auditable privileged actions.
- Tested backups and recovery.

### Product quality
- Responsive layouts and accessible controls.
- Clear loading, empty, success and error states.
- Safe handling of user-generated content.
- Consistent product, order and payment status.
- Regression tests for critical customer and seller journeys.

### Performance
- Lightweight pages and assets.
- Efficient image sizes and lazy loading.
- Minimal unnecessary requests.
- Resilience to slow and interrupted mobile networks.
- Testing on affordable Android hardware.

### Operational quality
- Documented seller and customer support.
- Clear ownership of incidents and exceptions.
- Defined fulfilment responsibilities.
- Reconciled payment and payout records.
- Honest communication of service coverage.

## 16. Roadmap Governance

The founder retains final authority over scope, priority, commercial commitments and launch approval.

For each roadmap item, record:

- Feature or outcome.
- User problem being solved.
- Priority.
- Status: Verified, In progress, Planned, Proposed or Blocked.
- Responsible owner.
- Dependencies and risks.
- Acceptance criteria.
- Evidence link, test result or release reference.
- Decision date and next review.

Review the roadmap at least monthly and whenever a major product, security, operational or commercial decision changes the delivery sequence.

Do not move an item to **Verified** based only on a mockup, code commit, static check, migration file or successful build. Use the evidence appropriate to the feature, including end-to-end tests and live operational checks where required.

---

## 17. Immediate Product Priorities

Based on the inspected `web-portal` branch and the current product direction, the next priorities are:

1. Reconcile the outdated root README with the active web portal and customer-app architecture.
2. Produce a current implementation and deployment inventory.
3. Verify Supabase migrations, policies and functions against the active project.
4. Complete and test authentication, role enforcement and seller data isolation.
5. Validate seller onboarding and product review end to end.
6. Verify the customer app's discovery, cart and checkout implementation.
7. Prove multi-seller order creation, payment reconciliation and seller-package isolation.
8. Validate fulfilment, delivery status and support processes before public launch.

These are priorities for investigation and delivery, not claims that the work is currently complete.

## Closing Direction

**Make the core marketplace dependable. Validate it with real users. Expand only when the evidence supports it.**
