# Everneed Advertising Database Reconciliation and Build Plan

**Status:** Reconciliation blueprint — no schema changes  
**Date:** 2026-11-15  
**Branch:** `web-portal`  
**Database reviewed:** `Everneed-staging` (`vjiadqygpyebpisxslbx`)  
**Production:** No access or changes performed  
**Owner decisions:** hybrid wallet + campaign-specific funding; CPC + CPM; regional targeting + automatic expansion; balanced sponsored/organic inventory.

## 1. Purpose and decision

This document translates `INTELLIGENCE_ADVERTISING_DATA_ARCHITECTURE.md` into a staged database/API build plan based on the current staging schema. It identifies existing canonical entities, what must be reused, what is missing, and the dependencies that must be completed before campaign billing is enabled.

**Do not create advertising tables or enable campaign charges until the payment lifecycle and double-entry journal foundations are ready.** The next migration number is provisionally 026; recheck the staging migration history and repository filenames immediately before creating each migration.

## 2. Environment and schema facts verified

Read-only inspection on 2026-11-15 confirmed:

- Staging migration history ends at `025_storefront_details_seller_grant`; no 026 migration is applied.
- Staging project is `Everneed-staging`, ref `vjiadqygpyebpisxslbx`.
- Production remains separate. The environment contract says production project ref is `zpgasfweaixwsktlueje`; never use it for staging work.
- Existing canonical tables include `profiles`, `stores`, `products`, `orders`, `order_items`, `seller_orders`, `store_plans`, `store_subscriptions`, `ledger_entries`, `refunds`, `disputes`, `banners`, `seller_verification_rules`, and `store_verification_checks`.
- Existing product IDs and store IDs are text, not UUID. Orders and seller orders are also text IDs. New foreign keys must match those actual types.
- Product catalog fields include `products.status`, `products.store_id`, `products.col` (category-like legacy field), `products.price`, `products.stock`, `products.cty` (country array), and `products.search`. Do not assume conventional column names such as `category_id`, `active`, or `inventory_quantity` exist.
- Store geography currently uses `stores.country`, `stores.state`, and `stores.city`; these are text fields, not normalized region foreign keys.
- Existing `banners` are simple platform-managed promotional content with priority, text, scope, dates, countries, link and image. They are not a seller self-service advertising system and must not be repurposed as campaign, billing, impression or click records.
- `ledger_entries` is the existing seller subledger: amount is numeric, currency defaults to NGN, and entries refer to store/order/seller-order/kind/status. It is not a balanced double-entry journal.
- `store_plans` has price, period, product_limit, commission_discount and JSONB features. `store_subscriptions.plan_id` is nullable. Existing paid tiers and limits must remain unchanged.
- No existing `payment_attempts`, `finance_accounts`, or `finance_postings` tables were found in the audited staging schema.
- Staging has minimal commerce fixture data. Do not use empty-table observations as proof that production behaviour is safe.

## 3. Reuse map: canonical entities

| Advertising concept | Canonical existing entity | Reconciliation |
|---|---|---|
| Advertiser identity | `stores.id`, `stores.owner_id` | Campaign belongs to a store; derive owner from authenticated identity and store ownership. |
| Advertised product | `products.id`, `products.store_id` | FK uses text product/store IDs. Eligibility reads current status, stock, country and category fields through catalog-owned logic. |
| Seller subscription | `store_subscriptions` + `store_plans` | Resolve advertising entitlement server-side. Null plan is unresolved, not Free or unlimited. |
| Store operational state | `stores.status` + `stores.activation_status` | Current state model needs reconciliation; never infer live from application approval alone. |
| Geographic origin | `stores.country/state/city` | Transitional source only. Add canonical region hierarchy and a mapping strategy; do not silently treat free-text values as canonical IDs. |
| Customer identity | `auth.users.id` / `profiles.id` | Behavioural features must be pseudonymous/minimised and access restricted. |
| Commerce attribution | `orders.id`, `order_items.id`, `seller_orders.id` | Attribute only to valid order items and eligible ad touchpoints. A multi-seller order must not credit every campaign with the whole parent-order value. |
| Refund/return adjustment | `refunds`, `disputes` | Reconcile conversion reporting after confirmed refund/cancellation; do not rewrite original click/impression facts. |
| Existing promotional content | `banners` | Keep for platform-curated banners. Do not overload it with seller ad campaigns. |
| Existing seller earnings | `ledger_entries` | Preserve compatibility and history. Do not use it as the advertising wallet or double-entry journal. |

## 4. Required new bounded contexts and tables

The following are logical table families, not a final migration SQL listing. Exact names, types, constraints, indexes, RLS and grants are to be finalised after reviewing the repository migrations, triggers, and RPC callers.

### 4.1 Event and telemetry foundation

- `private.event_outbox`: events emitted transactionally by trusted domain mutations.
- `private.event_consumer_receipts`: idempotency receipt per consumer and event.
- `private.client_telemetry_inbox`: allowlisted, rate-limited client behaviour events; explicitly lower trust than server domain events.
- `private.event_dead_letters`: bounded retry exhaustion and operator review.

Common event envelope: event UUID, versioned type, occurred/recorded timestamps, actor type and pseudonymous actor/session key, region ID where permitted, entity type/ID, correlation ID, source trust class, schema version, minimal JSON payload. No credentials, bank details, raw identity documents or payment card data.

The outbox must not be a generic client-write table. Critical events (payment settled, order created, delivery completed, campaign spend posted) originate from the authoritative domain transaction. Client telemetry cannot assert payment, purchase, delivery, or billable ad events.

### 4.2 Region directory

- `public.regions`: stable region ID, ISO country code, parent region, region type, canonical name, active state.
- `public.region_aliases`: alternative spellings/legacy labels mapped to one region.
- `public.delivery_region_coverage` (or a compatible extension of an existing delivery coverage model): serviceability by store/product and destination region.

Campaign targeting references region IDs. Keep ad targeting and delivery serviceability separate: targeting is a marketing choice; serviceability is a fulfilment truth. Automatic expansion may only expand within seller-approved country/region boundaries and the campaign's delivery/awareness mode.

### 4.3 Advertising configuration and campaign domain

- `public.ad_placements`: controlled placement keys, surface, sponsored-share ceiling, consecutive-slot limit, frequency policy and active state.
- `public.ad_campaigns`: store ID, objective, lifecycle status, schedule, currency, total/daily caps, funding mode, targeting mode, created-by and timestamps.
- `public.ad_campaign_versions`: immutable live configuration snapshots, pricing model, bid, targeting snapshot, creative snapshot and version.
- `public.ad_campaign_products`: campaign-to-product membership; product/store ownership must match campaign store.
- `public.ad_creatives`: creative asset key, text, destination, moderation status and immutable version.
- `public.ad_target_rules`: include/exclude rules referencing normalized region/category identifiers and explicit automatic-expansion boundaries.
- `public.ad_campaign_state_events`: append-only transition history with reason, actor and source.

Draft edits may update a draft. Once a version is submitted/active, pricing, budget, targeting and creative terms become immutable for that version. Material changes create a new version and seller acceptance.

### 4.4 Delivery, attribution and quality

- `private.ad_delivery_decisions`: request/candidate decision, placement, score version and reason code.
- `private.ad_impressions`: validated server-issued impression IDs, campaign/ad/version/placement/region and viewability state.
- `private.ad_clicks`: validated click records tied to a prior impression where the placement supports it.
- `private.ad_billable_events`: unique, validated CPC/CPM chargeable event records with immutable pricing-rule version and amount.
- `private.ad_attribution_touches`: eligible touchpoints linked to order and order item.
- `private.ad_conversions`: attributed order-item outcomes and later adjustment state.
- `private.ad_fraud_signals`: abuse evidence and decision references.

Do not trust client-reported billable impressions/clicks. A click endpoint validates the signed/opaque impression token, campaign state, frequency limits, event uniqueness and invalid-traffic checks. CPM must define viewability before charging. Partition/expire high-volume raw event tables and retain aggregate reporting according to a documented privacy schedule.

### 4.5 Funding and accounting

Seller-facing objects:
- `public.ad_wallets`: one wallet per store and currency (or one per store/currency pair); status only, not a mutable balance source.
- `public.ad_funding_attempts`: immutable provider attempt identity, amount/currency, provider reference, idempotency key and lifecycle.
- `public.ad_campaign_funding`: records campaign-specific funding allocation/checkout and links it to the same payment-attempt mechanism.
- `public.ad_budget_reservations`: concurrency-safe campaign allocation of wallet/campaign prepaid funds; reservations are not revenue and do not themselves create spend.
- `public.ad_invoices` / `public.ad_receipts`: seller-readable billing documents and references.

Private financial records:
- `private.ad_ledger_dimensions` or account references into the shared finance chart of accounts.
- `private.ad_spend_postings`: source references to balanced journal transactions; no independent mutable balance.
- `private.ad_refund_adjustments`: audited reversal/credit workflow tied to original funding or spend and provider result.

**Do not implement a second ad-only financial ledger.** The advertising module must post through the shared double-entry journal introduced by the finance foundation. Advertising wallet available/reserved/spent figures are projections over posted journal entries plus active reservations, reconciled against the journal.

Illustrative accounting flow, subject to finance review:
1. Wallet funding confirmed: debit provider clearing asset; credit seller advertising-wallet liability.
2. Campaign-specific funding confirmed: debit provider clearing asset; credit campaign prepaid liability.
3. Budget reservation: allocate liability to campaign reservation subledger; no revenue recognition.
4. Valid CPC/CPM delivery: debit applicable prepaid liability; credit deferred advertising revenue.
5. Revenue recognition under the accounting policy: debit deferred advertising revenue; credit advertising revenue.
6. Confirmed refund/reversal: post balanced reversal entries; never edit/delete the original journal transaction.

Every posting is balanced per currency. Never net NGN and another currency in one journal transaction. FX conversion requires immutable quote/rate/source/time and explicit clearing/rounding accounts. Final account mapping, tax treatment and revenue recognition policy require finance review before live billing.

## 5. API ownership and contracts

All APIs are authenticated and versioned. Client-supplied owner IDs, balances, spend, impression counts, ranking scores, product eligibility, and payment state are never authoritative.

### Seller
- `POST /api/v1/seller/ad-campaigns` — create draft for an owned store.
- `GET /api/v1/seller/ad-campaigns` — list only campaigns for owned stores.
- `GET /api/v1/seller/ad-campaigns/{id}` — campaign, active version, eligibility reasons and budget summary.
- `PATCH /api/v1/seller/ad-campaigns/{id}` — draft-only changes; active changes create a new version.
- `POST /api/v1/seller/ad-campaigns/{id}/submit` — server-side validation and eligibility.
- `POST /api/v1/seller/ad-campaigns/{id}/pause|resume|cancel` — audited state transition; resume re-evaluates all conditions.
- `GET /api/v1/seller/ad-campaigns/{id}/report` — privacy-safe campaign aggregates and attribution caveats.
- `GET /api/v1/seller/ad-wallet` — currency-specific available/reserved/pending projections.
- `POST /api/v1/seller/ad-wallet/fund` — idempotent provider funding attempt.
- `POST /api/v1/seller/ad-campaigns/{id}/fund` — campaign-specific funding attempt.
- `GET /api/v1/seller/ad-transactions` — seller-scoped ledger-backed transactions.

### Buyer/discovery
- `GET /api/v1/discovery/home` — organic recommendations plus separately identified sponsored modules.
- `GET /api/v1/discovery/search` — organic result set and eligible sponsored slots, separately represented.
- `GET /api/v1/products/{id}/related` — related/complementary organic recommendations.
- `POST /api/v1/telemetry/events` — allowlisted, rate-limited client telemetry only.

### Internal workers
- Claim/publish outbox events with lease/visibility timeout.
- Process events idempotently per consumer.
- Recompute aggregates using watermarks and replay-safe upserts.
- Validate and bill eligible ad events through a single posting service.
- Reconcile funding/provider references and journal projections.

### Admin
- `GET /api/v1/admin/advertising/overview` — aggregate KPIs and exceptions.
- `GET /api/v1/admin/advertising/campaigns` — searchable campaign registry.
- `GET /api/v1/admin/advertising/campaigns/{id}` — campaign, version, funding, delivery and audit detail.
- `POST /api/v1/admin/advertising/campaigns/{id}/hold` and `/release` — privileged emergency actions with mandatory reason and audit.
- `GET /api/v1/admin/advertising/transactions` — funding, spend, refund and reconciliation views.
- `GET /api/v1/admin/advertising/regions` — aggregated regional reporting.
- `GET /api/v1/admin/advertising/audit` — immutable administrative action history.

Admin dashboards are read models. Routine campaigns are self-service; admins handle exceptions, fraud, appeals, disputes and policy configuration. No dashboard should write directly to a wallet balance.

## 6. API response and security contract

- Stable IDs, ISO timestamps, explicit currency, pagination cursors and structured reason codes.
- Suggested errors: `CAMPAIGN_NOT_ELIGIBLE`, `INSUFFICIENT_AD_FUNDS`, `PRODUCT_UNAVAILABLE`, `REGION_NOT_SERVICEABLE`, `CAMPAIGN_BUDGET_EXHAUSTED`, `IDEMPOTENCY_CONFLICT`, `CAMPAIGN_VERSION_IMMUTABLE`.
- RLS enabled on exposed tables; private event/financial tables live in non-exposed schemas with no browser grants.
- SECURITY DEFINER only when justified, with pinned search_path, explicit auth/role checks and minimal execute grants.
- Seller queries derive store ownership from authenticated identity and server-side store membership.
- Admin operations require explicit permissions and immutable actor/reason records.
- Views exposed through the Data API must use security-invoker semantics where supported, or remain private.
- Telemetry is minimised, rate-limited, allowlisted and retention-bound. No sensitive-attribute targeting. Precise GPS is not required by default.
- Recommendations and ads fail closed independently. If ad delivery fails, organic discovery continues; checkout never depends on intelligence services.

## 7. Dependency graph and migration sequence

The following order is recommended. Numbers after 026 are provisional and must be reconciled against actual repository filenames and staging migration history.

| Order | Workstream | Why it precedes advertising |
|---|---|---|
| 026 | Payment attempts, immutable checkout snapshots, webhook inbox and reconciliation | Both wallet and campaign-specific funding need reliable provider settlement. |
| 027 | Shared double-entry journal and legacy seller-ledger bridge | Advertising wallet liabilities, revenue and reversals must use one accounting authority. |
| 028 | Provider refund lifecycle and allocation caps | Funding reversals, campaign credits and chargebacks need correct refund semantics. |
| 029–030 | Consignment/delivery proof and payout eligibility | Commerce conversion attribution needs reliable order/delivery/refund outcomes; this may proceed in parallel with non-billing ad discovery. |
| 031 | Entitlement/plan representation and advertising entitlement | Campaign creation must respect seller plan, store operation and policy; preserve current paid plan prices/limits. |
| 032 | Event outbox, telemetry inbox, consumer receipts and region directory | Establish reliable, replayable signals and canonical targeting geography. |
| 033 | Campaign, creative, targeting and placement configuration | Seller self-service campaign lifecycle with no billing activation yet. |
| 034 | Wallet/funding, budget reservation and shared-journal integration | Enable test-mode funding and budget safety. |
| 035 | Impression/click validation, CPC/CPM billable events and delivery decisions | Enable controlled ad delivery and charging in staging. |
| 036 | Attribution, conversion reporting, seller insights and admin read models | Complete end-to-end measurement and operations. |
| 037+ | Ranking experiments, ML features, model registry and scalable event/search adapters | Improve intelligence after reliable baseline data exists. |

Non-billing discovery can be developed while finance foundations progress, but no paid campaign may activate until 026–027 and the applicable refund/reconciliation gates are complete. No live billing until all relevant staging gates pass and the owner explicitly approves production release.

## 8. Staging acceptance tests

### Ownership and eligibility
- Seller A cannot create, read, edit, fund or report on Seller B's campaign.
- Campaign product must belong to the campaign's store.
- Draft campaign cannot serve ads.
- Unapproved, suspended or non-live store cannot serve ads.
- Product pending review, rejected, archived, out of stock or policy-blocked cannot serve ads.
- Null-plan subscription does not silently gain promotion entitlement.
- Subscription downgrade/expiry follows explicit effective-entitlement policy.

### Funding and journal
- Duplicate funding request with same idempotency key returns the same attempt.
- Duplicate provider webhook funds wallet once.
- Wrong owner, amount, currency or provider reference is rejected.
- Campaign-specific payment cannot credit a different campaign.
- Concurrent campaign reservations cannot overspend wallet or campaign funding.
- CPC and CPM billable events are deduplicated.
- Invalid click/viewability event is not billed.
- Budget exhaustion pauses serving within a documented bounded overspend tolerance.
- Every financial transaction balances per currency.
- Refund, chargeback and reversal do not mutate original postings.
- Wallet projection reconciles exactly to journal liability and active reservations.

### Delivery, privacy and ranking
- Region expansion never exceeds seller-approved country/region boundaries.
- Product is not advertised where delivery is unavailable unless campaign is explicitly awareness-only.
- Sponsored result is labelled and ad/campaign IDs are traceable.
- Organic results remain available when ad service times out.
- Sponsored share, consecutive placement and frequency caps are enforced.
- No sensitive personal attributes are used for targeting.
- User opt-out/reset controls are respected.
- Buyer identity and seller-private metrics are not exposed across tenants.

### Operations and analytics
- Admin dashboard updates from authoritative records without manual data entry.
- Admin hold/release records actor, reason, timestamp and before/after state.
- Outbox retry and dead-letter replay do not duplicate spend or conversion.
- Aggregates can be rebuilt from retained events and source watermarks.
- Low sample sizes are labelled as insufficient evidence rather than confident seller advice.

## 9. Explicit non-goals for the first release

- No Kafka/Kubernetes/microservice fleet before measured need.
- No autonomous AI price, stock, refund, transfer or budget changes.
- No CPA billing until attribution and refund controls are proven.
- No precise GPS requirement.
- No paid ranking override of relevance/safety.
- No reuse of `banners` as ad campaigns.
- No separate mutable wallet balance or ad-only accounting ledger.
- No production schema, campaign, billing or payment changes.

## 10. Next engineering action

1. Review the repository's actual migrations and current database function/trigger definitions for finance, Paystack, stores, products, plans and order item attribution.
2. Produce the shared finance chart-of-accounts and posting contract for 027, including currency and FX treatment.
3. Finalise entitlement source-of-truth and the seller advertising entitlement key without inventing Free plan limits.
4. Only then draft migration 026 using the Supabase CLI migration workflow; apply to staging after review, never to production automatically.
