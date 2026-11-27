# CX-04 staging privilege audit — initial narrow remediation

**Date:** 27 Nov 2026  
**Target:** Everneed-staging `vjiadqygpyebpisxslbx` only  
**Production:** untouched  
**Status:** Initial grant inventory + non-API privilege removal; broad DML/default-ACL review remains incomplete.

## Verified result

- Before remediation, `authenticated` held `UPDATE`, `DELETE` and `TRUNCATE` on `public.disputes`. RLS is not a TRUNCATE control.
- Revoke applied to all public base tables for API roles `anon` and `authenticated`: `TRUNCATE`, `TRIGGER`, `REFERENCES`.
- Post-change catalog assertion: **0 public base tables** retain any of those privileges for either API role.
- `public.disputes`: authenticated TRUNCATE = false; UPDATE and DELETE remain true (row policies apply). Those DML grants require further review.
- Residual matching privileges reported on five views (`auto_offers`, `product_ratings`, `public_products`, `public_reviews`, `public_stores`) are view-level grants; TRUNCATE is not applicable to views. The regression test deliberately checks base tables only.

## Initial direct DML grant inventory (base tables)

The staging catalog showed direct DML grants (INSERT/UPDATE/DELETE, with SELECT often also present) on:

- `anon`: banners, category_attributes, collections, offers, orders, product_inventory_movements, product_links, product_media, product_price_tiers, product_variant_private, product_variants, products, profiles, reviews, settings, size_charts.
- `authenticated`: banners, canned_replies, cards (DELETE only), category_attributes, collections, conversation_members, conversations, disputes, kv, messages, offers, orders, policy_documents, product_inventory_movements, product_links, product_media, product_price_tiers, product_private, product_variant_private, product_variants, products, profiles, rate_limits, reviews, seller_verification_rules, settings, size_charts, store_plans, support_queue, support_rules, support_settings, waitlist.

These are **SQL ACL facts, not proof of API reachability or a vulnerability**. RLS and column privileges are separate controls. This inventory is not yet mapped to every frontend, RPC, trigger and service call-site, so no blanket DML revocation is included.

## Next required pass

1. Map each direct DML table to exact frontend/Android/Edge/RPC/trigger caller and required columns.
2. Capture effective column grants and policy predicates; identify public guest-form exceptions.
3. Review both `postgres` and `supabase_admin` default ACLs for future tables, functions and sequences; separate remediation.
4. Draft table/column allowlist and RPC-only conversion candidates; add negative and positive regression tests.
5. Validate the full change against staging browser/app flows before any further grant reduction.

## Files and validation

- Migration: `supabase/migrations/20261127110139_cx04_public_table_privilege_trim.sql`
- Test: `supabase/tests/040_cx04_public_table_privilege_checks.sql`
- CI: Database tests step wired in `.github/workflows/build.yml`
- Replay manifest: `.github/workflows/migrations-check.yml`

No order, user, ledger or dispute fixture data was written. Production and `main` were not touched.
