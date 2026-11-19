# Seller product catalogue and universal workspace — backend handoff for Claude

**Branch:** `web-portal`  
**Environment:** Everneed-staging only (`vjiadqygpyebpisxslbx`)  
**Priority:** Product add/edit/catalogue is the highest priority seller experience.  
**Production:** untouched. `main` and PR #31 must remain unmerged.

## Product principle

Build a rich, extensible commerce catalogue comparable in capability to Shopify, Amazon Seller Central, AliExpress/Alibaba seller tooling, Walmart Marketplace and WooCommerce—but do not copy their dense desktop UI. The product form should be mobile-first and progressively disclosed: Basic sellers receive a guided path with clear defaults, while every core field remains available under Advanced details. Growth/Pro/Admin can use the full editor and operational tools. Do not invent frontend state for missing backend contracts.

## Staging audit — existing foundation

Existing `public.products` remains canonical and has: `name, col, price, old, stock, cty, code, img, descr, at, images, chart, sizes, stocks, maker, maker_addr, origin, ships_from, sku, weight_g, dims, material, axes, status, store_id, search`.

Existing behavior that must be preserved:
- `private.products_guard()` enforces seller plan active-product quota and daily listing quota, writes listing events, keeps seller products draft/pending-review, and prevents sellers from publishing/rejecting directly.
- `review_product(product, publish|reject, note)` is the moderation decision.
- Products public-read RLS requires published product and live store; seller/admin access is separate.
- Product search index exists.
- Existing product/order IDs and checkout snapshot must remain backward-compatible.
- `product_private` holds moderation/compliance private data and owner/admin RLS.
- Current `collections` taxonomy was flat (22 categories).
- Current `order_items` does **not** include variant_id; checkout `create_order_with_snapshot` and `create_order` still use the legacy size/stock model. Variant checkout integration is not yet done.

## Backend work already implemented on staging

Migrations:
- `20261119030341_product_catalog_foundation`
- `20261119030531_catalog_taxonomy_and_publish_schedule_hardening`

Regression test:
- `supabase/tests/038_product_catalog_foundation_checks.sql` — executed successfully on staging and wrapped in a transaction with rollback.

New product fields (preserve existing legacy columns):
- `brand, condition, gtin, mpn, short_description, highlights[], tags[], slug, seo_title, seo_description`
- `attributes jsonb` (structured category specifications)
- `compare_at_price, sale_price, sale_starts_at, sale_ends_at`
- `min_order_qty, max_order_qty`
- `track_stock, low_stock_threshold, allow_backorder, lead_time_days`
- `expiry_date, batch_no, handling_days, free_shipping, fragile, hazmat`
- `dimensions jsonb` (structured length/width/height/unit; legacy `dims` stays)
- `return_window_days, warranty_months, warranty_type`
- `publish_at, visibility (public/hidden), product_type (physical/digital/service/subscription), updated_at`
- Private `product_private.cost_price, tax_class, supplier_code, internal_notes`

New backend tables:
- `category_attributes`: category-specific field definitions, options, type, required/search/filter/variation flags, validation and ordering. Admin-only manage; active definitions read by sellers.
- `product_variants`: per-variant SKU/barcode/options, price/compare/sale prices, stock/backorder/threshold, weight/dimensions, image, active/position. RLS seller-owner/admin; public read only for active variants of public published live products.
- `product_variant_private`: variant cost/supplier/internal notes, seller-owner/admin only.
- `product_media`: ordered image/video/3D/document metadata, alt/caption, primary flag, dimensions and duration. Seller-owner/admin; public only through eligible product.
- `product_price_tiers`: quantity-based price tier records. Owner/admin edit; public read only on eligible products. **Not yet integrated into checkout pricing.**
- `product_links`: related/upsell/cross-sell/bundle-component/replacement relations. Owner/admin edit; public read through eligible product.
- `product_inventory_movements`: stock adjustment audit trail (initial stock and every variant stock change), owner/admin read.

Category tree:
- `collections.parent_id, slug, sort_order, active`.
- Enforced max three levels and cycle prevention.
- 22 current categories remain, existing category IDs and names preserved.
- 47 starter category attribute definitions seeded (all optional until admin deliberately configures required fields).

RPCs:
- `seller_product_category_schema(p_collection)`: category tree + category-specific attribute definitions.
- `admin_store_workspace_context(p_store)`: admin-only context switch data, store/owner/subscription, counts, full capability override and module readiness.
- `seller_product_capabilities(p_store)`: authenticated owner/admin; returns plan capabilities. Admin context returns full override.
- `seller_adjust_variant_stock(p_variant, p_quantity, p_reason, p_reference)`: atomic stock adjustment with audit movement.

Validation:
- Internal SECURITY DEFINER catalogue trigger functions have EXECUTE revoked from PUBLIC, anon and authenticated; regression test 038 checks the ACL.
- `private.validate_product_category_attributes()` checks required attributes and basic type when products are submitted for review/published. Required fields are configurable; the starter seed deliberately does not force incomplete requirements.
- Public product RLS respects visibility and scheduled publish time; media, variants, tiers and links follow the same public eligibility.
- RLS is enabled on every new table. Owner/admin management policies and public read policies are separate.

Plan capability flags seeded (price and product quota unchanged):
| Plan | Variants/attributes | Bulk | CSV import/export | Analytics | Promotions | Inventory alerts | Seats |
|---|---|---|---|---|---|---|
| Free | Yes | No | No | None | No | No | 1 |
| Starter | Yes | No | No | Basic | No | Yes | 1 |
| Growth | Yes | Yes | Yes | Advanced | Yes | Yes | 2 |
| Pro | Yes | Yes | Yes | Advanced | Yes | Yes | 5 |
| Everneed Admin / official-store context | Full override | Full override | Full override | Advanced | Full override | Full override | Admin-managed |

All plans have `advanced_product_editor=true`; Free/Starter use `product_editor_mode=guided` and Growth/Pro use `full`. Basic sellers still have access to all rich product fields through advanced details—the guided mode only simplifies the workflow. These are backend capability flags, **not a claim that bulk, CSV, promotions, analytics or team-seat workflows are already implemented**. They remain future backend contracts. Plan prices and existing catalogue quotas were not changed.

## Frontend product editor — implement the full capability set

Use a phone-friendly wizard/sections with save draft, progress, field-level validation and optional advanced sections. Avoid forcing basic sellers to fill every field. Category selection loads `seller_product_category_schema` and displays only relevant specs.

### A. Product identity
- Product name/title, category/subcategory path, brand, model, condition (new/refurbished/used/open-box)
- Seller SKU, product code, MPN, GTIN/EAN/UPC/ISBN
- Product type (physical/digital/service/subscription)
- Slug; country of origin; manufacturer and manufacturer address; ships-from
- Product short description and full rich description; key feature bullets; tags/search terms

### B. Media
- Multiple photos, hero image, ordered gallery, variant image assignment
- Video, 360 imagery and 3D model support; document/certificate attachments where relevant
- Alt text, captions, media metadata, primary image and drag reorder
- Uploads must use an authorized storage bucket and signed paths. **Storage bucket/policies and upload RPC are still pending**; do not fake uploads with arbitrary public URLs.

### C. Category-specific specifications
- Dynamic attribute schema by category/subcategory (examples: phone storage/RAM/network/battery; fashion size/color/material/gender/care; beauty ingredients/skin type/volume/expiry; food allergens/ingredients/storage/expiry; furniture material/assembly/dimensions/weight capacity; tools voltage/power/tool type; auto compatibility).
- Attribute values need correct data types, units, options and requiredness.
- Category attributes can be marked searchable, filterable and used for variants.
- Admin needs category tree and attribute-schema management.

### D. Variants
- Variant axes/options and combination generation (size/color/storage/etc.)
- Per-variant SKU/barcode, image, price, compare-at/sale price, schedule, stock, backorder, low-stock threshold, weight, dimensions and active state
- Validate duplicate combinations/SKUs/barcodes and prevent invalid variant combinations
- Bulk-edit variants inside product editor
- **Checkout/order support for variants is a blocker:** add `order_items.variant_id`, selected option snapshot, variant SKU, variant-specific price and inventory reservation. Extend checkout snapshot to persist immutable variant/options/price. Existing legacy size-based checkout remains until migration/tests prove compatibility. Do not release variants as buyable before this integration is completed.

### E. Pricing
- Regular price, compare-at price, sale price and sale start/end
- Private cost price and tax class (never expose to customers)
- Min/max purchase quantity, wholesale/quantity tiers
- Currency derived from store country or explicit validated currency
- Checkout must calculate tiers/promotions server-side, never trust client prices. Tier pricing table is present but checkout calculation is pending.

### F. Inventory
- Track stock toggle, available quantity, low-stock threshold, backorders, preorder/lead time
- Variant-level stock and stock adjustment history
- Batch/lot, expiry (for applicable categories)
- Bulk stock adjustments with reasons and actor
- Future: multi-location stock, seller warehouse/pickup nodes, transfer and stock reservation lifecycle. Current implementation is single-variant quantity + movement ledger, not location-based inventory.

### G. Shipping, returns and warranty
- Structured package dimensions, weight, handling time, shipping origin
- Shipping class, free shipping eligibility, fragile/hazardous flags
- Seller direct delivery / Everneed hub eligibility (order routing remains marketplace-level)
- Return window, warranty type/duration, assembly or special handling
- Product-specific shipping rules should not override marketplace safety/delivery policies.

### H. Compliance and quality
- Category/country restrictions, certification/document uploads, safety notes
- Private compliance references and admin review status
- Listing quality score/checklist with exact missing fields and remediation
- Do not make all categories require CAC or identity checks; scope legal/provider requirements to product/capability.

### I. Publishing and merchandising
- Draft, submit for review, published, rejected, archived; scheduled publish; public/hidden visibility
- Review comments and resubmission
- Related, upsell, cross-sell, replacement and bundle links
- Collections and storefront placement, SEO title/description, tags, search synonyms
- Duplicate product, copy variants, bulk actions and change history (bulk/history not implemented)

## Admin universal toolkit

When Admin selects a store in a store-context switcher, use that store ID consistently for product/catalogue, inventory, orders, inbox, analytics, settings, fulfilment and billing. Everneed's official store `everneed-official` already exists and admin RLS/plan-capability override supports management of it. Admin should not be routed through seller subscription limits or verification onboarding for its official store.

Universal admin modules to design:
1. Marketplace overview and alerts/queues.
2. Store switcher + store profile/branding/catalogue/operations; official Everneed store is first-class.
3. Catalogue: category taxonomy, attribute definitions, product moderation, duplicate/quality/prohibited-list review, bulk tools.
4. Inventory and fulfilment: variant stock, adjustments, warehouses/hub, transfer, reservations, packing, pickup/handover, tracking.
5. Orders: full order details, split seller orders, timeline, actions, customer context, delivery route and exceptions.
6. Returns/refunds/disputes/claims.
7. Customer and seller inbox/support, attachments, canned replies, SLA/triage.
8. Pricing/promotions/coupons/wholesale/commission rules.
9. Seller plans, entitlements, subscriptions, invoices/receipts, verification and compliance.
10. Payments, seller settlement, ledger, payout/reconciliation (financial actions remain permissioned and audited).
11. Analytics, performance, catalogue quality, search/assortment and report exports.
12. CMS/storefront content, banners, landing pages, policy documents, SEO and localization.
13. Users, teams/roles/permissions, audit log, fraud/risk controls.
14. Integrations, webhooks, API keys, automation, marketplace configuration, tax, delivery zones and system health.

The frontend should show a module only when its backend contract is ready, not simply because an entitlement flag is true. Admin capability overrides must not be mistaken for existing functionality.

## Backend gaps / next implementation phases

1. **Variant-aware checkout and immutable snapshots (critical before enabling variant purchases).** Update `create_order`, `create_order_with_snapshot`, `order_items`, stock reservation and payment reconciliation; preserve old cart schema and idempotency; test mismatched product/variant, price tampering, stock race, duplicate callbacks and refunds.
2. **Media storage:** secure Supabase Storage bucket, owner/admin upload paths, MIME/size limits, signed uploads and public media delivery.
3. **Multi-location inventory:** locations, levels, reservations, movements, hub transfer and seller pickup contracts.
4. **Product CRUD RPC contracts:** explicit create/update/save-draft/submit/re-submit/duplicate; validate category fields, variant combinations, SKU, media and plan limits server-side. Existing RLS direct edits are not a substitute for workflow RPCs.
5. **Bulk update and CSV import/export:** dry-run validation, row errors, limits, audit, plan enforcement.
6. **Plan feature enforcement:** currently flags and capabilities are seeded, but bulk/import/export/promotions/analytics/team functions are not implemented. Gate the actual RPCs server-side.
7. **Promotions/coupons:** durable promotion rules, validation and checkout integration.
8. **Analytics/reporting:** seller-scoped summary, top products, sales buckets, inventory alerts, export jobs and events for views/conversion.
9. **Team seats/roles:** membership table, permission scope and seat enforcement.
10. **Product listing audit history:** immutable history for product content/price/status changes and moderation actions.
11. **Tax, category compliance, supplier data and product certificates** with privacy-aware admin/seller access.
12. **Admin workspace context RPC:** safe store context switching that returns store metadata, plan/capabilities and module readiness; ensure admin can manage `everneed-official` without pretending pending modules are live.

## Regression coverage already run on staging

`038_product_catalog_foundation_checks.sql` verifies:
- new schema and RLS tables
- public/owner policy presence
- category-schema RPC shape and seeded phone attributes
- plan capability mapping
- required-attribute validation on review submit
- product/variant creation, stock movements, media, wholesale tier and relation persistence
- 3-level category cap and cycle rejection
- scheduled-publish public policy

It passed against staging; its transaction rolled back test data. Add this test to CI (done in `.github/workflows/build.yml`). The two migration filenames must remain exactly aligned to the staging migration ledger and `.github/workflows/migrations-check.yml`.

## Claude frontend deliverable

Please implement the product editor/list/management UI and admin store-context switcher against the backend additions above. Do not create fake variants or upload previews that don't persist. Keep mobile usability first. Treat variant checkout, upload bucket, bulk operations and promotion/report RPCs as unavailable until backend phases land. Give ChatGPT a backend gap list when the frontend needs new contracts. Do not edit `main` or merge PR #31.
