# Mobile Buyer App Resumption & Frontend Design Handoff

**Decision recorded: 22 November 2026**  
**Owner:** Founder  
**Status:** Approved direction; design and implementation work may resume  
**Scope:** Customer shopping app and its frontend design. Website/web portal continues in parallel. APK packaging/build automation remains paused until the owner explicitly resumes APK testing.

## Why this work resumes

The web portal is not a substitute for the customer shopping application. The current web experience cannot be used to validate the complete consumer shopping journey and payment acceptance. The finance backend and staging Paystack work are being prepared, but payment E2E acceptance is blocked until the mobile buyer experience is available and connected.

Do not describe a web-only checkout as a completed customer-app shopping flow. Do not treat a sandbox payment as launch acceptance until the app flow and server-side settlement evidence are tested together.

## Claude handoff

Claude should resume the **customer-app frontend design and implementation**, inspect the actual current repository before making assumptions, and reconcile the current designs/screens with existing app architecture. Do not rebuild the app from scratch or discard working features.

First perform a code/design inventory:
- Identify the active customer Android/app frontend, framework and entry points.
- Locate existing customer shopping screens, navigation, product models, authentication, Supabase integration and any mock/demo data.
- Identify existing product details fields and components (including SKU, description, manufacturer, variants/options, sizes/size guides, stock and seller/store identity); preserve and extend them rather than regress.
- Inspect design tokens, component styles, layouts and current responsive behavior.
- Identify unfinished screens, broken routes, hard-coded/mock-only flows and backend contracts.
- Report findings and propose an incremental screen plan; then proceed with implementation in small reviewed increments without waiting for repeated confirmation for routine steps.

## Customer shopping journey — design/implementation sequence

1. **App foundation & navigation:** stable buyer navigation, loading/error/empty/offline states, authentication state and session persistence.
2. **Discovery/home:** category browsing, search, curated/promotional content, recently viewed where supported, clear store attribution and performant low-data assets.
3. **Search & results:** query, category/filter/sort, pagination/incremental loading, unavailable items and helpful empty results.
4. **Store discovery/storefront:** store identity, seller profile/verification signals, store catalogue, delivery/fulfilment information and store-specific branding.
5. **Product detail:** high-quality images; name, price/currency, seller/store; SKU; description; manufacturer/brand; category; attributes; sizes/size guides; variant selection; available stock; sale/offer validity; shipping/delivery information; returns policy; quantity; wishlist/share where already supported or planned.
6. **Cart:** persist cart appropriately, handle multiple sellers, display each store group, variant/option and quantity, revalidate prices/stock, remove/edit items, and show transparent subtotal/discount/fees.
7. **Address & delivery:** buyer address selection/entry, delivery availability, delivery method, hub/direct fulfilment distinctions where applicable, clear fee and ETA estimates only when backed by data.
8. **Checkout quote:** server-calculated immutable quote/snapshot; visible currency and totals; seller/platform discount attribution; delivery and other fees; no client-side authoritative pricing; prevent stale quote or stock from silently proceeding.
9. **Payment selection/integration:** card/Paystack staging first, with only methods actually implemented and enabled shown as selectable. Wallet/transfer/COD must not be represented as operational unless their backend lifecycle is verified. Handle cancel, retry, pending, failure, verification and reconciliation states safely.
10. **Order success & order list:** confirmation only after server-confirmed state, clear order reference, seller/store grouping, receipts/details, and safe refresh/recovery.
11. **Order tracking:** seller preparation, hub intake/consolidation where applicable, dispatch and delivery milestones; use truthful status and contact/support paths.
12. **Account/support:** profile, addresses, order history, preferences, support, privacy and account actions with accessible, secure flows.

## Design requirements

- Nigeria-first, mobile-first buyer experience; Android devices with constrained memory, older WebViews, 360–412 px layouts, intermittent/slow mobile data and bright outdoor viewing.
- Keep the interface lightweight: optimize and lazy-load images, avoid unnecessary blur/large animations, avoid heavy bundled assets and protect performance on low-end devices.
- Clear contrast, readable typography, predictable touch targets (aim at least 44 px), useful skeleton/loading states and concise error recovery.
- Use consistent design tokens and components; avoid screen-specific style drift.
- Product and store identity should be visible and trustworthy. Store attribution must not disappear in cart, checkout or order details.
- Use real backend data/contracts when available; mock fixtures must be labelled and isolated, never silently presented as live.
- Keep the buyer app distinct from seller/admin portal experiences, while sharing appropriate design tokens and reusable components.
- Do not invent live delivery estimates, inventory, discounts, payment methods, seller verification or order states.

## Backend / finance integration constraints

- Existing staging finance work is authoritative; do not invent a parallel checkout, payment, ledger or wallet implementation in the frontend.
- Checkout and payment totals must come from validated backend quote/snapshot contracts. Client display values are not trusted for settlement.
- Card payment integration should use the deployed/staging Paystack path and persisted payment-attempt identity; do not hard-code secrets or expose provider keys.
- Current finance checkpoint: migration 057 verified-payment journal integration is staging-tested; Paystack staging Edge Function v14 was deployed and SQL tests 055–057 rerun. However, real sandbox HTTP/webhook/verify/replay acceptance remains untested because current connector cannot invoke the function. The app is required to exercise the consumer journey.
- Production remains untouched. No live payment or public-launch test.
- Variant checkout/payment is not launch-enabled until acceptance gates pass.

## Acceptance gates (buyer app)

- [ ] Inventory existing frontend and design before refactoring.
- [ ] Screen/navigation map and incremental implementation plan documented.
- [ ] Browse/search/store/product detail functional with staging data and loading/error/empty states.
- [ ] Variant/option and quantity selection validated against server stock/pricing.
- [ ] Multi-seller cart groups products and shows accurate line/store totals.
- [ ] Cart and checkout refresh server-side prices, inventory, offer and quote identity.
- [ ] Delivery address/method/fee flow works only for supported coverage.
- [ ] Payment methods shown match enabled backend methods; no fake wallet or transfer flows.
- [ ] Paystack sandbox init, success, failure, cancellation, pending/verify and recovery handled.
- [ ] Server-side paid status and journal evidence checked; no client-only success screen.
- [ ] Duplicate webhook/verify and mismatch scenarios remain idempotent/fail closed.
- [ ] Order history/detail/tracking display accurate server state.
- [ ] Regression tests, accessibility/performance review and staging end-to-end evidence documented.

## Branch and release discipline

- Continue the active PR #32 branch and review its scope before deciding whether buyer-app work belongs in that PR or a separate focused branch. Avoid mixing unrelated app redesign with risky finance migration changes without clear separation.
- Keep `main` protected and use reviewed PRs.
- Web portal work continues in parallel; this decision does not cancel web tasks.
- APK CI remains paused/disabled until the owner explicitly resumes APK builds. App source/design development is not paused.
- Never deploy to production or enable live payment for this handoff.

## Roadmap sequence update

The practical sequence is now:
**Web portal foundations + finance staging hardening (ongoing) → buyer app frontend design/incremental implementation → staging app shopping/checkout integration → sandbox payment and finance E2E acceptance → refunds, reconciliation and seller payout gates → pilot readiness review.**

This is a resumption of app frontend work, not a declaration that the app or checkout is finished.
