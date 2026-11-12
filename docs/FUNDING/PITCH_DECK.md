# EVERNEED
## Investor Pitch Deck — Working Master Copy

**Document type:** Internal pitch-deck content and presentation brief  
**Document status:** Draft narrative for founder review; not approved for external distribution  
**Business status:** Founder-led startup; not yet registered with Nigeria's Corporate Affairs Commission (CAC)  
**Initial market:** Nigeria  
**Product:** Multivendor digital marketplace, with a proposed hub-supported fulfilment model  
**Project reference branch:** `web-portal`  
**Prepared:** November 2026

---

## Important use note

This document is the written master copy for a future investor presentation. It is not evidence of an active fundraising round, an approved funding ask, a valuation, a completed product launch or investor commitments.

The current position is **pre-validation, with product implementation underway**. The reviewed repository contains meaningful product components, but important production, payment, security and operational workflows remain unverified. Do not present proposed capabilities as live services.

Before external use, the founder must:
- Review and approve the narrative and any claims.
- Replace every bracketed evidence placeholder with verified information or remove it.
- Confirm legal and corporate status.
- Add current, supportable market research and financial assumptions.
- Decide whether fundraising is active and approve the ask and instrument.
- Obtain professional review of legal, financial and investment statements.

## Deck positioning

**Core positioning:** Everneed is building a digital commerce ecosystem, starting with a multivendor marketplace for independent businesses and shoppers in Nigeria.

**Tagline:** Connecting Businesses. Enabling Commerce. Building Opportunities.

**One-sentence pitch:** Everneed aims to give independent businesses a shared digital marketplace while helping shoppers discover products across multiple sellers through one connected shopping experience, with coordinated fulfilment as a planned extension.

**Recommended presentation length:** 12–14 slides, approximately 8–12 minutes, followed by discussion.

---

# Slide 1 — Cover

## EVERNEED
### A Digital Commerce Ecosystem

**Connecting Businesses. Enabling Commerce. Building Opportunities.**

A founder-led technology startup building a multivendor marketplace for Nigerian shoppers and independent businesses.

**Founder:** [Insert approved founder name and title]  
**Contact:** [Insert approved business contact]  
**Date:** [Insert presentation date]

**Visual direction:** A clean, confident brand cover. Show the Everneed identity and a simple visual connecting independent storefronts to a shared customer marketplace. Avoid stock imagery that implies an operating warehouse or delivery fleet.

**Presenter note:** Introduce Everneed as a company being built, not as an already established national marketplace.

---

# Slide 2 — The Problem

## Independent businesses need a simpler route into digital commerce.

Many small and independent businesses face barriers when trying to establish and grow their online presence:

- Building and maintaining a standalone online store can be difficult or costly.
- Reaching customers beyond an existing local network is challenging.
- Business information, product listings and customer conversations are often fragmented across tools.
- Establishing trust and presenting a consistent store identity takes effort.
- Customers may need to search across separate seller channels to find and compare products.

**Customer-side problem:** discovering products from different independent sellers and completing purchases through a coherent experience can be inconvenient.

**Evidence to insert before external presentation:**
- [Number] seller interviews conducted during [period].
- [Verified] recurring seller problems, with method and sample clearly described.
- [Verified] customer research findings and sample.
- [Source and date] relevant Nigerian market evidence.

**Presenter note:** Do not claim every Nigerian small business has the same problem. Use direct research to show which customer and seller segment experiences the problem most acutely.

---

# Slide 3 — The Opportunity

## Bring independent sellers and shoppers into one connected marketplace.

Everneed's opportunity is to create shared digital commerce infrastructure for businesses that may not need or be able to operate a standalone commerce platform.

The initial focus is deliberately narrow:

- **Market:** Nigeria.
- **Supply:** independent retailers and small businesses.
- **Demand:** mobile-first shoppers.
- **Initial product:** multivendor product discovery, seller storefronts and a connected shopping journey.
- **Longer-term opportunity:** seller services and coordinated fulfilment, subject to validation.

**Market sizing to complete:**

| Measure | Required evidence |
|---|---|
| TAM — Total Addressable Market | Credible, sourced definition of the wider market Everneed could serve |
| SAM — Serviceable Available Market | The segment, categories and geography the product can realistically serve |
| SOM — Serviceable Obtainable Market | A defensible near-term share based on actual capacity and acquisition assumptions |

Do not insert a large generic e-commerce market figure as though it were Everneed's achievable market. State source, publication date, geography, currency and calculation method. Bottom-up sizing from target sellers, customer groups, order frequency and realistic reach is preferred.

**Presenter note:** Explain why the first segment is reachable and valuable before describing the long-term African and international ambition.

---

# Slide 4 — The Solution

## One marketplace. Independent stores. A connected shopping experience.

Everneed is being built to connect three groups:

### Customers
- Discover products from independent sellers.
- See which store offers each product.
- Browse product details and available options.
- Build a shopping journey across participating stores.
- Manage account and order information through connected product experiences.

### Sellers
- Establish a digital storefront.
- Present store identity and products.
- Submit and manage listings through seller tools.
- Build visibility within a shared marketplace.
- Receive and manage orders through the intended seller workflow.

### Everneed operations
- Review seller applications and product submissions.
- Administer marketplace policies and platform activity.
- Support customer and seller issue resolution.
- Coordinate fulfilment services as the operating model is established.

**Presenter note:** These describe the intended product experience. Clearly distinguish code already present from workflows that have been tested and released.

---

# Slide 5 — Product

## A connected product foundation is under development.

The reviewed `web-portal` branch contains implementation across several product surfaces:

| Product surface | Current evidence in reviewed branch | Qualification |
|---|---|---|
| Public website | Marketing site, navigation and seller calls to action | Deployment and live integrations require verification |
| Seller portal | Store application, store information and product submission flows | Backend permissions and end-to-end production workflow require verification |
| Admin console | Seller application and product review interfaces | Database functions, permissions and audit behaviour require verification |
| Android customer app | Customer application foundation exists in the wider repository | Current branch review does not by itself verify a live customer purchase journey |
| Supabase integration | Client integration, schema and server-function paths are present | Applied migrations, production configuration and RLS behaviour require verification |
| Payment path | Paystack integration code/path exists | Live payment confirmation, settlement, refunds and reconciliation are not verified |

**Current product assessment:** Product foundation substantially implemented; production and operational readiness not yet verified.

**Demo to prepare:**
1. Show a real build or deployed environment.
2. Demonstrate a seller application and product submission.
3. Show the customer product discovery experience if the current build supports it.
4. Show an end-to-end test order only after the complete flow has been verified.
5. Disclose any mocked, seeded or simulated steps.

**Presenter note:** A screenshot or prototype is not proof of a live transaction. If a workflow is not verified, label it as a prototype, implementation or planned capability.

---

# Slide 6 — How It Works

## Independent sellers participate in one marketplace.

**Marketplace journey**
1. A seller applies to establish a store.
2. Everneed reviews the application under its marketplace requirements.
3. The seller prepares and submits product listings.
4. Approved products become discoverable to customers.
5. Customers browse products and identify the selling store.
6. Customers place orders through the supported purchase flow.
7. Sellers prepare their respective order items.
8. Order status and customer support are managed through defined processes.

**Planned multi-seller fulfilment journey**
1. One customer-facing parent order contains items from multiple sellers.
2. Each seller's items are organised into a separate seller package or sub-order.
3. Participating sellers hand over their packages to the designated Everneed hub.
4. The hub receives and checks package identity and condition.
5. Eligible packages are consolidated and prepared for final delivery.
6. If consolidation is unsuitable, items may travel as separate parcels.
7. The customer receives delivery updates and proof of delivery.

**Single-seller route:** direct seller delivery may be appropriate; a hub-assisted route may be used where the operating area and economics support it.

**Status:** The hub workflow is a proposed operating model. Do not imply a physical hub, delivery fleet, carrier agreement or live package tracking network exists until confirmed.

**Presenter note:** The intended benefit is coordination and convenience, not a promise that every order can always be combined into one parcel.

---

# Slide 7 — Business Model

## Multiple potential revenue streams, introduced in stages.

Potential revenue streams include:

1. **Transaction commission** on eligible completed marketplace transactions.
2. **Seller subscriptions** for enhanced storefront or business services.
3. **Promoted listings** that provide clearly labelled paid visibility.
4. **Advertising** within suitable marketplace placements.
5. **Fulfilment services** such as disclosed handling, consolidation or delivery coordination charges where Everneed is entitled to retain the fee.
6. **Future merchant services** and integrations after demand is validated.

**Commercial status:** No commission rate, subscription price or advertising price is approved in the current business model.

**Financial discipline**
- Customer merchandise value is not the same as Everneed revenue.
- Seller balances and carrier pass-through collections are not freely available company cash.
- Marketplace contribution and fulfilment contribution must be measured separately.
- Each revenue stream must be validated for customer willingness to pay, delivery cost and regulatory requirements.

**Presenter note:** Explain how Everneed may earn revenue without suggesting that every potential stream is already active.

---

# Slide 8 — Go-to-Market Strategy

## Build density before expanding reach.

Everneed's proposed market-entry approach is to start with a defined Nigerian service area and grow the marketplace in a controlled sequence.

### 1. Build relevant seller supply
- Identify a focused set of suitable independent sellers.
- Prioritise accurate listings, stock availability and reliable order preparation.
- Help sellers complete onboarding and storefront setup.

### 2. Activate customer demand
- Use seller communities and their existing customer relationships.
- Create product-led social content and shareable storefronts.
- Test referrals, local partnerships and targeted campaigns.
- Measure purchases and repeat usage, not just views or registrations.

### 3. Prove the operating model
- Define the service boundary and delivery promise.
- Validate seller handover and package accountability.
- Pilot hub consolidation only after location, partner, process and cost decisions are complete.
- Measure delivery quality, support demand and contribution per order.

### 4. Expand when evidence supports it
- Deepen the first market.
- Add nearby zones when service levels remain dependable.
- Consider additional Nigerian markets before international expansion.

**Presenter note:** The first launch city, service area, hub location, delivery partners and launch date must be confirmed by the founder before being named in an external deck.

---

# Slide 9 — Competition and Differentiation

## Compete on the experience and operating model, not unsupported claims.

Everneed will operate in a market with existing online marketplaces, social commerce, independent store websites and informal seller channels.

The intended areas of differentiation are:

- **Store-forward marketplace:** make the seller visible, not just the product.
- **Accessible seller participation:** give independent businesses a shared route to digital storefronts.
- **Connected multi-seller shopping:** design one customer-facing journey around products from multiple sellers.
- **Coordinated fulfilment option:** develop hub-supported package handling where it is operationally and economically viable.
- **Long-term merchant services:** extend the platform only where sellers demonstrate demand.

**Competitive research to complete:**
- [Named competitors and alternatives]
- [Comparable seller onboarding and pricing]
- [Customer experience comparison]
- [Delivery and fulfilment comparison]
- [Evidence supporting Everneed's differentiation]

Do not claim to be the first, largest, cheapest, fastest or only platform without reliable evidence. Acknowledge that customers and sellers can already use established alternatives.

**Presenter note:** Explain why a seller or shopper would choose Everneed for a specific use case today, and what remains to be proven.

---

# Slide 10 — Progress and Validation

## Product work is underway. Commercial validation is the next proof point.

### Current evidence
- A founder-led company and product direction are defined.
- The repository contains public website, seller portal and admin-console implementation.
- The wider repository includes an Android application foundation.
- Marketplace-oriented database and integration paths are present.
- Product, market-entry, growth and operational plans have been documented.

### Not yet established by the reviewed evidence
- A verified public production launch.
- A completed end-to-end customer purchase and payment journey.
- Verified multi-seller parent-order and package fulfilment in live operations.
- Reconciled seller payouts.
- A functioning physical hub or live delivery network.
- Confirmed active seller, customer, order, revenue or retention figures.

### Pilot scorecard to populate

| Measure | Current verified value | Evidence source |
|---|---:|---|
| Approved sellers | [Insert or state not yet measured] | Seller register |
| Active sellers | [Insert or state not yet measured] | Defined activity report |
| Published, available products | [Insert or state not yet measured] | Product catalogue |
| Purchasing customers | [Insert or state not yet measured] | Reconciled order data |
| Completed orders | [Insert or state not yet measured] | Order and payment records |
| Multi-seller parent orders | [Insert or state not yet measured] | Parent-order/package records |
| Repeat purchase rate | [Insert or state not yet measured] | Cohort analysis |
| Successful deliveries | [Insert or state not yet measured] | Proof-of-delivery records |
| Contribution per order | [Insert or state not yet measured] | Financial reconciliation |

**Presenter note:** Never fill these fields with targets or estimates and label them as actual traction. If no pilot has occurred, say so plainly and explain the next validation milestone.

---

# Slide 11 — Roadmap

## Prove the foundation, then scale the marketplace.

### Phase 1 — Product and technical verification
- Complete critical customer, seller and admin journeys.
- Verify authentication, access controls and seller data isolation.
- Test checkout, payment events, order states and refunds.
- Complete device, security and reliability testing.

### Phase 2 — Pilot readiness
- Complete legal and commercial preparation.
- Select the first service area.
- Define seller onboarding, customer support and incident processes.
- Confirm fulfilment and delivery arrangements before promising coverage.

### Phase 3 — Controlled pilot
- Onboard a limited group of suitable sellers.
- Publish a quality-controlled catalogue.
- Invite a defined customer cohort.
- Measure completed transactions, support issues and delivery outcomes.

### Phase 4 — Repeatability
- Improve seller activation and retention.
- Improve conversion and repeat purchase.
- Demonstrate reliable order handling.
- Establish positive or improving contribution economics.

### Phase 5 — Geographic and service expansion
- Add zones and markets based on demand and operating capacity.
- Introduce additional merchant services only after validating demand.

**Presenter note:** This is a stage-based roadmap, not a promise of fixed dates. Show dates only when work has been resourced and approved.

---

# Slide 12 — Financial Model and Unit Economics

## Sustainable growth requires positive, measurable order economics.

Everneed will need to understand the economics of several distinct order types:

- Single-seller order delivered directly by the seller.
- Single-seller order handled through a hub.
- Multi-seller order consolidated at a hub.
- Multi-seller order delivered in separate parcels.
- Cancelled, refunded, returned and failed-delivery orders.

**Key calculations**

`Marketplace Contribution = Net Platform Revenue - Variable Marketplace Costs`

`Fulfilment Contribution = Earned Fulfilment Revenue - Direct Fulfilment Costs`

`Combined Contribution = Marketplace Contribution + Fulfilment Contribution`

Relevant costs may include payment fees, platform-funded discounts, customer support, seller-to-hub transfer, hub labour, packaging, last-mile delivery, failed delivery, returns and claims.

**Financial information to insert only after validation:**
- [Actual monthly operating cost]
- [Actual cash position and runway, if approved for disclosure]
- [Actual completed orders and merchandise value]
- [Net platform revenue]
- [Contribution per order by fulfilment route]
- [Customer and seller acquisition costs]
- [Base, downside and upside forecasts with assumptions]

**Presenter note:** Do not use gross merchandise value as company revenue. Do not present a forecast as actual performance. The current financial plan has no approved pricing or populated financial forecast.

---

# Slide 13 — Team and Leadership

## Founder-led, with specialist capabilities added as evidence and workload grow.

Everneed is currently founder-led. The organisational framework identifies future capabilities across:

- Product and technology.
- Marketplace operations and seller success.
- Logistics and fulfilment.
- Growth and partnerships.
- Finance, legal and administration.

These are proposed functions, not a claim that all positions are filled.

**Founder:** [Insert approved biography, relevant experience and role.]

**Additional team members and advisers:** [Insert only confirmed individuals who have consented to be named, with accurate titles and contributions.]

AI tools and external development tools are not human co-founders, directors, employees or equity holders. Describe their contribution accurately if relevant; do not list them as members of the leadership team.

**Presenter note:** Investors back execution capability. Explain the founder's relevant experience and identify genuine capability gaps with a realistic hiring plan.

---

# Slide 14 — The Ask and Closing

## Help prove and grow a better-connected commerce experience.

**Funding status:** No funding round, valuation, instrument or target amount has been approved in the current strategy.

Complete this slide only after the founder approves a milestone-based funding plan.

### Proposed funding ask — to be completed
- **Amount:** [Founder-approved amount and currency]
- **Instrument:** [Equity / convertible instrument / grant / other, subject to legal advice]
- **Milestone period:** [Defined period]
- **Use of funds:** [Approved allocation tied to the financial plan]
- **Milestones:** [Specific, measurable outcomes]
- **Runway:** [Modelled duration and assumptions]

### What the capital is intended to prove
- A secure and reliable marketplace journey.
- A focused group of active sellers and purchasing customers.
- Successful and reconciled transactions.
- A workable fulfilment approach in a defined service area.
- Evidence of customer retention and sustainable order economics.

**Closing statement**

Everneed is building more than a place to list products. It is working toward shared digital commerce infrastructure that helps independent businesses participate in a connected marketplace.

**Everneed — Connecting Businesses. Enabling Commerce. Building Opportunities.**

**Contact:** [Approved contact details]

**Presenter note:** If fundraising is not active, replace the funding ask with a clear partnership or feedback request. Do not imply that capital is being raised when the founder has not approved an active process.

---

## Appendix A — Evidence and Claims Register

Complete this register before using the deck externally.

| Claim / slide | Evidence required | Current treatment |
|---|---|---|
| Company legal status | Current CAC and relevant registration records | State not yet CAC-registered unless verified otherwise |
| Market size | Current authoritative sources and transparent calculation | Placeholder; no figure approved |
| Seller problem | Interview notes, sample, dates and methodology | Research evidence required |
| Customer problem | Customer research and observed behaviour | Research evidence required |
| Product functionality | Current build, test evidence and environment | Describe code as implementation, not live service |
| Multi-seller checkout | End-to-end test and order/package records | Not verified |
| Paystack payments | Verified test/live transaction, webhook and reconciliation evidence | Not verified end-to-end |
| Hub operations | Confirmed location, operating procedures and records | Proposed model only |
| Delivery network | Signed partner terms and service evidence | Do not claim live network |
| Traction | Reconciled seller, customer and order data | No figures inserted |
| Revenue | Accounting records and reconciliation | No revenue claim inserted |
| Unit economics | Actual costs and completed order data | Model framework only |
| Team | Confirmed roles and consent to disclose | Founder-led; future roles are proposed |
| Funding ask | Approved financial model and founder decision | Not approved |
| Partnerships | Executed agreement and permission to disclose | Do not imply commitments |

## Appendix B — Investor Questions to Prepare For

Prepare concise, evidence-backed answers to:

1. Which exact seller and customer problem is Everneed solving first?
2. What have sellers and customers said, and how many have been interviewed?
3. Why would a seller choose Everneed over social commerce or an existing marketplace?
4. What is the first launch geography and why?
5. How will Everneed acquire enough sellers and customers in the same area?
6. How does a multi-seller order work from checkout through delivery?
7. Who holds responsibility for a package at each handover?
8. What happens when one seller is late, a package is missing or an order is refunded?
9. What parts of the product are live, tested, in development or planned?
10. How are payment collections, seller payables and refunds reconciled?
11. What are the expected and observed economics of each order type?
12. What prevents a larger marketplace or seller platform from copying the model?
13. What legal entity will enter contracts and receive investment?
14. What specific milestone will the requested capital achieve?
15. What evidence will show whether the pilot succeeded?

## Appendix C — Presentation Design Direction

- Use a consistent Everneed logo, typography and colour system from the current product brand.
- Keep each slide focused on one message.
- Use real product captures from a verified build; label prototypes and simulated data.
- Use a simple marketplace flow diagram for the seller-to-customer journey.
- Use a separate proposed fulfilment diagram for the hub model, clearly labelled as planned.
- Prefer real seller/customer research charts over generic stock market statistics.
- Use maps only after the first service area has been selected and verified.
- Use readable text, strong contrast and restrained animation.
- Keep detailed assumptions, financial schedules and legal material in the appendix or data room.
- Never display credentials, personal data, private seller information or production security details.

---

**Deck control rule:** Every external claim must be accurate, current, attributable and consistent with Everneed's product status, business model, financial plan and legal position.