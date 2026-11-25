# Phase A — Verified Initial Audit: Everneed01

**Date:** 25 November 2026  
**Project:** Supabase project **Everneed01**  
**Project ref:** `zpgasfweaixwsktlueje`  
**Status:** Read-only inventory. No data, schema, ACL, settings, or deployment changes.

This is the correctly targeted initial snapshot. A previous preliminary query was accidentally run against `Everneed-staging` (`vjiadqygpyebpisxslbx`) and is explicitly marked staging-only in its document; do not use it as the Everneed01 report.

## Confirmed project selection
The connected Supabase project list shows two projects:
- `Everneed01` — ref `zpgasfweaixwsktlueje` (this report's target)
- `Everneed-staging` — ref `vjiadqygpyebpisxslbx` (earlier preliminary scan only)

## Live baseline
- Public tables include core marketplace tables: profiles, stores, products, orders, seller_orders, deliveries, payout/ledger, refunds, store applications, support/chat, notifications, disputes, policies and settings.
- All inspected public base tables have RLS enabled; FORCE RLS is not enabled.
- Current role counts: `admin=1`, `customer=2`. No merchant profile is present in the role count snapshot.
- Store count: 1, with **0 owner_id populated**. Do not assign an owner or presume this is a live seller store. Ownerless store must be classified by the project owner.
- `store_members` and `staff_members` tables do not exist. `conversation_members` exists for chat.
- Migration history in this project is recorded through `015_support_sla_public` (versions 2026-10-29 through 2026-11-11). This differs materially from the staging project's much newer migration history. Repository/live migration parity must be checked carefully before any migration proposal.

## Existing authorization baseline
Policies inspected for orders, seller_orders, deliveries, profiles, stores, products, refunds, ledger_entries, payouts, audit_log and store_applications:
- Orders: buyer or admin SELECT; admin UPDATE.
- Deliveries: buyer or admin SELECT.
- Seller orders: admin or owner of store when seller order released.
- Products: store owner/admin paths, public published product path, owner deletion constrained to draft/rejected.
- Stores: owner/admin reads and updates, public approved + live reads; owner creation constrained to draft/pending.
- Profiles: self/admin read; self update with role invariant.
- Refunds: admin, buyer, or selling store.
- Payouts and ledger entries: admin or store owner.
- Store applications: owner/admin read, owner write path constrained by decision-null.
- Admin-only audit log SELECT.
Policies are row-level boundaries but depend on current role/ownership helpers. A new permission system must not bypass these and must be migrated with compatibility tests.

## RPC snapshot
Selected functions on this target include:
- `dispatch(order,courier)`, `hub_receive(seller_order,check)`, `hub_consolidate(order)`, `mark_delivered(order,code)`, `seller_transition(seller_order,to,payload)`, `order_tracking(order)`, `cancel_order(order,reason)`.
- These are SECURITY DEFINER and show authenticated EXECUTE (except `cancel_order_for`, which is not granted to authenticated); anon EXECUTE is false on selected public business RPCs.
- `private.my_store()` and `private.owns_store(text)` show effective anon/authenticated EXECUTE and private schema USAGE grants for anon/authenticated. Private table privileges to anon/authenticated returned none in the inspected grant query. API-exposed-schema configuration remains to be verified. These helpers are context/ownership predicates, but the grants still need least-privilege and exposure review.
- Selected functions use fixed `search_path=public`; review full definitions, authorization, ACLs and input validation.

## Delivery structure
Current `deliveries` is order-level and has mode, courier_name, courier_phone, tracking_note, parcel_label, status, dispatched_at, delivered_at, proof. `seller_orders` holds seller workflow status/timestamps including accepted, ready, handover, hub_received and delivered. `orders` holds direct/hub route and global state. No structured courier membership/assignment, zone, route stop, shipment leg, delivery attempt, exception or event history was found in these inspected fields.
Design should evolve this existing workflow, not create an independent delivery model or break payment/settlement/order status dependencies.

## Initial risks / questions
1. **Migration parity:** Everneed01 has migrations only through 015 in its history, whereas staging has a much later history. Reconcile this with `web-portal` branch and determine which migrations are intended for production before planning any rollout.
2. **Ownerless store:** single store, no owner_id. Determine official/demo/unclaimed status before any ownership or access changes.
3. **Legacy authorization:** direct admin/owner checks in RLS and RPCs are the current enforcement model; inventory consumers and keep compatibility during migration.
4. **Team roles:** no membership tables, so store staff/dispatcher/courier role assignment is a new capability.
5. **Private helper grants:** private schema USAGE and EXECUTE on selected ownership/context helpers granted to anon/authenticated; private table access is not granted in queried table ACLs. Confirm private is not API-exposed and review least privilege.
6. **Delivery event model:** currently order/seller-order status + one delivery record; carefully plan event history/assignment and compatibility.
7. **RLS test coverage:** validate buyer, owner, unrelated seller, admin, anon and future scoped staff across SELECT/INSERT/UPDATE/DELETE and RPCs.

## Next actions
- Inspect migration files from `web-portal` and compare to Everneed01's migration history; identify missing, divergent, and unapplied migrations. Do not apply any.
- Inspect all Everneed01 SECURITY DEFINER functions, exposed schemas, grants, views, triggers, edge functions and frontend authorization.
- Build the authorization matrix and high-risk security review.
- Trace delivery/payment/settlement lifecycle before designing event tables or RPCs.
- Draft the permission registry and scopes in documents only after inventory.
- No live modifications until the audit is reviewed and owner explicitly approves.

