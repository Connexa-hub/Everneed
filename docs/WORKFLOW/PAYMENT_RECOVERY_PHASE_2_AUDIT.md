# Payment Recovery Phase 2 — Staging Audit

**Audit date:** 2026-11-16  
**Branch reviewed:** `web-portal`  
**Staging project:** `Everneed-staging` (`vjiadqygpyebpisxslbx`)  
**Production:** Not queried or changed.

## 1. Verified staging state

- The migration ledger records migrations `000` through `028`, including `026_payment_lifecycle`, `027_payment_checkout_snapshot`, and `028_payment_attempt_rpc`.
- The private payment-attempt, provider-event-inbox, and provider-refund tables exist with the expected core columns and indexes.
- The payment-attempt and provider-event-inbox tables currently contain no rows in staging. This is a structural baseline, not an end-to-end payment test.
- The deployed `paystack` Edge Function is ACTIVE at version 1 with `verify_jwt=false`. The GitHub source changes are not proof that this deployed function has been updated.
- `pg_cron`, `pg_net`, and `pgmq` are available extensions but are not installed in staging. The `vault` schema and its secret-management functions exist.

## 2. Migration/source drift found

The live staging definitions do not fully match the current `web-portal` migration source:

1. Live `public.settle_verified_payment_attempt(text,text,bigint,text)` does not contain the explicit attempt-owner, order-owner, checkout-snapshot-hash, or snapshot-version comparisons present in the current branch's 028 source. The live function does contain a post-cancellation guard.
2. Live `public.record_verified_provider_event(text,text,text,text,jsonb)` determines the duplicate flag using event age (`received_at < now() - interval '1 second'`). The current branch's 028 source uses the insert row count, which is the reliable way to distinguish a newly inserted event from a conflict.

The migration ledger alone therefore is not sufficient evidence that the live function bodies equal the current source. Do not treat this as proof of a customer-facing exploit; it is a verified integrity and release-drift gap that must be corrected and regression-tested.

## 3. Recovery design

The worker must be safe under duplicate invocation, overlapping runs, webhook redelivery, and process crashes.

- Claim inbox events and stale attempts atomically using row locks with `SKIP LOCKED`, short lease tokens, and lease expiry.
- Process only signature-verified inbox events. Re-fetch the transaction from Paystack by the stored provider reference; never settle from the webhook payload alone.
- Require exact reference, attempt ID, order ID, user ID, amount, and currency matches before calling the settlement RPC.
- Keep settlement idempotent. A second transaction for an already-paid order, an unknown reference, a cancelled order, or any mismatch goes to reconciliation rather than seller release.
- Retry transient provider/network/database failures with bounded exponential backoff. After the configured retry ceiling, quarantine the event for manual review.
- Recover stale `initializing` attempts by verifying the same persisted reference. Do not create a new reference or blindly initialize another charge. Mark an attempt failed only when Paystack provides a conclusive terminal/not-found result; otherwise retry verification or send it to reconciliation.
- Verify stale `pending` attempts periodically. A verified success settles once; an authoritative failure becomes terminal; a still-pending transaction is rescheduled.
- Keep event leases and attempt-recovery leases separate so an event worker and an attempt worker can safely overlap.

## 4. Scheduling and environment boundary

No scheduler is currently installed in staging. A recovery Edge Function alone would not run periodically. The implementation must include a secure scheduled invocation path and environment-specific secrets. Do not put service-role keys or recovery tokens in source code, migration files, or logs.

The staging scheduler must call only the staging function URL and use staging-only credentials. Production must have a separate deployment, secrets, and schedule. No production scheduler or endpoint is to be configured as part of this phase.

## 5. Phase 2 implementation gates

1. Add migration `029` to correct the verified live/source drift, add lease/retry metadata, and expose only service-role recovery RPCs.
2. Add a recovery Edge Function that verifies provider transactions before settlement and safely resolves stale attempts.
3. Add structural and behavioral SQL checks for lease ownership, expired-lease reclaim, bounded retries, terminal-state protection, exact metadata/amount/currency checks, and client-role denial.
4. Run CI and local database tests. Review function grants, search paths, RLS, and concurrency behavior.
5. Only after source/tests are reviewed, request explicit authorization before applying migration 029 or deploying the recovery function to staging. Production remains untouched.

