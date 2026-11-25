# Everneed01 vs Everneed-staging — Environment Drift Alert

**Date:** 25 November 2026  
**Read-only project comparison.** No schema/data/config changes.

## Projects
- **Everneed01 (intended live/main):** `zpgasfweaixwsktlueje`; migration history ends at `015_support_sla_public` (2026-11-11).
- **Everneed-staging:** `vjiadqygpyebpisxslbx`; migration history includes many additional changes through `20261122140408_fin03_verified_payment_journal_posting` (2026-11-22).

## Snapshot differences verified
- Everneed01: 38 public base tables inspected; lacks `product_variants`, `category_attributes`, `seller_plan_entitlements`, several later catalogue/finance support tables found in staging.
- Everneed01 roles at snapshot: one admin, two customers; one store and its `owner_id` is null.
- Everneed-staging has additional marketplace catalogue, variant, entitlements and finance snapshot structures and more recent migrations.
- Both show legacy admin/owner RLS patterns and existing orders/deliveries, but schema parity is not established.

## Operational warning
Do **not** assume `web-portal` code or the staging DB migration history is safe to deploy to Everneed01. There is a significant environment gap. Treat the current repository migrations as a candidate migration set only after:
1. mapping migration files to each live project's history;
2. reviewing dependencies/order, destructive or backfill effects, and any unrecorded migration drift;
3. running a fresh staging backup and migration rehearsal;
4. validating checkout, payment, financial ledger, seller/store, catalogue, delivery, RLS and CI tests against the candidate target;
5. obtaining explicit owner approval before production migration.

## Audit target
Phase A live audit must prioritize Everneed01 for production architecture and separately use Everneed-staging for rehearsal/validation. Never mix findings or migration histories between project refs.
