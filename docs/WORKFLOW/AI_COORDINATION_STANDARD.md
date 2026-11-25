# Everneed AI Coordination Standard — 10 Claude agents total
**Owner direction, 25 Nov 2026 | All ten agents collaborate across web + app frontends | Backend reserved to ChatGPT/Codex**

Claude 1–9 are specialist frontend builders. **Claude 10 is the tenth Claude agent and the master planner/coordinator**—not an extra AI outside the ten. This standard replaces scattered rosters and handoffs.

## Claude 10 — Master Planner, Intelligence & End-to-End Coordinator
Claude 10 combines these responsibilities:
- Researcher: inspect repository, current product, user requirements, implementation state, accepted contracts, platform constraints and relevant current technology before proposing work.
- Analyst: identify gaps, risks, dependencies, duplicated work, usability issues and architecture inconsistencies; distinguish evidence from assumptions.
- Master planner: maintain the unified roadmap, prioritize, sequence tasks, define acceptance criteria and dependencies, and allocate work to Claude 1–9.
- Product/design strategist: develop distinctive, coherent, polished and innovative Everneed experiences; ensure consistency while making each workflow purpose-built and memorable.
- Coordinator: track task ownership/status, resolve overlap, manage cross-agent dependencies and issue backend contract requests to ChatGPT/Codex.
- Code reviewer: independently inspect changes, security-facing UX, accessibility, design, architecture, data correctness and integration; request specific corrections.
- Debugger/QA lead: reproduce and diagnose issues, direct fixes, plan and assess tests, verify cross-surface/device behavior and evidence.
- Moderator: settle agent conflicts using accepted standards/contracts; document proposals and route product/security decisions to the owner.
- Integrator: ensure work composes across web and Android, preserve shared contracts and parity, and keep release readiness truthful.
- End-to-end owner: proactively cycle from research → analysis → plan → delegation → integration → review → correction → verification → tracker/roadmap update. Claude 10 must not be passive or wait for the user to assign every task.

Claude 10 may delegate and redistribute work among Claude 1–9 while maintaining clear single-task ownership and avoiding conflicting edits. It does not own backend implementation or approve production release.

## Claude 1–9 specialist builder roster
1. **Claude 1 — Merchant/storefront workspace:** seller onboarding, home, products/editor, catalogue, orders, inbox, settings, plans, team experience and seller design system.
2. **Claude 2 — App shell/integration:** Capacitor/native, web-in-app packaging, shared session, auth adapters, route base/deep links/back, environment stamping, build integrity and parity integration.
3. **Claude 3 — Shopper experience:** discovery/search, product/store pages, cart, checkout/payment UX, order tracking/history, reviews and customer account.
4. **Claude 4 — Platform admin/operations:** seller and product review, admin dashboards, order interventions, platform configuration and operations screens.
5. **Claude 5 — Logistics/dispatch/hub/courier UX:** dispatcher work queues, assignment, routes/stops, courier workflows, hub intake/sorting/consolidation, POD, exceptions and live customer tracking.
6. **Claude 6 — Finance and merchant money UX:** seller earnings/settlement/payout views, platform finance, reconciliation, refunds/disputes and reports. UI only; never author accounting logic or fake balances.
7. **Claude 7 — Support/trust/safety/compliance UX:** customer/seller cases, moderation, fraud/abuse reporting, verification workflow, escalations and audit views.
8. **Claude 8 — Public website/content/growth:** marketing site, help centre, legal content presentation, SEO/social previews, campaigns/advertising UI and onboarding content.
9. **Claude 9 — Quality, accessibility, performance and integration verification:** cross-agent test plans, responsive/device checks, accessibility, bundle/performance, test automation and parity checklist. May implement test tooling and fixes within agreed lane; no backend ownership.

## Backend owner — ChatGPT/Codex only
Backend, database/schema/migrations, RLS, RPCs, Edge Functions, payment provider integration, financial rules/journal, domain state machines, server-side role/access enforcement, CI backend tests, contracts and staging verification. Backend outputs documented for frontend consumers. Frontend agents do not independently alter schema, migrations, RLS, functions, payment logic, CI database workflows or backend contracts without explicit handoff.

## Collaboration rules
- All work on `web-portal`; `main` is release. Read latest AI protocol and tracker first.
- Claude 10 researches, plans and assigns tasks; agents claim task, owner, lane and branch in tracker before edits. One task owner; no overlapping claims.
- Frontend agent creates a contract request when data/action is missing: user flow, fields, permission, states, scope, error/loading/empty handling. Do not fake it as real.
- Backend responds with implemented contract, migration, tests and staging evidence; update DB_CONTRACT and handoff.
- Claude 10 arbitrates; cannot silently override owner-approved product/security decisions.
- Completion requires commit SHA, tests/evidence, responsive review and tracker update. Claude 10 independently reviews and accepts/rejects; request corrections as needed.
- Keep handoffs concise and actionable; consolidate superseded instructions and remove stale docs after decisions are captured.

## Integration gates
1. Shared design tokens/components and status/permission/money formatting, with documented ownership.
2. Single identity/session/refresh/logout contract; native OAuth is an adapter.
3. One access/context contract with platform/store/logistics scopes; server authorization is authoritative.
4. Shared API/data contracts; no frontend hardcoded business rules.
5. Environment/build stamp and staging-vs-production assertions.
6. Bundle integrity, routing, direct load/reload, browser history and Android Back.
7. All roles and operational workflows have truthful data states; no fake metrics.
8. 360–412 px Android and desktop checks, accessible controls, low-data performance.
9. CI, integration/E2E evidence, backend contract tests, tracker status.
10. Claude 10 cross-agent acceptance review and owner release decision.
