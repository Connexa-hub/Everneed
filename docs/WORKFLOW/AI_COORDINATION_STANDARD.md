# Everneed AI Coordination Standard — 9 builders + AI #10
**Owner direction, 25 Nov 2026 | All agents work on web + app frontends | Backend reserved to ChatGPT/Codex**

This replaces scattered roster/handoff documents. Agent roster is an operating allocation, not a separate authority. Coordinator may redistribute tasks but must keep one owner per task/file and tracker claims.

## AI #10 — Researcher, analyst, reviewer, planner and moderator (coordinator)
The tenth AI is the coordinating intelligence across all nine frontend builders and app/web lanes. Responsibilities:
- Research current project, user requirements, repository state, existing contracts and platform constraints before planning.
- Break work into sequenced, small tasks; assign/coordinate lanes; maintain dependencies, claims and status in the tracker.
- Review architecture, design, implementation, accessibility, performance, security-facing UI and integration quality. Challenge assumptions and mark findings with evidence.
- Moderate conflicts between agents: refer to accepted standards/contracts; propose a decision, log it; owner resolves product decisions or risk.
- Maintain a single roadmap, prevent duplicate work, check cross-surface parity, ensure frontend does not invent backend contracts or data.
- Review agent outputs before acceptance; ask for corrections with exact acceptance criteria; keep only verified work as DONE.
- Coordinate releases and integration, but no production release without owner approval.
- AI #10 is planner/reviewer, not a frontend coding lane and not backend owner.

## Builder roster (9 agents; role allocation can evolve)
1. **Claude 1 — Merchant/storefront workspace:** seller onboarding, home, products/editor, catalogue, orders, inbox, settings, plans, team experience and seller design system.
2. **Claude 2 — App shell/integration:** Capacitor/native, web-in-app packaging, shared session, auth adapters, route base/deep links/back, environment stamping, build integrity, parity integration.
3. **Claude 3 — Shopper experience:** discovery/search, product/store pages, cart, checkout/payment UX, order tracking/history, reviews, customer account.
4. **Claude 4 — Platform admin/operations:** seller and product review, admin dashboards, order interventions, platform configuration, operations screens.
5. **Claude 5 — Logistics/dispatch/hub/courier UX:** dispatcher work queues, assignment, routes/stops, courier workflows, hub intake/sorting/consolidation, POD, exceptions and live customer tracking.
6. **Claude 6 — Finance and merchant money UX:** seller earnings/settlement/payout views, platform finance, reconciliation, refunds/disputes, reports. UI only; never author accounting logic or fake balances.
7. **Claude 7 — Support/trust/safety/compliance UX:** customer/seller cases, moderation, fraud/abuse reporting, verification workflow, escalations and audit views.
8. **Claude 8 — Public website/content/growth:** marketing site, help centre, legal content presentation, SEO/social previews, campaigns/advertising UI and onboarding content.
9. **Claude 9 — Quality, accessibility, performance and integration verification:** cross-agent test plans, responsive/device checks, accessibility, bundle/performance, test automation and parity checklist. May implement test tooling and fixes within agreed lane; must not take backend ownership.

## Backend owner (ChatGPT/Codex only)
Backend, database, migrations, RLS, RPCs, Edge Functions, payment provider integration, financial rules/journal, domain state machines, server-side role/access enforcement, CI backend tests, contracts and staging verification. Backend outputs documented for frontend consumers. Frontend agents do not independently alter schema, migrations, RLS, functions, payment logic, CI database workflows or backend contracts without explicit handoff.

## Collaboration rules
- All work on `web-portal`; `main` is release. Read latest AI protocol and tracker first.
- Claim task, owner, lane and branch in tracker before edits. One task owner; no overlapping claims. Coordinate shared files and request review.
- Frontend agent creates a contract request when data/action is missing: desired user flow, fields, permission, states, scope, error/loading/empty handling. Do not mock it as real.
- Backend responds with implemented contract, migration, tests and staging evidence; update DB_CONTRACT and handoff.
- AI #10 researches, assigns, reviews, and arbitrates; it cannot silently override owner-approved product/security decisions.
- Agent completion requires commit SHA, tests/evidence, responsive review and tracker update. AI #10 independently reviews and accepts/rejects.
- Keep agent handoffs concise and actionable; consolidate superseded instructions and delete stale documents after their decisions have been captured.

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
10. Planner's cross-agent acceptance review and owner release decision.
