# Supabase advisor review — Everneed01

**Project:** `zpgasfweaixwsktlueje`  
**Observed:** 12 Nov 2026, approximately 04:27 UTC  
**Mode:** Read-only security and performance advisor checks

## Safety

No database changes were made. Advisor findings are signals to review, not automatic proof of exploitable vulnerabilities or reasons to apply blind fixes. The complete machine-readable output is in `schema_snapshot/advisor-findings.json`.

## Security findings

| Advisor | Level | Count | Interpretation |
|---|---:|---:|---|
| RLS enabled, no policy | INFO | 2 | `public.kv` and `public.rate_limits`; currently intended for privileged function-only access, but confirm this remains true. |
| Anonymous can execute SECURITY DEFINER | WARN | 6 | Public RPC endpoints include waitlist, guest support, public SLA, and store reply statistics. Confirm each is intentionally anonymous and properly bounded. |
| Authenticated can execute SECURITY DEFINER | WARN | 38 | This includes buyer, seller, support, and administrative RPCs. EXECUTE permission is not itself authorization; each function must enforce the correct caller/role/ownership checks. |
| Leaked password protection disabled | WARN | 1 | Enable in the Supabase Auth dashboard after reviewing the setting; this is an owner-level dashboard action, not a migration. |

The six anonymous SECURITY DEFINER RPCs reported by the advisor are:
- `public.join_waitlist(...)`
- `public.store_reply_stats()`
- `public.support_guest_close(p_id)`
- `public.support_guest_open(p_id, ...)`
- `public.support_guest_ping(p_id)`
- `public.support_sla_public()`

These are consistent with intended public-facing waitlist/support features, but they still require explicit rate limiting, identifier validation, data-minimization, and negative tests. The support guest close/ping functions should be checked for the same visitor-ID validation guarantees used by support_guest_open.

The advisor also reports 38 authenticated-callable SECURITY DEFINER functions. Do not respond by revoking EXECUTE wholesale: some are intended RPCs. Review the function bodies and verify that admin-only functions call a trusted authorization check, seller functions enforce store ownership, and buyer functions enforce order ownership. The complete function inventory and ACLs are in `schema_snapshot/routine-and-grant-metadata.json`.

## Performance findings

| Advisor | Level | Count | Interpretation |
|---|---:|---:|---|
| Unindexed foreign keys | INFO | 29 | Candidate indexes; evaluate expected query paths and write overhead before adding. |
| Auth RLS initialization plan | WARN | 18 | Some policies re-evaluate auth/current-setting functions per row; consider scalar subquery wrapping where semantically correct. |
| No primary key | INFO | 1 | `public.rate_limits`; verify whether a composite or surrogate key is needed before changing it. |
| Unused indexes | INFO | 10 | Current data is extremely sparse, so lack of usage is not evidence that indexes are unnecessary. |
| Multiple permissive policies | WARN | 12 | May add policy evaluation cost; preserve the union of intended access behavior if consolidating. |

The full findings include exact table, policy, foreign-key, and index names in `schema_snapshot/advisor-findings.json`.

## Recommended order of work

1. Keep the current production database unchanged during baseline recovery.
2. Review the 6 anonymous and 38 authenticated SECURITY DEFINER RPCs against their intended client call sites and role requirements.
3. Enable leaked-password protection in the owner dashboard after confirming availability and impact.
4. Add negative tests for anonymous, buyer, seller, and admin access before considering privilege changes.
5. Treat index and RLS-performance findings as workload optimization tasks; do not change indexes while the live dataset is still nearly empty.
6. Re-run advisors after any separately approved security/performance migration and compare the results.

## Current decision

Record these findings as baseline acceptance and hardening requirements. No advisor finding has been fixed by this review, and no SQL or Auth setting has been changed.
