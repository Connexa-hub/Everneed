# Staging QA identities — R26

**Everneed-staging only:** project ref `vjiadqygpyebpisxslbx`. Production ref `zpgasfweaixwsktlueje` is rejected by the script.

## Provision/reset

1. Obtain the staging Auth Admin service-role key through an authorized private channel. Never put it in Git, PR comments, docs, or logs.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` in the local shell. The script refuses any host except the exact staging URL.
3. Preview without network/user changes:
   ```sh
   SUPABASE_URL=https://vjiadqygpyebpisxslbx.supabase.co node tools/staging/provision-qa-users.mjs --dry-run
   ```
4. Run to create/reset accounts, upsert their profile rows through service-role REST, and verify password sign-in:
   ```sh
   node tools/staging/provision-qa-users.mjs
   ```
   It rotates passwords for existing QA accounts. Passwords are never printed; credentials are written to `.qa/staging-qa-credentials.json` with mode 0600. `.qa/` is gitignored. Share the file only through an approved private handoff, then remove local copies when no longer needed.

## Accounts

| Key | Profile role | Scope |
|---|---|---|
| buyer | customer | buyer/cart/checkout/tracking |
| seller | merchant | seller/store setup |
| seller2 | merchant | multi-seller fixtures |
| dispatch | customer | awaits explicit scoped dispatcher assignment |
| support | customer | awaits explicit support assignment |
| admin | admin | restricted staging-only legacy admin testing |
| logistics | customer | awaits explicit hub/logistics assignment |

QA metadata is a label only, not authorization. Dispatcher/support/logistics accounts remain nonprivileged until the approved role assignment/enforcement workflow is deployed. Admin credentials are separately controlled and should not be shared broadly.

## Cleanup before launch

- Identify and safely reconcile test fixtures/orders owned by QA identities through supported domain workflows.
- Disable/rotate QA users; don't delete users until fixture foreign keys and audit retention are understood.
- Confirm no QA credentials, fixture ownership, mock IDs or test artifacts are copied into production.
- Staging QA accounts and fixtures never become real customer accounts.
