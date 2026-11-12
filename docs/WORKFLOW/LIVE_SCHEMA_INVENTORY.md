# Live schema inventory — Everneed01

**Project:** Everneed Supabase `zpgasfweaixwsktlueje`  
**Inspection date:** 12 Nov 2026  
**Environment:** Existing live project; read-only inspection only  
**Status:** Initial catalog inventory captured. This is evidence for a future clean baseline, not executable migration SQL.

## Safety and interpretation

This document records catalog facts observed from the existing project. It does not claim to recover the eight missing historical migration files. It is not a migration and must never be applied to production.

No schema, migration history, configuration, or row data was changed during this inspection. The existing `Everneed01` project remains the official database. Do not reset it, replay historical migrations, or infer missing historical SQL from current definitions.

The inventory is an initial pass. A baseline is not ready until the full definitions of tables, views, constraints, indexes, policies, grants, functions, triggers, sequences, types, storage policies, Auth dependencies, and required seed/configuration data have been exported, reviewed, and tested on a disposable database.

## Confirmed project-level facts

| Item | Observed |
|---|---|
| Live migration records | 19 |
| Repo migration SQL files | 11 (numbered 000–010) |
| Applied records missing SQL in repo | 8 |
| Public tables | 38 |
| Public indexes | 69 |
| Public RLS policies | 68 |
| Public non-internal triggers | 9 |
| Constraints in public tables | 363 |
| Functions in `public`, `private`, and `app_private` | 84 |
| RLS | Enabled on all 38 public tables |
| Profiles / products / orders | 0 / 0 / 0 rows |
| Support settings | 1 row |
| Support rules | 8 rows |
| Support queue | 1 row |
| Canned replies | 7 rows |

The four support/configuration tables above contain 17 rows in total. Preserve them; do not describe the database as completely empty.

## Public table inventory

The live public schema contains these 38 tables:

- `audit_log`
- `banners`
- `canned_replies`
- `cards`
- `collections`
- `conversation_members`
- `conversations`
- `deliveries`
- `disputes`
- `kv`
- `ledger_entries`
- `messages`
- `notifications`
- `offers`
- `order_item_fees`
- `order_items`
- `order_secrets`
- `orders`
- `payouts`
- `product_private`
- `products`
- `profiles`
- `rate_limits`
- `refunds`
- `reviews`
- `seller_orders`
- `settings`
- `size_charts`
- `store_applications`
- `store_payments`
- `store_plans`
- `store_private`
- `store_subscriptions`
- `stores`
- `support_queue`
- `support_rules`
- `support_settings`
- `waitlist`

Five public views were also identified in the existing DB contract: `public_stores`, `public_products`, `public_reviews`, `product_ratings`, and `auto_offers`. Their complete SQL definitions and security-invoker behavior still need explicit export and review.

## Other schemas observed

Catalog relations were present in these schemas:

- `auth`: 27 relations (27 tables)
- `extensions`: 2 relations
- `public`: 43 relations (38 tables; remaining relations include views)
- `realtime`: 8 relations (7 tables)
- `storage`: 10 relations
- `supabase_migrations`: 1 table
- `vault`: 2 relations (1 table)

Supabase-managed schemas are not to be copied blindly into an application baseline. The baseline must declare required platform dependencies and let Supabase provision its managed schemas.

## Installed PostgreSQL extensions

The installed extensions observed were:

| Extension | Version | Schema |
|---|---:|---|
| `pg_stat_statements` | 1.11 | `extensions` |
| `pgcrypto` | 1.3 | `extensions` |
| `plpgsql` | 1.0 | `pg_catalog` |
| `supabase_vault` | 0.3.1 | `vault` |
| `uuid-ossp` | 1.1 | `extensions` |

`pg_cron` and `pg_net` are not installed. Do not add them as part of this recovery baseline without a separate design/review for scheduled jobs and network calls.

## Storage

One application bucket was observed:

| Bucket | Public | Max file size | Allowed MIME types |
|---|---:|---:|---|
| `media` | yes | 5 MiB | image/jpeg, image/png, image/webp, image/gif |

The bucket's object policies, ownership rules, and upload/update/delete grants still require a separate full export and review. Public bucket read does not imply public write.

## User-defined triggers observed

These nine non-internal triggers exist on public tables:

| Table | Trigger | Timing / operation | Function |
|---|---|---|---|
| `ledger_entries` | `ledger_guard` | BEFORE DELETE OR UPDATE | `private.ledger_guard()` |
| `messages` | `chat_guard_bi` | BEFORE INSERT | `chat_guard()` |
| `messages` | `chat_triage_ai` | AFTER INSERT | `chat_triage()` |
| `orders` | `orders_guard` | BEFORE UPDATE | `private.orders_guard()` |
| `products` | `products_guard` | BEFORE INSERT OR UPDATE | `private.products_guard()` |
| `profiles` | `profiles_guard` | BEFORE UPDATE | `private.profiles_guard()` |
| `seller_orders` | `seller_orders_guard` | BEFORE UPDATE | `private.seller_orders_guard()` |
| `store_private` | `store_private_guard` | BEFORE INSERT OR UPDATE | `private.store_private_guard()` |
| `stores` | `stores_guard` | BEFORE INSERT OR UPDATE | `private.stores_guard()` |

These are only trigger names and definitions. Every referenced function body, owner, execution grant, search path, and dependency must be captured before baseline acceptance.

## Security inventory summary

- All 38 public tables have RLS enabled.
- 68 public RLS policies were counted.
- 69 public indexes were counted.
- 363 table constraints were counted.
- 84 functions were counted across `public`, `private`, and `app_private`.

The counts do not prove policy correctness or full security equivalence. The complete definitions, role grants, function privileges, SECURITY DEFINER attributes, safe search paths, view security settings, and storage object policies remain to be exported and audited. Keep internal helper functions in non-exposed schemas where appropriate; never assume a SECURITY DEFINER function is safe merely because it exists.

## Baseline reconstruction plan

1. Preserve this read-only evidence and continue searching for exact original SQL in Claude's working copy, original ZIPs, CI artifacts, and backups.
2. Export the current application-owned schema definitions in a deterministic form. Exclude Supabase-managed internals that are provisioned by the platform.
3. Capture complete DDL and privilege definitions, not only object names or counts.
4. Separate schema DDL from seed/configuration data. Identify and preserve the 17 observed support/configuration rows and any other intentional seed data.
5. Reconcile every exported object against the eleven existing migration files and all 19 live migration records.
6. Create a clearly labelled fresh-install baseline strategy; do not mislabel reconstructed SQL as the missing historical migrations.
7. Test the baseline on a disposable Supabase project/branch, then compare its schema and security behavior with the live project.
8. Only after review, document how future incremental migrations proceed from the baseline. Do not modify live migration history as part of baseline preparation.

## Acceptance criteria

The baseline is not complete until:

- A clean disposable database can be built from the documented baseline and required platform setup.
- All expected application-owned tables, views, types, sequences, indexes, constraints, functions, triggers, and grants exist.
- RLS and storage policies are functionally equivalent to the reviewed live project.
- Required seed/configuration records are intentionally recreated and verified.
- Database tests and security advisors pass, with any exceptions documented.
- A schema comparison shows no unexplained differences.
- A rollback/recovery plan exists before any production-facing change is proposed.

## Current decision

Continue development on `web-portal`, release through reviewed PRs to `main`, and keep `Everneed01` untouched. The missing historical SQL remains unrecovered. This inventory is the starting evidence for a separate, tested fresh-install baseline—not permission to rebuild or alter production.
