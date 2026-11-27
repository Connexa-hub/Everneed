# EVERNEED
## Product Implementation & Readiness Status

> **Historical readiness snapshot (11 Nov 2026).** Use `docs/WORKFLOW/REPOSITORY_AND_PRODUCT_AUDIT_2026-11-12.md` and `docs/WORKFLOW/WEBSITE_TRACKER.md` for newer repository, deployment and environment evidence. This document remains useful for its feature-by-feature readiness analysis.

**Document type:** Internal implementation status register  
**Document status:** Working record; update after each material product release  
**Project reference branch:** `web-portal`  
**Repository:** `Connexa-hub/Everneed`  
**Review date:** 11 November 2026  
**Business status:** Founder-led startup; not yet registered with Nigeria's Corporate Affairs Commission (CAC)

---

## 1. Purpose and Evidence Standard

This document separates what is present in the repository from what has been tested, deployed or proven in real operations. It is not a launch announcement.

The review uses the `web-portal` branch and the files visible there on the review date. It is a source-code and configuration review, not a live penetration test, production database inspection, payment test, customer transaction or physical operations audit.

### Status definitions

| Status | Meaning |
|---|---|
| **Implemented in code** | Relevant code, schema or configuration is present in the reviewed branch. This does not automatically mean it works in production. |
| **Partially implemented** | Some required components exist, but the complete workflow or its dependencies are not verified. |
| **In progress / needs verification** | There is a clear implementation path or supporting code, but important evidence is missing. |
| **Planned** | A product requirement or roadmap item, not yet established as a working capability. |
| **Blocked / decision required** | Progress depends on a missing external setup, founder decision, policy, partner, legal input or operational capability. |
| **Not verified** | The repository review cannot establish deployment, configuration, security, reliability or real-world operation. |

A migration file is not proof that a migration has been applied. An Edge Function is not proof that it is deployed with correct secrets. A UI is not proof that its backend workflow is secure or complete. A test file is not proof that the test has passed in the current CI run.

---

## 2. Executive Status

Everneed has a substantial codebase covering an Android commerce application, a public web experience, a seller portal, an admin console, Supabase schema and server functions, and a Paystack integration path.

The reviewed branch contains meaningful implementation for product discovery and shopping in the app code, seller onboarding and catalogue management in the web portal, administration and review interfaces, and a marketplace-oriented database model.

However, the review does **not** establish that the full product is deployed and ready for public commerce. In particular, live database migration state, production RLS behaviour, the complete multi-seller order journey, live Paystack settlement, operational fulfilment, seller payouts, and a real customer-to-delivery journey remain to be evidenced.

**Current overall assessment: Product foundation substantially implemented; production and operational readiness not yet verified.**

---

## 3. Implemented in the Reviewed Codebase

### 3.1 Android customer application foundation

The repository contains a Capacitor-based Android application with browser-side modules for the customer experience.

Observed implementation includes:

- Home and product discovery flows.
- Product detail pages, image galleries and product information.
- Cart and checkout-related interfaces.
- Customer account and profile handling.
- Order views and order tracking interfaces.
- Product options, size selection and size-guide functionality in the product modules.
- Country and currency configuration, including NGN, GHS, KES, ZAR, GBP and USD display paths.
- Theme and appearance support.
- Payment-provider registration, including bank transfer, WhatsApp and Paystack-related paths.
- Local application state and Supabase client integration.

**Qualification:** Source files demonstrate implementation work, not a verified production release. The full customer journey must be exercised on a real device against the intended live backend, including account creation, catalogue visibility, cart persistence, checkout, payment confirmation, order updates and error handling.

### 3.2 Public website

The `web/` directory contains the public website experience, shared visual assets and browser scripts.

Observed implementation includes:

- Marketing homepage and product explanation.
- Navigation and seller calls to action.
- Public information and FAQ content.
- Links into account and seller portal routes.
- Shared theme, typography and design assets.
- Supabase-backed waitlist integration code.

The website is currently hosted through Cloudflare Pages, with production from `main` and preview builds from `web-portal`. The static site packaging workflow copies the required shared assets into the published directory.

**Qualification:** Repository configuration does not prove that every route, domain, environment, authentication flow or form works in production.

### 3.3 Seller portal

The reviewed `web/assets/js/portal.js` contains seller-facing functionality.

Observed implementation includes:

- Signed-in seller portal access.
- Store record loading and dashboard state.
- Five-step store application flow:
  1. Store identity.
  2. Business information and location.
  3. Delivery preferences.
  4. Payout information.
  5. Business confirmation.
- Store description, logo, cover, categories and location inputs.
- Pickup and direct-delivery preference fields.
- Product creation and editing.
- Product image upload path.
- Product draft, submission, archive and restore paths.
- Product review states and seller-facing review notes.
- Seller notifications and dashboard summaries.

**Qualification:** The portal calls Supabase tables, Storage and RPC functions. Live persistence, seller ownership isolation, upload restrictions, form validation, notification delivery and the complete application decision lifecycle still require tests against the deployed project.

### 3.4 Admin console

The reviewed `web/assets/js/admin.js` contains an administration interface.

Observed implementation includes:

- Store application review queue.
- Store listing and status views.
- Product review queue.
- Product publish and return-for-changes actions.
- Store approval, rejection, suspension and reinstatement paths.
- Waitlist viewing and CSV export code.
- Calls to database functions for decisions.

The admin code is designed to rely on backend permission checks rather than treating hidden UI controls as security.

**Qualification:** Admin access control, RPC grants, audit-log completeness, notification delivery and protection against privilege escalation must be tested against the live database. A button or RPC call in the frontend is not proof that the backend rejects unauthorised users.

### 3.5 Messaging and support interface

The reviewed `web/assets/js/inbox.js` contains messaging and support interface code for buyers, sellers and administrators, including conversation categories, unread state and support-rule controls.

**Qualification:** Real-time behaviour, message persistence, attachment handling if enabled, access boundaries, support response timing and notifications need end-to-end verification.

### 3.6 Marketplace database and backend foundation

The repository contains a sequence of Supabase migrations and marketplace functions. The reviewed migration files include:

- `000_baseline.sql`
- `001_remove_cj.sql`
- `002_hotfix.sql`
- `003_remove_unrecorded_multivendor.sql`
- `004_marketplace_core.sql`
- `005_marketplace_backfill_guards.sql`
- `006_marketplace_rls.sql`
- `007_marketplace_functions.sql`
- `008_hardening.sql`
- `009_profile_settings.sql`

The marketplace schema and data-model documentation describe stores, private seller information, store applications, subscriptions, products, parent orders, seller orders, order items, deliveries, ledger entries, payouts, refunds, disputes, notifications and audit records.

The SQL function layer includes paths for order creation, seller order transitions, hub receipt and consolidation, dispatch, delivery confirmation, refunds, earnings release, rental handling, store review and payout recording.

**Qualification:** These files establish a version-controlled implementation design. They do not establish which migrations are currently applied to the connected Supabase project, whether the live schema matches the branch, whether all functions compile and behave correctly in production, or whether scheduled jobs and secrets are configured.

---

## 4. Partially Implemented / Needs Verification

| Capability | Evidence in branch | What remains to prove |
|---|---|---|
| Customer authentication and profiles | App authentication code and Supabase client/profile access | Sign-up, sign-in, recovery, session expiry, role handling and account deletion on production |
| Public catalogue | App product modules, Supabase data access and public database views | Correct live data, anonymous access rules, pagination/performance and seller attribution |
| Seller onboarding | Five-step portal and store/application tables | Real submission, document privacy, admin decision, seller notification and secure status transitions |
| Product listing and moderation | Seller product forms, image upload and admin review actions | Ownership enforcement, file validation, moderation rules and published visibility |
| Admin permissions | Admin interface and protected database function design | Tests proving non-admin users cannot invoke privileged actions directly |
| Payments | Paystack Edge Function with server-side pricing and webhook signature verification code | Deployment, secrets, provider configuration, real test transactions, webhook retries, idempotency and reconciliation |
| Order creation | Paystack function calls the database order-creation function; SQL defines parent and seller order handling | Full multi-seller checkout, stock reservation, correct seller package creation and failure recovery |
| Order tracking | App tracking interface and database functions are present | Customer and seller state transitions, accurate tracking and live notifications |
| Messaging/support | Inbox interface and supporting data access | Real-user isolation, realtime reliability, operational support process and notification behaviour |
| Delivery/hub workflow | Schema and server functions include direct/hub delivery concepts | A real hub or collection point, operating procedures, custody records, courier integration, proof of delivery and returns |
| Seller earnings and payouts | Ledger and payout structures and SQL functions are present | Verified accounting, scheduled releases, payment execution, reconciliation and seller-facing statements |
| Store subscriptions/rentals | Store plan, subscription and payment structures are present | Approved plans/prices, payment lifecycle, renewal, grace period, expiry and seller communication |
| Waitlist | Website code and `shared/sql/011_website_sync.sql` | SQL is explicitly marked NOT auto-run; review and deliberate application are required before treating it as live |
| Website deployment | Cloudflare Pages packaging and GitHub branch integration | Confirm each deployment, domain, environment and form behaviour |

---

## 5. Planned Product and Operational Capabilities

The following remain product goals unless a later status review records implementation and test evidence:

### 5.1 Complete multi-seller customer journey

The intended customer experience is one shopping journey and one customer-facing parent order, with seller-specific packages beneath it. The customer should be able to see the overall order and each package's status.

Acceptance evidence required:

- A customer buys from at least three independent stores in one checkout.
- One parent order is created with the correct seller packages and order items.
- Each seller can access only their own package and necessary customer fulfilment information.
- A seller cannot read another seller's orders, private products, earnings or customer records.
- Payment confirmation, stock reservation, commission and seller earnings reconcile correctly.
- Cancellation, partial fulfilment, refund and delivery exceptions behave predictably.

### 5.2 Hub-supported fulfilment

The operating model envisages sellers preparing their own items, handing packages to an Everneed hub or designated collection point, and Everneed coordinating receipt, checking, consolidation, packaging and onward delivery where practical.

This is an operating plan, not evidence that a physical hub, staff, courier network, delivery coverage or service-level agreement is currently in place.

Acceptance evidence required:

- A selected pilot area and documented service coverage.
- Confirmed hub or collection-point arrangements.
- Receiving, package identification, custody, discrepancy and handover procedures.
- Consolidation and separate-parcel rules.
- Courier/driver assignment, delivery proof, failed-delivery and returns procedures.
- Cost tracking and customer support escalation.

### 5.3 Commercial operations

Planned capabilities include seller subscription/rental administration, commission accounting, earnings release, payouts, refunds and dispute handling.

Before commercial launch, Everneed must approve the actual commercial terms, test the complete money flow and establish reconciled records. No unapproved commission rate, seller subscription price, payout timeline or delivery tariff should be represented as final.

### 5.4 Growth and wider ecosystem

Seller acquisition, promoted listings, advertising, business services, additional integrations and expansion beyond the first validated market are roadmap items. They should not be treated as active services until their product, commercial, compliance and operational requirements are met.

---

## 6. Technical and Release Readiness

### 6.1 Build and CI

The repository contains a GitHub Actions workflow at `.github/workflows/build.yml`.

Observed workflow configuration includes:

- Install and test job.
- Node-based static checks through `npm test`.
- Design-token freshness check.
- A database-test job that starts a local Supabase stack.
- Android build and APK/release artifact steps.

The database-test job is explicitly configured with `continue-on-error: true` and its SQL report is piped through a command that tolerates an initial command failure before checking the report. Therefore, the workflow configuration must not be described as a strict database release gate.

**Current result:** This source review did not retrieve a current successful workflow run for the reviewed branch. CI pass status is therefore **not verified by this document**.

### 6.2 Database migration control

The migration sequence is present in the repository. The website waitlist SQL at `shared/sql/011_website_sync.sql` is explicitly marked as not auto-run.

Required actions:

- Compare the connected Supabase schema with the exact migration sequence on `web-portal`.
- Confirm which migrations have been applied and in what order.
- Back up production data before any corrective or destructive migration.
- Apply pending migrations through a controlled process.
- Run the SQL test suite against a clean local database and the intended staging environment.
- Keep a record of the production migration version.

### 6.3 Security and privacy

Security-sensitive areas requiring release evidence include:

- Row Level Security (RLS) on every exposed table.
- Seller-to-seller isolation.
- Admin-only actions enforced server-side.
- Private seller, payout and identity information.
- Storage bucket access and upload restrictions.
- Payment webhook signature verification and idempotency.
- Server-side price, discount, stock and order validation.
- Session and token handling.
- Safe rendering of user-supplied text.
- Privacy policy, terms, seller agreement and data deletion.
- Secrets stored only in approved server-side secret storage.

The migration files include RLS and hardening work. This document does not certify that the live database has passed a security review.

### 6.4 Documentation accuracy

The root `README.md` still describes an earlier single-store/staged app setup and refers to older setup and payment instructions. It does not accurately serve as the sole setup and operating guide for the current marketplace/web-portal architecture.

A coordinated README and deployment-guide update is required before external contributors or operators rely on it.

---

## 7. Release Gates

Everneed should not move from internal development to public transactions merely because the interface is complete or an APK can be built.

| Gate | Required evidence | Current assessment |
|---|---|---|
| Product baseline | Reviewed build, documented scope and known issues | Partially evidenced in repository |
| Backend baseline | Live schema matches reviewed migrations; backups and migration record exist | Not verified |
| Security baseline | RLS, role and seller-isolation tests pass against staging | Not verified |
| Seller pilot | Real sellers can apply, receive decisions and publish approved listings | Not verified |
| Customer journey | Real customer can browse, purchase and view order status on a supported device | Not verified end to end |
| Payment integrity | Test payment, signed webhook, duplicate webhook and reconciliation tests pass | Not verified |
| Multi-seller integrity | Three-seller order creates correct parent order and seller packages | Not verified end to end |
| Fulfilment pilot | Hub/collection and delivery operations are staffed, documented and tested | Planned / not verified |
| Support readiness | Customer and seller support channels, ownership and escalation are operational | Partially implemented in interface; operations not verified |
| Commercial readiness | Seller terms, fees, payout and refund rules approved and tested | Founder decisions and validation required |
| Public launch | All critical gates passed, monitored pilot and rollback plan ready | Not yet established |

---

## 8. Priority Work Queue

The following sequence is recommended to turn repository implementation into verified product capability.

### P0 — Establish a trustworthy baseline

1. Confirm that `web-portal` is the intended source branch for the next release.
2. Record the latest commit and successful/failed GitHub Actions runs.
3. Reconcile the live Supabase schema with migrations `000`–`009`.
4. Review the database test workflow and make critical database failures blocking.
5. Update the root README to describe the current architecture and correct setup process.
6. Confirm production and staging environments, secrets ownership and backup/rollback procedure.

### P1 — Prove the core marketplace

1. Test customer, seller and admin authentication and role boundaries.
2. Test store application submission and admin approval.
3. Test product submission, review, publication and seller ownership.
4. Run RLS tests proving sellers cannot access one another's private records.
5. Execute a complete customer order journey in staging.
6. Execute a multi-seller checkout and verify parent order, seller packages, stock and ledger.
7. Test Paystack initiation, signed webhook, duplicate delivery, verification and reconciliation.

### P2 — Prove operations and commercial controls

1. Select a limited pilot market and service boundary.
2. Confirm the hub/collection-point and delivery-partner model.
3. Run receiving, consolidation, dispatch, delivery, failed-delivery and returns simulations.
4. Approve seller fees, commission, payout holding period and refund policy.
5. Test seller earnings and payout reconciliation.
6. Establish customer support ownership and incident response.

### P3 — Controlled pilot and growth

1. Onboard a small group of real sellers.
2. Publish a quality-checked catalogue.
3. Invite a controlled group of customers.
4. Monitor conversion, successful payment, fulfilment time, cancellation, returns and support issues.
5. Fix operational bottlenecks before increasing marketing or geographic coverage.

---

## 9. Evidence Register to Maintain

Every future status update should record evidence rather than rely on memory or assumptions.

| Evidence item | What to record |
|---|---|
| Source version | Branch, commit SHA and review date |
| Build | Workflow run URL, result and APK version |
| Database | Migration versions applied in staging and production |
| Tests | Exact test command, environment, result and known exclusions |
| Security | RLS and role-isolation test results |
| Seller journey | Test seller, application result and product publication result |
| Customer journey | Device, test account, order reference and observed outcome |
| Payments | Provider test reference, webhook result and reconciliation |
| Fulfilment | Pilot location, partner, process test and exceptions |
| Operations | Support coverage, incident log and unresolved issues |

Do not place customer identity documents, payment credentials, private keys, access tokens or other secrets in this document or the repository.

---

## 10. Current Founder-Level Decisions

The following decisions or confirmations are still needed before launch claims can be made:

- Confirm the first pilot city, neighbourhoods and delivery boundary.
- Confirm whether an Everneed hub/collection point will be operated directly or through a partner.
- Approve seller subscription and commission terms after unit-economics review.
- Approve payout timing, refund rules and customer support commitments.
- Confirm the legal and compliance path before onboarding sellers and processing public transactions.
- Confirm production deployment, database migration state and payment-provider readiness.

These are decisions and validation tasks, not assumptions to be filled with invented values.

---

## 11. Status Summary

**Implemented in code:** Android customer application modules, public website, seller portal, admin console, messaging interface, Supabase client and marketplace schema/function files, Paystack integration code, and GitHub build workflow.

**Partially implemented:** Customer and seller workflows, moderation, messaging, order/payment paths, marketplace controls and delivery-related backend structures.

**Planned or not verified:** A proven multi-seller live transaction, production-safe end-to-end payment settlement, a functioning physical hub and delivery network, reconciled seller payouts, operational customer support, and a controlled public launch.

**Overall:** Everneed has a meaningful technical foundation. The next milestone is not simply adding more screens; it is proving the critical customer, seller, payment, security and fulfilment journeys in a controlled staging and pilot environment.

---

*Internal working document. Update this register when implementation, deployment or test evidence changes. Do not use it as a public capability statement without a fresh verification pass.*
