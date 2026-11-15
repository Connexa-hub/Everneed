# Everneed Intelligence, Advertising and Data Architecture

**Status:** Architecture proposal — not an implementation migration  
**Date:** 2026-11-15  
**Target branch:** `web-portal`  
**Production:** No changes authorised or performed  
**Staging:** Design target only; implementation must be reviewed and tested in the staging Supabase project  
**Decisions confirmed by owner:**
- Seller promotion payments: hybrid prepaid wallet and individual campaign payments.
- Promotion pricing: hybrid CPC and CPM initially, with conversion-based pricing considered later.
- Targeting: explicit regional/location targeting plus automatic audience expansion.
- Sponsored placement: balanced; relevant sponsored inventory is limited and organic relevance is protected.

## 1. Executive architecture decision

Build Everneed as a **modular marketplace application with an event-driven intelligence layer**, not as a collection of premature microservices.

The initial deployment remains compatible with the existing Supabase/PostgreSQL and Cloudflare arrangement. Business capabilities are separated by domain boundaries and communicate through versioned application interfaces and durable events. Search, recommendations, advertising, analytics and finance may later be extracted into independent services without changing customer-facing contracts.

The intelligence layer has four cooperating capabilities:

1. Buyer discovery and recommendations.
2. Seller performance insights and growth guidance.
3. Self-service advertising, auction/ranking, pacing and optimisation.
4. Marketplace-wide demand, regional and operational intelligence.

They share governed events and read models, but they do not share unrestricted write access. In particular, recommendation and advertising analytics must never write directly to order/payment state or financial balances.

## 2. Non-negotiable system principles

- **Relevance before revenue:** paid bids cannot make an irrelevant, unavailable, unsafe or undeliverable product eligible.
- **Clear advertising disclosure:** sponsored placements carry a visible Sponsored/Promoted label and an attributable advertisement ID.
- **Organic protection:** sponsored inventory has placement-specific caps and frequency limits. Organic results retain their own relevance ranking.
- **Seller autonomy:** sellers can create, pause, resume and end eligible campaigns without routine admin approval.
- **Automatic exception handling:** policy, fraud, payment, product and store-state exceptions are held for review; ordinary campaigns are not manually operated.
- **Financial correctness:** campaign funding, spend, refunds and fees are ledger-backed, idempotent and reconcilable. Analytics counters are not a financial ledger.
- **Portable business logic:** domain rules live in application/domain modules and PostgreSQL constraints/RPCs where appropriate, not only in vendor-specific edge functions or client code.
- **Privacy by design:** collect only events needed for stated product purposes; separate identity from behavioural aggregates; apply retention, consent and access policies.
- **Graceful degradation:** if recommendation or ad-ranking infrastructure is unavailable, product search and checkout continue. Sponsored placements can fail closed while organic discovery remains available.
- **Staging-first:** no production migration, deployment, payment activation or campaign charging until the relevant staging tests and owner approval are complete.

## 3. Logical architecture

### 3.1 Application surfaces

- Customer app and mobile web.
- Seller portal.
- Admin operations portal.
- Public store and product pages.

These surfaces call versioned APIs. The client never supplies trusted campaign spend, ad eligibility, ranking scores, seller entitlements, payment status or financial balances.

### 3.2 Domain modules

| Module | Owns | Must not own |
|---|---|---|
| Identity and access | users, roles, sessions, permissions | campaign spend or ranking |
| Catalog and stores | products, store state, stock, product quality | ad billing |
| Commerce | carts, checkout snapshots, orders, seller orders | recommendation scores |
| Payments and finance | provider attempts, payment reconciliation, ledger, refunds | impression counters |
| Subscriptions and entitlements | seller plans, feature entitlements, limits | ad auction decisions |
| Advertising | campaigns, targeting, creatives, eligibility, delivery, spend attribution | order/payment authority |
| Discovery | search candidates, organic ranking, recommendations | seller balances |
| Event and analytics | event ingestion, aggregation, reporting read models | authoritative commerce state |
| Logistics | delivery coverage, hub custody, fulfilment events | ad billing |

Advertising may read trusted product, store, stock, delivery coverage and entitlement facts through internal interfaces. It may not bypass the owning module's permissions or mutate those facts.

### 3.3 Deployment shape

**Initial:** modular application/API + PostgreSQL + durable outbox + background workers + object storage. Keep workers logically separate even if they initially run in the same hosting environment.

**Growth:** introduce a dedicated queue/stream, search service, analytics store and model-serving endpoint when measured throughput or query load justifies them.

**Large scale:** independently deploy advertising delivery, recommendations, event processing, analytics and other high-volume modules. Keep stable API/event contracts and provider adapters.

Do not begin with Kafka, Kubernetes or a large microservice fleet merely for appearance. Add infrastructure when volume, latency, availability or team ownership requires it.

## 4. Core event architecture

### 4.1 Event flow

1. A trusted domain transaction commits (for example, a product view is recorded, an order is placed, or a payment is confirmed).
2. The same transaction writes an outbox event where loss would matter.
3. A worker claims and publishes the event.
4. Consumers process it independently: analytics, recommendation features, campaign attribution, seller insights and monitoring.
5. Each consumer records its own processing/idempotency key.
6. Failed work is retried with bounded backoff and then moved to a dead-letter/review state.

Use a transactional outbox for events emitted from critical database transactions. Client-side telemetry may be ingested separately, but must be treated as lower-trust evidence and never as proof of payment, purchase, delivery or billable advertising activity.

### 4.2 Event envelope

Recommended common envelope:

| Field | Meaning |
|---|---|
| `event_id` | UUID/ULID, globally unique |
| `event_type` | versioned name such as `ad.clicked.v1` |
| `occurred_at` | event time in UTC |
| `recorded_at` | server ingestion/commit time |
| `actor_type` / `actor_id` | buyer, seller, admin, system or anonymous session |
| `region_code` | governed region identifier, if relevant |
| `entity_type` / `entity_id` | product, store, order, campaign, ad, etc. |
| `session_id` | pseudonymous session identifier where permitted |
| `correlation_id` | connects a user journey or business workflow |
| `schema_version` | payload schema version |
| `source` | trusted server, client telemetry, provider webhook, worker |
| `payload` | minimal event-specific JSON |

Never place passwords, access tokens, full payment credentials, bank details, raw identity documents or unnecessary personal data in event payloads.

### 4.3 Initial event catalogue

**Discovery:** `search.submitted`, `product.impression`, `product.viewed`, `product.clicked`, `recommendation.served`, `recommendation.clicked`, `recommendation.dismissed`.

**Commerce:** `cart.item_added`, `checkout.started`, `order.created`, `order.cancelled`, `order.completed`, `return.created`, `delivery.completed`.

**Advertising:** `campaign.created`, `campaign.submitted`, `campaign.eligible`, `campaign.paused`, `campaign.ended`, `ad.impression`, `ad.clicked`, `ad.conversion_attributed`, `ad.spend_recorded`, `ad.invalid_activity_detected`.

**Finance:** `ad_funding.initiated`, `ad_funding.succeeded`, `ad_funding.failed`, `ad_refund.recorded`, `provider.webhook_received`, `provider.transaction_reconciled`.

**Seller and catalog:** `seller.verified`, `store.activated`, `store.suspended`, `product.approved`, `product.rejected`, `product.stock_changed`, `subscription.changed`.

Event schemas are versioned and documented. Consumers must tolerate unknown optional fields and must not assume delivery is exactly once. Design for at-least-once delivery with idempotent consumers.

## 5. Database design proposal

This is a logical/additive schema proposal, not SQL to apply. Names and foreign keys must be reconciled against the live staging schema before migration. Use existing canonical users, stores, products and payment records; do not create duplicate seller/product identity tables.

### 5.1 Advertising configuration

| Table | Purpose | Important fields |
|---|---|---|
| `ad_campaigns` | Seller campaign container | id, store_id, owner_user_id, name, objective, status, starts_at, ends_at, currency, budget_total_minor, budget_daily_minor, targeting_mode, created_at |
| `ad_campaign_products` | Products attached to campaign | id, campaign_id, product_id, status, max_bid_minor, bid_model |
| `ad_creatives` | Creative/version metadata | id, campaign_id, product_id, creative_type, asset_key, headline, destination, moderation_status, version |
| `ad_target_rules` | Region/category/audience targeting | id, campaign_id, rule_type, operator, region_id/category_id/value, include_exclude |
| `ad_placements` | Governed inventory slots | id, placement_key, surface, position_group, max_sponsored_share, max_consecutive_sponsored, active |
| `ad_campaign_state_events` | Campaign state history | id, campaign_id, from_state, to_state, reason_code, actor_id, created_at |

Use constrained status values, foreign keys, indexes and timestamps. Campaign ownership is derived from the authenticated seller's store ownership, never trusted from a client-supplied owner ID.

### 5.2 Funding, pricing and spend

| Table | Purpose | Important fields |
|---|---|---|
| `ad_wallets` | Seller advertising wallet account | id, store_id, currency, status |
| `ad_wallet_transactions` | Immutable wallet activity view/reference | id, wallet_id, transaction_type, amount_minor, currency, reference_type, reference_id, created_at |
| `ad_funding_attempts` | Provider funding attempts | id, wallet_id, provider, provider_reference, idempotency_key, amount_minor, currency, status |
| `ad_budget_reservations` | Amount reserved for campaign delivery | id, campaign_id, amount_minor, currency, status, expires_at |
| `ad_billable_events` | Deduplicated billable impressions/clicks | id, campaign_id, ad_id, event_type, pricing_model, amount_minor, currency, source_event_id, occurred_at |
| `ad_spend_ledger_entries` | Auditable spend/credit postings | id, campaign_id, wallet_id, entry_type, amount_minor, currency, source_event_id, reference_id, created_at |
| `ad_pricing_rules` | Versioned pricing and floor/ceiling config | id, placement_id, pricing_model, currency, min_bid_minor, max_bid_minor, effective_from, effective_to, version |
| `ad_refund_requests` | Refund/reversal workflow | id, campaign_id, wallet_id, amount_minor, reason, status, reviewed_by, provider_reference |

All monetary values are integer minor units with explicit currency. Do not use floating-point values. Never assume every market uses the same currency or price floor.

**Ledger rule:** wallet balances are derived from immutable, balanced financial postings. The current staging finance foundation was previously found to be a seller subledger rather than a complete double-entry ledger. Advertising wallet accounting must not be bolted onto that incomplete structure as an isolated mutable balance. Before implementation, reconcile it with the broader finance/payment lifecycle design and establish the authoritative double-entry posting model.

### 5.3 Delivery and attribution

| Table | Purpose | Important fields |
|---|---|---|
| `ad_delivery_decisions` | Why an ad was selected or excluded | id, request_id, campaign_id, ad_id, placement_id, decision, reason_code, score_version, created_at |
| `ad_impressions` | Validated served impressions | id, event_id, campaign_id, ad_id, placement_id, session_id, region_id, served_at, viewability_state |
| `ad_clicks` | Validated click records | id, event_id, impression_id, campaign_id, ad_id, session_id, clicked_at, validity_state |
| `ad_attribution_touches` | Eligible ad touchpoints | id, order_id, order_item_id, campaign_id, ad_id, touch_type, touched_at, attribution_model |
| `ad_conversions` | Attributed outcomes | id, order_id, order_item_id, campaign_id, ad_id, attributed_value_minor, currency, status, created_at |
| `ad_fraud_signals` | Invalid traffic and abuse signals | id, campaign_id, event_id, signal_type, severity, decision, created_at |

Do not store every raw impression forever in the transactional database. Apply retention and partitioning from the start; retain compact aggregate reporting longer where lawful and useful. A later analytics warehouse can store high-volume event history.

### 5.4 Intelligence and reporting

| Table | Purpose |
|---|---|
| `buyer_preference_features` | Minimal, versioned and privacy-governed buyer interest features |
| `product_performance_daily` | Product impressions, views, clicks, carts and orders by day/region |
| `store_performance_daily` | Seller/store performance aggregates |
| `campaign_performance_daily` | Spend, impressions, clicks, conversions and attributed revenue |
| `regional_demand_daily` | Aggregated category/product demand by region |
| `recommendation_experiments` | Experiment definitions and allocation |
| `recommendation_model_versions` | Model/scoring version, effective dates and metadata |
| `intelligence_job_runs` | Worker/model run status, duration, input watermark and errors |

Aggregates must be rebuildable from retained source events or documented snapshots. They are read models, not authoritative payment or order state.

### 5.5 Geographic model

Use a normalized region hierarchy, not free-text city strings as the only targeting key:

- country
- state/province
- city/municipality
- optional delivery zone/neighbourhood

A region record should have a stable ID, ISO country code, parent region ID, canonical name, aliases and active status. Store targeting references IDs. Keep delivery serviceability separate from advertising targeting: an ad may target a region only if the product can actually be delivered there, unless the campaign is explicitly for awareness and is labelled/configured as such.

Do not require precise GPS. Prefer buyer-selected or coarsened location and explicit permission for precise location features.

## 6. Campaign lifecycle and eligibility

Recommended lifecycle:

`draft → submitted → eligible → scheduled → active → paused → completed`

Additional terminal/exception states: `rejected`, `cancelled`, `exhausted`, `suspended`, `payment_hold`.

Eligibility must be computed server-side and rechecked at delivery time. A campaign is deliverable only if:

1. The authenticated seller owns the store and campaign.
2. Store is approved, live and not suspended/closed.
3. Seller subscription/entitlements permit advertising.
4. Product is approved, active, in stock and policy-eligible.
5. Creative passes automated validation and any required moderation.
6. Campaign dates and budget are valid.
7. Wallet reservation or campaign-specific funding is sufficient.
8. Region and delivery coverage match the buyer context.
9. Frequency and buyer-exclusion rules permit delivery.
10. No fraud, safety or legal hold applies.

Admin review should be exception-based. High-risk categories, new seller risk signals, suspicious creative changes and policy flags can route to moderation. Ordinary compliant campaigns should be self-service.

## 7. Hybrid funding and hybrid pricing

### 7.1 Funding options

Support both:

**Prepaid advertising wallet**
- Seller funds wallet using an approved payment method.
- Successful provider transaction is verified server-side.
- Funding is posted once using provider-reference uniqueness and idempotency.
- Campaign budget reserves funds before delivery.
- Valid spend consumes reservation and reduces available wallet liability.
- Unused reserved funds are released on completion/cancellation, subject to unsettled billable events.

**Campaign-specific payment**
- Seller pays a campaign invoice/checkout directly.
- Funding is attached to that campaign, not silently mixed into the general wallet.
- The same payment-attempt, webhook and reconciliation safeguards apply.
- Duplicate provider callbacks must not double-fund a campaign.

Both options must use the existing payment lifecycle design principles: immutable attempts, exact amount/currency validation, provider-reference uniqueness, idempotent settlement, durable webhook inbox and reconciliation. Do not implement a second weaker Paystack flow just for ads.

### 7.2 Pricing models

Initial supported models:
- **CPC:** charge for a validated, billable click.
- **CPM:** charge per 1,000 validated impressions, with a documented viewability definition.

Campaigns choose one model per ad group or campaign version. A campaign cannot switch pricing models mid-flight without a new version and clear seller consent. Use explicit bids, floors, caps, currency and pricing-rule version.

Later option:
- **CPA/conversion pricing:** only after reliable attribution, fraud controls, return/cancellation adjustment rules and sufficient volume exist. Do not promise CPA in the initial launch.

### 7.3 Spend and budget safety

- Reserve budget before campaign activation.
- Enforce daily and total budget limits atomically on the server.
- Use a safety margin for asynchronous event processing; do not overspend because multiple workers read the same stale balance.
- Deduplicate billable events by immutable event ID and provider/campaign-specific keys.
- Apply a defined late-event policy for events arriving after pause/end.
- Pause delivery when available budget is exhausted.
- Provide seller-visible estimated spend and final reconciled spend.
- Never bill client-reported impressions or clicks without server-side validation.

### 7.4 Billing edge cases to specify before implementation

- Click invalidation and click-fraud reversals.
- CPM rounding and partial thousand-impression groups.
- Campaign cancellation and unused balance release.
- Provider chargeback and wallet negative-balance handling.
- Currency changes and FX (prefer one campaign currency fixed at funding).
- Order cancellation, return and refund effects on attribution reporting.
- Disputed campaign charges and admin adjustments.
- Tax/invoice requirements for each launch market.

## 8. Ad selection and balanced sponsored placement

### 8.1 Candidate generation

For each placement, generate eligible candidates from:
- Product/category/search relevance.
- Buyer interest features, where consent and data permit.
- Region and delivery serviceability.
- Stock and product availability.
- Store quality and fulfilment signals.
- Campaign budget, bid and pacing eligibility.

Apply hard exclusions before scoring. Never let a high bid override product safety, relevance minimums, store suspension, stock or delivery constraints.

### 8.2 Ranking

Use a transparent versioned score. A candidate score can combine:
- query/category relevance
- predicted click or conversion probability
- product quality and completeness
- stock and delivery confidence
- seller fulfilment/return quality
- bid value adjusted for pricing model
- campaign pacing and budget health
- frequency cap and diversity penalty

The exact weights must be calibrated with experiments; do not hard-code arbitrary permanent weights. Keep score version and reason codes for audit/debugging.

For CPC, the auction may use bid × predicted click probability × quality. For CPM, compare effective bid per eligible impression while preserving relevance and quality floors. Do not mix CPC and CPM bids naively; convert to a comparable expected-value metric with calibrated predictions and explicit auction rules.

### 8.3 Balanced placement policy

- Sponsored slots are explicitly marked and capped per placement.
- Organic results are ranked independently.
- A sponsored candidate must pass a relevance threshold before it can enter a slot.
- Limit consecutive sponsored items and repeated exposure to the same seller/product.
- Apply per-buyer frequency caps across sessions where identity/consent permits; otherwise use session-level caps.
- Use category/store diversity to avoid one advertiser monopolising all inventory.
- Keep a minimum organic share. Initial percentages are configuration decisions to be tested, not fixed in this document.
- Never label a paid placement as an organic recommendation.
- If the ad service times out or returns no valid candidate, render organic results without blocking the page.

## 9. Targeting: regional and automatic expansion

Support two complementary modes:

1. **Explicit targeting:** seller chooses country, state, city or delivery zone.
2. **Automatic expansion:** platform finds additional eligible buyers in other selected/allowed regions based on relevance, available inventory, delivery coverage and campaign objective.

Automatic expansion must not silently exceed seller's chosen countries, campaign budget, category or other hard constraints. Show sellers where the campaign can deliver and whether automatic expansion is enabled. Provide a region-level performance report.

Use coarse region by default. Do not infer sensitive characteristics or target by sensitive personal attributes. Avoid using precise location without clear permission and a real need.

## 10. Buyer recommendations and seller intelligence

### 10.1 Buyer recommendations

Separate candidate generation from ranking:
- Candidate generators: same category, similar attributes, complementary items, regional availability, trending products, repeat-purchase candidates and seller/store discovery.
- Ranker: relevance, predicted usefulness, stock, price fit, delivery availability, quality, diversity and freshness.
- Re-ranker: remove duplicates, enforce frequency caps, diversify stores/categories and apply safety rules.

Use contextual recommendations for home, search, product detail, cart and reorder surfaces. Do not insert disruptive recommendations into payment or checkout confirmation steps.

New users receive contextual/popular/regional candidates without pretending a personal profile exists. Users should be able to dismiss or reset personalisation where applicable.

### 10.2 Seller intelligence

Generate evidence-based insights from aggregates:
- impression-to-click rate
- product view-to-cart rate
- cart-to-order conversion
- stock-out and availability rate
- cancellation/return rates
- delivery performance
- regional demand and price competitiveness
- campaign spend and attributable outcomes

Each insight must include its measurement window, sample size and confidence caveat. Do not generate advice from tiny or noisy samples as if it were certain. AI may turn measured facts into plain-language explanations, but cannot invent metrics or autonomously change seller prices, stock or campaign budgets.

## 11. API contracts

All routes are versioned under `/api/v1` (or the project's agreed versioned API convention). These are proposed resource contracts; reconcile with existing frontend routes and API patterns before implementation.

### 11.1 Seller campaign APIs

| Method and route | Purpose |
|---|---|
| `POST /api/v1/seller/ad-campaigns` | Create draft campaign |
| `GET /api/v1/seller/ad-campaigns` | List campaigns owned by current seller |
| `GET /api/v1/seller/ad-campaigns/{id}` | Campaign detail and current eligibility |
| `PATCH /api/v1/seller/ad-campaigns/{id}` | Update allowed draft fields |
| `POST /api/v1/seller/ad-campaigns/{id}/submit` | Validate and submit |
| `POST /api/v1/seller/ad-campaigns/{id}/pause` | Pause delivery |
| `POST /api/v1/seller/ad-campaigns/{id}/resume` | Recheck eligibility and resume |
| `POST /api/v1/seller/ad-campaigns/{id}/cancel` | Cancel and release eligible reservation |
| `GET /api/v1/seller/ad-campaigns/{id}/report` | Campaign performance and spend |

### 11.2 Seller funding APIs

| Method and route | Purpose |
|---|---|
| `GET /api/v1/seller/ad-wallet` | Available, reserved and pending balance |
| `POST /api/v1/seller/ad-wallet/fund` | Create wallet funding attempt |
| `POST /api/v1/seller/ad-campaigns/{id}/fund` | Create campaign-specific funding attempt |
| `GET /api/v1/seller/ad-transactions` | Seller-scoped funding/spend history |
| `GET /api/v1/seller/ad-invoices/{id}` | Invoice/receipt details |

Funding endpoints require idempotency keys and server-side amount/currency validation. Client redirect success is not proof of payment; provider verification/webhook reconciliation is authoritative.

### 11.3 Buyer discovery APIs

| Method and route | Purpose |
|---|---|
| `GET /api/v1/discovery/home` | Organic recommendations and eligible sponsored modules |
| `GET /api/v1/discovery/search` | Search results with separately identified sponsored slots |
| `GET /api/v1/products/{id}/related` | Related/complementary items |
| `POST /api/v1/telemetry/events` | Limited client behaviour telemetry |

Telemetry API must enforce payload size, event allowlist, rate limits, bot filtering and privacy controls. It must not accept client assertions of payment, order completion or delivery.

### 11.4 Admin APIs

| Method and route | Purpose |
|---|---|
| `GET /api/v1/admin/advertising/overview` | Marketplace ad KPIs and alerts |
| `GET /api/v1/admin/advertising/campaigns` | Filter/search campaigns |
| `GET /api/v1/admin/advertising/campaigns/{id}` | Campaign and audit detail |
| `POST /api/v1/admin/advertising/campaigns/{id}/hold` | Emergency hold with reason |
| `POST /api/v1/admin/advertising/campaigns/{id}/release` | Release hold after checks |
| `GET /api/v1/admin/advertising/transactions` | Funding, spend, refunds and reconciliation |
| `GET /api/v1/admin/advertising/regions` | Region-level campaign performance |
| `GET /api/v1/admin/advertising/audit` | Administrative action history |

Admin actions require explicit permissions, reason codes, actor attribution and immutable audit records. Routine campaign operations should not require admin APIs.

### 11.5 API response conventions

Responses should include stable IDs, status, currency and timestamps. Paginate lists with cursor pagination. Use structured error codes such as `CAMPAIGN_NOT_ELIGIBLE`, `INSUFFICIENT_AD_FUNDS`, `PRODUCT_UNAVAILABLE`, `REGION_NOT_SERVICEABLE`, `CAMPAIGN_BUDGET_EXHAUSTED`, `IDEMPOTENCY_CONFLICT`. Do not expose internal scoring features, fraud thresholds or other sellers' private performance.

## 12. Admin command centre and finance integration

Admin dashboards are read models fed from authoritative domain records and event aggregates.

Advertising dashboard should show:
- campaign count by state
- active spend and budget remaining
- funding success/failure
- CPC/CPM delivery and effective costs
- impressions, clicks, attributed orders and attributed sales
- top regions/categories
- policy holds and fraud alerts
- provider reconciliation differences
- campaign refunds and disputes

Finance dashboard should show advertising separately from order commissions, subscriptions and delivery revenue. Distinguish gross advertiser funding, unspent wallet liability, reserved budget, recognised ad revenue, refunds, provider fees and taxes. Do not report wallet top-ups as earned revenue before the corresponding advertising service is delivered under the approved accounting policy.

Every campaign/ad ID must be traceable through campaign, creative, placement, region, delivery decision, impression/click, attribution and spend posting. Admin reports should link to source records without exposing unnecessary buyer identity.

## 13. Security, privacy and abuse controls

- Enforce seller ownership and admin role checks server-side and in database policies.
- Keep provider secrets and privileged service credentials server-side only.
- Use narrowly scoped database functions with fixed safe search paths and least privilege.
- Rate-limit campaign creation, funding, telemetry and click endpoints.
- Validate creatives, destinations, product eligibility and URL schemes.
- Detect bots, click farms, repeated self-clicks, data-centre traffic and suspicious conversion patterns.
- Use deduplication and anomaly scoring; hold uncertain billing events rather than silently charging.
- Keep a clear seller appeal/dispute path.
- Apply data retention/deletion rules to behavioural events and pseudonymous identifiers.
- Do not target or infer sensitive personal characteristics.
- Provide clear Sponsored labelling and a privacy explanation for personalisation.
- Separate buyer identity data from analytics aggregates; admin access to identifiable data must be justified and audited.

## 14. Reliability, performance and portability

### Initial reliability requirements

- Search and checkout remain functional if intelligence workers are unavailable.
- Sponsored inventory fails closed on ad service failure; organic results remain.
- Event consumers are idempotent and retry safely.
- Budget reservation and spend posting are concurrency-safe.
- Campaign reports can be slightly delayed and must show their last-updated time.
- Admin overview uses pre-aggregated read models rather than expensive live joins across raw events.
- Partition or archive high-volume impression/click data before scale requires emergency remediation.

### Portability boundaries

- PostgreSQL remains the initial system of record.
- Use standard SQL, documented migrations and provider-neutral domain interfaces.
- Keep payment providers behind a payment adapter and preserve provider references.
- Keep object storage behind an S3-compatible interface.
- Keep event publication behind an outbox/queue adapter.
- Keep search behind a search interface.
- Keep model inference behind a recommendation/ads scoring interface with versioned input/output schemas.
- Export data in documented formats and maintain tested backups/restore procedures.
- Avoid vendor-specific features in core business rules unless isolated behind an adapter and justified.

## 15. Proposed implementation sequence

Do not assign or apply migration numbers until the current branch and staging migration history are rechecked. The existing payment lifecycle contract is a prerequisite for campaign funding.

**Phase A — contract and schema reconciliation**
1. Re-read current migrations and existing payment lifecycle contract.
2. Map canonical store/product/user/order/payment identifiers.
3. Confirm finance ledger design and accounting treatment for wallet liability and ad revenue.
4. Define region hierarchy and event schemas.
5. Review privacy, consent and retention requirements.
6. Produce a migration dependency graph and rollback plan.

**Phase B — event foundation**
1. Add event/outbox schema and worker idempotency.
2. Add allowlisted client telemetry.
3. Add core server events for catalog, commerce and payments.
4. Add monitoring, replay and dead-letter handling.
5. Validate event completeness and duplicate handling in staging.

**Phase C — advertising finance**
1. Integrate ad funding with the common payment attempt/webhook/reconciliation design.
2. Establish balanced ledger postings and wallet liability.
3. Implement reservation, spend, release and refund accounting.
4. Test concurrent funding/spend and duplicate provider callbacks.
5. Do not activate real seller charging until staging reconciliation passes and the owner authorises it.

**Phase D — campaign and delivery**
1. Add campaign, creative, targeting and placement records.
2. Implement server-side eligibility and moderation exceptions.
3. Implement CPC/CPM billing rules and pacing.
4. Implement relevance-gated ad selection and sponsored placement caps.
5. Add impression/click validation and fraud controls.

**Phase E — discovery and intelligence**
1. Add candidate generators and transparent organic ranking.
2. Add contextual recommendations.
3. Add seller performance aggregates and evidence-based insights.
4. Add experimentation and model versioning.
5. Introduce machine learning only when sufficient clean data exists.

**Phase F — admin and scale**
1. Add admin read models and audit workflows.
2. Add region/campaign/finance drill-downs.
3. Load-test search, event ingestion, ad selection and budget reservation.
4. Test backup, restore, export and provider-adapter portability.
5. Extract services only when measured needs justify it.

## 16. Minimum staging acceptance tests

### Campaign lifecycle
- Seller cannot create or operate a campaign for another store.
- Unapproved, suspended or non-live store cannot deliver ads.
- Rejected, archived, out-of-stock or policy-blocked product cannot be advertised.
- Draft, submit, pause, resume, cancel and expiry transitions are audited.
- A campaign cannot target outside seller-selected hard boundaries.

### Funding and ledger
- Wallet funding and campaign-specific funding both work.
- Duplicate provider webhooks cannot double-credit.
- Client redirect cannot mark funding successful.
- Exact amount and currency are verified.
- Reservations cannot exceed available funds under concurrent requests.
- Duplicate billable events cannot double-charge.
- Budget exhaustion stops further delivery.
- Cancellation releases only eligible unused reservations.
- Refunds and adjustments have balanced postings and audit references.
- Wallet liability and recognised advertising revenue reconcile.

### Delivery and attribution
- CPC charges only valid, deduplicated clicks.
- CPM charges only validated impressions under the agreed viewability definition.
- Click fraud/self-clicks/bot activity is excluded or held.
- Attribution does not count duplicate orders or refunded/cancelled outcomes as completed sales.
- Sponsored labels and ad IDs are returned to clients.
- Relevance threshold, sponsored share and frequency caps are enforced.
- Ad service failure leaves organic search/home functional.

### Recommendations and privacy
- New buyers receive non-personalised fallback results.
- Location targeting respects permissions and configured region.
- Sensitive attributes are not used.
- Dismissal/frequency controls work.
- Model/scoring version is traceable.
- Small samples are not presented as confident seller advice.

### Admin and operational safety
- Campaigns and payments appear automatically in admin reporting.
- Every admin hold/release/refund action records actor and reason.
- Seller cannot access other sellers' campaign reports or wallet records.
- Admin reports reconcile to financial source records.
- Background job failure, retry, replay and dead-letter handling are tested.
- No staging credentials, test data or service secrets leak into production.

## 17. Decisions intentionally left configurable

The following are not fixed by this architecture and must be decided through product, legal, financial and staging validation:
- CPC/CPM minimum bids and pricing floors by currency/market.
- Initial sponsored share and maximum consecutive sponsored slots per placement.
- Frequency caps by surface and buyer/session identity.
- Impression viewability definition.
- Click validity window and invalid-traffic policy.
- Attribution window and model.
- Campaign cancellation/refund rules and tax treatment.
- Region coverage and automatic expansion defaults.
- Creative moderation thresholds and restricted categories.
- Event retention periods and consent UX.
- Performance thresholds that trigger extraction into dedicated services.

## 18. Existing Everneed constraints and explicit non-actions

This design must integrate with the existing Everneed marketplace, not replace it.

Previously audited staging findings remain relevant:
- Staging project: `vjiadqygpyebpisxslbx`.
- Existing migration history was observed through migration 025; the payment lifecycle 026 document is a proposal and must be checked for implementation status before sequencing.
- Current finance foundation needs reconciliation before it can safely support advertising wallet accounting.
- Existing seller plans and verification/activation rules must be respected; advertising must not bypass store activation or entitlements.
- Existing order, payment and seller data remain owned by their current modules.

**No database migration was applied by creating this document. No staging data was changed. No production resource was accessed or modified. No live advertising campaign or payment was created.**

## 19. Next engineering artefacts

After review, prepare separate implementation artefacts:
1. Schema reconciliation matrix against current staging.
2. Event catalogue with JSON schemas and ownership.
3. Finance ledger/account mapping for ad wallet liability and revenue recognition.
4. API OpenAPI specification and permission matrix.
5. Migration plan with rollback and staging test SQL.
6. Worker/job contracts and retry/dead-letter policy.
7. Frontend integration contract for customer, seller and admin portals.

Do not turn this architecture document directly into one large migration. Each artefact and migration should be independently reviewable, testable and reversible where practical.
