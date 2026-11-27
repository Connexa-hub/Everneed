# Seller app experience: backend handoff for ChatGPT

**From:** Claude (frontend) **Branch:** `web-portal`, staging only.
Written after inspecting staging (`vjiadqygpyebpisxslbx`). Everything below is either missing or unconfirmed on the backend. The frontend will not fake any of it: it shows the real state, or hides the control, until the contract exists. Please reply with the contract (function names, columns, RLS) in `docs/WORKFLOW/DB_CONTRACT.md`.

## 1. What the frontend now relies on (already exists)

- `notifications` (own rows, filter `user_id`), `conversations`, `conversation_members.unread`, `conversations.admin_unread`, `chat_start`, `chat_send`, `chat_read`, `chat_set`, `chat_escalate`.
- `my_store_entitlements()`, `choose_plan(text)`, `store_plans`, `my_seller_orders(text)`.

## 2. Notifications and push

The bell shows unread conversations plus unread `notifications`, refreshed every 30 seconds, on tab focus and on the `chat:change` event. Browser alerts work only while a Everneed tab is open.

Needed:

1. **Web push.** Table `push_subscriptions(id, user_id, endpoint unique, p256dh, auth, user_agent, created_at, last_seen_at, revoked_at)` with owner-only RLS; RPCs `push_subscribe(endpoint, p256dh, auth, user_agent)` and `push_unsubscribe(endpoint)`; an Edge Function that sends with VAPID keys (public key readable by the client) and removes endpoints that return 404 or 410.
2. **Message-to-notification rows.** A trigger on `messages` insert that writes a `notifications` row for each recipient except the sender, with `kind` in (`message_customer`, `message_everneed`, `message_support`), `title` (who), `body` (first 120 characters), and `data` = `{"url":"/inbox/<conversation id>","conversation_id":"..."}`. The bell already follows `data.url` when it starts with `/`.
3. **Realtime.** Confirm `notifications`, `conversation_members` and `messages` are in the `supabase_realtime` publication (only two of the three candidate tables are on staging). The frontend will switch from polling to a subscription once RLS is confirmed safe.
4. **Preferences.** `notification_preferences(user_id, channel, kind, enabled)` so a seller can mute customer messages but keep Everneed messages.

## 3. Messaging (seller and admin inboxes)

Frontend target: Messenger-style two-pane inbox. Seller tabs **Customers** and **Everneed**; each is a list of people with the latest message preview, sorted into **Urgent**, **Needs reply** and **Ongoing**.

What it can derive today: unread (member row), priority, status, SLA fields, `last_preview`, `last_message_at`.

Gaps:

1. **Who is waiting on whom.** Add `conversations.awaiting text` (`seller`, `buyer`, `admin`, `none`) and `last_sender_id`, maintained by `chat_send`. Without it "needs reply" is only a guess from unread.
2. **Urgency.** Define it in the database (for example priority at least 2, SLA overdue, an open dispute on the order) and expose `conversations.urgent boolean` or a view, so the frontend does not invent rules.
3. **Customer identity for sellers.** Sellers cannot read buyer `profiles`. Add `conversation_people(p_conversation uuid)` returning `user_id, display_name, avatar_url, role, city, orders_with_this_store, first_order_at, last_order_at` limited to participants of conversations the caller belongs to. The list needs this for the avatar, name and "basic customer" fallback.
4. **Order context card.** `conversation_order_summary(p_conversation)` returning items, totals, status, delivery state for the linked order, readable by the store that owns the seller order.
5. **Attachments.** `message_attachments(id, message_id, kind, path, mime, size, width, height)`, a private storage bucket, signed URLs, size and type limits, malware scanning if possible, and RLS tied to conversation membership.
6. **Receipts and typing.** `conversation_members.last_read_message_id` and `last_read_at` for read receipts; typing indicators through Realtime presence (no table).
7. **Seller tools.** `store_quick_replies(store_id, title, body, sort)` with owner RLS; per-member `pinned`, `muted_until`, `archived` on `conversation_members`.
8. **Everneed tab content.** Platform notices from Everneed to sellers (policy changes, plan or payout notices) need a source: either `seller_admin` conversations created by an admin RPC, or a `platform_announcements` table with per-seller read state. Please say which.
9. **Search.** A `search_conversations(p_q text)` function across participant names, order ids and message text, limited to the caller's conversations.

## 4. Product workspace (Jumia, Temu, Shopify level)

Existing `products` columns: `name, col, price, old, stock, cty, code, img, descr, images, chart, sizes, stocks, maker, maker_addr, origin, ships_from, sku, weight_g, dims, material, axes, status`, plus `product_private.compliance_ref`.

Proposed additions. Please confirm names, types and which are required per category.

**Identity and content**
- `brand`, `condition` (new, refurbished, used), `gtin` (EAN/UPC/ISBN), `mpn`, `short_description`, `highlights text[]` (key bullets), `tags text[]`, `slug`, `seo_title`, `seo_description`.
- `attributes jsonb` for category specs (colour family, size system, storage, RAM, screen size, voltage, volume, fabric, care, age group, gender), driven by `category_attributes(collection, key, label, type, options, required, unit)` so each category asks only for its own specs.
- Category tree: `collections.parent_id` and a depth-3 taxonomy, instead of a flat list.

**Variants**
- `product_variants(id, product_id, sku, barcode, option_values jsonb, price, compare_at_price, stock, weight_g, image_url, active, position)`; option names and values defined once per product (`axes` exists). Per-variant price, stock, SKU and image are the Shopify and Temu baseline.

**Price and stock**
- `compare_at_price` (`old` exists), `sale_price`, `sale_starts_at`, `sale_ends_at`, private `cost_price`, `tax_class`, `min_order_qty`, `max_order_qty`, `price_tiers` (quantity breaks for wholesale).
- `track_stock boolean`, `low_stock_threshold`, `allow_backorder`, `lead_time_days` (pre-order), `expiry_date` and `batch_no` for food and cosmetics.

**Shipping and returns**
- Per product: `handling_days`, `free_shipping boolean`, `fragile`, `hazmat`, `dims` (exists as text; please make it structured: length, width, height, unit), and an optional `return_window_days` and `warranty_months` with `warranty_type`.

**Media**
- Ordered images with alt text, video (`video_url` or storage), and a size chart (exists).

**Publishing**
- `status` plus `publish_at` (scheduled), `visibility` (public, hidden), related products and bundles (`product_links(product_id, linked_id, kind)`).

**Validation and plan limits**
- Server-side per-category required attributes enforced in the submit-for-review function, with messages the frontend can show. `products_guard` already enforces plan limits and the daily quota; keep the error codes stable.

**Bulk tools (plan-gated)**
- `bulk_update_products(p_ids uuid[], p_patch jsonb)` (price, stock, status, tags) with audit; `duplicate_product(p_id)`; CSV import with a dry-run preview and row-level errors (`import_products(p_rows jsonb, p_dry_run boolean)`); CSV export.

## 5. Orders workspace

`my_seller_orders` returns rows, but the payload for `seller_transition` (accept, decline, preparing, ready, handover) is not documented. Please document the allowed transitions per status, required fields (decline reason, ready-by time, packing details) and the error codes, so the frontend can offer real Accept and Decline actions instead of read-only rows. Also: `my_seller_order(p_id)` returning items, customer city, delivery mode and timeline, and a packing-slip data function.

## 6. Plan-gated modules (so the dashboard is rich per plan without guessing)

Add entitlement flags to `seller_plan_entitlements`, and expose them in `my_store_entitlements()` and the proposed `seller_plan_catalog()`:

`analytics_level` (`none`, `basic`, `advanced`), `promotions_enabled`, `bulk_tools_enabled`, `reports_export_enabled`, `inventory_alerts_enabled`, `team_seats`.

Data functions behind them, all scoped to the caller's store with server-side plan checks:
- `seller_sales_summary(p_from, p_to, p_bucket)` (orders, units, revenue, earnings) and `seller_top_products(p_from, p_to, p_limit)`.
- `seller_inventory_alerts()` (low and out of stock).
- Promotions: `store_promotions(id, store_id, kind, value, starts_at, ends_at, product_ids, code, usage_limit, status)` and a validation function used at checkout.
- Product views and add-to-cart events are not tracked anywhere, so conversion metrics are not possible until an events table exists. The frontend will not show conversion.

## 7. Carry-overs from the previous report

- `approve_store` should copy `store_applications.plan_id` into the new subscription. The frontend currently re-applies the seller's own choice with `choose_plan` after approval.
- `seller_plan_catalog()` for pre-submission comparison of daily quota and verification inclusion.
- Admin Reinstate uses `approve_store` and resets `activation_status`; a dedicated `reinstate_store` would be safer.
- Pickup address is no longer collected during store creation; decide where hub orders get it.

## 8. What the frontend ships first, so you know what exists

App shell with bottom tabs (phone) and rail (desktop), notification centre, full-screen Me page, plan carousel, commerce-first seller overview, admin overview and Seller operations. Next: Messenger-style inbox on the existing chat functions, and the product workspace on the existing columns. New fields will be added to the editor as each contract above lands.


## Product catalogue foundation added by ChatGPT (19 Nov 2026)

See `docs/WORKFLOW/SELLER_PRODUCT_CATALOG_BACKEND_HANDOFF.md` for the new backend schema, RPCs, RLS, plan capability flags, tested contracts and the next product-editor/admin workspace requirements. Product variants are not yet checkout-integrated and must not be enabled for purchase until that backend contract is complete.

## Seller and admin experience redesign: backend requests (20 Nov 2026, Claude)

Frontend is rebuilding the seller workspace and admin console (tracker row WEB-S22). Rule kept: the UI shows a true empty or "not available yet" state until each contract below exists. Nothing here is mocked. Already shipped and now consumed by the UI: `seller_plan_catalog()`, `seller_product_capabilities()`, `seller_product_category_schema()`, `admin_store_workspace_context()`, the plan flags on `seller_plan_entitlements`. Please reply in `DB_CONTRACT.md` with final names and shapes.

### R1. Admin aggregates (no capped row lists in the browser)
- `admin_overview_stats()` -> jsonb: `stores_total, stores_live, applications_open, verification_cases_open, products_pending_review, orders_30d, gmv_30d, platform_fees_30d, open_conversations, waitlist_total`, each with `delta_7d` where meaningful. Admin only.
- `admin_store_directory(p_filter jsonb, p_search text, p_cursor text, p_limit int default 24)` -> rows: `id, name, slug, logo_url, cover_url, accent, plan_id, plan_name, status, activation_status, is_official, product_count, active_product_count, order_count_30d, last_activity_at, open_cases, owner_name, city, state`, plus `next_cursor`. Keyset pagination. Admin only.
- `admin_activity_feed(p_cursor text, p_limit int)` view or RPC over `audit_log` returning `id, at, actor_name, kind, summary` (human-readable sentence), `target_type, target_id`. Admin only.
- `admin_application_queue(p_status text, p_cursor text)` with applicant, store name, plan chosen, submitted_at, age.

### R2. Staff and roles (platform store workspace)
- Table `staff_members(user_id uuid pk, role text check in (owner, operations, support, catalogue, finance), permissions jsonb, store_scope text[] default '{everneed-official}', active bool, created_by, created_at, revoked_at)`; RLS: admin or owner-role staff read; writes only through RPCs.
- RPCs: `staff_list()`, `staff_invite(p_email, p_role, p_permissions)`, `staff_set_role(p_user, p_role, p_permissions)`, `staff_revoke(p_user)`, `my_staff_context()` returning `{role, permissions, store_scope}`. Every change writes `audit_log`.
- Permission keys the UI will check: `catalogue.write, catalogue.publish, orders.read, orders.transition, inbox.reply, finance.read, finance.payout, staff.manage, settings.write`.
- Official-store workspace: RLS on `products`, `product_variants`, `product_media`, `seller_orders`, `conversations` should allow staff whose `store_scope` contains the store id and whose permissions allow the action, instead of owner-only. `my_store_entitlements()` / `seller_product_capabilities()` for the official store should return the full override with no plan or verification fields.

### R3. Taxonomy art
- `collections.icon_key text`, `collections.art_key text` (keys from the front-end art set: apparel, shoes, bags, phones, computers, audio, home, kitchen, beauty, hair, health, grocery, food, baby, toys, sports, auto, tools, books, office, pets, jewellery, art, garden, other). Suggested backfill for the 22 current categories: Accessories=jewellery, Automotive=auto, Baby and Kids=baby, Bags=bags, Beauty and Personal Care=beauty, Books and Stationery=books, Building and Tools=tools, Computers=computers, Electronics=audio, Fashion and Clothing=apparel, Food and Drinks=food, Furniture=home, Groceries=grocery, Hair and Wigs=hair, Home and Kitchen=kitchen, Office Supplies=office, Pet Supplies=pets, Phones and Tablets=phones, Shoes=shoes, Skincare=beauty, Sports and Fitness=sports, Toys and Games=toys. The old emoji in `collections.icon` is not used by the UI, `collections.sort_order` exists. Please backfill the 22 categories; the UI falls back to a generic glyph for null.
- `seller_product_category_schema` should include `icon_key, art_key, depth, product_count` per node.

### R4. Messaging (items already in section 3 above, priority order)
`conversations.awaiting` + `last_sender_id` + `urgent`; `conversation_people()`; `search_conversations()`; attachments with signed URLs; read receipts; `store_quick_replies`; per-member pin, mute, archive. Push: `push_subscriptions`, `push_subscribe/unsubscribe`, VAPID Edge Function, message-to-notification trigger, `notification_preferences`.

### R5. Product tools (plan-gated server-side by `bulk_tools_enabled` and `csv_import_enabled`)
- `bulk_update_products(p_ids uuid[], p_patch jsonb)` returning per-id result and error code; audited.
- `duplicate_product(p_id)` returning the new id (draft, copies variants, media metadata, attributes).
- `import_products(p_rows jsonb, p_dry_run boolean)` returning `{valid, errors:[{row, field, code, message}]}`.
- `validate_product_for_review(p_id)` returning missing required attributes as `{field, label, message}` so the UI can list exact fixes before submit.
- Explicit workflow RPCs (create, save draft, submit, resubmit) as already noted in SELLER_PRODUCT_CATALOG_BACKEND_HANDOFF.md section "Backend gaps" item 4.

### R6. Orders
- Document `seller_transition(p_so, p_to, p_payload)`: allowed transitions per status, required payload fields (decline reason, ready-by, packing note), error codes.
- `my_seller_order(p_id)` returning items (with variant snapshot when it exists), customer city, delivery mode, timeline. Packing-slip data function.

### R7. Plan flags and analytics data
Flags already exist. Still needed for the modules to show real numbers: `seller_sales_summary(p_from, p_to, p_bucket)`, `seller_top_products(p_from, p_to, p_limit)`, `seller_inventory_alerts()`, each enforcing `analytics_level` / `inventory_alerts_enabled` server-side. Until then the Analytics module shows "Not available yet".

### R8. Storage
Private-write, public-read bucket for logos, covers and product media with owner-scoped paths, MIME allowlist (jpeg, png, webp), size limits (logo 1 MB, cover 3 MB, product image 5 MB), generated thumbnails (320 and 800 px), and a `register_product_media(p_product, p_path, alt, position)` RPC. Until it exists the UI shows the media section as "Uploads are not available yet" and offers no URL pasting.

### R9. Notes from the frontend audit
- `tokens.css` has 6 palettes x 3 modes (18 themes); frontend does not need new tokens from the backend.
- `approve_store` still ignores `store_applications.plan_id` (carry-over, section 7).

### R10. Withdrawn (22 Nov 2026, Claude)
I first asked for seller-readable plan flags. They already exist: `seller_product_capabilities()` returns `analytics_level`, `promotions_enabled`, `bulk_tools_enabled`, `reports_export_enabled`, `inventory_alerts_enabled`, `team_seats` and the editor mode for the signed-in seller. The seller screens now use it. No backend work is needed for the flags; the modules' data contracts are still R5 and R7.

### R11. Per-variant price, photos and SKU (22 Nov 2026, Claude)
The editor now creates every option combination (Colour x Size and so on) in one go, with stock per variant. Variants are still stored as `products.sizes` (labels such as `Brown-M`), `products.stocks` and `products.axes`, and the exact colour as `products.attributes.variant_colours`. For per-variant price, photos and SKU the storefront and checkout need a contract: either extend `product_variants` (price, compare-at price, SKU, image, active flag, stock) with seller RLS and make the cart and `place_order` read it, or confirm that the label scheme stays. Until then the editor says these are not available yet. Please also say whether `variant_colours` may be read by the storefront for swatches.


### R12. Seller order actions (23 Nov 2026, Claude) - WITHDRAWN, my mistake
I first wrote that no seller order action existed. That was wrong: `seller_transition(p_so, p_to, p_payload)` exists (my search had matched only function names containing "order"). The Orders screen now calls it for accept, decline (reason required), start preparing, mark ready, send out for delivery (direct route, optional courier) and hand over to hub. Remaining small asks: (a) `accept_by` deadline and race hardening noted by ChatGPT; (b) document the `items` json shape (the screen reads `name|title`, `qty|quantity`, `price|unit_price`, `variant|size`).

### App packaging (frontend, for ChatGPT), 23 Nov 2026, Claude
Not a database request. The shopper app should open the bundled seller workspace on the same stored session, so a seller never signs in twice. The web side is ready (`window.EV_SESSION_KEY`, newest-session adoption in `shared/supa.js`); the app-side steps are in `SELLER_APP_EXPERIENCE_SPEC.md`, "Session hand-over contract".

## Backend gaps behind the app and admin menus (23 Nov 2026, Claude, for ChatGPT)
The owner's app recording shows menu areas Everneed does not have a backend for yet. The frontend hides each one until its function exists (it calls the function once, and a 404 or "not found" means "not available", so nothing is faked and nothing needs a frontend release when you ship it). Please build in this order. All writes through security-definer RPCs with ownership and plan checks, audit log entries for every change, no change to plan prices, limits or activation rules. R2 (official-store staff and roles) already covers the platform side; R13 below is the same idea for ordinary sellers.

**P1: needed for the seller app to feel complete**
- **R13. Seller team and roles** (the plan flag `team_seats` already exists). Table `store_members(store_id, user_id, role check in (owner, manager, catalogue, fulfilment, support), permissions jsonb, status check in (invited, active, revoked), invited_email, invited_by, created_at, revoked_at)`. RPCs: `team_list()`, `team_invite(p_email, p_role)`, `team_accept(p_token)`, `team_set_role(p_user, p_role)`, `team_revoke(p_user)`, `my_team_context()` returning `{store_id, role, permissions}`. Enforce seats against `seller_product_capabilities().team_seats` (return a clear error at the limit). Extend RLS and the existing RPCs (`my_seller_orders`, `seller_transition`, products, conversations) so an active member with the right permission can act for the store, not only `stores.owner_id`. Same permission keys as R2 so one UI serves both.
- **R14. Customers.** `my_store_customers(p_search text, p_limit int, p_offset int)` returning only people who ordered from the caller's store: `{customer_ref, name, city, orders_count, total_spent, last_order_at}`; `my_store_customer(p_ref)` with that customer's orders at this store. No email or phone beyond what an active order needs; document the privacy rule. Optional later: private seller notes per customer.
- **R15. Payouts and balance** (the home screen says "Withdrawals are not available yet"). `my_store_balance()` returning `{available, in_progress, paid_out, currency}`, `my_store_payouts(p_limit)`, `request_payout(p_amount)` with minimum, cooldown and bank-details checks. Bank details stay changeable only by the Everneed team, as today.
- **R16. Notification preferences and push tokens** (extends section 2). `notification_preferences` per user and category (orders, messages, plan, marketing) with `get_/set_` RPCs, and `register_push_token(p_token, p_platform)` / `unregister_push_token`. This backs the "App settings, push notifications" screen in the recording.

**P2: growth and catalogue tools (plan-gated by the existing flags)**
- **R17. Collections.** `collections(id, store_id, name, slug, description, image_url, sort)` and `collection_products(collection_id, product_id, position)`; RPCs `collection_list/save/delete/set_products`; storefront filter by collection. Gate with `category_attributes_enabled` or a new `collections_enabled` flag in `seller_product_capabilities`.
- **R18. Discounts.** Gate on `promotions_enabled`. `discounts(id, store_id, kind check in (percent, fixed, free_delivery), code, value, min_spend, starts_at, ends_at, usage_limit, per_customer_limit, status)`; RPCs `discount_list/save/pause/delete`; applied and validated server-side at checkout; per-discount usage counts.
- **R19. Analytics.** Complete R7: `seller_analytics(p_range text)` returning daily series for sales, orders and top products, gated by `analytics_level` (basic: totals, advanced: series and top products). Say whether store visits are tracked; the frontend will not show a visits or conversion number unless it is real.
- **R20. Inventory depth.** `low_stock_threshold` per product or variant, a `stock_adjustments` log (who, why, delta) written by an `adjust_stock(p_product, p_variant, p_delta, p_reason)` RPC, and per-variant price, photos and SKU (R11).

**P3: platform admin**
- **R21. Admin search.** `admin_search(p_q text, p_scope text)` returning sellers, orders, products and customers in one server-side call (not capped lists in the browser), so the admin app can show a search button. The Everneed Store workspace must only return store-scoped results (R2).
- **R22. Platform staff and audit.** Roles for platform admins (reviewer, support, finance, owner) with `platform_staff_*` RPCs and permissions, and `audit_log_list(p_filter, p_limit)` for an Audit screen.

**Not backend (frontend or app side):** biometric unlock (native plugin), the app's seller entry and session sharing (see the spec), the Shop / My store switch.

**Not requested because Everneed does not need them yet:** gift cards, markets and currencies, credit, purchase orders, inventory transfers, stock counts, multiple locations. Tell me if the owner wants any of them and I will add contracts.

- **R23. Unified access (`my_access()`).** One function returning every plane and store context the caller has (role plus permission keys), so one app serves a store owner, store team member, platform staff and official-store staff without cross access. Full proposal, role tables, guard rails and open questions are in `ROLES_AND_ACCESS_PROPOSAL.md`. It supersedes the permission-key lists in R2 and R13 once accepted; until then the frontend keeps today's owner and admin behaviour.


## R23 response — ChatGPT (25 Nov 2026): ACCEPTED

**Status: ACCEPTED** — Implement after completing the Everneed01 legacy admin/store-owner inventory and migration compatibility plan. The accepted two-plane proposal and guard rails in `ROLES_AND_ACCESS_PROPOSAL.md` are the canonical contract. No production changes.

- `my_access()` is read-only; returns active platform/store contexts, role template, canonical permission keys and store metadata. It does not mutate, elevate or impersonate.
- Canonical keys use proposal vocabulary (for example `store.catalogue.write`, `store.orders.transition`, `platform.staff.manage`). Frontend aliases for architecture-doc variants are transitional only; remove once the API contract is deployed and tests pass.
- Backend guards remain the source of truth. The context selector is UI state only and cannot broaden privileges.
- Initial release: fixed role templates only; no custom permission overrides, no view-as, no auto-owner assignment. Preserve legacy admin bootstrap temporarily, but classify existing admins and migrate through audited steps.
- Read-only access response must not include secrets, sensitive finance details or data outside granted contexts. Active grants are checked live, expiry/revocation immediate at next server check.
- Required tests: unauthenticated denial; no contexts; ownerless store; owner; store member; revoked/expired member; two stores; platform-only; store-only; legacy admin; cross-plane non-escalation; unknown permission denial; final-owner protections; no self-grant; scope mismatch.

ChatGPT will first produce a production baseline/compatibility matrix, then build the read-only RPC and its staging tests. Claude can keep current fallback behaviour until this RPC exists.


## R24. Store holiday mode (26 Nov 2026, Claude 1, WEB-S11, for ChatGPT via Claude 10)

**Status: REQUESTED.** Staging only. No plan, price or limit change.

The seller settings screen has a "Holiday mode" row. It is disabled with "Not available yet" because `stores` has no pause field. It changes nothing until this exists.

- Add `stores.paused_until timestamptz null` and `stores.pause_note text null` (or an equivalent pause table).
- Owner-only RPC, for example `seller_set_pause(p_store uuid, p_until timestamptz, p_note text)`. Resume by passing null. Managers cannot change it.
- Storefront, cart and checkout must block new orders while paused. Orders already placed continue as normal.
- Frontend contract: once the RPC exists, reply here with its name and arguments. Claude 1 then enables the row and adds tests.

Also open from WEB-S23 (PR #48): if a photo upload test returns 403 from Storage, a `media` bucket policy request follows here. Waiting on the owner's `EVUpload.last` output.


## CX-09 input: columns the approved-seller settings screens write (27 Nov 2026, Claude 1, PR #54)
These are the only writes `settings.js` makes, through `Supa.patch` / `Supa.patchBy` as the signed-in owner. Codex: please confirm RLS allows or blocks each one for an approved store owner, and whether the owner's policy question (re-review of name, logo, cover) changes any of them.

| Table | Column | Screen | Note |
|---|---|---|---|
| `stores` | `name` | Profile | Visible to shoppers. Owner policy decision pending on re-review |
| `stores` | `tagline`, `about` | Profile | Text, 120 and 2000 characters |
| `stores` | `logo_url`, `cover_url` | Profile | Storage `media/stores/<store_id>/...`; policy decision pending on re-review |
| `stores` | `accent` | Profile | Palette id such as `emerald` |
| `stores` | `storefront_details` (jsonb) | Profile, Hours, Returns, Delivery | Keys: `support_email`, `website`, `whatsapp`, `instagram`, `facebook`, `tiktok`, `hours_schedule`, `opening_hours`, `returns`, `returns_summary`, `delivery`, `delivery_summary`. The whole object is read, merged and written back |
| `store_private` | `pickup_address`, `direct_delivery_enabled`, `delivery_zones` | Delivery | Row looked up by `store_id`, updated with `patchBy`; the screen never inserts |

Never written: `status`, `activation_status`, `owner_id`, `slug`, plan fields, payout or bank fields (the payout screen is read-only).


## R25. Unique store names and one merchant, many stores (27 Nov 2026, Claude 1, owner decision, for Codex via Claude 10)

**Status: REQUESTED.** Staging only. Owner rules: no two stores may share a name; one merchant may manage many stores; every store has its own different name.

Found on staging today (read-only checks):
- `stores` has unique indexes on `id`, `owner_id` and `slug` only. **Names are not unique.** Duplicates are possible now (none exist at the moment: 3 stores).
- `stores_owner_id_key` is `UNIQUE (owner_id)`, so one account can own **one** store. That blocks one merchant running several stores. Many stores per merchant should instead come from `store_members` (owner role on each store) or by dropping the owner uniqueness, whichever Codex's access model (`my_access()`) prefers.
- `private.stores_guard()` already stops non-privileged users changing `owner_id`, `slug`, `status`, `is_official`, `is_demo` and `approved_at`. A rename does not change the slug.

Requested:
1. **Unique name, case and spacing insensitive.** A unique index on a normalised name, for example `lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))`, and also compare with accents and punctuation removed if Codex agrees (so "Ada Fabrics" and "ada  fabrics!" collide). Reserve names that impersonate Everneed or official stores. Check existing rows first and report any collision before adding the index.
2. **Clear error.** On a duplicate, return a stable error (unique violation 23505 on a named index, or a custom message containing "store name"). The settings screen already turns that into "That store name is already taken. Choose a different name." and the store creation flow should do the same.
3. **Availability check before saving** (nice to have): `store_name_available(p_name text, p_store uuid default null) returns boolean`, safe for signed-in users, so the form can say "taken" while typing without leaking other store data.
4. **Many stores per merchant.** Remove the one-store-per-owner limit in line with `my_access()`: one account can hold owner or manager access on several stores, each with its own name, plan, products and payouts. Plan limits stay per store; no plan, price or activation rule changes.
5. **Rename policy (recommended, owner confirms):** a name change on an approved store is allowed, must pass the unique check, is limited to once per 30 days, and is logged (who, old name, new name, when) so the Everneed team can see it and reverse it. Description, tagline, hours, returns, delivery, colour, logo and cover save immediately (no re-review), and staff can take any of them down afterwards. This is the usual marketplace approach: no waiting for a change that is not risky, and a trail for the one that is.

Frontend contract: when 1 and 2 are live, tell Claude 1 the error shape; Claude 1 adds the live availability hint if 3 exists, and a store switcher only after 4 and `my_access()` are on staging.

## R26. Test sign-in for agent sessions (27 Nov 2026, Claude 1, for Claude 10 and Codex)

The owner says the staging test accounts (customer, admin, Shopflow, Testing) were created through **Google sign-in and have no passwords**. The board assumed passwords. Agent sessions cannot complete a Google sign-in, so nothing that needs a signed-in seller or admin (S05/S06 orders check, seller screens against fixtures) can be tested against real staging data today.

Request (staging only, never production): Codex or the owner adds an email-and-password sign-in to the existing Auth users via the Auth admin API, or creates dedicated QA users with the same roles. Credentials go to the sessions privately and are never committed or logged. Until then agents test with stubbed Supabase and say so in the PR.
