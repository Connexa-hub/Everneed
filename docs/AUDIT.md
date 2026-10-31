# Everneed01 audit (Phase 1.1)

Baseline of the code as received. No code was changed to produce this report.
Line numbers refer to the files as received; JS files are dense, so a few references are file plus feature.

## 1. Result of `node --check`

All 15 files in `js/` pass: admin, adminx, app, auth, banners, busy, cards, config, country, guide, opts, payments, shop, store, supa.
`tools/check.mjs` (added for CI) also passes: JSON files valid, every script tag in `index.html` resolves, both edge functions present.

## 2. File inventory

| Area | Files | Size |
|---|---|---|
| UI shell | `index.html`, `css/app.css` | 1.2 KB, 23 KB |
| Client JS | 15 files in `js/`, 1,421 lines of dense code in total | about 177 KB |
| Backend | `supabase/schema.sql` (114 lines), `functions/paystack` (279 lines), `functions/cj` (240 lines) | |
| Seed data | `data/products.json`, `data/banners.json` | |
| Build | `.github/workflows/build.yml`, `capacitor.config.json`, `package.json`, `keystore/debug.keystore` | |
| Assets | icons, splash, logo, favicon | |

There is no `android/` folder. CI generates it with Capacitor and patches the manifest with `sed`.

## 3. Module map (`window.X`)

Scripts load in this order: busy, config, store, supa, country, banners, payments, app, auth, admin, cards, opts, shop, guide, adminx.

| Global | File | Owns |
|---|---|---|
| `Busy` | busy.js | loading overlay |
| `CFG` | config.js | per-country config (currency, auth options, bank, legal URLs), Supabase URL and anon key, ads, collections |
| `S` | store.js | data layer: localStorage cache (`en_` prefix), loading from Supabase, CRUD for products, banners, orders, size charts, settings |
| `Supa` | supa.js | REST/auth client, session refresh, rpc, list/insert/patch/upsert/del, image upload |
| `Ctx` | country.js | current country, currency, price formatting |
| `Banners` | banners.js | banner selection rules |
| `Pay` | payments.js | payment methods per country |
| `A` | app.js | router, home, catalogue, cart, checkout, orders list, settings (220 lines, 54 KB) |
| `Auth` | auth.js | sign-in, sign-up, phone OTP, age gate |
| `Adm` | admin.js | admin dashboard, order list |
| `AdmX` | adminx.js | admin extras: offers, pricing, reviews, CJ import, CJ sending, supplier settings |
| `Cards` | cards.js | saved cards |
| `Opts` | opts.js | colour and size options |
| `Shop` | shop.js | product page, reviews, order tracking (including CJ tracking) |
| `Guide` | guide.js | size guide |

## 4. Data flows

- **Load:** `S` renders from the localStorage cache, then fetches `products`, `banners`, `collections`, `settings`, `size_charts`, `auto_offers`, `product_ratings` (all `select=*`), and, when signed in, `orders`, `order_costs` (admin) and `cards`. The whole catalogue is downloaded and searched on the device.
- **Auth:** email and password through Supabase Auth. `auth.js:23` calls the anon RPC `email_status` (or `email_is_admin` when `CFG.emailCodes` is on) before sign-in. Phone OTP exists for some countries. Google and NIN buttons only show a "coming soon" message. A `profiles` row is created by the `on_signup` trigger; name, date of birth and country are patched in afterwards.
- **Cart:** held in the client. Lines carry product id, size, colour, quantity.
- **Checkout:** the client calls the `paystack` function with `action: "create"`. The server recomputes the price (product prices, offers, delivery fee, FX rate), checks stock, writes the order with the service role and decrements stock. There is no client insert policy on `orders`, so clients cannot create orders directly.
- **Payment:** card goes through `init` (hosted page) or `charge` (saved card), confirmed by the signed Paystack webhook (HMAC checked at `paystack/index.ts:146-152`) or by `verify`. `settle()` checks currency and amount before marking an order paid. Bank transfer and WhatsApp create `awaiting_transfer` and `sent` orders that the admin marks manually. Pay on delivery charges a saved card when the customer taps "received".
- **Tracking:** order status steps in `shop.js:55`. CJ tracking is fetched through the `cj` function when an order is opened.

## 5. Findings S1 to S17

| ID | Verdict | Evidence and notes |
|---|---|---|
| S1 | Confirmed | `products read` and `settings read` use `using (true)` (`schema.sql:21`, `:45`). Loads use `select=*`. `sup_cost`, `sup_ship`, `sup_pid` and `variants` are public columns. `settings` also exposes the `pricing` and `cj` rows. |
| S2 | Confirmed | `schema.sql:27` "orders report paid": `with check` only constrains `status`, so `total`, `items` and `cust` can change in the same PATCH. |
| S3 | Confirmed | `email_is_admin` (`:47-48`) and `email_status` (`:51-52`) are granted to `anon`. Caller is `auth.js:23`. |
| S4 | Confirmed | `keystore/debug.keystore` is committed. `build.yml:61` copies it and `:67` runs `assembleDebug`. |
| S5 | Confirmed | `paystack/index.ts:206-211` reads stock then writes `max(0, stock - qty)`. Two buyers can oversell. |
| S6 | Confirmed | 22 `innerHTML` sites: app 11, shop 6, adminx 3, cards 1, guide 1. `esc()` exists (`app.js:3`) and is used widely. Unescaped interpolations found at `app.js:121` and `:159` (`x.label`) come from fixed payment labels in `payments.js`, so no current exposure, but they are the pattern the CI grep check must flag. Session tokens are kept by the `S` helper in localStorage. I did not confirm the exact key name. |
| S7 | Confirmed | `coupon_info` is granted to `anon` (`schema.sql:100-101`), called from `app.js:201`. `used` is incremented as read-then-write (`paystack/index.ts:203`). |
| S8 | Confirmed | No pagination or server search; `select=*` on `products` (`supa.js:25`, `store.js:17`). |
| S9 | Confirmed | `sent` and `awaiting_transfer` orders are created with no verification trail. Merchants must only see `paid` orders. |
| S10 | Confirmed | `orders.items` is jsonb. The reviews insert policy matches with `items @> ...` (`schema.sql:77`). |
| S11 | Confirmed | `profiles.dob` and `profiles.idv` (`schema.sql:38`). `terms` and `privacy` are empty strings for every country in `config.js` (the `C()` helper). `adminEmail` is empty. |
| S12 | Confirmed | `@capacitor/local-notifications` only. No push plugin. |
| S13 | Confirmed | Order ids are `Date.now().toString(36)` plus 3 random characters (`paystack/index.ts:195`; the client helper `nid` in `store.js` does the same). Only light validation of `cust` (`:170`). No rate limiting. |
| S14 | Confirmed | `theme-color` is fixed `#0f6b4f` (`index.html`), Capacitor `backgroundColor` is `#fafaf8` (`capacitor.config.json:5`). |
| S15 | Extended | `build.yml:45` adds `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `CAMERA`, `POST_NOTIFICATIONS` and `RECORD_AUDIO`. Camera and notifications are used by the camera and local-notifications plugins, so only `RECORD_AUDIO` and fine location need a decision. |
| S16 | Confirmed, partly addressed | CI had only `node --check`. `tools/check.mjs` and a test job now run on every push. There are still no RLS, checkout or role tests. |
| S17 | Confirmed | `cj/index.ts:196` handles `?hook=1` with no signature check. Goes away with CJ removal. |

### New findings (not in Part A)

| ID | Severity | Finding |
|---|---|---|
| N1 | Med | Stock is reserved when the order is created, including unpaid card and bank-transfer orders. Nothing releases it if the customer walks away, so abandoned orders hold stock indefinitely. Needs an expiry in Phase 2. |
| N2 | Med | Admin `cancel` (`paystack/index.ts:236-244`) restocks and sets `cancelled` but never refunds a paid order, and the restock is the same racy read-then-write as S5. |
| N3 | Low | The `profiles` update policy only locks `role`. Users can rewrite their own `email`, `phone` and `country` fields (the profile email is used for lookups). |
| N4 | Low | The Definition of Done grep `grep -ri "cj\|supplier\|sup_"` cannot return empty as written: the Supabase anon key in `config.js` and four PNGs contain the letters "cj" by chance. Use word-boundary matching and exclude `assets/`; I will make the CI check do that. |
| N5 | Info | `config.js` still points at the old `everneed` Supabase project and its anon key. The new `Everneed01` project (`zpgasfweaixwsktlueje`) is empty, so URL, key and edge-function secrets must be switched together. AdMob ids are Google test ids. |

## 6. Incomplete or placeholder paths

- "Continue with Google" and "Continue with NIN" show "coming soon" (`auth.js:13`, `:45`). The NIN option also describes itself as "Trusted badge and faster checkout. Coming soon." (`auth.js:10`). Phase 1.3 removes the sign-in reliance on identity lookups; these two buttons should be removed or hidden until built, per the "no placeholder buttons" rule.
- Terms and Privacy links are empty.
- No password reset path was found in `auth.js` (not verified in the UI).

## 7. CJ footprint to remove in Phase 1.2

| File | References |
|---|---|
| `supabase/functions/cj/index.ts` | whole function |
| `js/adminx.js` | 20 (import sheet, pricing tool, send-to-CJ, supplier settings) |
| `js/shop.js` | 5 (status map, tracking) |
| `js/admin.js` | 3 (Import from CJ button, `AdmX.cjRows`) |
| `js/app.js` | 1 (`supplier` check at line 156) |
| `js/store.js` | `order_costs` load and `cj`/`pricing` settings branch (line 17) |
| `supabase/functions/paystack/index.ts` | CJ hand-off (`:114-124`), `supplier` restrictions (`:175`, `:180`) |
| `supabase/schema.sql` | supplier columns, `products_supplier_pid` index, `order_costs`, `kv` (`:84-91`, `:94`) |
| `README.md` | 12 (Suppliers, Order fulfilment, roadmap item 4, CJ options note) |

## 8. Conflicts with Part A

None. Every finding S1 to S17 is confirmed in code; S15 is slightly extended and S16 is partly addressed already. New findings N1 to N5 are additions, none contradict Part A.
