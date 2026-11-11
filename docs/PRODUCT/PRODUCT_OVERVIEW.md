# EVERNEED
## Product Overview

**Document type:** Product definition and capability overview  
**Document status:** Working product document  
**Business status:** Founder-led startup; not yet registered with Nigeria's Corporate Affairs Commission (CAC)  
**Project reference branch:** `web-portal`  
**Initial market:** Nigeria  
**Last reviewed:** November 2026

---

## 1. Product Vision

Everneed is being built as a digital commerce ecosystem. Its starting product is a multivendor marketplace where independent businesses can establish digital storefronts and customers can discover and purchase from them through a shared commerce experience.

The product is intended to connect three operating groups:

- **Customers**, who discover products, shop and manage purchases.
- **Sellers**, who establish stores, submit products and fulfil their part of customer orders.
- **Everneed administrators and operations staff**, who review sellers and listings, oversee marketplace activity and coordinate the services Everneed provides.

The marketplace is the foundation. Additional seller tools, advertising, logistics services and integrations are longer-term extensions, not a reason to overstate the current product.

## 2. Product Surfaces

Everneed's product direction includes connected customer, seller and administration experiences.

| Product surface | Intended user | Purpose | Evidence in the `web-portal` branch |
|---|---|---|---|
| Everneed customer marketplace/app | Shoppers | Discover stores and products, manage a cart, check out and follow orders | This branch contains website and portal code; it does not by itself verify the current customer app implementation or live purchase flow |
| Everneed web portal | Sellers and prospective sellers | Apply for a store, manage store information and submit products | Seller routes, five-step application and product-management code are present |
| Everneed admin console | Everneed team | Review store applications and product submissions, manage stores and inspect waitlist entries | Admin interface and decision actions are present |
| Public website | Prospective sellers, partners and visitors | Explain the product, communicate the seller proposition and direct sellers into onboarding | Marketing homepage and public navigation are present |

The branch contains a public marketing experience, seller portal and admin console. The presence of an interface or code path is not proof that the corresponding workflow is secure, deployed, configured or operational in production.

## 3. Users and Their Jobs

### 3.1 Customers

Customers should be able to:

- Browse approved stores and published products.
- Understand which seller offers each product.
- View product details, price, availability and relevant options.
- Add products from multiple sellers to a cart.
- Complete checkout using available payment methods.
- Receive clear order and delivery updates.
- Contact support and raise issues when necessary.

These are product requirements. Customer purchase, payment, order and delivery journeys must be validated against the current customer application and backend before they are described as live capabilities.

### 3.2 Sellers

Sellers need to:

- Apply to open a store.
- Describe their business and choose product categories.
- Provide location and contact details.
- Define pickup and direct-delivery information.
- Submit payout and business-verification information.
- Add, edit, submit and archive product listings.
- See whether a store or product is a draft, under review, approved, rejected or suspended.
- Receive review notes and platform notifications.

The inspected seller portal code includes a five-step store application: store identity, business/location, delivery, payout and business confirmation. It also includes product creation and submission for review.

### 3.3 Everneed administrators

The administration experience is intended to support:

- Reviewing and deciding store applications.
- Publishing or returning product submissions for changes.
- Suspending or reinstating stores.
- Viewing store status and selected seller information.
- Viewing and exporting waitlist records.

The inspected admin code invokes backend RPC functions for several decisions. The existence of these calls does not establish that the functions, database permissions, audit trails or production data have all been tested successfully.

## 4. Core Product Components

### 4.1 Storefront identity

Each seller should have a recognizable store identity, including:

- Store name and shareable store link.
- Store description and tagline.
- Logo and cover imagery.
- Product categories.
- Location and relevant seller information.
- A clear relationship between each product and its seller.

The seller portal code supports store name, tagline, description, logo and cover inputs, plus category and location fields. The final public storefront presentation and customer discovery experience require separate end-to-end validation.

### 4.2 Product catalogue

A product listing is expected to carry the information customers need to make an informed choice, including:

- Product name and category.
- Price and optional previous price.
- Description and product imagery.
- Stock or availability information.
- Seller/store identity.
- Relevant compliance or registration reference where required.
- Product options such as size or colour where supported by the customer product.

The inspected web portal product form supports name, category, price, previous price, stock, description, photo and a compliance reference. Product review states include draft, pending review, published, rejected and archived.

Product options, size guides, per-option inventory and their complete customer checkout behaviour must be checked in the current app and database before being treated as verified in this branch.

### 4.3 Seller onboarding and review

The intended onboarding lifecycle is:

1. Seller creates an account.
2. Seller creates a store application.
3. Seller enters business and location details.
4. Seller provides pickup and delivery preferences.
5. Seller enters payout and business-verification information.
6. Seller submits the application.
7. Everneed reviews the application.
8. Seller receives an approval decision or change request.

The portal code shows draft, pending, rejected, suspended and approved-related states. The actual submission, review and notification lifecycle must be tested against the deployed backend and its access policies.

### 4.4 Marketplace checkout and orders

The target marketplace experience should support a customer purchasing from more than one seller in a single shopping journey.

The intended model is:

- One customer-facing parent order.
- Separate seller-specific order packages or sub-orders.
- Each seller can access only the orders and information needed for that seller's fulfilment.
- The customer can understand the status of the overall order and its individual packages.
- Payment, commission, seller earnings, refunds and delivery costs are reconciled consistently.

This is a target product and data model. The inspected `web-portal` seller portal code does not demonstrate a complete order-management workflow. Multi-seller checkout, parent-order tracking, seller isolation and order reconciliation remain validation requirements until proven by current application code, backend tests and a live end-to-end test.

### 4.5 Delivery and fulfilment

Everneed's intended fulfilment model has two main paths:

**Multi-seller orders:** Sellers prepare their own items and hand them to an Everneed hub or designated collection point. Everneed operations receive and check the packages, consolidate and package them where practical, then coordinate delivery to the customer. Separate parcels may be necessary when consolidation is unsuitable.

**Single-seller orders:** A seller may deliver directly where the seller's coverage and service are suitable, or use an Everneed-assisted route where available.

The seller portal contains fields for pickup address, direct-delivery preference and delivery zones. This records seller preferences; it does not prove a physical hub, carrier agreement, live route coverage or operational delivery network exists.

### 4.6 Payments and seller earnings

The product direction requires a trustworthy payment and settlement model:

- Customers see payment methods actually enabled for their market.
- The server validates prices and payable totals.
- Payment status is based on trusted provider confirmation.
- Seller earnings and platform commission are recorded separately.
- Refunds, reversals, failed payments and payout status are traceable.
- Sensitive payment credentials are not stored by Everneed when the payment provider can securely handle them.

The current branch includes shared Supabase configuration and a Supabase client, and the repository contains a Paystack Edge Function. These artefacts alone do not verify successful live payment initiation, signed webhook processing, order reconciliation or seller payouts. Each must be tested before launch claims are made.

## 5. Web Portal: Observed Capabilities

The following are visible in the inspected `web-portal` branch:

| Area | Observed implementation | Qualification |
|---|---|---|
| Public website | Marketing homepage, product explanations, seller calls to action and FAQ | Public-facing content; not proof of customer shopping |
| Seller access | Portal routes require a signed-in user | Authentication and role enforcement need live security tests |
| Store application | Five-step form with store, location, delivery, payout and business details | Backend persistence, privacy and submission path need testing |
| Seller dashboard | Store status, product counts, review notes and notifications | Depends on database policies and live data |
| Product management | Create/edit product, image upload, draft, submit for review, archive and restore | Server-side validation and ownership rules need testing |
| Admin store review | Approve, reject, suspend and reinstate actions | RPC permissions, auditability and deployed functions need testing |
| Admin product review | Publish or return products for changes | RPC permissions and data integrity need testing |
| Waitlist | View signups and export CSV | SQL function/policies and production configuration need verification |
| Shared backend client | Supabase Auth, REST, RPC and Storage helpers | Token handling, session behaviour and RLS need security review |

## 6. Product Design Principles

Everneed should be designed for the realities of its initial market:

- **Mobile first:** prioritise everyday smartphone use.
- **Affordable-device support:** target low- and mid-range Android devices and older WebViews.
- **Low-data efficiency:** compress imagery, minimise unnecessary network requests and avoid heavy visual effects.
- **Readable in bright conditions:** maintain strong contrast and clear hierarchy.
- **Accessible interaction:** use comfortable touch targets, clear labels, keyboard/focus support and reduced-motion preferences.
- **Trust by design:** make seller identity, product status, payment state and delivery responsibility understandable.
- **Secure by default:** enforce access on the server and database, not only by hiding interface elements.
- **Progressive capability:** launch a dependable core before adding complex ecosystem services.

## 7. Trust, Safety and Platform Controls

The product must protect customers, sellers and the platform through:

- Store and product review before public availability.
- Seller-specific data access and strict role-based permissions.
- Server-side validation of prices, stock, order totals and status transitions.
- Secure handling of seller identity, bank and business information.
- Payment-provider verification for payment events.
- Traceable administrative actions.
- Clear seller rules, product restrictions and customer support processes.
- Appropriate handling of complaints, refunds, disputes and suspicious activity.

A user interface control is not a security boundary. Database row-level security, server-side functions and tested authorisation rules are required.

## 8. Product Boundaries

The initial product should focus on:

1. Reliable customer and seller accounts.
2. Store applications and approval.
3. Approved stores and product catalogue.
4. Product discovery and seller attribution.
5. Cart and checkout.
6. Payment confirmation and order records.
7. Seller-specific fulfilment.
8. Customer order visibility and support.
9. Administrative review and operational oversight.

Potential later extensions include:

- Paid seller plans and enhanced storefront tools.
- Promoted products and advertising.
- Merchant analytics and business insights.
- Expanded delivery and hub services.
- Additional commerce integrations.
- New countries, currencies and local payment methods.

These extensions should be prioritised only when demand, technical readiness and operating capacity justify them.

## 9. Product Readiness and Validation

Product readiness must be tracked with explicit evidence. Use these labels:

- **Verified:** demonstrated by repeatable tests or live operational evidence.
- **In progress:** implementation exists but is incomplete or not fully validated.
- **Planned:** approved product direction not yet implemented.
- **Proposed:** an option under consideration, not yet approved.
- **Blocked:** cannot proceed until a named dependency is resolved.

Before a public marketplace launch, the team should demonstrate at minimum:

- Customer registration, sign-in and account recovery.
- Seller application, approval and secure seller data handling.
- Product submission, review and public publication.
- Product visibility restricted to approved stores and published listings.
- A customer checkout involving products from multiple sellers.
- Correct parent-order and seller-package creation.
- Seller A cannot access Seller B's orders, drafts, earnings or customer data.
- Server-side price and stock validation.
- Payment confirmation through a verified provider event.
- Order status, delivery handover and proof-of-delivery handling.
- Refund, cancellation and failed-payment behaviour.
- Admin permissions and audit records.
- Mobile performance, accessibility and error-state testing.

A successful build, static check, interface preview or database migration is not a substitute for these end-to-end tests.

## 10. Current Evidence and Known Gaps

This overview was prepared from the `web-portal` branch, including the README, company profile, master roadmap, seller portal, admin interface, marketing homepage, shared Supabase client/configuration and Netlify build configuration.

The root README describes an older Android app roadmap and contains instructions that may not match the current web portal. It should be reconciled with the active product architecture before it is used as authoritative product documentation.

The inspected branch establishes that seller and admin interface code exists. It does not, by itself, establish:

- That the current customer app is complete or released.
- That all seller/admin workflows work against production data.
- That the relevant SQL functions and policies have been applied to the active Supabase project.
- That row-level security has passed adversarial tests.
- That Paystack payment and webhook flows work end to end.
- That multi-seller checkout and parent-order tracking are operational.
- That a physical hub, delivery partner network or live delivery coverage is in place.
- That Everneed has launched publicly or achieved commercial traction.

These are explicit validation tasks, not assumed capabilities.

## 11. Product Direction

Everneed should become a dependable place where customers can shop across independent businesses and sellers can run their digital stores with less friction.

The product should earn trust through clear seller identity, reliable catalogue information, secure transactions and fulfilment that matches what the platform promises.

**Build the marketplace. Prove the experience. Expand the ecosystem.**
