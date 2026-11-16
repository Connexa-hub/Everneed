# Payment Recovery Phase 2 — Staging Audit and Implementation Record

**Audit date:** 2026-11-16  
**Branch:** `web-portal`  
**Staging project:** `Everneed-staging` (`vjiadqygpyebpisxslbx`)  
**Production:** Not queried or changed.

## 1. Verified staging migration state

The read-only Supabase migration ledger records 30 versions: `000`, `001`, `002`, `0020`, `0021`, `003`, `0030`, and `004` through `029`.

### Important deployment incident

The repository's former `.github/workflows/staging-db.yml` had a `push` trigger for migration files on `web-portal`. The first 029 migration commit therefore started a staging deployment automatically, without a separate in-chat approval.

- Workflow run: [43795299918](https://github.com/Connexa-hub/Everneed/actions/runs/43795299918)
- The job log explicitly shows `Applying migration 029_payment_recovery_worker.sql...` at 2026-11-16 02:58:25 UTC.
- The later run [43795546437](https://github.com/Connexa-hub/Everneed/actions/runs/43795546437) reported the remote database was already up to date.
- The migration ledger now records 029. This is an unintended staging-only change, not approval for further staging or production deployment.

The push trigger has been removed. `staging-db.yml` now runs only through manual workflow dispatch, retaining the exact staging/live project-ref guard. The migration file `029_payment_recovery_worker.sql` was restored to the exact source content from the commit that was applied. Never edit or reapply 029; follow-up changes belong in 030.

Production project `Everneed01` (`zpgasfweaixwsktlueje`) was not queried or changed.

## 2. Read-only verification after 029

A read-only catalog query against staging confirmed:

- `claim_provider_event_recovery(integer,integer,integer)` exists.
- `finish_provider_event_recovery(uuid,uuid,text,text,text,integer)` exists.
- The settlement RPC now checks the immutable snapshot digest.
- Provider-event duplicate detection uses the actual insert row count.
- `anon` cannot execute the claim RPC; `authenticated` cannot execute the finish RPC.
- There are currently zero payment-attempt rows and zero provider-event rows.
- `pg_cron`, `pg_net`, and `pgmq` are not installed.
- `get_payment_attempt_recovery_context(text)` is not yet present in staging; it is part of pending migration 030.

The deployed `paystack` Edge Function remains ACTIVE v1 with `verify_jwt=false`. Source updates on GitHub are not evidence of a deployed function. The new `payment-recovery` Edge Function is source-only and is not deployed or scheduled.

## 3. What migration 029 contains

The exact applied 029 migration:

- Adds lease token, lease expiry and dead-letter timestamp fields to the provider-event inbox.
- Adds due-event and lease-expiry indexes.
- Adds bounded retry/dead-letter states.
- Claims due events atomically with `FOR UPDATE SKIP LOCKED`, increments attempts at claim time and assigns expiring lease tokens.
- Finishes an event only when the worker presents the active lease token.
- Uses exponential retry backoff and dead-letters exhausted events.
- Corrects provider-event duplicate detection using `GET DIAGNOSTICS ... ROW_COUNT`.
- Strengthens settlement with attempt/order ownership, snapshot hash/version, snapshot amount, currency/exponent and cancellation checks.

Migration 029 is already in staging. The current repository copy is restored to the applied source version.

## 4. Migration 030 and worker source — not deployed

Migration `030_payment_recovery_context.sql` is source-only. It:

- Recreates the claim RPC with a `signature_verified` return column (PostgreSQL requires drop/recreate to change a TABLE return type).
- Adds a service-role-only `get_payment_attempt_recovery_context(text)` RPC that returns persisted attempt/order identity and exact amount/currency.
- Keeps both RPCs unavailable to `anon` and `authenticated`.

The `payment-recovery` Edge Function is also source-only. Its intended safety path is:

1. Require a service-role JWT at the Edge Function gateway and verify the configured service credential in the handler.
2. Claim only inbox events with a lease.
3. Refuse events whose stored signature-verification flag is false.
4. Re-fetch the transaction directly from Paystack using the stored reference.
5. Require the provider-verified reference and transaction ID to match the signed event.
6. Compare Paystack's server-verified order/user metadata, amount and currency against the trusted database attempt context.
7. Call the settlement RPC only after those checks.
8. Complete only the lease token it owns; transient errors retry with bounded backoff, while mismatches are quarantined for reconciliation.

Migration 030 and the worker must pass local database replay, SQL regression tests and function type/syntax checks before any staging deployment is considered.

## 5. Migration 031 — stale attempt recovery (source-only)\n\nMigration 031 adds a separate lease lifecycle for stale `initializing`, `pending` and `processing` attempts. It never initializes or charges a new transaction. The worker re-verifies the existing reference; `failed` and `abandoned` can close an attempt, `pending` / `ongoing` / `processing` / `queued` are retried, and `reversed` or unknown states require reconciliation. A database trigger prevents a new attempt from being inserted for an order while a prior attempt is `succeeded` or `reconciliation_required`.\n\nMigration 031 is in the repository but has not been applied to staging. The first full local replay and 031 SQL test passed on commit `939d526`; the subsequent guard/message hardening is being re-run in CI. Staging remains at 029; 030 and 031 require manual dispatch with the explicit `APPLY` input. The next new repository migration number is 032.\n\n## 6. Remaining payment recovery work

Not yet implemented:

- A production-grade schedule. Supabase scheduling with `pg_cron` + `pg_net` is unavailable until the extensions are deliberately enabled and secrets are stored safely; an external scheduler is an alternative but needs its own environment controls.
- Audit of legacy `confirm_payment`, `admin_confirm_payment`, `report_payment`, saved-card and pay-on-delivery flows.
- Provider-confirmed refunds and refund accounting.

The recovery worker must not create a new charge reference when recovering an ambiguous initialization. It must verify the same persisted reference first. A transaction that is pending, missing, or inconclusive must not be treated as a failure or a successful payment without authoritative provider evidence.

## 7. CI and release gates

- Migration naming/order validation now includes 030.
- The local database workflow runs the 029 lease/settlement checks, 030 context/privilege checks, and 031 stale-attempt lease/guard checks after applying the migrations.
- The worker is checked for service-role authorization, Paystack verification before settlement, trusted attempt-context matching, and lease completion.
- Commit `939d526` passed Install and test, Deno type-check, and the complete Database tests job including 029, 030 and 031. The Android APK packaging job was still running at the last check; later source hardening commits are undergoing another CI pass.
- PR #31 remains open and unmerged.
- Staging migration application now requires manual workflow dispatch and explicit owner approval.
- No production migration, production Edge Function deployment, production scheduler or production database modification is authorized.

## 8. Next implementation order

1. Finish local replay and regression tests for 029 and 030; fix all failures before proceeding.
2. Add Deno/type checks for the recovery worker and review its runtime/auth contract.
3. Implement separate stale-attempt recovery without generating duplicate charges.
4. Review and test legacy/manual/POD payment paths.
5. Choose and document a secure staging scheduler; keep staging and production credentials and endpoints separate.
6. Present the complete source/test evidence and request explicit approval before manually applying migration 030 or deploying any Edge Function to staging.
7. Keep production untouched until a separate release review and explicit approval.
