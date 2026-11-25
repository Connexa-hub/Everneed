# Phase A — frontend privilege dependency map (initial)

**Date:** 25 Nov 2026  
**Branch:** `web-portal`  
**Scope:** Static source inspection only; Everneed01 remains read-only. This is an initial dependency map, not a complete codebase scan or a migration-ready allowlist.

## Protocol and latest frontend status
- Read `AI_PROTOCOL.md`, tracker, roles/access proposal, backend handoff, privilege-hardening plan and current audit.
- Tracker task claimed by ChatGPT before inspection.
- Latest Claude commits: WEB-S22 parts 24–25. Team/staff and dispatcher screens are previews behind `?proto=1`; all sample data and writes are mocked/disabled. Dispatcher reads no backend and is not in real navigation. No security or backend contract implied by these previews.

## Direct REST dependencies observed in inspected files

### Seller read paths
- `stores`: owner-filtered store fetch by `owner_id`; reads store profile/state.
- `products`: store-filtered product list; status, stock and editor fields.
- `product_private`: product review note/compliance reference (soft-fail).
- `collections`: category catalogue read.
- `size_charts`: seller size-chart list.
- `store_private`: seller private/store contact details (store-scoped).
- `store_applications`: application and plan/business details (store-scoped).
- `notifications`: user's recent notifications.
- `policy_documents`: published/effective acceptance-required documents for country.
- `seller_verification_rules`, `store_verification_checks`: activation and verification UI reads.
- `store_plans`, `seller_plan_entitlements`: plan/capability display reads in portal/admin screens.
- `store_subscriptions`: subscription display (admin store listing).

### Seller direct mutations observed
- `stores`: create draft with owner_id; update seller-editable store details, categories/location, storefront details, logo/cover URLs. The frontend intentionally does not send owner_id on updates.
- `store_private`: upsert seller phone/contact details.
- `store_applications`: create/update business name and store application fields in onboarding.
- `products`: insert/edit product draft, duplicate, and set review status; direct status update path exists in the inspected workspace. Must classify whether supported status transitions should be RPC-only and ensure policy/grants match.
- `product_private`: insert/update compliance reference.
- `storage`: uploads are through the shared Supa.upload helper; bucket/policy ACLs are separate scope and not classified here.
- Plan selection, policy acceptance, store submission and activation are RPCs: `choose_plan`, `accept_policy`, `submit_store`, `request_store_activation`.

### Admin direct read paths observed
- `stores`, nested `store_applications` and `store_private`; `profiles` for application owner identity.
- `products` and nested `stores`, `product_private` for review queues.
- `store_plans`, `seller_plan_entitlements`, `store_subscriptions`, `seller_verification_rules`, `store_verification_checks`.
- Operational summaries: `orders`, `seller_orders`, `disputes`, `deliveries`, `support_queue`, `waitlist`.
- `audit_log` (scoped to target store in inspected view).
- Official Everneed store context is fetched through `admin_store_workspace_context`; its product/order/conversation summaries use scoped REST reads.
- Admin writes observed are predominantly RPCs: `approve_store`, `reject_store`, `review_product`, `suspend_store`, `admin_set_plan_entitlements`. Waitlist page is a direct read.

### Support/inbox direct mutations observed
- `conversation_members` and conversation/message reads are participant-scoped or admin reads.
- Guest support queue: direct patch of `support_queue` to claim guest session (`status=active, claimed_by`) and close guest session (`status=closed`); public guest open/ping/close API paths are distinct.
- `support_settings`: direct read and patch of SLA settings.
- `support_rules`: direct read and patch active toggle.
- Chat actions are RPCs: `chat_set`, `chat_escalate`, `chat_start`; periodic SLA sweep uses `support_sla_sweep`.
- The support queue direct mutations and settings/rules writes require explicit role/admin and row/column grant classification before revocation.

## Grant-migration implications
1. A blanket revoke of all direct INSERT/UPDATE/DELETE from `authenticated` would break seller draft/store setup, product editing, store private/application upserts, and support settings/queue paths unless these are converted to RPCs or column/table grants are explicitly retained.
2. Anon direct write privileges should be removed by default; the public waitlist/guest-support workflows should be checked against their Edge Function/RPC contracts and remain only through intentionally exposed endpoints.
3. Admin pages use several direct reads of operational/financial tables. Their RLS and table grants need a role-scoped admin strategy; do not assume the legacy `profiles.role='admin'` check is a sufficient future staff permission model.
4. Direct product status mutations are a potential transition boundary. Inspect the RLS policies, review RPC paths, and make a decision in the contract before any migration.
5. Storage and Realtime are separate privilege scopes. This mapping does not cover storage bucket policies, publication membership or function EXECUTE grants.

## Evidence limits
- Files inspected: `workspace.js`, `setup.js`, `portal.js`, `seller-flow.js`, `admin.js`, `ds-admin.js`, `inbox.js`, `ds-access.js`, `ds-team.js`, `ds-dispatch.js`, `ds-lazy.js`, `shared/config.js`, `shared/supa.js`, and `DB_CONTRACT.md`.
- GitHub code search did not return indexed results for broad REST patterns, so this is a manually selected source-path scan, not exhaustive. App source, remaining website JS modules, Edge Functions, triggers and SQL dependencies still need inspection.
- No SQL, ACL, policy, data, configuration, or deployment change was made. No migration drafted.
- Next: complete call-site scan (including root `js/`, Android generated build inputs, support/admin modules, Edge Functions and storage), query column-level grants and existing/default ACLs on staging, then develop negative-access tests and an allowlist proposal. Staging rehearsal requires owner-approved workflow; production changes require explicit owner approval.

## Staging ACL snapshot (read-only, 25 Nov)
Queried Everneed-staging information_schema table privileges and pg_default_acl. Results:
- `anon`: 22 table objects with TRUNCATE, 21 objects each with INSERT/UPDATE/DELETE, 22 with REFERENCES and TRIGGER, 21 SELECT.
- `authenticated`: 36 table objects with TRUNCATE, 36 with INSERT/UPDATE/DELETE, 49 with REFERENCES and TRIGGER, 54 SELECT.
- Anon TRUNCATE objects include operational/data objects `orders`, `products`, `profiles`, `stores`, `product_variants`, `product_inventory_movements`, `product_media`, `product_price_tiers`, `product_variant_private`, plus public views. Views should be distinguished from base tables in any remediation.
- Default ACLs for both `supabase_admin` and `postgres` in `public` grant anon/authenticated broad table privileges (`arwdDxtm`), sequence privileges (`rwU`), and function EXECUTE (`X`). This confirms the same default-ACL root cause in staging; do not treat it as evidence that the production ACLs are identical without separately querying production.
- This SQL snapshot does not establish PostgREST reachability of TRUNCATE or exploitability. It confirms excessive SQL grants and the default-ACL configuration. No changes were made.

## Root app source paths added to scan
Static inspection also confirms direct writes in `js/merchant/merchant.js`: stores, store_private/store_applications, products and product_private are edited through REST, and product status is directly updated for draft/review. Admin-sellers uses RPCs for approve/reject/reinstate/review/suspend. `js/adminx.js` directly toggles offers, inserts offer records, and may update order state through a legacy store abstraction; payment confirmation uses RPC/Paystack. `js/shop.js` directly inserts reviews. The exact mapping for every app flow and table/column is still incomplete; missing paths in this connector scan are not evidence they do not exist.

## Focused table grants for observed client paths (staging)
- `products`, `collections`, `offers`, `orders`, `profiles`, `size_charts`, `reviews`: anon and authenticated table-level grants include broad CRUD plus REFERENCES/TRIGGER/TRUNCATE (review view exceptions and base-table status before remediation).
- `product_private`: authenticated broad CRUD plus REFERENCES/TRIGGER/TRUNCATE; anon not granted.
- `store_applications`, `store_private`: authenticated SELECT plus REFERENCES/TRIGGER/TRUNCATE (no table-level INSERT/UPDATE in this snapshot; column grants and policy are likely part of supported seller writes and must be inspected specifically).
- `stores`: authenticated SELECT plus REFERENCES/TRIGGER/TRUNCATE; anon REFERENCES/TRIGGER/TRUNCATE but no SELECT. This is particularly relevant to seller direct create/update and storefront grants; inspect column grants and RLS before drafting.
- `support_queue`, `support_rules`, `support_settings`: authenticated broad CRUD and truncate/trigger/reference grants; actual support flows use direct writes as identified above.
- `notifications`: authenticated SELECT only at table-level, with excess REFERENCES/TRIGGER; no anon grant.
- `policy_documents`: anon SELECT; authenticated SELECT/INSERT/UPDATE/DELETE. The client reads published documents only; admin publication management needs scoped policies and may be RPC-only.
These are catalog grant observations on Everneed-staging, not production and not a full column ACL matrix. No tests or changes were applied.

## Production grant baseline refresh (Everneed01, read-only, 25 Nov)
Separate SQL snapshot confirms the production catalogue has the same broad pattern, with different object counts than staging:
- `anon`: 15 public objects with TRUNCATE, 42 table grants among INSERT/UPDATE/DELETE, 30 REFERENCES/TRIGGER privileges counted.
- `authenticated`: 29 objects with TRUNCATE, 82 INSERT/UPDATE/DELETE grants, 84 REFERENCES/TRIGGER privileges counted.
- Anon TRUNCATE includes the base tables `banners`, `collections`, `offers`, `orders`, `products`, `profiles`, `reviews`, `settings`, `size_charts`, and `stores` (plus objects not shown by the focused filter). This is a confirmed production excess privilege catalog finding; public API reachability/exploitability is not established.
- Production default ACLs for both `supabase_admin` and `postgres` likewise include broad table (`arwdDxtm`), sequence (`rwU`) and function EXECUTE (`X`) defaults for anon/authenticated.
- The production and staging counts differ. Never copy the staging grant list as a production migration without fresh inventory, dependency analysis and staging test evidence.
No changes made to Everneed01.
