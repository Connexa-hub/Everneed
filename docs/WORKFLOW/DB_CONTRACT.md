# Database contract for the Everneed app and website (live Supabase `zpgasfweaixwsktlueje`)

Snapshot taken **12 Nov 2026** from the live database. This contract applies to the app and website because they are parts of the same Everneed platform and use the shared Supabase backend. The function map currently records the known website call sites; app call sites must be added as the app audit progresses. Do not assume a function is app-integrated merely because it exists in the database.
If you change the database, update this file in the same commit. Status words are defined in `AI_PROTOCOL.md`.

## Branch and database workflow
- App and website changes are developed together on `web-portal` and released together to `main` through a reviewed pull request.
- Both clients must use the same documented function signatures, status rules, money rules and RLS expectations. Put reusable client helpers in `shared/`.
- Database changes must be committed as numbered files in `supabase/migrations/` before they are applied to the live project. Update this contract and the project tracker in the same change.
- Verify the Supabase project reference before applying any migration. Never apply a migration to a different project based only on a copied project ID.

## How the app and website talk to the database
- Browser client: `shared/supa.js` (`Supa.get`, `insert`, `patch`, `rpc`, `rpcAnon`, `upload`). Public anon key in `shared/config.js`.
- Row Level Security is **on for every table**. The browser never has more rights than the signed-in user.
- Anything that moves money or changes an order/store state is a **SECURITY DEFINER function** that checks the caller. The app and website call the function; clients never write those protected tables directly.
- Payments: edge function `paystack` (HMAC-verified webhook, `verify_jwt` off by design). Not yet called by the website; app integration must be verified during the app audit.

## Function map (what exists vs known app and website call sites)

### Stores and products
| Function | Who | App / web surface | Status |
|---|---|---|---|
| `submit_store(p_store)` | seller | Portal > Store setup | DONE |
| `approve_store(p_store, p_note)` | admin | Admin > Applications, Stores (reinstate) | DONE |
| `reject_store(p_store, p_reason)` | admin | Admin > Applications | DONE |
| `suspend_store(p_store, p_reason)` | admin | Admin > Stores | DONE |
| `set_store_terms(p_store, p_commission, p_trusted)` | admin | Admin > Stores (commission, trusted) | TODO |
| `review_product(p_product, p_decision, p_note)` | admin | Admin > Product review | DONE |
| `next_slug(p_name)` | system | used when creating a store | n/a |

### Orders, delivery, hub
| Function | Who | Web screen | Status |
|---|---|---|---|
| `my_seller_orders(p_status)` | seller | Portal > Orders list | TODO |
| `seller_transition(p_so, p_to, p_payload)` | seller | Portal > Orders (accept, ready, hand over) | TODO |
| `mark_delivered(p_order, p_code)` | seller | Portal > Orders (4-digit delivery code) | TODO |
| `hub_receive(p_so, p_check)` | admin | Admin > Hub board | TODO |
| `hub_consolidate(p_order)` | admin | Admin > Hub board | TODO |
| `dispatch(p_order, p_courier)` | admin | Admin > Hub board | TODO |
| `admin_confirm_payment(p_order)` | admin | Admin > Orders | TODO |
| `cancel_order(p_order, p_reason)` | buyer/seller/admin | Admin > Orders | TODO |
| `order_tracking(p_order)` | buyer | Public tracking page | TODO |
| `create_order(...)`, `confirm_payment(...)`, `confirm_received(...)` | buyer / server | Web checkout (future) | TODO |
| `report_payment(order_id, reference, note)` | buyer | Web checkout, bank transfer (future) | TODO |

### Money
| Function | Who | Web screen | Status |
|---|---|---|---|
| `store_balance(p_store)` | seller/admin | Portal > Earnings | TODO |
| `release_earnings()` | scheduled | not scheduled yet, see below | BLOCKED |
| `record_payout(p_store, p_amount, p_reference, p_period)` | admin | Admin > Payouts | TODO |
| `refund(p_order, p_seller_order, p_amount, p_reason)` | admin | Admin > Refunds | TODO |
| `choose_plan(p_plan)` | seller | Portal > Plan | TODO |
| `apply_rental_payment(...)`, `apply_rental_payment_for(...)` | seller/server | Portal > Plan, Admin > Rentals | TODO |
| `expire_rentals()` | scheduled | not scheduled yet | BLOCKED |
| `redeem_offer(p_id)` | buyer | Web checkout (future) | TODO |

### Support and chat
| Function | Who | Web screen | Status |
|---|---|---|---|
| `chat_start`, `chat_send`, `chat_read`, `chat_set`, `chat_escalate` | members | Inbox (all roles), store chat page | DONE |
| `support_guest_open`, `support_guest_ping`, `support_guest_close` | anyone (anon) | Support widget | DONE |
| `support_sla_public`, `support_tier`, `store_reply_stats` | anyone / system | Support widget, store pages | PARTIAL (verify each in `chat.js`) |
| `support_sla_sweep()`, `chat_triage()` | scheduled / trigger | not scheduled yet | BLOCKED |

### Website
| Function | Who | Web screen | Status |
|---|---|---|---|
| `join_waitlist(...)` | anyone (anon) | Early access form | DONE |

### Helpers (used by policies and other functions, not called from the browser)
`is_admin`, `my_role`, `on_signup`, `rate_hit`, `chat_member`, `chat_guard`, `chat_escalate_core`, `cancel_order_for`, `confirm_received_for`, `support_sla_minutes`, `run_scheduled_jobs`.

## Tables (all have RLS on)
Policy counts in brackets.

- **People and stores:** `profiles` (2), `stores` (5), `store_private` (3), `store_applications` (3), `store_subscriptions` (1), `store_plans` (2), `store_payments` (1)
- **Catalogue:** `products` (6), `product_private` (3), `collections` (2), `size_charts` (2), `banners` (2), `offers` (2), `reviews` (4), `cards` (2)
- **Orders:** `orders` (2), `seller_orders` (1), `order_items` (1), `order_item_fees` (1), `order_secrets` (1), `deliveries` (1)
- **Money:** `ledger_entries` (1), `payouts` (1), `refunds` (1), `disputes` (2)
- **Support:** `conversations` (2), `conversation_members` (1), `messages` (1), `canned_replies` (2), `support_queue` (1), `support_rules` (1), `support_settings` (1)
- **System:** `notifications` (2), `audit_log` (1), `settings` (3), `waitlist` (1), `kv` (0), `rate_limits` (0)

`kv` and `rate_limits` have RLS on with no policies on purpose: only definer functions touch them.

### Public views (no RLS; they expose safe columns only)
`public_stores`, `public_products`, `public_reviews`, `product_ratings`, `auto_offers`. These are what a public web storefront should read.

## Migration log
Repo folder: `supabase/migrations/`. **Next number: 016.**

| # | Name | In repo | Applied live |
|---|---|---|---|
| 000 to 010 | original schema, RLS, orders, hub, ledger, etc. | yes | yes |
| 011 | plans_and_limits | **NO** | yes |
| 012 | support_chat_and_waitlist | **NO** | yes |
| 013 | chat_hardening | **NO** | yes |
| 014 | chat_start_official_store | **NO** | yes |
| 015 | sla_public | **NO** | yes |

**Drift:** 011 to 015 exist only in the live database. Task `WEB-F07` exports them into the repo. Until then a rebuilt database would lose chat, support, waitlist and plans. `shared/sql/011_website_sync.sql` is an older partial copy and is superseded.

## Live facts that matter
- Data is **empty** (0 profiles, 0 products, 0 orders). No admin account exists yet (`WEB-F11`).
- Extensions `pg_cron` and `pg_net` are **not installed**, so nothing runs on a schedule (`WEB-F09`). The functions that need a schedule: `release_earnings`, `expire_rentals`, `support_sla_sweep`, `run_scheduled_jobs`.
- Security advisor: leaked-password protection is off (`WEB-F10`, owner dashboard setting).
- Edge function: `paystack` v4, ACTIVE.
- Storage bucket used by uploads: `media` (public read).

## How to add a database change
1. Read the table or function you are changing in the live database first.
2. Write `supabase/migrations/016_<name>.sql` (idempotent where possible: `create or replace`, `if not exists`).
3. Apply it, then check the Supabase security advisor.
4. Add a row to the migration log and update the function map above.
5. Update the tracker rows that depend on it.
