# Everneed staging QA accounts

**Owner-authorized disposable QA identities only. Staging project:** `vjiadqygpyebpisxslbx`  
**Production project (never use for QA):** `zpgasfweaixwsktlueje`  
**Launch target:** ready-for-launch before 2027-01-01. **Coordinator:** Claude 10 via GitHub workflow.

## Safety
- All identities, orders, payments, inventory, and fixtures in this plan are test-only and belong to Everneed-staging.
- Never create QA users in production or promote staging fixtures.
- Create identities through Supabase Auth Admin/dashboard or a protected staging-only admin script using the service-role secret in its environment. Never insert directly into `auth.users`, weaken RLS, or use service-role credentials in a browser.
- Passwords and recovery credentials MUST NOT appear in repository files, Git history, PR/issues/comments, commits, screenshots, logs, or agent handoff text. Store credentials in a restricted secret manager/GitHub environment with access limited to the authorized setup operator; distribute access only through that secure channel. Rotate after testing.
- Assign roles through the supported role/permission admin flow. Verify role, context, and resource scope using actual authenticated requests. The admin account is separately restricted; no blanket access for other accounts.
- Use clear QA labels on fixture records; test provider payments must use approved simulated/test lifecycle paths. Do not fabricate ledger, inventory, payment, refund, or order states.

## Account roster and verification checklist

| Account key | Intended role | Test coverage | Setup status |
|---|---|---|---|
| `qa-buyer` | Buyer/customer | Browse, cart, checkout, payment return, history, refunds, tracking | NOT CREATED |
| `qa-seller-1` | Seller/store owner | Onboarding, catalogue, inventory, store settings, orders, balance | NOT CREATED |
| `qa-seller-2` | Separate seller/store | Multi-seller checkout, isolation, hub consolidation | NOT CREATED |
| `qa-dispatch` | Dispatch role | Assignment, courier handoff, delivery attempts, POD, exceptions | NOT CREATED |
| `qa-support` | Support role | Ticket/customer assistance, scoped lookup, dispute support | NOT CREATED |
| `qa-admin` | Platform admin | Admin operations, reviews, interventions, configuration | NOT CREATED — RESTRICTED |
| `qa-logistics` | Hub/logistics role | Intake, custody scans, partial/complete consolidation, dispatch | NOT CREATED |

Use unique controlled email addresses for each account. Do not put email/password pairs in this table or any committed documentation.

## Setup run
1. Confirm the Supabase Dashboard project selector is **Everneed-staging** and project ref matches above.
2. Create disposable users using Auth Admin (or a staging-only protected script); record account key and non-secret user UUID in the private QA register.
3. Assign role/context through the approved admin mechanism. If role assignment requires a missing RPC/migration, mark BLOCKED and send a backend contract request—do not manually bypass guards.
4. Test login/session for each account. Verify intended permission succeeds and cross-role / cross-store / platform-scope checks fail.
5. Keep the credential delivery mechanism separate from this repo. Claude 10 coordinates the agents' authorized access; GitHub docs only hold setup status and instructions.
6. At cleanup, revoke sessions, rotate/disable/delete the disposable identities and remove fixture data. Run a staging-only cleanup verification before release; confirm production has no QA fixtures.

## Current status (27 Nov 2026)
- Inventory query for emails containing `qa` or `test` in staging returned **no users**.
- Supabase connector currently exposes no Auth Admin create-user operation. ChatGPT/Codex cannot provision credentials through this connector. Next step: authorized Supabase Dashboard Auth Admin setup or provide a secure, protected staging setup mechanism (never paste service-role secrets into chat).
- This is a provisioning blocker, not a blocker for backend contract/audit work. Keep testing moving with existing fixture accounts and supported authenticated flows while setup is arranged.
- Update statuses and user UUIDs only after verified creation; never record passwords or tokens.
