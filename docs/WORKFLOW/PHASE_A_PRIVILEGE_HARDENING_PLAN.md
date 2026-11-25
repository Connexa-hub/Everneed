# Phase A — privilege hardening plan

**25 Nov 2026 | Status: draft plan only | Target: staging first**
**Production:** Everneed01 ref `zpgasfweaixwsktlueje`, read-only. No migration or ACL changes applied.

## Protocol
Checked latest `AI_PROTOCOL.md`, tracker, architecture, R23 access proposal, DB contract and seller handoff before work. Keep this plan and test handoff in docs; tracker updated.

## Confirmed catalog findings
1. Broad public-schema default ACLs for table objects owned by `supabase_admin` and `postgres` grant `anon` and `authenticated` broad privileges (`arwdDxtm`, includes TRUNCATE/trigger/reference).
2. The anon role has excessive existing table grants; TRUNCATE is not subject to RLS.
3. Authenticated also has broad write/TRUNCATE grants on several tables, even when policies are read-only or admin-only.
4. Public views with RLS disabled are `security_invoker=true`; base table RLS remains relevant. Do not mistake view `relrowsecurity=false` for a base-table exposure.
5. `private` schema USAGE is granted to anon and authenticated; API exposed-schema configuration has not been verified. Function EXECUTE is a separate gate.

## Non-goals
- No blanket revoke of all authenticated table writes; existing client flows rely on explicit INSERT/UPDATE/DELETE on some tables and column-level grants.
- No migration to production.
- No changes to RLS policies in the first grant-only pass unless test evidence shows policy defects.
- No alteration to business RPCs or role model in the same migration.

## Staging-only migration strategy (to be developed after dependency map)
A. Capture current table/column/function/sequence ACLs and default ACLs; preserve migration owner/service_role requirements.  
B. Revoke unnecessary privileges from anon/authenticated on public objects, especially TRUNCATE, TRIGGER, REFERENCES and direct writes where no client code requires them.  
C. Grant minimal SELECT/INSERT/UPDATE/DELETE by table and column as required by the actual browser/app contract. Public reads must use intentional SELECT grants plus RLS; sensitive mutations should be RPC-only.  
D. Change default privileges for both `supabase_admin` and `postgres` object creators. Future table defaults should not grant anon/authenticated broad write/DDL-like privileges. Future function EXECUTE defaults must be reviewed independently.  
E. Review private schema USAGE and private helper ACLs; do not remove access required by SECURITY DEFINER functions until function dependencies and API exposure are understood.  
F. Build tests for effective ACLs and API behavior, including a create-table/function/sequence test proving defaults are least-privilege.  
G. Apply only through owner-approved staging workflow; run migration replay, SQL tests, web checks, app build and authenticated browser/device tests. Reconcile any failures before proposing production.

## Required dependency map before migration
- Direct public-table write call sites in `web/`, `js/`, `shared/` and `android/` generated app path.
- Supabase RPC/Edge Functions and trigger paths; role grants for helper functions.
- Public read endpoints/views and their security-invoker behavior.
- Existing column-specific grants (e.g. seller storefront details).
- Storage and realtime privileges, excluded from public table migration unless separate scope is justified.
- Default privilege owners and migration execution role in staging CI.

## Acceptance tests
- Anon cannot TRUNCATE or mutate private/operational tables, cannot read protected rows, and retains only documented public reads/guest forms.
- Authenticated buyer cannot alter order totals/status/payment, secrets, role/profile fields or another buyer's data.
- Store owner cannot access another store's data or directly change protected store approval/live fields, settlement, ledger or payout state.
- Seller order/stock/product mutations continue through supported paths and remain owner-scoped.
- Admin flows still work through protected RPCs; no direct table grants are needed for admin-only mutations unless specifically approved.
- SECURITY DEFINER functions and triggers continue functioning with minimal caller privileges.
- Views remain safe and public catalog functions return only allow-listed public fields.
- CI confirms least-privilege ACLs on all current and future created objects.

## Next action
Complete call-site/dependency mapping, then write a numbered staging migration and tests. Migration is not drafted/applied until grant needs are fully classified and the owner-approved staging workflow is available.
