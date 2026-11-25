# Workflow documents index
**Refactored 25 Nov 2026.** These are the maintained documents; old dated audits, duplicate agent rosters, implementation snapshots and superseded handoffs have been removed after their current conclusions were consolidated. No source code or migration files were deleted.

## Read first
1. [Project Standard & Roadmap](PROJECT_STANDARD_AND_ROADMAP.md) — accepted platform, roles, dispatch/hub, app/web standards and roadmap.
2. [AI Coordination Standard](AI_COORDINATION_STANDARD.md) — nine builders and AI #10 planner/researcher/reviewer/moderator.
3. [AI Protocol](AI_PROTOCOL.md) — mandatory collaboration, branch, security, release and handoff rules.
4. [Backend-only Roadmap](BACKEND_ONLY_ROADMAP.md) — ChatGPT/Codex scope and sequenced backend work.
5. [Website Tracker](WEBSITE_TRACKER.md) — task status/evidence (historical rows are explicitly dated).

## Authoritative implementation contracts
- [DB Contract](DB_CONTRACT.md) — schema/API/migration contract and change log.
- [Environment Separation](ENVIRONMENTS.md) — staging/live refs and deployment rules.
- [Universal Architecture](EVERNEED_UNIVERSAL_PLATFORM_ARCHITECTURE.md) — modular platform, extensible roles and context scopes.
- [Roles & Access](ROLES_AND_ACCESS_PROPOSAL.md) — accepted platform/store split and permission model.
- [Seller Backend Handoff](SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md) — frontend requirements mapped to backend asks.
- [Seller App Experience Spec](SELLER_APP_EXPERIENCE_SPEC.md) — seller UI requirements (reference only; frontend ownership).
- [Seller Entitlements & Verification](SELLER_ENTITLEMENTS_AND_VERIFICATION_CONTRACT.md).
- [Seller Product Catalog Backend Handoff](SELLER_PRODUCT_CATALOG_BACKEND_HANDOFF.md).
- [Platform Finance/Hub Roadmap](PLATFORM_FINANCE_HUB_ROADMAP.md).
- [Payment Lifecycle 026 Contract](PAYMENT_LIFECYCLE_026_CONTRACT.md) and [Implementation Blueprint](PAYMENT_LIFECYCLE_026_IMPLEMENTATION_BLUEPRINT.md).
- [Shared Financial Journal 027 Contract](SHARED_FINANCIAL_JOURNAL_027_CONTRACT.md).
- [Payment legacy paths audit](PAYMENT_LEGACY_PATHS_AUDIT.md), [payment recovery audit](PAYMENT_RECOVERY_PHASE_2_AUDIT.md), [refund audit](PAYMENT_REFUND_AUDIT.md) — backend risk references; validate current status against tracker and code.
- [Store ownership & staging order fixture handoff](STORE_OWNERSHIP_AND_STAGING_ORDER_TEST_DATA_HANDOFF.md) — current test-data task; staging only.
- [Live schema inventory](LIVE_SCHEMA_INVENTORY.md), [migration recovery record](MIGRATION_RECOVERY.md) — historical factual references; always recheck actual DB.
- [Auth production setup](AUTH_PRODUCTION_SETUP.md) — deployment checklist.
- [Routine security review](ROUTINE_SECURITY_REVIEW.md), [Supabase Advisor review](SUPABASE_ADVISOR_REVIEW.md), [Privilege hardening plan](PHASE_A_PRIVILEGE_HARDENING_PLAN.md) — security findings; not proof of current security posture.
- [Intelligence & advertising data architecture](INTELLIGENCE_ADVERTISING_DATA_ARCHITECTURE.md), [Advertising DB reconciliation/build plan](ADVERTISING_DATABASE_RECONCILIATION_AND_BUILD_PLAN.md) — optional growth/ads work.

**Rule:** New decisions update a canonical standard/contract. Do not create another dated report or parallel roadmap unless a short, temporary audit is needed; fold findings into canonical docs and delete the temporary report after handoff.
