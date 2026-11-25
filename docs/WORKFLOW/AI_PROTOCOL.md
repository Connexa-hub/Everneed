# Everneed AI protocol
**Canonical collaboration rules | 25 Nov 2026**

Read `PROJECT_STANDARD_AND_ROADMAP.md`, `AI_COORDINATION_STANDARD.md`, `BACKEND_ONLY_ROADMAP.md`, and the current `WEBSITE_TRACKER.md` before acting. Detailed accepted contracts and migrations remain authoritative for implementation details.

## 1. Branch, safety and workflow
- Development/integration branch is `web-portal` for both app and website. Release branch is `main`. Never create an app-only branch, force-push, or edit production directly.
- Pull latest before work and before commit; inspect recent commits and relevant docs. If production hotfixes are missing from development, bring them back through a reviewed PR.
- Claim one task in the tracker with ID, status, owner and branch before starting. Do not overlap claims.
- One focused commit per concern; read the file first and use current SHA. No broad rewrites or mass formatting.
- Migrations: repository migration first, staging apply/test, DB_CONTRACT change log. No undocumented DB changes.
- All tests and fixtures on Everneed-staging (`vjiadqygpyebpisxslbx`). Production `zpgasfweaixwsktlueje` and real users/data remain protected. Production release/migration requires owner approval.
- Never commit secrets, private keys, keystores or service-role keys.

## 2. Team boundary
**Ten Claude agents total:** Claude 1–9 are specialist builders for all web/app frontend work. **Claude 10 is the tenth agent and master planner/coordinator**—researcher, analyst, design strategist, task planner/delegator, moderator, reviewer, debugger/QA lead and end-to-end integrator. Claude 10 coordinates the nine builders; it is not an extra agent outside the ten and cannot override owner decisions.

**ChatGPT/Codex owns backend only:** database/schema/migrations, RLS, RPC, Edge Functions, payment/finance/order/logistics domain rules, server-side permissions, CI backend checks, staging tests, contracts and security. Frontend agents must not invent contracts or author backend logic; submit a structured request and wait for a contract. Backend response must be handoff-ready and include tests.

## 3. Standards
- Backend is authority. UI gating is not security. Deny by default; check live membership, resource ownership/scope, permission and state at each protected server operation.
- Platform and store planes are isolated; logistics contexts are explicitly scoped. Roles are bundles of canonical permission keys. Unknown keys, scope mismatch and revoked/expired grants fail closed.
- No fake metrics, money, permissions, order states or ETA. Mock data must be isolated and clearly labelled.
- Shared contracts/components/config live in `shared/`; use adapters rather than duplicate auth, data, native, payment, storage, messaging and maps integrations.
- Keep low/mid Android/WebView support, 360–412px layouts, low data, accessible contrast and 44px touch targets. Verify desktop as well.
- Native/web session is unified; one refresh lock and logout propagation. Build-stamped environment only; no hostname inference for native builds. Staging artifacts must never contain production project reference.

## 4. Completion and release
A task is DONE only after tests and evidence, CI, mobile/desktop checks where relevant, real staging behavior verified, tracker updated with commit and limitations. For backend: migration replay, SQL/RLS regression, staging result and DB_CONTRACT update. For frontend: true loading/empty/error/success states, API contracts, accessibility/responsive evidence.
Release: PR `web-portal → main`, reviewed CI and owner approval. Update tracker. No direct deploy claims unless verified.

## 5. Handoffs
Use concise docs: **Summary; owner/lane; files; contract/version (inputs/outputs, permissions/scopes, states/errors); mock vs live; tests/evidence; gaps/risks; requested next action.** Update tracker and the contract, not a separate long-lived narrative report.
AI #10 moderates conflicts using accepted contracts and records owner decisions. If a standard needs change, propose it with rationale; do not silently diverge.
