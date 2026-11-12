# Live migration recovery record

**Project:** Everneed Supabase `zpgasfweaixwsktlueje`  
**Inspection date:** 12 Nov 2026  
**Status:** forensic inventory in progress; original SQL for eight applied migration records is missing from the repository and has not yet been recovered.

## Safety boundary

This document records read-only observations from the live database. It is **not** a replacement migration chain and must not be used to recreate production by applying inferred DDL. No migration was applied, no schema was changed, and no data was modified during this inspection.

Do not mark any of the eight missing migration records as recovered until their original SQL is found in a reliable source (for example a developer working copy, backup, CI artifact, or Supabase migration backup) and reconciled against this live inventory.

## Confirmed migration history

A fresh read-only call to the live Supabase migration-history endpoint returned **19 applied records**, not just the five newer records previously highlighted.

| Version | Live migration name | SQL file in repo |
|---|---|---|
| 20261029014653 | 000_baseline | yes |
| 20261029014658 | 001_remove_cj | yes |
| 20261029014913 | 002_hotfix | yes |
| 20261029044105 | multivendor_foundation | **NO — missing** |
| 20261029044131 | multivendor_function_grants_hardening | **NO — missing** |
| 20261029081939 | 003_remove_unrecorded_multivendor | yes |
| 20261029134730 | signup_profile_fields | **NO — missing** |
| 20261029184309 | 004_marketplace_core | yes |
| 20261029184336 | 005_marketplace_backfill_guards | yes |
| 20261029184403 | 006_marketplace_rls | yes |
| 20261029184540 | 007_marketplace_functions | yes |
| 20261030002325 | 008_hardening | yes |
| 20261031105857 | 009_profile_settings | yes |
| 20261102105101 | 010_seller_helpers | yes |
| 20261104011326 | 011_plans_and_limits | **NO — missing** |
| 20261111073217 | 012_support_chat_and_waitlist | **NO — missing** |
| 20261111073234 | 013_support_chat_hardening | **NO — missing** |
| 20261111073320 | 014_chat_start_official_store | **NO — missing** |
| 20261111073610 | 015_support_sla_public | **NO — missing** |

The repository currently contains the eleven files numbered 000–010. The live database has **eight additional applied migration records whose SQL files are absent**: multivendor_foundation, multivendor_function_grants_hardening, signup_profile_fields, and 011–015. The earlier recovery note focused on 011–015; this expanded inventory corrects that incomplete scope.

The old shared/sql/011_website_sync.sql is only a partial waitlist/site-sync script and is not equivalent to any of the missing migration records. No original SQL for the eight missing records has been recovered yet.

## Live schema evidence

Read-only catalog queries confirmed these tables and their columns:

- Plans and billing: `store_plans`, `store_subscriptions`, `store_payments`.
- Support and chat: `conversations`, `conversation_members`, `messages`, `canned_replies`, `support_queue`, `support_rules`, `support_settings`.
- Website acquisition: `waitlist`.

Notable observed fields include:

- `store_plans`: name, price, period, product_limit, commission_discount, features, active.
- `store_subscriptions`: store_id, plan_id, status, current_period_start, current_period_end, grace_until.
- `store_payments`: store_id, subscription_id, amount, currency, method, reference, status, paid_at, recorded_by.
- `conversations`: kind, subject, store_id, order_id, created_by, status, priority, tier, tags, assignee, escalation fields, SLA fields, unread/preview fields and timestamps.
- `conversation_members`: conversation_id, user_id, role, unread, last_read_at, muted, joined_at.
- `messages`: conversation_id, sender_id, sender_role, kind, body, meta, created_at.
- `support_queue`: visitor id, name, topic, page, status, claimed_by, created_at, last_seen.
- `support_rules`: name, pattern, applies_to, action, tag, priority, reason, reply, active.
- `support_settings`: key, JSON value, updated_at.
- `waitlist`: email, name, role, country, interest, source, status, created_at.

## Live security and trigger evidence

RLS policies observed in the live catalog:

- `store_plans`: active plans readable by authenticated users; all operations restricted to admins.
- `store_subscriptions`: reads restricted to owning store or admin.
- `store_payments`: reads restricted to owning store or admin.
- `conversations`: members/admins can read; admin-only direct update policy.
- `conversation_members`: user/member/admin read policy.
- `messages`: members/admins can read; internal `note` messages are hidden from non-admins.
- `canned_replies`: scoped admin/seller read and write policies.
- `support_queue`, `support_rules`, `support_settings`: admin-only table policies.
- `waitlist`: admin-only table policy.

Observed message triggers:

- `chat_guard_bi`: BEFORE INSERT calls `chat_guard()`.
- `chat_triage_ai`: AFTER INSERT calls `chat_triage()`.

## Function definitions captured from live catalog

The following live function definitions were retrieved using `pg_get_functiondef` and should be preserved as evidence while the original migrations are sought:

- Plans/subscriptions: `choose_plan`, `apply_rental_payment`, `apply_rental_payment_for`, `expire_rentals`, `support_tier`.
- Chat: `chat_start`, `chat_send`, `chat_read`, `chat_set`, `chat_escalate`, `chat_escalate_core`, `chat_member`, `chat_guard`, `chat_triage`.
- Guest support: `support_guest_open`, `support_guest_ping`, `support_guest_close`.
- SLA: `support_sla_minutes`, `support_sla_public`, `support_sla_sweep`.
- Waitlist: `join_waitlist`.

These definitions are evidence of current live behavior, not proof of the exact historical migration contents. Some functions depend on helpers, triggers, policies, sequences, indexes, grants, and private-schema functions that must also be inventoried before a faithful reconstruction can be considered complete.

## Recovery checklist

1. Search the developer's original working copies, exported project ZIPs, CI artifacts and backup locations for the exact SQL files for all eight missing records.
2. Compare each recovered file with the live definitions, including table constraints, indexes, policies, grants, triggers, helper functions and seed/configuration rows.
3. Preserve exact historical files where available. If an original cannot be recovered, do not fabricate its historical contents; instead design a clearly labelled forward baseline/reconciliation strategy for a fresh database and document its limitations.
4. Test the complete migration chain against a disposable database/project before proposing any production change.
5. Keep production untouched until a reviewed plan proves that no already-applied migration will be replayed against the live project.

## Current conclusion

Migration drift remains open across eight missing applied SQL files. The current GitHub repository exposes only main and web-portal; the previous everneed01 branch is no longer present. A Library search did not surface a usable Everneed source archive. No original SQL has been recovered in this pass. This record improves the evidence but does not close drift or make a fresh database reproducible.
