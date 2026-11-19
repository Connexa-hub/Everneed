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
