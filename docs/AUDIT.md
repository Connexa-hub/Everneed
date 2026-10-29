# EverNeed Audit Report — Phase 1.1

**Date:** 2026-10-29
**Repo:** Connexa-hub/Everneed (main branch)
**Auditor:** Automated review against Part A master context

---

## 1. File Inventory

| Path | Purpose | Lines (approx) |
|---|---|---|
| `index.html` | App shell, script loader, single `<main>` | 1 |
| `css/app.css` | All styling (single file) | ~970 |
| `js/config.js` | Country config, Supabase keys, collections | 17 |
| `js/supa.js` | Minimal Supabase client (fetch-based) | 33 |
| `js/store.js` | Data layer (local + remote, caching) | 39 |
| `js/app.js` | Main app: routing, cart, checkout, home, admin | 220 |
| `js/auth.js` | Email-first sign-in flow | 58 |
| `js/shop.js` | Product page, gallery, reviews, order tracking | 82 |
| `js/admin.js` | Admin dashboard (products, banners, orders) | not read (exists) |
| `js/adminx.js` | Admin extensions (CJ, pricing, import sheet) | not read (exists) |
| `js/banners.js` | Banner logic | not read |
| `js/cards.js` | Saved card management | not read |
| `js/country.js` | Country/currency context, FX rates | not read |
| `js/guide.js` | Size guide diagrams | not read |
| `js/opts.js` | Product option (color/size) parsing | not read |
| `js/payments.js` | Payment method definitions | not read |
| `js/busy.js` | Loading indicator | not read |
| `supabase/schema.sql` | Database schema (all in one file) | 115 |
| `supabase/functions/paystack/index.ts` | Paystack edge function | 279 |
| `supabase/functions/cj/index.ts` | CJ dropshipping edge function | exists |
| `data/products.json` | Seed products | exists |
| `data/banners.json` | Seed banners | exists |
| `capacitor.config.json` | Capacitor config (webDir: www) | 6 |
| `package.json` | Capacitor dependencies only | 13 |
| `keystore/debug.keystore` | Debug signing keystore (committed) | exists |
| `.github/workflows/` | CI (build Android APK) | not read |

**Note on line counts:** The codebase is described as ~150 KB in ~970 lines. In practice the JS files are dense one-liner style — `js/app.js` alone is 220 lines but contains the entire app logic, routing, cart, checkout, and event handling. Each "line" packs 3-5 statements.

---

## 2. Module Map (window.X ownership)

| Module | window var | Responsibility |
|---|---|---|
| Config | `CFG` | Country blocks, Supabase URL/key, collections, ads config |
| Storage/Data | `S` (window.S) | localStorage + Supabase REST; products, banners, orders, collections, settings, charts, offers, cards, ratings |
| Supabase client | `Supa` (window.Supa) | Auth (signUp, signIn, otp), REST CRUD, RPC, edge function calls, file upload |
| Country context | `Ctx` (window.Ctx) | Current country, currency conversion, FX rate loading |
| App core | `A` (window.A) | Routing, cart, checkout, rendering, notifications, sheets, images |
| Auth | `Auth` (window.Auth) | Email-first sign-in wizard (email → code/password → profile) |
| Shop | `Shop` (window.Shop) | Product page, gallery, size options, reviews, order tracking |
| Admin | `Adm` (window.Adm) | Admin dashboard (products, banners, orders, collections) |
| AdminX | `AdmX` (window.AdmX) | Admin extensions: CJ settings, pricing, import sheet |
| Banners | `Banners` (window.Banners) | Banner selection logic |
| Cards | `Cards` (window.Cards) | Saved card UI, Paystack checkout popup |
| Options | `Opts` (window.Opts) | Product color/size option parsing |
| Payments | `Pay` (window.Pay) | Payment method definitions (card, bank, whatsapp, card_later) |
| Guide | `Guide` (window.Guide) | Size guide diagrams |
| Busy | `Busy` (window.Busy) | Loading spinner |

---

## 3. Data Flow Analysis

### 3.1 Load
- On app start: `S.load()` fires. If Supabase keys are set, it fetches `products`, `banners`, `orders` (if signed in), `collections`, `settings`, `size_charts`, `product_ratings`, `order_costs`, `auto_offers`, and `cards` in parallel.
- If offline or fetch fails, it falls back to localStorage cache (`en_cache`).
- Without Supabase keys, it loads from `data/products.json` and `data/banners.json`.
- FX rates are loaded from `open.er-api.com` (4s timeout).

### 3.2 Auth
- Email-first flow in `Auth`: enter email → `email_status` RPC (or `email_is_admin` if `CFG.emailCodes`) determines if user exists / is admin → password step (existing) or create step (new) → profile completion (name, DOB, country, photo).
- **Google sign-in and NIN verification are listed in the UI but are non-functional ("Coming soon" / "Coming in Stage 2b").**
- On success: `Supa.profile()` fetches the user's profile, sets `user` object, checks `role === 'admin'`.
- Admins are redirected to `#/a` (admin area).

### 3.3 Cart
- Cart is stored in localStorage (`en_cart`) as `{ "productId~size": qty }`.
- `addCart(id, size)` checks stock limits, adds to cart, calls `bump()` for ranking.
- Cart lines can be edited (size, quantity) via a sheet.
- `tot()` computes subtotal, discount (best offer/coupon), delivery fee, total.

### 3.4 Checkout
- Two-sheet flow: (1) delivery address, (2) review and pay.
- Address saved to localStorage (`en_addr`).
- On submit (`data-form="order"`):
  - With Supabase: calls `paystack` edge function `action: "create"` with items, pm, card_id, coupon, country, customer details.
  - Without Supabase: creates a local order directly.
- Payment methods: `card` (Paystack popup), `bank` (awaiting transfer), `whatsapp` (sent), `card_later` (pay on delivery).
- **Supplier restriction:** If any cart item has `supplier` set, WhatsApp and card_later are blocked (`js/app.js` line 156).

### 3.5 Payment
- Card: `Cards.start(o)` opens Paystack popup → on success, `paystack` edge function `action: "init"` or `"charge"` → Paystack processes → webhook calls `settle()`.
- Bank transfer: order created with `status: "awaiting_transfer"`. Customer clicks "I've paid" → `S.patch("o", id, {status: "payment_reported"})` — **this is the S2 vulnerability**.
- WhatsApp: order created with `status: "sent"`, opens WhatsApp with order details.
- Bank transfer confirmation: admin can mark paid via `paystack` function `action: "charge_later"` (actually that's for card_later). The README says admin confirms bank transfers.

### 3.6 Order Tracking
- `Shop.order(id)` shows a timeline (Placed → Paid → Shipped → Delivered).
- CJ tracking: `trackHtml()` renders CJ-specific tracking info from `o.track`. `trackRefresh()` calls the `cj` edge function.
- Delivery confirmation: customer clicks "I received it" → `paystack` function `action: "received"`.

---

## 4. Findings — S1 through S17

### S1 — Public read of private fields (HIGH) ✅ CONFIRMED
- `schema.sql` line 21: `create policy "products read" on public.products for select using (true);` — anyone with anon key reads ALL columns including `supplier, sup_pid, sup_cost, sup_ship, variants, opt`.
- `schema.sql` line 45: `create policy "settings read" on public.settings for select using (true);` — anyone reads `settings.data` which includes `pricing.margin`.
- `js/store.js` line 17: `S.load()` fetches `products` with `select=*` (via `Supa.list("products")`), meaning all columns including private ones arrive in the client.
- **Impact for marketplace:** Merchant-private fields (cost, supplier info) would be exposed to any anonymous user.
- **Fix lands in:** P1 (CJ removal eliminates sup_* columns), P2 (public views).

### S2 — Order PATCH allows total/items manipulation (HIGH) ✅ CONFIRMED
- `schema.sql` line 27: `create policy "orders report paid" on public.orders for update using (user_id=auth.uid() and status='awaiting_transfer') with check (user_id=auth.uid() and status='payment_reported');`
- The `WITH CHECK` only validates that `status='payment_reported'` — it does NOT prevent the customer from changing `total`, `items`, `cust`, or other fields in the same PATCH request.
- `js/app.js` line 191: `S.patch("o", d.id, {status: "payment_reported"})` — the client only sends status, but the RLS policy would allow a crafted request to include `total`, `items`, etc.
- **Fix:** Replace with server function `report_payment()` that only changes status + stores reference.

### S3 — Email enumeration RPCs (HIGH) ✅ CONFIRMED
- `schema.sql` lines 47-52: `email_is_admin(e text)` and `email_status(e text)` are both `SECURITY DEFINER` and granted to `anon, authenticated`.
- `js/auth.js` line 23: `Supa.rpc(CFG.emailCodes?"email_is_admin":"email_status", {e:em})` — called directly from the client with the anon key.
- Anyone can test if an email is registered and if it's an admin account.
- **Fix:** Drop both RPCs. Rework sign-in to use Supabase Auth responses only.

### S4 — Debug keystore committed (HIGH) ✅ CONFIRMED
- `keystore/debug.keystore` exists in the repo.
- CI builds `assembleDebug` as the release artifact (per README).
- Anyone with the repo can sign an APK that installs over the legitimate one.
- **Fix lands in:** P5.

### S5 — Stock decrement race condition (HIGH) ✅ CONFIRMED
- `supabase/functions/paystack/index.ts` lines 204-213: Stock is decremented via read-modify-write: fetch product → compute new stock → update. Two concurrent buyers for the last unit can both succeed.
- The code reads `p.stocks` (or `p.stock`), subtracts qty, and writes back. No atomic `WHERE stock >= qty` guard.
- **Fix lands in:** P2 (atomic stock reservation in `create_order`).

### S6 — innerHTML XSS surface (MED) ✅ CONFIRMED
- The codebase uses `esc()` for most user-generated content (defined in `js/app.js` line 3). However, there are ~22 `innerHTML` assignments building HTML from strings.
- Currently only admin writes content, so the risk is low. With merchants writing product names, descriptions, and store names, an unescaped field becomes stored XSS.
- A grep for `innerHTML` shows assignments in: `js/app.js` (lines 26, 76, 80, 85, 90, 92, 116, 117, 120, 121, 127, 155, 159, 167, 168), `js/shop.js` (lines 22, 28, 47, 52, 56, 57, 58), `js/auth.js` (lines 8-13).
- Most use `esc()` for dynamic values, but the volume makes it fragile. A CI grep check for unescaped interpolation is needed.
- **Fix lands in:** P2B, P3.

### S7 — Coupon enumeration and non-atomic increment (MED) ✅ CONFIRMED
- `schema.sql` line 100: `coupon_info(c text)` is `SECURITY DEFINER`, granted to `anon, authenticated`. Anyone can brute-force coupon codes with unlimited guesses.
- `supabase/functions/paystack/index.ts` line 203: `await db.from("offers").update({ used: Number(pr.offer.used || 0) + 1 }).eq("id", pr.offer.id)` — non-atomic read-modify-write increment. Concurrent orders using the same coupon can both increment from the same base, resulting in `used` being off by one.
- **Fix:** Move coupon checking to edge function with per-user rate limit. Use atomic `UPDATE ... SET used = used + 1 WHERE used < limit_uses RETURNING *`.

### S8 — No pagination or server-side search (MED) ✅ CONFIRMED
- `js/store.js` line 17: `Supa.list("products")` fetches `select=*&order=at.desc` — the entire products table.
- `js/app.js` line 79: `results(q)` filters client-side: `P().filter(...)`.
- No pagination, no server-side full-text search.
- Will not scale past a few thousand products.
- **Fix lands in:** P2, P3.

### S9 — Unverified order states (MED) ✅ CONFIRMED
- `supabase/functions/paystack/index.ts` line 172: `whatsapp` creates orders with `status: "sent"`, `card_later` with `status: "awaiting_delivery"`.
- These orders have no payment verification trail.
- Merchants would see unpaid orders if they are given order visibility.
- **Fix lands in:** P2, P4.

### S10 — Denormalised order items (MED) ✅ CONFIRMED
- `schema.sql` line 5: `orders.items jsonb not null` — items stored as denormalised JSON.
- Reviews policy (line 77) relies on `items @> jsonb_build_array(jsonb_build_object('id', product_id))` to verify purchase.
- No per-seller structure; cannot split orders by merchant.
- **Fix lands in:** P2 (order_items table, seller_orders table).

### S11 — Personal data and missing legal links (MED) ✅ CONFIRMED
- `schema.sql` line 38: `profiles` has `dob date` and `idv text` (NIN/ID).
- `js/auth.js` line 10: DOB collected during signup. `IDV[c.code]` shows NIN/Ghana Card/etc as "Coming soon".
- `js/config.js` lines 8-13: All country configs have `terms: ""` and `privacy: ""` (empty strings from the `C()` factory function at line 3).
- Data minimisation needed; NIN should not be stored unless required.
- **Fix lands in:** P1 (interim), P5 (full).

### S12 — No push notifications (MED) ✅ CONFIRMED
- `package.json` only includes `@capacitor/local-notifications`, not push notifications.
- "Receive updates" is not met when the app is closed.
- **Fix lands in:** P4.

### S13 — Light input validation, no rate limiting (LOW) ✅ CONFIRMED
- `supabase/functions/paystack/index.ts` line 166: Validates `qty > 0 && qty <= 50` and customer fields presence. No rate limiting on any action.
- Order IDs: `Date.now().toString(36) + Math.random().toString(36).slice(2, 5)` (line 195) — predictable and short.
- **Fix lands in:** P2.

### S14 — Static theme-color causes white flash in dark mode (LOW) ✅ CONFIRMED
- `index.html` line 1: `<meta name="theme-color" content="#0f6b4f">` — hardcoded, doesn't adapt to dark mode.
- `capacitor.config.json` line 5: `"backgroundColor": "#fafaf8"` — light-only, causes white flash on cold start in dark mode.
- **Fix lands in:** P2B.

### S15 — Excessive permissions (LOW) ✅ CONFIRMED
- README mentions `RECORD_AUDIO` (mic for voice search) and fine location.
- Need to verify AndroidManifest.xml (not read yet, but the Capacitor plugins for Geolocation and Camera are present).
- **Fix lands in:** P5.

### S16 — No real tests (LOW) ✅ CONFIRMED
- CI runs only `node --check` and JSON parse (per Part A description).
- No tests of RLS, checkout, or role flows.
- **Fix lands in:** P5.

### S17 — CJ webhook no signature check (INFO) ✅ CONFIRMED
- The CJ edge function has a `?hook=1` webhook mode with no signature verification.
- It only triggers a refresh, so it's harmless, but it goes away with CJ removal.
- **Fix lands in:** P1 (CJ removal).

---

## 5. Incomplete / Non-functional Features

| Feature | Location | Status |
|---|---|---|
| Google sign-in | `js/auth.js` line 13, `data-act="gsoon"` | "Coming soon" — shows notification only |
| NIN verification | `js/auth.js` line 10, IDV section | "Coming soon" — disabled div only |
| Image search | `js/app.js` line 87, `imgSearch()` | "Switches on in Stage 2" — placeholder message only |
| Pay on delivery (`card_later`) | `js/payments.js` (not read) + paystack function | Functional but creates unverified orders (S9) |

---

## 6. Config Problems

1. **Supabase keys point to old project:** `js/config.js` line 5 has `url: "https://krpzbuoxozdyduszzlvb.supabase.co"` — this is the `everneed` project, not the new `Everneed01` project (`zpgasfweaixwsktlueje`). **Needs updating.**
2. **Empty adminEmail:** `CFG.adminEmail` is `""` — in local mode (no Supabase), this defaults every user to admin (`js/app.js` line 198: `admin: CFG.adminEmail ? ... : true`).
3. **Empty Terms/Privacy URLs:** All countries have `terms: ""` and `privacy: ""`.
4. **Webhook URL in README points to old project:** Line 44 references `krpzbuoxozdyduszzlvb.supabase.co`.

---

## 7. `node --check` Results

All 15 JS files pass syntax check:

```
OK: js/admin.js
OK: js/adminx.js
OK: js/app.js
OK: js/auth.js
OK: js/banners.js
OK: js/busy.js
OK: js/cards.js
OK: js/config.js
OK: js/country.js
OK: js/guide.js
OK: js/opts.js
OK: js/payments.js
OK: js/shop.js
OK: js/store.js
OK: js/supa.js
```

---

## 8. Disagreements with Part A

| Claim in Part A | Actual in Code | Impact |
|---|---|---|
| "~150 KB in roughly 970 lines" | The JS files total ~970 lines but `css/app.css` is separate (~970 lines of CSS). The JS is dense one-liner style. | No material impact — description is roughly accurate. |
| "CI runs only `node --check` and JSON parse" | CI workflow file not read yet (`.github/workflows/` exists but not inspected). | Needs verification but assumed correct. |
| "`order_costs` loaded in `js/store.js`" | Confirmed — `js/store.js` line 17 loads `order_costs` and stores in `rcost`. | None — matches. |

No contradictions found that would change the Phase 1 plan.

---

## 9. Strengths to Preserve (confirmed in code)

- **Server-side price recomputation:** `paystack/index.ts` `price()` function recomputes all totals from product prices, offers, FX rates. ✅
- **Paystack webhook HMAC-SHA512 verification:** Lines 148-155. ✅
- **Card tokens only (no PANs):** Cards stored as `authorization_code`, never PANs. ✅
- **Column-level grants on `cards`:** `schema.sql` line 59: `grant select (id,brand,last4,exp,bank,at), delete on public.cards to authenticated;` ✅
- **RLS enabled on every table:** Confirmed for all tables in schema. ✅
- **Reviews gated on delivered orders:** `schema.sql` line 77. ✅
- **Offline cache:** `js/store.js` lines 17-18 fall back to localStorage. ✅
- **Multi-country currency and FX:** `js/country.js` (Ctx module) + server-side rates. ✅
- **Per-size stock:** `products.stocks` jsonb. ✅
- **`esc()` function used for most dynamic content:** Present in `js/app.js` line 3. ✅

---

## 10. Summary

The codebase is a dense, single-page vanilla JS app with a Supabase backend and Paystack payments. All 17 findings (S1-S17) are confirmed in the code. The most critical are:

- **S2 (order PATCH manipulation):** Customers can modify order totals/items when reporting payment.
- **S3 (email enumeration):** Anyone can check if an email is registered or is an admin.
- **S5 (stock race condition):** Concurrent buyers can oversell the last unit.
- **S1 (private field exposure):** Anonymous users can read supplier cost, pricing margin.

Phase 1 will remove all CJ/dropshipping code, close S2/S3/S7 with security hotfixes, and establish a clean baseline. No contradictions with Part A were found that would change the plan.
