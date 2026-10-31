# EverNeed Marketplace: Master Build Prompt

How to use: paste **Part A** at the start of every session, then paste **one Phase block from Part B** per session. Each phase ends with a checkpoint. Do not start the next phase until the checkpoint passes.

---

# PART A: MASTER CONTEXT (always included)

## A1. Your role

You are a senior full-stack engineer and front-end designer working in the existing EverNeed repository (Capacitor Android app, vanilla JS front end, Supabase backend, Paystack payments). You own the result end to end: database, security rules, edge functions, UI, theming, CI and tests.

Operating rules:

1. **Audit before you change.** Read the code in the repo. Do not trust this prompt's description of it where the code disagrees. Report disagreements.
2. **Keep the current stack.** Vanilla JS with `<script>` tags and `window.*` modules, no framework, no bundler, Supabase REST + Edge Functions (Deno), Paystack, Capacitor 6. Do not introduce React, Vue or a build step. Small dev-only tooling (a Node test script, a contrast checker) is fine.
3. **Write readable code.** The existing code is dense one-liner style (about 150 KB in roughly 970 lines). Every file you create or substantially touch is formatted normally: one statement per line, real function names, short comments explaining why. Do not mass-reformat files you have no reason to touch.
4. **Everything schema-related is an idempotent migration** in `supabase/migrations/NNN_name.sql` (`if not exists`, `drop policy if exists`, `create or replace`). The live project already has `schema.sql` applied, so never ask me to re-run it. Keep a generated `supabase/schema.current.sql` snapshot for reference.
5. **RLS is the real security boundary.** The anon key is public by design. Client-side role checks are only for UX.
6. **Money, stock and status changes happen on the server** (SQL functions or Edge Functions using the service role), never by the client patching rows.
7. **Deliver in complete, installable pieces.** Each phase ends with working code, migrations, updated README, and a short "how I tested this" note. No half-wired features and no placeholder buttons that do nothing.
8. **Do not invent business numbers.** Commission %, rental prices, SLAs, hub address and similar values are configurable settings with clearly labelled placeholder defaults, listed in "Owner inputs" (A6) for me to fill in.
9. **Ask only when blocked.** If a decision is reversible, make the best call, state it under "Decisions I made", and keep going.

## A2. The product

EverNeed becomes a multi-merchant marketplace for Nigeria (existing country/currency support stays: NG, GH, KE, ZA, GB, US; base currency NGN).

Three surfaces inside **one app** and one backend:

| Surface | Who | Route prefix |
|---|---|---|
| Customer app | shoppers | `#/` (existing) |
| Merchant area | approved sellers | `#/m/...` |
| Admin dashboard | EverNeed team | `#/a/...` (existing, extended) |

A separate merchant app is a later option. Design the merchant area so it could be lifted out (its own `js/merchant/` folder, no hidden coupling).

**Customer can:** browse categories, discover products from many sellers, search the whole marketplace (products, stores, categories), open a seller's store page (name, profile image, cover, about, products, rating), add products from different stores into one cart, pay once, track the order and receive updates.

**Merchant can:** apply and submit a store for approval; set store name and profile image; choose categories; upload product images and descriptions; set prices and stock; receive orders and move them through preparation; see sales and earnings; manage their store rental or subscription; see handover instructions.

**Admin can:** approve or reject merchants; manage rental payments; suspend stores; review products before publication; monitor all orders; see what each merchant owes or is owed; coordinate deliveries involving several sellers; handle refunds, disputes and cancellations; monitor revenue and commissions.

Illustrative sellers for demos only: Urban Finds (bags and fashion), TechNest (phones and gadgets), Glow Corner (beauty and skincare). These are demo data, flagged `is_demo`, removable in one click.

## A3. Delivery model (two routes)

The route is decided **server-side when the order is placed**, shown to the customer at checkout, and stored on the order. Admin can override.

**Route 1, direct: order contains items from exactly one seller**
Eligible when ALL are true: one seller only; store is approved and active; store has `direct_delivery_enabled`; customer's state/city falls inside the store's delivery zones (or within its radius if coordinates exist); admin's global direct-delivery switch is on. Flow: customer pays EverNeed, seller is notified, accepts, prepares, delivers, customer sees updates in EverNeed. If not eligible, it falls back to Route 2.

**Route 2, hub: order contains items from several sellers (or Route 1 is not eligible)**
Flow: one checkout, then EverNeed allocates each line to its seller (one `seller_order` per store), each seller prepares their own items, sellers bring items to the EverNeed hub, the EverNeed team verifies items against the checklist and consolidates them into one parcel, EverNeed arranges one delivery, the customer sees progress throughout.

**Privacy rule:** on Route 2 the merchant must NOT see the customer's phone or street address (first name and city only). On Route 1 the seller sees the full delivery details only after accepting.

**Delivery code:** each order gets a 4-digit delivery code shown only to the customer. The courier (EverNeed, or the seller on Route 1) enters it to mark the order delivered. The customer's existing "I received it" confirmation stays as a fallback.

## A4. Money model

- The customer always pays **EverNeed** (Paystack card/bank/USSD, or bank transfer that admin confirms). Never the seller directly.
- Each `seller_order` earns a ledger entry: gross sale, minus commission, equals merchant earning. Earnings are `pending` until delivery is confirmed (customer confirmation, delivery code, or auto-confirm after N days, configurable), then `available`.
- Payouts to merchants are recorded by admin (manual bank transfer first, with a reference). Paystack Transfers can be added later; design the ledger so that is a drop-in.
- Store rental or subscription is a separate revenue line with its own payments, due dates and status.
- Refunds can be partial (per seller_order or per line) and reverse the ledger.
- Default policy knobs (all settings, all editable): commission %, per-category and per-store overrides, rental plans, payout holding days, auto-confirm days, seller acceptance deadline, hub drop-off deadline.

## A5. Known audit findings (verify each in code, then fix as assigned)

Severity is for the **marketplace** version of the app.

| ID | Sev | Finding | Fix lands in |
|---|---|---|---|
| S1 | High | `products` and `settings` are readable by anyone with `using (true)` and the app loads `select=*`. Anonymous clients can read `sup_cost`, `sup_ship`, `sup_pid`, CJ `variants` (vid, sku, cost) and `settings.pricing.margin`. The README claims customers never see supplier cost. The same class of leak would hit merchant-private fields. | P1 (CJ removal), P2 (public views) |
| S2 | High | Policy "orders report paid" only checks `status`. A customer can PATCH their own `awaiting_transfer` order and change `total`, `items` or `cust` in the same request that sets `payment_reported`. | P1 hotfix |
| S3 | High | RPCs `email_status` and `email_is_admin` are executable by `anon`. Anyone can test whether an email is registered and whether it is an admin. | P1 hotfix |
| S4 | High | `keystore/debug.keystore` is committed and CI ships `assembleDebug` as the release. Anyone with the repo can sign an APK that installs over yours. Debug builds are debuggable and not eligible for Google Play. | P5 |
| S5 | High | Stock is decremented by read-modify-write in the Paystack function. Concurrent buyers can oversell. With many sellers this becomes constant. | P2 |
| S6 | Med | UGC XSS surface: about 22 `innerHTML` sites build HTML from strings. Today only the admin writes content. Once merchants write product names, descriptions and store names, an unescaped field becomes stored XSS running next to the session token in `localStorage`. | P2B, P3 |
| S7 | Med | `coupon_info` is callable by `anon` with unlimited guesses. `offers.used` is incremented non-atomically. | P1 |
| S8 | Med | No pagination or server-side search: the app downloads the whole `products` table and searches on the device. Will not scale past a few thousand products. | P2, P3 |
| S9 | Med | `whatsapp` and `bank` flows create orders in `sent` and `awaiting_transfer` states with no verification trail. Merchants must only ever see **paid** orders. | P2, P4 |
| S10 | Med | `orders.items` is denormalised jsonb. Reviews policy relies on `items @> ...`. No per-seller structure. | P2 |
| S11 | Med | Personal data: NIN and other ID values plus date of birth stored in `profiles` (`idv`, `dob`). Terms and Privacy URLs in `config.js` are empty. Needs data minimisation and policy links (Nigeria NDPA/NDPR). Owner should confirm requirements with a lawyer. | P1, P5 |
| S12 | Med | No push notifications. Only the local-notifications plugin is present, so "receive updates" is not met when the app is closed. | P4 |
| S13 | Low | Edge function inputs are only lightly validated (`cust` shape and size), no rate limiting, order ids come from `Date.now()` plus a short random string. | P2 |
| S14 | Low | Static `theme-color` (`#0f6b4f`) and Capacitor `backgroundColor` (`#fafaf8`) cause a white flash and wrong status bar in dark mode. | P2B |
| S15 | Low | Permissions requested: `RECORD_AUDIO`, fine location. Keep only what features use (mic for voice search, coarse location for region). Play policy will ask. | P5 |
| S16 | Low | CI runs only `node --check` and JSON parse. No tests of RLS, checkout or role flows. | P5 |
| S17 | Info | CJ webhook (`?hook=1`) has no signature check. It is harmless because it only triggers a refresh, but it goes away with CJ removal. | P1 |

Strengths to preserve: server-side price recomputation, Paystack webhook HMAC-SHA512 verification, card tokens only (no PANs), column-level grants on `cards`, RLS enabled on every table, reviews gated on delivered orders, offline cache, skeleton loaders, visible focus styles, reduced-motion support, multi-country currency and FX with markup, per-size stock, size guides, offers and banners.

## A6. Owner inputs (placeholders until I fill them in)

Hub address, hours and handover instructions; commission default; rental plan names, prices and limits; payout schedule and holding days; seller acceptance deadline; hub drop-off deadline; delivery fees (hub, direct) per country; Paystack keys; Firebase project and `google-services.json` for push; privacy policy and seller agreement text; refund policy; whether pay-on-delivery stays (default: off); regulated-goods rule (skincare, food, supplements: require a NAFDAC number on the product and verify it at review; the old README already warns about this).

## A7. Definition of done (global)

- No reference to CJ, dropshipping, EPROLO, `supplier`, `sup_*` or "Send to CJ" remains in code, schema (after migration), UI strings, README or CI.
- A customer can buy from three sellers in one checkout and see one tracked order with three packages.
- Merchant A can never read Merchant B's orders, products drafts, earnings or customers, proven by an automated test.
- Anonymous users can read only published products and approved stores, through public views, with no private fields.
- Every theme × mode combination passes the contrast checks in Phase 2B.
- All new UI text is escaped; a CI grep check fails the build on unescaped interpolation into `innerHTML`.

---

# PART B: PHASE BLOCKS

## PHASE 1: Audit, CJ removal, security hotfix

**Goal:** establish a baseline, remove everything CJ, close S2, S3, S7 immediately.

### 1.1 Audit report (no code changes yet)
Produce `docs/AUDIT.md`: file inventory; module map (which `window.X` owns what); data flow for load, auth, cart, checkout, payment, order tracking; findings S1 to S17 confirmed, refuted or extended with file and line; anything incomplete (buttons that do nothing, "coming soon" paths such as Google and NIN sign-in); config problems. Run `node --check` on every JS file and record the result. Stop and show me the report summary before step 1.2 if you find anything that contradicts Part A.

### 1.2 Remove CJ and "the rest"
Remove completely:
- `supabase/functions/cj/` (and the `cj` call sites).
- In `js/adminx.js`: `hasCj`, `cjRows`, `cjBox`, `prc` (CJ pricing tool), `impSheet`, `impLoad`, `impDraw`, import sheet and handlers (`cjsend`, `cjgo`, `cjref`, `acj`, price recalculation), and the `cjRows` and `cjBox` exports.
- In `js/shop.js`: the `CJ` status map, `trackHtml` supplier-specific parts, `trackRefresh` calling the `cj` function (keep a generic tracking block that Phase 4 re-implements on the new delivery model).
- In `js/app.js`: the `supplier` check in `payStep`; CJ-only payment restrictions.
- In `js/store.js`: loading of `order_costs`, and the `cj` and `pricing` settings branches.
- In `supabase/functions/paystack/index.ts`: the "hand the paid order to CJ" block and the `supplier` restrictions on `whatsapp`/`card_later`.
- README sections: Suppliers (CJdropshipping), Order fulfilment with CJdropshipping, roadmap item 4, "CJ products show every option as available".
- Strings: "Supplier", "Send to CJ", "Being prepared for shipping", "Processing with our supplier".

Database migration `001_remove_cj.sql`:
- Existing CJ-imported products are **archived, not deleted** (`status='archived'`) because past orders reference them. Existing first-party stock is kept and will be attached to a built-in store named "EverNeed" in Phase 2.
- Drop `order_costs`, `kv` rows `cj_*`, `settings` rows `cj` and `pricing`.
- Drop columns `supplier, sup_pid, sup_cost, sup_ship, variants, opt, ship_days` and the `products_supplier_pid` index **only after** archiving. Keep `maker, origin, ships_from, sku, weight_g, dims, material` (useful for sellers).
- Remove `CJ_API_KEY` from docs. Tell me to delete the secret in Supabase.
- Do not build a plugin or supplier-adapter layer. If I want product import later, it returns as a per-merchant tool inside their own store, not platform-wide.

### 1.3 Security hotfix migration `002_hotfix.sql`
- **S2:** drop policy "orders report paid". Customers report a transfer through a server function `report_payment(order_id, reference, note)` that only changes status and stores the reference. No client PATCH on `orders` at all.
- **S3:** drop `email_status` and `email_is_admin`. Rework the sign-in screen to use Supabase Auth responses only, with non-revealing messages ("Check your email or password").
- **S7:** move coupon checking into the Edge Function (service role, per-user rate limit); make the `used` increment atomic (`update ... set used = used + 1 where used < limit_uses returning *`).
- **S1 (interim):** `settings`: make anon read only the columns needed (country config), not a blanket select; the full public-view solution arrives in Phase 2.

### 1.4 Checkpoint 1
Show: audit summary, list of deleted files and functions, `grep -ri "cj\|supplier\|sup_" .` returning nothing, both migrations, and a manual test script proving (a) a customer cannot change an order total, (b) anon cannot call the removed RPCs, (c) the app still builds, browses, checks out by card and bank transfer.

---

## PHASE 2: Marketplace database and secure access

**Goal:** the data model for stores, per-seller orders, allocation, delivery, rental and money, with RLS you can defend.

### 2.1 Roles and ownership
- `profiles.role` becomes `customer | merchant | admin`. A user applies as a customer (creating a pending store); the role becomes `merchant` on approval (trigger), never by client write.
- A merchant can still shop. Switching between customer and merchant mode is a UI toggle. Admin keeps the existing behaviour (routed to the admin area).
- Start with one store per owner (`unique(owner_id)`). Leave room for `store_members` (staff) without building it.

### 2.2 Tables (names are guidance; keep naming consistent)

**stores:** `id, owner_id, slug (unique), name, tagline, about, logo_url, cover_url, accent (one of the theme palette ids), categories text[], country, state, city, pickup_address, phone, status (draft | pending | approved | rejected | suspended), status_note, direct_delivery_enabled, delivery_zones jsonb, commission_override numeric null, is_official boolean, is_demo boolean, created_at, approved_at`.
**store_applications:** `id, store_id, submitted_at, reviewed_by, reviewed_at, decision, reason, business_name, id_type, id_ref (stored minimally, admin-only), bank_name, account_number, account_name`.
**store_plans:** `id, name, price, period (monthly), product_limit, commission_discount, features jsonb, active`.
**store_subscriptions:** `id, store_id, plan_id, status (trialing | active | past_due | expired | cancelled), current_period_start, current_period_end, grace_until`.
**store_payments (rental payments):** `id, store_id, subscription_id, amount, currency, method (paystack | bank | admin_recorded), reference, status, paid_at, recorded_by`.
**products:** add `store_id (not null after backfill), status (draft | pending_review | published | rejected | archived), review_note, reviewed_by, reviewed_at, compliance_ref`. Keep existing columns (`stock`, `stocks` per size, `images`, `sizes`, `axes`, `chart`, `cty`, ...).
**orders (parent):** keep `user_id, total, currency, country, pm, cust, discount, coupon, offer`; add `route (direct | hub), route_reason, delivery_fee, delivery_code (hashed or admin-readable only), status (placed | awaiting_payment | paid | confirmed | preparing | ready_for_delivery | out_for_delivery | delivered | cancelled | disputed), paid_at, auto_confirm_at`.
**order_items:** `id, order_id, seller_order_id, product_id, store_id, name, size, unit_price, qty, line_total, commission_rate, commission_amount`.
**seller_orders:** `id, order_id, store_id, status (pending | accepted | rejected | preparing | ready | handover_pending | at_hub | consolidated | out_for_delivery | delivered | cancelled | issue), subtotal, commission, earning, accept_by, rejected_reason, accepted_at, ready_at, handed_over_at, hub_received_at, hub_check jsonb (per item: received / missing / damaged), delivered_at`.
**deliveries:** `id, order_id, mode (direct | hub), courier_name, courier_phone, tracking_note, parcel_label, status, dispatched_at, delivered_at, proof (code_verified | customer_confirmed | admin_override)`.
**ledger_entries:** `id, store_id nullable, order_id, seller_order_id, kind (sale | commission | rental | refund | payout | adjustment), amount (signed), currency, status (pending | available | paid | reversed), note, created_at`. Append-only. Never update amounts; reverse with a new entry.
**payouts:** `id, store_id, amount, currency, reference, method, paid_at, recorded_by, period`.
**refunds / disputes:** `id, order_id, seller_order_id nullable, opened_by, reason, status, amount, resolution, resolved_by, timestamps`.
**notifications:** `id, user_id, kind, title, body, data jsonb, read_at, created_at` (customers, merchants and admins).
**hub_settings / settings rows:** hub name, address, hours, handover instructions, drop-off deadline, fees per route and country, commission default, payout hold days, auto-confirm days, acceptance deadline.
**audit_log:** `id, actor_id, action, target_type, target_id, before, after, at`. Written by triggers or functions for approvals, suspensions, status overrides, refunds, payouts, rental changes.

Add indexes for `products(store_id,status)`, `seller_orders(store_id,status)`, `order_items(order_id)`, and a `tsvector` (or `pg_trgm`) index for search over product name, description and store name.

### 2.3 Backfill
Create the built-in store **EverNeed** (`is_official=true`, approved) and attach all existing first-party products to it, so nothing disappears. Convert existing `orders.items` into `order_items` and one `seller_order` per order for history, so old orders still render.

### 2.4 RLS (write it, then test it)
- **Public (anon + authenticated)** read only through views: `public_products` (published products of approved, active-rental stores; no private fields), `public_stores` (approved stores; no payout, ID or phone fields), `public_reviews`. Base tables are not directly readable by anon.
- **Merchant:** CRUD on own `products` (cannot set `status='published'`; only `draft` and `pending_review`; `published` is set by admin or by an automatic rule when the admin chooses "auto-approve trusted stores"). Read own `seller_orders` and `order_items`. Read own `ledger_entries`, `payouts`, `store_subscriptions`, `store_payments`. Update own store profile fields but never `status`, `commission_override`, `is_official`. Update own `seller_orders` only through functions that enforce legal state transitions.
- **Customer:** read own `orders`, `order_items`, `deliveries` (not other users', not ledger). No direct inserts or updates on orders.
- **Admin:** full access, with every sensitive change written to `audit_log`.
- Merchants never read `profiles` of customers. They get a sanitised `seller_order_view` that applies the privacy rule in A3 (customer first name and city on hub orders; full details on direct orders only after `accepted`).
- Storage: bucket `media` keeps public read; uploads allowed only under `stores/<store_id>/...` for the owner of that store and anywhere for admin. Enforce file size and type limits.

### 2.5 Server functions (SQL or Edge, service role; one transaction each)
`create_order` (replaces the current "create" action: validates cart, splits by store, computes route, fees, commission, reserves stock atomically with `update ... set stock = stock - $qty where stock >= $qty`, generates uuid ids and the delivery code); `confirm_payment` (called by the Paystack webhook and admin bank-transfer confirmation; only now do seller orders become visible to merchants and ledger `sale` entries appear); `seller_transition(seller_order_id, to_status, payload)`; `hub_receive(seller_order_id, check)`; `hub_consolidate(order_id)`; `dispatch(order_id, courier)`; `mark_delivered(order_id, code)`; `cancel_order`, `refund(order_id|seller_order_id, amount, reason)`; `release_earnings` (scheduled: pending to available); `apply_rental_payment`; `expire_rentals` (scheduled: past_due, grace, expired; hides products, never deletes); `approve_store`, `reject_store`, `suspend_store`; `record_payout`. Add input validation, length caps and per-user rate limits on every public function (S13).
Idempotency: the Paystack webhook and every payment function must be safe to call twice.

### 2.5b State machines (enforce in SQL, reject illegal jumps)
```
seller_order (direct): pending > accepted > preparing > ready > out_for_delivery > delivered
seller_order (hub):    pending > accepted > preparing > ready > handover_pending > at_hub > consolidated
any:                   pending > rejected | cancelled ;  accepted..ready > issue
parent order:          placed > paid > confirmed (all sellers accepted) > preparing >
                       ready_for_delivery (direct: seller ready; hub: all consolidated) >
                       out_for_delivery > delivered ;  cancelled | disputed
```
If a seller rejects or misses the acceptance deadline: that seller_order is cancelled, its amount is auto-refunded (partial refund, ledger reversal), the customer is notified, and admin is alerted. The rest of the order continues.

### 2.6 Checkpoint 2
Deliver migrations `003` onward, `docs/DATA_MODEL.md` (diagram in Mermaid), `docs/RLS_MATRIX.md` (table: role × table × operation), and `tests/rls.test.mjs` that creates four users (customer, merchant A, merchant B, admin) against a local Supabase (`supabase start`) and asserts the rules in A7, including: merchant B cannot read merchant A's seller_orders; anon cannot read draft products or private store fields; a client cannot update an order; two parallel checkouts for the last unit result in exactly one success.

---

## PHASE 2B: Design system and theming (before building merchant and admin screens)

**Goal:** a premium, distinctive look on a real token system, with a proper dark mode and selectable colour themes, applied to the customer app first and reused by merchant and admin screens.

### 2B.1 What is wrong today (verify in `css/app.css`)
- Only six colour tokens (`--bg --ink --mut --line --card --ac`). Everything else is hard-coded or inverted from these.
- Dark mode has surfaces that are almost the same colour (`#0d0f0e`, `#151a18`, border `#232927`), so cards, sheets and inputs melt into the background. Shadows do nothing on dark. Muted text (`#8f9892`) is weak. One flat accent.
- Primary buttons, active tab and "add" buttons invert `--ink` and `--bg`, which is fine in light and looks stark in dark.
- Banner text is hard-coded (`#111`, `#fff`), icon and star colours are hard-coded in JS (`#f5a524`, `#0f6b4f`).
- `index.html` `theme-color` and Capacitor `backgroundColor` are light-only (white flash).

### 2B.2 Design process (mandatory)
Before any code, write `docs/DESIGN_PLAN.md`: (1) the subject and audience (Nigerian mobile shoppers and small sellers; low-to-mid Android devices; often on mobile data); (2) core palette as named hex values; (3) type roles; (4) layout concept with ASCII wireframes for Home, Product, Store, Cart, Merchant dashboard and Admin hub board; (5) principles. Then review the plan against these instructions and revise any part that looks like a generic template default. State what you changed and why. Only then build.

Design principles for this brief:
- **One memorable thing: the store-forward marketplace identity.** Every product card shows its seller, and stores have a visible, colourful identity (avatar ring in the store's accent, cover image, verified mark). Keep everything else quiet and disciplined.
- Avoid the generic AI look: no cream-and-terracotta default, no single acid-green on black, no identical rounded cards with one soft grey shadow everywhere, no tracked-out ALL-CAPS eyebrow labels above every heading, no `A · B · C` meta strings everywhere, no numbered markers unless the content is a real sequence, no scattered fade-up animations.
- Use a **radius scale** by hierarchy (chips 10, inputs 14, cards 20, sheets 28, avatar full) rather than one radius for everything.
- Motion only where it answers an action (add to cart, sheet open, tab change, status change). Respect `prefers-reduced-motion`.
- Sentence-case copy, active verbs ("Add to cart", "Submit for review"), errors that say what to do, empty states that invite an action.

### 2B.3 Token architecture
Semantic tokens only; components never use raw hex. Define in `css/tokens.css`:

```
Surfaces      --bg  --surface-1  --surface-2  --surface-3  --overlay
Lines         --border  --border-strong
Text          --text-1  --text-2  --text-3  --text-on-brand
Brand         --brand  --brand-hover  --brand-soft  --brand-ring
Accent        --accent  --accent-soft           (secondary highlight, e.g. sale badges)
Status        --success  --warning  --danger  --info   (+ -soft variants)
Elevation     --shadow-1  --shadow-2  --shadow-3  --glow
Shape         --r-chip  --r-input  --r-card  --r-sheet
Space         4-pt scale: --s-1 ... --s-8
Type          --fs-xs ... --fs-3xl, --lh-*, --ls-*
Motion        --ease  --dur-1 (120ms)  --dur-2 (220ms)  --dur-3 (360ms)
```

Theme model: two independent attributes on `<html>`.
- `data-mode`: `light | dark | amoled | system` (system follows `prefers-color-scheme`).
- `data-palette`: `emerald | indigo | rose | violet | ocean | gold`.
Persist both in `localStorage` and sync to `profiles.settings` when signed in. Apply them with a tiny inline script in `<head>` **before first paint** (no flash). Update `<meta name="theme-color">` and, through Capacitor, the status bar and navigation bar colour whenever either attribute changes. Set the Capacitor `backgroundColor` to a neutral dark that matches the splash.

### 2B.4 The six palettes
Write explicit hex values for every token in every palette in both light and dark (and AMOLED: `--bg:#000`, surfaces stepped up from it). Do not depend on `oklch()` or `color-mix()` at runtime (older Android WebViews). Start from these brand colours and derive the rest:

| Palette | Character | Brand (light) | Brand (dark) |
|---|---|---|---|
| Emerald (current brand) | heritage, trustworthy | `#0F6B4F` | `#3FD39A` |
| Indigo | modern, techy | `#4F46E5` | `#8E8CFF` |
| Rose | warm, fashion-forward | `#E11D48` | `#FF6B88` |
| Violet | creative, beauty | `#7C3AED` | `#B18CFF` |
| Ocean | calm, clean | `#0E7490` | `#34D3EE` |
| Gold | premium, luxe | `#A16207` | `#F2C14E` |

**Dark mode rules (this is the fix for "doesn't look attractive"):**
- Tint every dark surface with a hint of the palette hue (not pure grey).
- Build **four stepped surfaces**: `bg`, `surface-1`, `surface-2`, `surface-3`, each about 5 to 7 lightness points above the last, so cards read clearly against the background and sheets against cards.
- Add a 1px top highlight on raised surfaces (`inset 0 1px 0 rgba(255,255,255,.05)`) and a visible border (`rgba(255,255,255,.10)`). Use soft coloured glow (`--glow`) for the primary button and active states instead of drop shadows.
- Text: `--text-1` near-white (not pure `#fff`), `--text-2` at least 7:1 on `bg` for secondary body copy, `--text-3` at least 4.5:1 for captions.
- Desaturate large brand-coloured areas in dark mode; keep saturated brand only for small elements (buttons, rings, badges).
- Primary buttons use `--brand` with `--text-on-brand`, not inverted ink.
- Images and banners get a subtle gradient scrim so text is legible on any image; no hard-coded text colours.

Add `tools/check-contrast.mjs` that parses `tokens.css`, computes WCAG contrast for every required pair (text on bg and each surface; brand on bg; text-on-brand on brand; border visibility, minimum 1.3:1 against adjacent surface) for all 6 palettes × 3 modes = 18 token sets, and fails CI under thresholds (body text 4.5:1, large text and UI 3:1).

Per-store accent: a store chooses one of the six palette brand colours. It only affects that store's page header, avatar ring and badges. It must never replace the user's chosen theme for the rest of the app, and must be contrast-checked against the active mode.

### 2B.5 Typography
Bundle fonts locally as `woff2` (the app must work offline and on slow data; no external font requests). Recommended pairing (swap if you can justify better): **Bricolage Grotesque** (display: headlines, prices, store names) with **Figtree** (body and UI). Verify that **₦, GH₵, KSh and R** render in the final subset; if not, include a fallback face for currency glyphs. Fallback stack: `system-ui, sans-serif`. Use a defined type scale, tabular numerals for prices and order totals, line length under 75 characters for descriptions.

### 2B.6 Layout language
Take structure and ideas from the best marketplace patterns common on Dribbble, **described here in my own terms**. You cannot browse Dribbble from this environment and you must not copy any specific shot, asset or illustration. Build original work. If I paste Dribbble links or screenshots into the session, treat them as mood references: extract hierarchy, spacing, and interaction ideas and reproduce none of the artwork.

Patterns to use:
1. **Home:** greeting and location chip with a glass search bar that stays pinned; a row of **store avatars with accent rings** (ring shows new arrivals); hero carousel with pill pagination; a **bento category grid** (asymmetric tiles: one tall, two small, one wide, with item counts); "Fresh from sellers" two-column feed with **varied card heights** and a **store chip on every card**; sticky category chips under the header.
2. **Product card:** 20px-radius image, floating wishlist heart, quick-add button, price in display type, tiny seller row (logo + name), rating. Out-of-stock cards are dimmed with a label, not hidden.
3. **Product page:** full-bleed snap gallery with dot indicators, detail panel that overlaps the gallery, **sticky bottom bar** (quantity stepper plus "Add to cart"), "Sold by" store card, "More from this store", size guide sheet.
4. **Store page:** cover image with overlapping avatar, stats row (rating, products, joined), tab pills (Products, About, Reviews), sticky filter bar, share and report actions.
5. **Cart:** grouped by store in separate cards with per-store subtotals and a clear **delivery notice** ("2 sellers: delivered together from the EverNeed hub").
6. **Order tracking:** vertical timeline rail for the order, package cards per seller beneath it, the delivery code in a prominent card.
7. **Merchant dashboard:** bento KPI tiles (today's orders, earnings available, pending earnings, low stock), a "Needs your attention" queue (orders to accept, handovers due, rental due), inline-SVG sparkline of 14-day sales.
8. **Admin:** phone-first cards that become tables on wider screens (the app already allows `max-width: 1000px`; raise it for admin to 1280px).
9. **Navigation:** keep the floating pill tab bar, add an animated active indicator, badges for cart and notifications. Glass effect (backdrop blur) only on header and tab bar, with a solid fallback.

Quality floor: responsive from 320px, 44px minimum touch targets, visible keyboard focus, text scaling to 200% without breakage, icons from one consistent set (24px grid, 1.75px stroke; no emoji as icons), skeletons for every loading state, `content-visibility: auto` on long feeds.

### 2B.7 Deliverables
`css/tokens.css`, `css/themes.css`, refactored `css/app.css` using tokens only, `css/components.css` (buttons, chips, cards, sheets, inputs, badges, tabs, timeline), a **Settings > Appearance** screen (mode selector, six palette swatch cards with a live preview, AMOLED toggle), a quick theme toggle in the header, and `docs/DESIGN_SYSTEM.md` with a component gallery page (`/gallery.html`, dev-only) showing every component in every theme.

### 2B.8 Checkpoint 2B
Show screenshots (or recordings) of Home, Product, Store, Cart, Tracking in Emerald and two other palettes, in light, dark and AMOLED. Show the contrast checker passing for 18 token sets. Confirm there is no white flash on cold start in dark mode.

---

## PHASE 3: Merchant interface and customer marketplace

**Goal:** sellers can join, sell and get paid; customers can discover across stores.

### 3.1 Merchant area (`#/m/...`, files in `js/merchant/`)
1. **Apply:** account, then a short wizard: store name (unique slug, live availability check), logo and cover (client-side resize reusing `shrink`), tagline and about, categories (multi-select from existing `collections`), contact phone, pickup address, direct-delivery toggle and zones, payout bank details, business and ID details (minimum needed), agreement acceptance. Submit sets status `pending`. The applicant sees a clear "Under review" screen and gets a notification on decision, with the reason if rejected and a way to edit and resubmit.
2. **Dashboard:** KPIs, attention queue, rental status banner (due date, "Pay now"), quick actions.
3. **Products:** list with status chips (draft, in review, live, rejected with note, archived); create and edit (up to 8 images, description, price, compare-at price, category, per-size stock and option axes reusing the existing size and colour model, SKU, origin, maker, weight, compliance reference); "Submit for review"; duplicate; archive; bulk CSV import with a downloadable template and row-by-row error report; low-stock alerts; enforce the plan's product limit.
4. **Orders:** tabs New, Preparing, Ready, Handed over, Completed, Issues. Accept or reject (rejection needs a reason), mark preparing, mark ready. Actions available depend on the order's route (see A3, Phase 4). Show the acceptance countdown. Hub-route orders show a printable A6 **packing slip with QR** (order code, store, items) and **handover instructions** (hub address, hours, deadline).
5. **Earnings:** available, pending, lifetime, commission paid, payout history; per-order breakdown (gross, commission, net); CSV export; statement per payout.
6. **Rental:** current plan, status, next due date, history, "Pay now" (Paystack with `type=rental` metadata), plan upgrade, receipts. If lapsed: banner, grace period, then products hidden (never deleted) until paid.
7. **Store settings:** profile, accent colour, categories, delivery zones, holiday mode (pauses new orders), notification preferences.
8. **Notifications** list.

### 3.2 Admin additions (extend existing `js/admin*.js`; re-home banners, offers, size charts, country settings under Settings and Catalog)
- **Merchants:** application queue (approve, reject with reason, request changes), directory, suspend and reinstate (with reason and effect on live products and open orders), plan and commission overrides.
- **Product review queue:** approve, reject with note, bulk approve, "trusted store" auto-approve switch, regulated-goods check (compliance reference present).
- **Rentals:** plans CRUD, subscriptions list, record an offline payment, extend or waive, overdue list.
- **Finance:** per-merchant balance (owed to merchant, owed by merchant), commission report, rental revenue, payouts (record with reference), CSV exports.
- **Overview:** GMV, commission, rental revenue, orders by status, pending approvals, overdue handovers.

### 3.3 Customer marketplace upgrades
- Marketplace feed keeps the on-device ranker but adds a **store-diversity cap** (no more than two consecutive items from the same store) and a store chip per card.
- **Search:** server-side (tsvector/trigram), debounced, paginated 20 at a time, results grouped as Products, Stores, Categories; filters (category, price range, store, rating, in stock, country) and sorting. Replace "download everything" loading with paginated queries and cache (S8). Search history and suggestions are local.
- **Store page** at `#/store/<slug>`: as in 2B.6, with follow, share and report.
- **Product page:** "Sold by", store rating, more from this store, returns and delivery info that reflects the route that would apply.
- **Cart:** grouped by store; checkout creates **one** payment and **one** parent order via `create_order`; shows the route and the delivery fee before paying; stock and price changes are reported clearly if they changed since adding.
- **Reviews:** per product and a store rating roll-up; verified-purchase only (existing rule, moved to `order_items`).
- **Wishlist** and **recently viewed** (local, synced when signed in).

### 3.4 Checkpoint 3
Demo script: Merchant A applies, admin approves, A adds a product, admin approves it, customer finds it through search and through the store page. Show RLS tests still passing and the contrast checker passing.

---

## PHASE 4: Delivery coordination, tracking and notifications

### 4.1 Route 1 (direct)
Eligibility function and its stored reason (`route_reason`), seller delivery flow (accept, prepare, out for delivery, delivered with the customer's delivery code), seller-set delivery fee within admin limits, direct-delivery switch per store and globally.

### 4.2 Route 2 (hub)
- Merchant: "Mark ready", then "I'm bringing it to the hub" (`handover_pending`) with the printable slip.
- **Hub board** (admin): expected arrivals today, overdue handovers, per-order checklist per seller with per-item *received / missing / damaged* and photo, "Receive" per seller_order, "Consolidate" when all are in (generates one parcel label with QR and the delivery code), discrepancy handling (missing item: partial refund and notify, wait for seller, or substitute; damaged: dispute).
- **Dispatch:** assign courier (name, phone, optional tracking link or note), mark out for delivery, mark delivered via code or admin override (audited).
- Customer-visible **timeline** with plain-language steps, estimated windows, per-seller package status, and the delivery code.

### 4.3 Cancellations, refunds, disputes
Customer can cancel before any seller accepts; after that they request cancellation (seller or admin decides). Dispute flow with reasons, photos, and admin resolution (refund, partial refund, replace, reject). Refunds create ledger reversals and call the Paystack refund API (for card payments) or are recorded manually (bank transfer). All amounts shown in the customer's currency.

### 4.4 Notifications
- In-app notification centre for all three roles, with unread badge.
- **Push** via `@capacitor/push-notifications` and Firebase Cloud Messaging: store device tokens, send from an Edge Function on every status change. If I have not supplied a Firebase project yet, ship the full in-app path and Supabase Realtime subscriptions plus local notifications while the app is open, and leave push behind a config flag with exact setup steps.
- Merchant alerts: new order, acceptance deadline soon, handover due, product approved or rejected, rental due.
- Admin alerts: new application, product review queue, overdue handover, dispute opened.

### 4.5 Scheduled jobs (Supabase scheduled functions or `pg_cron`)
`release_earnings`, `expire_rentals`, rental reminders (7, 3, 1 days), acceptance and handover deadline escalations, auto-confirm delivery after N days, stale unpaid order cleanup with stock release.

### 4.6 Checkpoint 4
End-to-end demo of both routes, including a three-seller order with one missing item, plus the ledger and payout view after delivery.

---

## PHASE 5: Testing, release and promotion

### 5.1 Tests (run in CI)
- RLS suite from Phase 2 (extended to every table added later).
- Checkout and money suite: price tampering, coupon reuse, concurrent last-unit purchase, double webhook, partial refund reversal, ledger balances to zero across sale, commission, refund and payout.
- Role-flow E2E with Playwright against the web build and a local Supabase: apply, approve, list product, review, buy from three sellers, receive at hub, consolidate, deliver, release earnings, record payout.
- Scenario list to cover: single-seller direct delivery; three sellers via hub; seller rejects; seller misses deadline; rental lapses mid-order (existing orders still honoured); store suspended; product rejected then fixed; customer cancels before acceptance; dispute on a damaged item.
- Static checks: `node --check`, JSON validity, the unescaped-`innerHTML` grep rule, contrast checker, SQL lint on migrations.

### 5.2 Release hygiene
- Remove `keystore/debug.keystore` from the repo (S4). Generate a private **release keystore**, store it and its passwords as GitHub Secrets, and build a signed **AAB** (Play) and a signed APK (sideload). Document the one-time consequence: phones with the old debug-signed build must uninstall once.
- Keep the debug APK build only as a clearly named testing artifact.
- Trim permissions to what is used (S15). Add privacy policy and terms URLs to every country block; a seller agreement screen; data-deletion path in Settings.
- Update README fully (setup, environment, secrets, migrations order, roles, how to approve the first merchant, how to run tests).

### 5.3 Demo and promotion material (only real, working features)
- `supabase/seed_demo.sql` creates the three illustrative stores (Urban Finds, TechNest, Glow Corner), products, and sample orders, all `is_demo=true`, plus an admin button **Remove demo data**.
- A written **shot list** for promo videos using the real app: customer discovery across three stores, one checkout, merchant accepting, hub consolidation, delivery tracking, theme switching (light, dark, two palettes). Recording tips for Android (resolution, status bar, notification muting).
- Three **WhatsApp development update** templates (what shipped, what's next, how to try it), each under 120 words, factual, with no claims about features that are not yet working.

### 5.4 Checkpoint 5
All tests green in CI, signed build installed over a previous signed build, seed data removable, README verified by following it from scratch.

---

# PART C: OUTPUT FORMAT FOR EVERY PHASE

1. **Summary** (5 lines max): what is done and what is not.
2. **Decisions I made** (and how to change each).
3. **Files changed**, grouped: migrations, edge functions, JS, CSS, docs, tests.
4. **How I tested it**: commands run and results, not claims.
5. **How I verify it on a phone**: numbered manual steps.
6. **Risks and owner inputs still needed.**
7. Stop at the checkpoint.

---

# PART D: KICKOFF LINES TO PASTE

Session 1: *"Read Part A and Phase 1. Start with 1.1 only and show me the audit summary."*
Session 2: *"Phase 1, steps 1.2 to 1.4."*
Session 3: *"Phase 2, through Checkpoint 2."*
Session 4: *"Phase 2B. Write the design plan first and show it to me."*
Session 5: *"Phase 3."*
Session 6: *"Phase 4."*
Session 7: *"Phase 5."*

Design references: paste Dribbble links or screenshots under this line before Session 4. They are mood references only.

> Design reference slot: (paste here)
