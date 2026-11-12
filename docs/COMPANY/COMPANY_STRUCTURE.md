# EVERNEED
## Company Structure & Organisational Plan

**Document type:** Company organisation and people plan  
**Document status:** Proposed structure — roles are not claims of current employment  
**Business status:** Founder-led startup; not yet registered with Nigeria's Corporate Affairs Commission (CAC)  
**Initial market:** Nigeria  
**Project reference branch:** `web-portal`  
**Last updated:** November 2026

---

## 1. Purpose

This document defines how Everneed should organise its leadership, product development, marketplace operations and future logistics activities as the business grows.

Everneed's first operating model combines a multivendor marketplace with hub-supported fulfilment:

- Sellers list and manage their own stores and products.
- Customers can purchase from one seller or several sellers in one checkout.
- Multi-seller orders are routed through an Everneed hub for package receipt, checking, consolidation and dispatch to the customer.
- Single-seller orders may be delivered directly by the seller or routed through an Everneed hub when distance or operating conditions make that more suitable.
- Everneed coordinates the customer-facing order and delivery experience, while custody and delivery responsibilities are recorded at each handover.

This structure therefore includes both digital platform responsibilities and physical marketplace operations.

## 2. Organisational Principles

1. **Founder-led direction:** major company, product, financial and partnership decisions remain with the founder until formally delegated.
2. **Clear ownership:** every critical workflow has one accountable owner, even when several people contribute.
3. **Marketplace first:** prioritise customer, seller, order and fulfilment reliability before expanding into additional ecosystem services.
4. **Operations are part of the product:** seller onboarding, hub handling, delivery, support and refunds need defined processes and measurable service standards.
5. **Lean staffing:** combine compatible responsibilities early; split them into dedicated roles as workload and risk increase.
6. **Security and financial control:** privileged access, payments, seller balances and refunds require appropriate separation of duties and review.
7. **Evidence-based hiring:** recruit against validated workload and operational bottlenecks, not titles alone.

## 3. Proposed Organisation Structure

The following is a target structure. It does not imply that these executives, employees or departments currently exist.

```text
Founder / Chief Executive
│
├── Product & Technology
│   ├── Product management
│   ├── Software engineering
│   ├── UI/UX design
│   └── Quality, security & infrastructure
│
├── Marketplace Operations
│   ├── Seller onboarding & success
│   ├── Catalogue and product moderation
│   ├── Customer support
│   └── Trust, safety & order resolution
│
├── Logistics & Fulfilment
│   ├── Hub operations
│   ├── Package receiving & consolidation
│   ├── Dispatch and delivery coordination
│   └── Returns, failed delivery & proof of delivery
│
├── Growth & Partnerships
│   ├── Customer acquisition
│   ├── Seller acquisition
│   ├── Brand and content
│   └── Commercial and logistics partnerships
│
└── Finance, Legal & Administration
    ├── Accounting and reconciliation
    ├── Seller settlement oversight
    ├── Compliance and contracts
    └── People and administration
```

At the earliest stage, some functions may be handled by the founder, contractors or shared service providers. Finance, legal review and specialist compliance should receive qualified support when needed, even if they are not full-time roles.

## 4. Founder / Chief Executive

**Primary accountability:** company direction, business viability and execution.

Responsibilities:

- Set company vision, strategy and annual priorities.
- Own major product and commercial decisions.
- Approve budgets, pricing principles and material commitments.
- Build relationships with sellers, partners, advisers and potential investors.
- Set hiring priorities and approve key appointments.
- Review marketplace performance, customer experience and financial health.
- Ensure the company represents its legal and operating status accurately.
- Resolve cross-functional issues and assign accountable owners.

The founder should progressively delegate routine execution while retaining oversight of strategy, cash, risk and major company commitments.

## 5. Product & Technology

**Purpose:** build and maintain the marketplace, web portal and supporting systems.

Responsibilities include the customer marketplace, seller storefronts, admin tools, authentication and permissions, cart and checkout, payments and orders, parent orders and seller packages, delivery consignments, hub package-status workflows, delivery integrations, notifications, analytics, reliability, testing and incident response.

| Role | Main responsibility | Hiring stage |
|---|---|---|
| Technical lead / engineering lead | Technical quality, architecture, delivery and security oversight | When engineering workload and team size justify leadership |
| Software engineer | Application, backend and integration development | As core development workload requires |
| Product manager | Requirements, prioritisation, acceptance criteria and product outcomes | When coordination across product and operations becomes substantial |
| UI/UX designer | Research, interface design, usability and design consistency | Contract or part-time initially; dedicated later |
| QA / test engineer | Workflow, regression, device and release testing | Before broader beta or when release risk increases |
| DevOps / security specialist | Deployment, observability, infrastructure and security controls | Specialist or contracted support initially |

Technical ownership, code review, access control, release approval and production credentials must be managed deliberately. A job title does not automatically grant production or financial privileges.

## 6. Marketplace Operations

**Purpose:** make the marketplace trustworthy and useful for customers and sellers.

### Seller onboarding and success

- Respond to seller enquiries and explain eligibility and requirements.
- Coordinate applications and verification.
- Help approved sellers set up stores and publish suitable products.
- Educate sellers on stock, pricing, order preparation and hub handover.
- Monitor seller activity, satisfaction and retention.

### Catalogue and product moderation

- Review product information, images, categories and prohibited items.
- Check that listings meet platform standards.
- Coordinate corrections, approvals, rejection and removal.
- Escalate safety, authenticity or regulatory concerns.

### Customer support and trust

- Handle order enquiries and delivery-status questions.
- Coordinate cancellation, return, refund and complaint cases.
- Escalate missing, damaged, incorrect or delayed packages.
- Maintain case history and resolution ownership.
- Feed recurring problems back to product and operations teams.

These may begin as combined responsibilities. Separate them when case volume, response times or risk make combined ownership impractical.

## 7. Logistics & Fulfilment Operations

**Purpose:** coordinate physical movement of products from sellers to customers while protecting package accuracy, custody and delivery economics.

The hub is not merely a storage location; it is a controlled consolidation and dispatch point for eligible orders.

### 7.1 Logistics & Fulfilment Lead

Accountable for hub and delivery procedures, capacity, staffing, seller drop-offs and pickups, carrier relationships, package accuracy, turnaround time, delivery performance, exceptions, returns and logistics costs.

At the beginning, this may be an operations manager or founder-assigned responsibility rather than a standalone executive role.

### 7.2 Hub Operations

- Receive seller packages against order/package references.
- Record arrival time, package count and visible condition.
- Identify missing, damaged, late or mismatched packages.
- Label and sort packages by parent order and customer consignment.
- Keep packages secure and traceable while in hub custody.
- Consolidate eligible packages for the same customer.
- Prepare the combined parcel using approved packaging standards.
- Record dispatch, carrier handover and relevant evidence.

### 7.3 Dispatch and Delivery Coordination

- Assign the correct delivery route and provider.
- Coordinate direct seller delivery where that route is selected.
- Coordinate hub-assisted delivery for eligible single-seller orders.
- Dispatch consolidated multi-seller orders.
- Communicate delivery status and exceptions.
- Capture proof of delivery or a documented failed-delivery outcome.
- Coordinate reattempts, returns and reverse logistics.

### 7.4 Hub and delivery roles

| Role | Main responsibility | Hiring stage |
|---|---|---|
| Hub supervisor | Daily hub control, staff allocation, package accuracy and escalation | When a physical hub begins regular operations |
| Hub associate | Receiving, checking, sorting, labelling and packaging | Based on package volume and shift coverage |
| Dispatch coordinator | Route assignment, carrier communication and delivery status | When deliveries exceed founder-managed coordination |
| Rider / delivery personnel | Physical delivery and proof of delivery | Vetted partners or employed riders based on route economics |
| Logistics analyst / planner | Capacity, route, cost and service analysis | Later, when network complexity justifies it |

### 7.5 Required control points

Every package should have a traceable sequence:

1. Seller marks package prepared.
2. Seller hands over or drops off package.
3. Hub or authorised carrier records receipt and condition.
4. Hub identifies the package against the seller sub-order.
5. Hub consolidates and packages the customer consignment where appropriate.
6. Dispatch handover is recorded.
7. Customer delivery or failed-delivery outcome is recorded.
8. Exceptions, returns or claims are linked to the relevant package and parent order.

The exact custody transfer point must be defined in seller terms and operating procedures. Staff should not mark a package as received, dispatched or delivered without the corresponding event actually occurring.

### 7.6 Initial operating model

Do not open multiple hubs or hire a large delivery team before demand and route economics are understood. Start with a limited service area and a controlled process. Use contracted delivery providers where that is more economical and reliable than owning a fleet.

Define hub premises, security, staffing, insurance, package limits, operating hours, permitted goods and emergency procedures before accepting physical custody of customer orders.

## 8. Growth & Partnerships

**Purpose:** grow marketplace supply and customer demand without promising services the platform cannot yet deliver.

Responsibilities include seller and customer acquisition, brand and content, referrals, partnerships with delivery and payment providers, seller education, campaigns and measurement of acquisition cost, activation, conversion and retention.

Growth campaigns must be coordinated with seller supply, catalogue quality, support capacity and delivery coverage. Do not acquire demand in locations where fulfilment cannot be reliably served.

## 9. Finance, Legal & Administration

**Purpose:** protect financial records, contractual position and legal compliance.

Responsibilities:

- Maintain accounting records and operating budgets.
- Reconcile payment-provider settlements.
- Reconcile customer payments, seller payable balances, commissions and logistics charges.
- Review refunds, adjustments and payout batches.
- Track hub costs, carrier invoices and delivery collections.
- Maintain contracts, seller terms and partner agreements.
- Coordinate company registration, tax and regulatory advice.
- Maintain people, procurement and administrative records.

### Financial control principles

- Separate platform revenue from seller funds and carrier pass-through amounts.
- Keep marketplace commission and logistics contribution visible as distinct lines.
- Reconcile each delivery consignment to its charges and direct costs.
- Require documented approval for refunds, manual balance adjustments and exceptional payouts.
- Restrict access to financial data according to role.
- Use independent review for material payments where team size permits.

Qualified accounting and legal support should be engaged for the actual payment structure, tax treatment, consumer obligations and physical logistics arrangements.

## 10. Lean Initial Team

| Accountability | Lean starting arrangement |
|---|---|
| Company leadership and commercial decisions | Founder |
| Product and engineering delivery | Existing development arrangement / technical lead as appointed |
| Seller onboarding and seller communication | Founder-led or one marketplace operations generalist |
| Product moderation and customer support | Shared operations responsibility with clear escalation |
| Hub receiving and package consolidation | Designated hub supervisor/associate once hub operations begin |
| Dispatch and delivery | Operations coordination plus vetted delivery partner initially |
| Accounting and reconciliation | Founder oversight with qualified external accounting support |
| Legal and compliance | Qualified external professional support as needed |
| Growth and content | Founder-led experiments or part-time specialist |

This is a proposed lean arrangement, not a statement of current staffing. One person may hold more than one responsibility at first, but financial approval, package custody and recordkeeping should still have appropriate checks.

## 11. Hiring Sequence and Triggers

| Priority | Role / capability | Trigger to recruit |
|---|---|---|
| 1 | Marketplace operations generalist | Seller applications, product reviews and support cases exceed founder capacity |
| 2 | Hub supervisor / operations lead | A physical hub is selected and regular package intake begins |
| 3 | Hub associates | Daily package volume requires dedicated receiving, sorting and packing coverage |
| 4 | Dispatch coordinator | Delivery assignments and exceptions become difficult to manage manually |
| 5 | Customer support specialist | Response times or unresolved case volume begin to affect trust |
| 6 | Dedicated engineering / QA capacity | Release pace, reliability or security workload exceeds the current development arrangement |
| 7 | Growth and seller acquisition specialist | The marketplace can reliably serve additional sellers and customers |
| 8 | Finance and operations controller | Transaction, settlement, payroll and hub cost complexity requires stronger internal control |

Before each hire, define the work outcome, reporting line, authority, measurable performance indicators and expected cost.

## 12. Management Rhythm

**Daily logistics review (once fulfilment is active):**
- Orders awaiting seller preparation.
- Packages expected at each hub.
- Packages received, mismatched or damaged.
- Consolidations awaiting dispatch.
- Deliveries in progress and exceptions.
- Customer complaints requiring escalation.

**Weekly operating review:**
- Seller applications and activation.
- Product approval backlog.
- Paid, completed and cancelled orders.
- Hub package throughput and accuracy.
- Delivery on-time and failure rates.
- Refunds, disputes and support cases.
- Product issues affecting customer or seller workflows.

**Monthly company review:**
- Marketplace growth and retention.
- GMV and net platform revenue.
- Commission and logistics contribution separately.
- Hub and delivery costs by service area.
- Seller and customer feedback.
- Product roadmap and verified delivery progress.
- Cash position, risks and hiring needs.

## 13. Role Authority and Escalation

Document who may approve sellers, suspend stores, moderate products, change prices or delivery charges, assign fulfilment routes, confirm package receipt and dispatch, approve refunds and payouts, access private data, and sign partner agreements or commit company funds.

No employee or contractor should receive broader access merely for convenience. Administrative access, financial approval and physical package custody should be separated where practical.

Escalate immediately: missing or damaged packages, suspected theft or fraud, unauthorised account access, incorrect customer delivery, payment mismatch, unexplained seller balance, safety concerns and repeated hub/carrier failures.

## 14. Organisation Development Stages

| Stage | Organisation focus | What must be true |
|---|---|---|
| Founder-led build | Founder, development support and documented operating responsibilities | Core product and processes are being built and tested |
| Controlled marketplace beta | Small marketplace operations function and limited hub/delivery coverage | Defined service area, trained operators and escalation process |
| Early commercial growth | Dedicated seller success, hub supervision, dispatch coordination and support | Repeated order activity and measurable workload |
| Multi-area operations | Area hub leads, delivery partner management, finance controls and stronger product/QA functions | Hub capacity, route economics and quality can be managed consistently |
| Ecosystem expansion | Specialist leadership for new services and markets | Core marketplace and fulfilment model are stable and profitable enough to support expansion |

## 15. Immediate Actions

- [ ] Confirm which responsibilities the founder currently owns.
- [ ] Identify the person or partner accountable for development and technical releases.
- [ ] Define the first hub operating area and candidate location before making a lease or staffing commitment.
- [ ] Write the seller-to-hub receiving and custody procedure.
- [ ] Define package labelling, scanning, consolidation and dispatch controls.
- [ ] Decide whether initial last-mile delivery uses partners, employed riders or a hybrid.
- [ ] Create a delivery exception and customer support escalation process.
- [ ] Build role descriptions only for the first genuinely needed hires.
- [ ] Establish a weekly operations review and monthly company review.

## 16. Document Control

This is a proposed organisational plan. Update it when Everneed confirms its first hub, delivery partners, actual team members, operating volumes and approved delegations.

Do not publish proposed roles as existing staff appointments. Do not represent a planned hub or delivery network as operational until it has been established and tested.

**Guiding principle: Keep the team lean, make every handover accountable, and scale people and physical operations only as real marketplace demand requires.**
