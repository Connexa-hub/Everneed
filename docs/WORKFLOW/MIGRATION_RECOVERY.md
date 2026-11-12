# Live migration recovery record

**Project:** Everneed Supabase `zpgasfweaixwsktlueje`
**Inspection date:** 12 Nov 2026
**Status:** **Recovered and replay-verified on staging.** All 19 live migration records have matching repository files. A clean staging rebuild succeeded on 12 Nov 2026; executable SQL for all 19 files was compared with the stored live statements and matched after removing comments and formatting whitespace. No live database was changed.

## How it was recovered (12 Nov 2026, Claude)

Supabase stores the exact SQL of every applied migration in `supabase_migrations.schema_migrations.statements`. A read-only `select` returned the stored text for each of the eight missing records, and each was written to `supabase/migrations/` without edits. No migration was applied, no schema was changed and no data was modified.

The earlier version of this note concluded that the SQL could not be recovered. That was because the search covered repositories, archives and backups but not the migration table itself.

Integrity check: for each file, the byte size equals the stored character length, plus one trailing newline where the stored text had none, plus two extra bytes for each multi-byte character.

| File in repo | Stored characters | File bytes | Why they differ |
|---|---:|---:|---|
| `0020_multivendor_foundation.sql` | 7,462 | 7,463 | trailing newline |
| `0021_multivendor_function_grants_hardening.sql` | 289 | 290 | trailing newline |
| `0030_signup_profile_fields.sql` | 1,246 | 1,247 | trailing newline |
| `011_plans_and_limits.sql` | 6,880 | 6,880 | none |
| `012_support_chat_and_waitlist.sql` | 31,643 | 31,651 | two `••••` masks (3 bytes each, 1 character each) |
| `013_support_chat_hardening.sql` | 528 | 528 | none |
| `014_chat_start_official_store.sql` | 3,499 | 3,499 | none |
| `015_support_sla_public.sql` | 387 | 387 | none |

## Confirmed migration history

A read-only call to the live migration table returned **19 applied records**.

| Version | Live migration name | File in repo |
|---|---|---|
| 20261029014653 | 000_baseline | `000_baseline.sql` |
| 20261029014658 | 001_remove_cj | `001_remove_cj.sql` |
| 20261029014913 | 002_hotfix | `002_hotfix.sql` |
| 20261029044105 | multivendor_foundation | `0020_multivendor_foundation.sql` (recovered) |
| 20261029044131 | multivendor_function_grants_hardening | `0021_multivendor_function_grants_hardening.sql` (recovered) |
| 20261029081939 | 003_remove_unrecorded_multivendor | `003_remove_unrecorded_multivendor.sql` |
| 20261029134730 | signup_profile_fields | `0030_signup_profile_fields.sql` (recovered) |
| 20261029184309 | 004_marketplace_core | `004_marketplace_core.sql` |
| 20261029184336 | 005_marketplace_backfill_guards | `005_marketplace_backfill_guards.sql` |
| 20261029184403 | 006_marketplace_rls | `006_marketplace_rls.sql` |
| 20261029184540 | 007_marketplace_functions | `007_marketplace_functions.sql` |
| 20261030002325 | 008_hardening | `008_hardening.sql` |
| 20261031105857 | 009_profile_settings | `009_profile_settings.sql` |
| 20261102105101 | 010_seller_helpers | `010_seller_helpers.sql` |
| 20261104011326 | 011_plans_and_limits | `011_plans_and_limits.sql` (recovered) |
| 20261111073217 | 012_support_chat_and_waitlist | `012_support_chat_and_waitlist.sql` (recovered) |
| 20261111073234 | 013_support_chat_hardening | `013_support_chat_hardening.sql` (recovered) |
| 20261111073320 | 014_chat_start_official_store | `014_chat_start_official_store.sql` (recovered) |
| 20261111073610 | 015_support_sla_public | `015_support_sla_public.sql` (recovered) |

### Naming of the three records that had no number
They were first saved as `002a`, `002b` and `003a`. The Supabase CLI only applies files named `digits_name.sql` and skips anything else, so those names would have been left out of any rebuild (including `signup_profile_fields`, which saves date of birth and photo at sign-up). They were first renamed to `0030`, `0031` and `0040`, but that introduced an ordering flaw: the CLI compares migration version strings, and remote history sorts `003` before `0030`/`0031`, even though raw filenames place `0030`/`0031` before `003_`. Before the staging replay, the files were resequenced to `0020`, `0021` and `0030`. The resulting CLI and remote version order is `002`, `0020`, `0021`, `003`, `0030`, `004`. SQL contents are unchanged.

`003_remove_unrecorded_multivendor` drops exactly what `0020` creates (stores, store members, order items, seller orders, fulfilment batches and the two helper functions), which is why `0030` and `0031` must run before it.

The `Migration files` check (`.github/workflows/migrations-check.yml`) enforces the naming rule, rejects duplicate versions and checks that the first 19 files replay in the order in this table.

## What is still open

1. **Environment configuration outside migrations.** Auth redirect URLs, the `media` storage bucket and its policies, test users, and the Paystack test Edge Function still need staging setup (`WEB-ENV01`). These are not part of the 19-file SQL chain.
2. **Seeds and operational state.** `011` seeds three plans (Starter 3,000, Growth 8,000, Pro 20,000) and `012` seeds 8 support rules and 7 canned replies. They are guarded with `where not exists`. The closed support-queue row in live is operational state and is intentionally not seeded.
3. **Things a migration file cannot capture.** Edge function code (`supabase/functions/`), Auth settings, storage bucket settings, and the missing `pg_cron` schedule (`WEB-F09`) live outside these files.

## Safety boundary

This document and the recovered files are read-only evidence plus source history. Do not apply any of them to the live project. The live project already contains all of it.

## Live schema evidence (read-only observations, unchanged from the earlier pass)

- Plans and billing: `store_plans`, `store_subscriptions`, `store_payments`.
- Support and chat: `conversations`, `conversation_members`, `messages`, `canned_replies`, `support_queue`, `support_rules`, `support_settings`.
- Website acquisition: `waitlist`.

Message triggers: `chat_guard_bi` (BEFORE INSERT, `chat_guard()`) and `chat_triage_ai` (AFTER INSERT, `chat_triage()`). RLS and grants are as described in `DB_CONTRACT.md` and the files under `schema_snapshot/`.

## Replay and exact-SQL verification (12 Nov 2026)

- GitHub Actions reset run `43234686076` completed successfully against staging project `vjiadqygpyebpisxslbx`.
- The staging migration history was rebuilt from the 19 repository files in the same order as live. A temporary `016_signup_profile_fields.sql` duplicated the already-correct `0030_signup_profile_fields.sql`; it has been removed from the repository. Its no-op row in staging migration metadata still needs reconciliation.
- Each of the 19 repository migrations was compared with its corresponding `supabase_migrations.schema_migrations.statements` entry on live. After ignoring SQL comments and formatting whitespace (including comments inside dollar-quoted function bodies), all 19 executable SQL bodies match.
- Staging/live parity checks found matching public columns, RLS policies and RLS-enabled table sets. Four function-body hash differences were inspected and were comments only.
- No SQL or data was changed on live. The staging reset affected staging only.

## Conclusion

`WEB-F07` and `WEB-F07b` are complete: all 19 live migrations are recovered, executable-SQL equivalent to the stored live statements, and successfully replayed on an empty staging database. Remaining staging readiness work is tracked separately under `WEB-ENV01`, `WEB-F09` and the quality/security tasks.
