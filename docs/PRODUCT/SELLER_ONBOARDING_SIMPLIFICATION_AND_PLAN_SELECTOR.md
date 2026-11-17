# Seller onboarding simplification and plan-first journey

**Status:** Owner-approved UX direction; frontend implementation assigned to Claude  
**Date:** 17 November 2026  
**Branch:** `web-portal`  
**Scope:** Staging-first. This document supersedes conflicting older onboarding/verification presentation guidance. It does not authorise production changes.

## Product principle

Everneed is a marketplace, not a verification application. Creating a store must feel quick, confident and commerce-focused. Do not expose internal compliance terminology, verification explanations, KYC warnings, bank forms, or lengthy policy essays as the primary seller onboarding experience.

Collect only the information needed to create the store, establish its public identity/location/category, obtain required seller-policy consent, and submit the application. Keep sensitive or activity-specific checks out of the generic store-creation path.

## Target journey

### 1. Create your store

A short, polished, screen-by-screen flow:
- Store name and public identity.
- What the seller sells (managed categories).
- Country, state/region and city.
- Short store description.
- Logo, cover and brand colour are optional.
- Essential seller contact information, with phone verification only if the approved regional policy makes it necessary at this point.
- Concise seller-policy acceptance at submission; link to full policies instead of rendering long legal text inline.

Do not collect bank account details, identity documents, face/liveness, proof of address, tax information or payout details as generic prerequisites to create a store. Do not show a verification checklist, KYC explainer, or "complete verification before you can start" message during store creation.

### 2. Choose a plan

Immediately after the store profile steps, show a premium plan-selection screen. This is a distinct stage, not buried inside the store form.

- Use a horizontally sliding, animated 3D-style plan carousel/row with clear focus on the selected plan. On touch devices, support swipe; on desktop, support arrows/drag and keyboard navigation.
- Show Free/Entry, Starter, Growth and Pro using live plan/entitlement data from the backend.
- Make price, billing period, active product limit, daily listing quota (where applicable), commission benefit, verification inclusion/requirement, and premium features easy to compare.
- Free/Entry and its free trial: 5 active products, 2 new product listings per seller-local day; no optional commercial verification required to activate.
- Starter: ₦3,000/month, 25 products; optional commercial verification, not required to activate.
- Growth: ₦8,000/month, 200 products; included commercial verification required for activation.
- Pro: ₦20,000/month, unlimited products; included commercial verification required for activation.
- Preserve all other existing approved plan entitlements/commission discounts. Never invent or silently alter prices/limits.
- Default focus may be Free/Entry, but do not preselect or silently subscribe the seller. Require an explicit choice and explain any payment step before charging.
- Plan choice must be saved through the authenticated backend plan-selection action; never trust a client-supplied price or entitlement.

### 3. Plan-directed next screens

After the seller selects a plan, route them only to the screens genuinely required by that plan and their region:

- **Free/Entry and Starter:** no optional commercial identity/face/address verification screens in the activation path. Continue to application submission/review and then seller workspace, subject to any confirmed mandatory regional/product requirements.
- **Growth and Pro:** show the included commercial verification flow screen-by-screen, with progress, save/resume, provider status and clear retry/support states. Explain why it is required by the selected plan, not as a universal Everneed rule.
- **Mandatory legal/provider checks:** ask only when the exact check is confirmed to apply to the seller's country, product category or requested regulated capability. Explain the specific purpose and capability affected. A wallet, virtual account, payment acceptance, or withdrawal requirement must not automatically be presented as a storefront-activation requirement.
- No fake verification, no client-side bypass, and no unsupported provider-success state.

After required plan-specific steps, submit/continue the application for platform review. Approval and storefront operational activation remain distinct backend states. Do not promise that a store is live until the server confirms it.

## Seller workspace and overview

The seller dashboard is an operating workspace, not a verification dashboard.

- Primary overview: store performance, orders, product/catalogue health, inventory, earnings/settlement information that the seller is entitled to see, and actionable business tasks.
- Remove a permanent top-level **Verification** navigation item for every seller. Do not display a verification card, warning banner, checklist, or "finish KYC" message for Free/Starter when no commercial verification is required.
- If Growth/Pro verification is required, show a compact, contextual task/progress item with a direct action. Once complete, remove it from the primary attention area.
- If a genuine mandatory requirement blocks a specific capability, show the task beside that capability (for example, payout setup/withdrawal), not as a generic store warning.
- Keep optional "Get verified" upgrade/add-on discoverable in plan/benefits settings only where supported; do not nag sellers or imply it is required.

## Platform admin overview

The platform admin overview should be an executive/operations summary, not a wall of verification statuses.

- Prioritise business and operational metrics: active/live stores (based on actual operational activation, not merely `stores.status='approved'`), pending applications, orders, product moderation, sales/GMV, revenue, delivery exceptions and support workload.
- Do not count every approved application as a live store. The current `admin.js` overview computes "Live stores" from `status === 'approved'`; Claude must change this to use the actual live/operational state.
- Do not put a global "verification backlog" KPI or verification checklist on the main overview.
- Keep a dedicated **Seller operations** area for application review, plan status, included verification cases (Growth/Pro only), confirmed mandatory compliance cases, suspensions and audited exceptions.
- Keep financial-service checks and payout holds in the relevant finance/payout workflows, not mixed with storefront approval.
- Admins need full, role-authorised detail when handling a specific case, with reason, owner, state, audit history and next action. Simplifying the overview must not remove operational control or auditability.

## Design and engineering constraints

- Minimal, calm, premium marketplace UX: clear hierarchy, short copy, consistent components, no duplicate panels or circular button treatments.
- Mobile-first, 360–412 px, low/mid-range Android and constrained data. Avoid heavy 3D WebGL, large video or blur layers. The plan carousel's depth effect should be CSS/lightweight transforms with a static fallback.
- Respect `prefers-reduced-motion`; all plans remain accessible without animation.
- 44 px minimum touch targets, keyboard support, focus states, semantic labels and screen-reader announcements for selected plan.
- Avoid making the seller re-enter information. Persist progress and chosen plan securely.
- All buttons/actions must work; no decorative controls.
- Backend entitlements and RPC responses remain authoritative. UI must not decide who is eligible to activate.

## Acceptance tests

1. New seller can create a store without being shown identity/face/address verification or bank payout forms.
2. After store details, seller sees the plan carousel before any plan-specific verification.
3. Selecting Free or Starter never routes to optional commercial verification screens and does not show a verification warning in the dashboard.
4. Selecting Growth or Pro routes to the included verification flow, and only required screens are shown.
5. Confirmed mandatory checks are scoped to the relevant region/product/capability and explain the exact blocker.
6. Plan prices and entitlements are fetched from backend; changing client state cannot change price, limits or verification rules.
7. Seller overview prioritises commerce and only surfaces relevant actionable tasks.
8. Platform admin overview counts true live stores, not merely approved applications; no global verification KPI is shown there.
9. Seller operations still provides auditable case management for plan-required verification and mandatory compliance.
10. Test all flows on staging, mobile and desktop; no production changes or merge without explicit owner approval.

## Handoff ownership

- **Claude:** implement all frontend UX, animation, responsive behavior, seller overview, admin overview and contextual verification screens.
- **ChatGPT:** maintain backend plan/entitlement contracts, activation/authorization rules, staging SQL/security tests and documentation coordination.
- **Do not replace Claude's current frontend design work with a parallel UI implementation.** Coordinate against this contract and review the delivered implementation.


## Backend integration addendum — 17 November 2026

- Fetch plan cards from `public.seller_plan_catalog()`; do not query `seller_plan_entitlements` directly. The RPC returns seller-safe fields for active plans, including daily listing quota and verification flags.
- Persist the explicit plan choice using the authenticated `choose_plan(p_plan)` action before application submission. The backend now requires that selected plan during application approval and copies it to the trial subscription.
- The backend catalogue values currently resolve to: Free 5 active / 2 new listings per day; Starter 25 active / unlimited daily; Growth 200 active / unlimited daily with included/required commercial verification; Pro unlimited active / unlimited daily with included/required commercial verification. Existing plan prices and commission discounts remain unchanged.
- Pickup address is not part of onboarding. Collect it in Logistics/Store settings and require it only when enabling hub fulfilment or before the first hub-routed dispatch. Direct-delivery-only sellers must not be blocked.
- There is not yet a verification provider/start-check backend integration. Growth/Pro screens must be honest about this limitation and must not fabricate a pending check or provider success. A real start action depends on selecting and integrating a provider.
