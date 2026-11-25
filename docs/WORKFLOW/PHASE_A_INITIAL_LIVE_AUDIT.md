# Phase A — Initial Live Database Audit (Preliminary)

**Date:** 25 November 2026  
**Target:** Current connected Supabase project for Everneed (read-only inspection)  
**Status:** Initial inventory; deeper migration/function/policy review remains in progress. No schema/data/settings changed.

## Scope and safety
Queries inspected live table metadata, RLS flags, policy definitions, selected function definitions and execution grants, profile role counts and store ownership counts. This is a preliminary snapshot, not a full security audit. No user-identifying profile data was retrieved.

## Observations

### Schema inventory
- Public tables cover profiles, stores, products/catalogue, orders, seller_orders, deliveries, payout/ledger/refund, support, chat, notifications, disputes, policy, settings and audit.
- Private schema includes finance accounts/journal lines/journals, payment attempts, provider-event inbox/refunds, financial snapshots and offer-funding/reservation records.
- Public base tables inspected have RLS enabled; FORCE RLS is not enabled. Need confirm ownership, grants, service-role behavior, policies and any views/materialized views separately.
- No public `store_members` or `staff_members` tables exist in this live snapshot. Store team roles/memberships therefore have no current table-based foundation.
- `conversation_members` exists for chat membership and must not be repurposed as store staff membership.

### Legacy identity and ownership
- Current `profiles.role` counts: admin 1, merchant 2, customer 1.
- Current stores: 3 total, 2 with owner_id. The ownerless store must be classified and resolved by the owner; don't auto-assign.
- Legacy authority helpers observed: `my_role()`, `is_admin()`, `owns_store()`, `my_store()`, and `private.need_admin()`.
- Existing admin/store-owner predicates appear in RLS and business RPCs. A permission registry migration must preserve compatibility until all consumers are inventoried and tested.

### Delivery/logistics current model
- `deliveries` currently has one row shape keyed to order: mode, courier name/phone, tracking note, parcel label, status, dispatched/delivered timestamps, proof. It does not expose explicit shipment-leg, hub/zone, courier identity/assignment, route stops, attempts, exception codes, structured POD or event-history columns in the inspected schema.
- `seller_orders` includes status, released, accept-by, rejection reason, accepted/ready/handed-over/hub-received/delivered timestamps and hub_check.
- Existing routes include direct/hub at order level.
- Existing `dispatch(order,courier jsonb)` is SECURITY DEFINER, calls `private.need_admin()`, throttles, checks order is `ready_for_delivery` on hub route, updates delivery to dispatched, transitions consolidated seller orders to out_for_delivery, sets order status/auto-confirm, notifies customer and audits.
- `seller_transition` is SECURITY DEFINER and checks signed-in actor, admin or store owner, paid/released seller order, blocks delivery/hub-only transitions, validates status transitions, handles direct delivery creation and notifies/audits.
- `order_tracking(order)` checks the order belongs to `auth.uid()`, returns order state, seller summaries and delivery object with ID/order ID stripped. Tracking is customer-owned; future dispatcher/customer access should be a distinct, scope-aware contract.

**Architecture implication:** Build the future event/fulfilment-leg model as an evolution of current seller_orders + orders + deliveries, with a compatibility adapter and migration plan. Do not create a competing delivery system or alter existing statuses before mapping all consumers and settlement/auto-confirm dependencies.

### Security-function snapshot
Selected SECURITY DEFINER functions inspected include `admin_store_workspace_context`, `dispatch`, `seller_transition`, `seller_adjust_variant_stock`, `order_tracking`, `cancel_order`, `cancel_order_for`, `is_admin`, `my_role`.
- All selected public business RPCs showed authenticated EXECUTE true and anon EXECUTE false, except `cancel_order_for` which showed authenticated false and service_role true. This is a grant snapshot, not proof of safe authorization.
- The selected functions commonly use empty or fixed search_path; continue checking all SECURITY DEFINER functions, schema qualification, nested private helpers, EXECUTE grants, parameter validation, and checks inside each entry point.
- `dispatch` and admin store workspace context call private admin guard; seller transition validates user/owner/admin; stock adjustment checks admin/store ownership; order_tracking checks buyer. Verify edge cases and RLS separately.

## Preliminary risk/architecture items (not yet severity-rated)
1. Legacy role and owner checks are distributed through policies/functions; migration must avoid partial enforcement or privilege gaps.
2. No team-membership table: scoped store roles require a new design and migration, but do not build before full dependency map.
3. Delivery is order-level/single-row with free-text courier and tracking fields; future assigned courier/dispatcher workflows need structured assignments, legs and event history while preserving current order and seller settlement behavior.
4. Audit visibility and coverage need review: establish who can read audit logs, what events are recorded, whether sensitive before/after values are redacted, and whether role/config/logistics events are complete.
5. SECURITY DEFINER function review remains incomplete; grant status alone is not sufficient.

## Next audit queries/reviews
- Enumerate full RLS policies, table grants, exposed views, triggers, edge functions, and all SECURITY DEFINER functions (including private schema).
- Compare live schema to repository migration files and migration history; identify drift.
- Trace current orders/delivery statuses across checkout, payment verification, seller transitions, hub consolidation, dispatch, tracking, delivery confirmation, auto-confirm and payouts.
- Review roles/admin checks in frontend and edge functions, and create a compatibility matrix.
- Review finance/payout/refund and support permissions for separation of duties and data minimization.
- Produce permission-key proposal mapped to existing operations, context scopes and test cases.

## No changes made
No migrations, production policies, RPCs, user data, secrets, provider configuration, or deployment settings were changed.


## Second-pass findings (focused metadata queries)

### Table-policy and grant notes
- The public RLS policy inventory shows explicit policies on marketplace/order/store and support tables; several internal tables intentionally have RLS enabled but zero policies (e.g. `kv`, `rate_limits`, `seller_product_listing_events`). Those tables are inaccessible through policy-based authenticated access unless a separately reviewed RPC/service route is used. Confirm intended use and service-only status.
- Private-schema tables are not RLS-enabled in this snapshot (finance journals/accounts, campaign budget/consent audit, financial snapshots). They are sensitive, so verify that the `private` schema is not exposed through the Supabase REST API and that table privileges remain restricted to owner/service paths. Do not infer exposure from the RLS flag alone.
- Metadata shows schema USAGE grants for anon/authenticated on `private` as well as public. This is a configuration review item: confirm PostgREST exposed-schema configuration and effective grants. An API-exposed private schema would be high risk; no direct access test was performed.
- The table-grant inventory shows broad base privileges on many public tables for anon/authenticated (including mutation privileges), with RLS intended to constrain rows/operations. This is not automatically a vulnerability, but warrants least-privilege grant review, especially tables with only SELECT or ALL policies and no mutation policy. Confirm effective privileges and test policies per role.

### SECURITY DEFINER inventory summary
- Snapshot count: 83 SECURITY DEFINER functions in public, 25 in private.
- All inspected SECURITY DEFINER functions have a configured search_path (often empty); this is a positive baseline, but not a substitute for reviewing qualified references, dynamic SQL, authorization and ACLs.
- ACL helper reported effective anon EXECUTE for some private helpers (`buys`, `owns_store`, `my_store`, `sells`, `store_live`) and trigger/guard functions, plus a few public read functions. This may be inherited from PUBLIC or explicit grants; resolve actual ACL sources and REST exposure before rating. The private schema's USAGE is also granted, so this is a priority configuration check.
- No blanket revocation or ACL change was made. Treat these as findings to validate, not proof of an exploit.

### Priority next checks
1. Confirm the Supabase API exposed schemas and role-level schema/table/function grants, particularly `private`.
2. Trace ACL inheritance vs explicit grants on SECURITY DEFINER functions, and inspect all anon-callable functions for intended public behavior.
3. Inspect each no-policy table's intended service-only access and verify the API doesn't expose unintended routes.
4. Review RLS policy expressions and permissive/restrictive composition for key sensitive tables; create a test matrix for buyer, store owner, unrelated merchant, customer, platform admin and anonymous actor.
5. Continue migration drift comparison and state-transition dependency tracing.


### ACL verification refinement
A focused ACL query confirms that several `private` helper functions have explicit EXECUTE grants to anon/authenticated (not merely inherited from PUBLIC), including `private.buys(text)`, `private.my_store()`, `private.owns_store(text)`, `private.sells(text)`, and `private.store_live(text)`. A trigger guard function also has a NULL ACL (PostgreSQL default EXECUTE to PUBLIC). The private schema has USAGE grants to anon/authenticated/service_role. However, the private tables showed no anon/authenticated table privileges in the inspected grant query.

**Action:** Verify API exposed-schema configuration and whether private RPCs are reachable. If `private` is not an exposed PostgREST schema, these grants may be inert for API access, but they still widen SQL-level permissions and should be least-privilege reviewed. If exposed, immediately classify callable functions by whether they reveal private context or permit any unsafe operation. No ACL changes were made.
