# Design plan (Phase 2B)

**Status: approved with the recommended answers (fonts kept, Emerald default, Dribbble as mood only, gallery excluded from the APK).** Final colour values are generated into `css/tokens.css`; where the table below differs (for example light borders, which the contrast check darkened to reach 1.3:1), the generated file wins. See `docs/DESIGN_SYSTEM.md`.

Nothing has been built from this yet. It follows the Phase 2B brief. Section 7 records the review pass and what I changed.

## 1. Subject and audience
- **Who:** Nigerian mobile shoppers (also Ghana, Kenya, South Africa, UK, US shoppers later) and small sellers who run a shop from their phone.
- **Devices:** low-to-mid Android phones, 360 to 412px wide, older WebViews, often on mobile data and in bright sun. So: light assets, bundled fonts, no blur-heavy layers, strong contrast, 44px touch targets.
- **Job of the app:** let a shopper trust a stranger's shop in two seconds, and let a seller manage orders with one thumb.
- **The one memorable thing:** the marketplace is **store-forward**. Every product shows who sells it. Every store has a colourful identity (accent ring, cover, verified mark). Everything else stays quiet.

## 2. Core palette (named, hex)
Six brand palettes; the user picks one. Emerald is the default and the current brand.

| Name | Light brand | Dark brand | Character |
|---|---|---|---|
| Emerald | `#0F6B4F` | `#3FD39A` | heritage, trustworthy |
| Indigo | `#4F46E5` | `#8E8CFF` | modern, techy |
| Rose | `#E11D48` | `#FF6B88` | warm, fashion-forward |
| Violet | `#7C3AED` | `#B18CFF` | creative, beauty |
| Ocean | `#0E7490` | `#34D3EE` | calm, clean |
| Gold | `#A16207` | `#F2C14E` | premium, luxe |

Worked example, **Emerald** (the other five are generated from their brand hue with the same rules, then committed as explicit hex):

| Token | Light | Dark | AMOLED |
|---|---|---|---|
| `--bg` | `#F2F6F4` | `#0A1210` | `#000000` |
| `--surface-1` | `#FFFFFF` | `#101B17` | `#070D0B` |
| `--surface-2` | `#F7FAF8` | `#16241F` | `#0D1612` |
| `--surface-3` | `#E9F0EC` | `#1D2E28` | `#14201B` |
| `--border` | `#DCE5E0` | `rgba(255,255,255,.10)` | `rgba(255,255,255,.10)` |
| `--text-1` | `#0E1A16` | `#EAF3EF` | `#EAF3EF` |
| `--text-2` | `#41524B` | `#B4C7BF` | `#B4C7BF` |
| `--text-3` | `#5F7169` | `#8FA79D` | `#8FA79D` |
| `--brand` | `#0F6B4F` | `#3FD39A` | `#3FD39A` |
| `--text-on-brand` | `#FFFFFF` | `#04140E` | `#04140E` |
| `--accent` (sale, stars) | `#B45309` | `#F5A524` | `#F5A524` |
| `--success / --warning / --danger / --info` | `#15803D / #B45309 / #B91C1C / #1D4ED8` | `#4ADE80 / #FBBF24 / #FF7A7A / #7CB0FF` | same as dark |

Rules that fix today's flat dark mode: every dark surface carries a hint of the palette hue; four surfaces step up about 6 lightness points each; raised surfaces get a 1px top highlight and a visible border; the primary button uses a soft brand glow, not a drop shadow; large brand areas are desaturated in dark, saturated brand stays on small things (buttons, rings, badges).
All 6 palettes by 3 modes (18 sets) are checked by `tools/check-contrast.mjs` in CI: body text 4.5:1, large text and UI 3:1, borders 1.3:1 against the neighbouring surface.

## 3. Type roles
Bundled as local woff2, no network font requests (I will take them from the `@fontsource` npm packages and check coverage before using them).
| Role | Face | Use |
|---|---|---|
| Display | Bricolage Grotesque 600/700 | headlines, prices, store names, order totals |
| Body and UI | Figtree 400/500/600 | everything else |
| Currency fallback | system sans | only if the subset misses ₦, GH₵, KSh or R (a build script checks every glyph) |
Scale (px): 12, 14, 16, 18, 22, 28, 36. Prices and totals use tabular numerals. Descriptions stay under 75 characters a line. Fallback stack `system-ui, sans-serif`.

## 4. Shape, space, motion
- **Radius by hierarchy:** chip 10, input 14, card 20, sheet 28, avatar full. (Today the CSS uses 14, 16, 18, 20, 99 and 999 with no system.)
- **Space:** 4-point scale, 4 to 32.
- **Elevation:** light mode uses soft shadows; dark mode uses surface steps, borders and glow.
- **Motion** only where it answers an action: add to cart, sheet open, tab change, status change. 120, 220, 360 ms. `prefers-reduced-motion` turns it off.
- **Glass blur** on the header and tab bar only, 12px, with a solid fallback colour for WebViews without `backdrop-filter`.
- **Icons:** one inline SVG set, 24px grid, 1.75px stroke. No emoji as icons.

## 5. Layout concept and wireframes (320 to 412px wide)

**Home**
```
+----------------------------------+
| Good morning, Ada      [bell][cart]|
| Lagos v   [ search products, shops ]  <- pinned, glass
+----------------------------------+
| (o)(o)(o)(o)(o)>   store avatars, ring = new this week
| +------------------------------+ |
| |  hero: one promotion       . | |  pill dots
| +------------------------------+ |
| [Fashion|Beauty|Home|Tech|...]     <- sticky chips
| +-------------+ +------+ +------+ |
| |  Fashion    | | Tech | | Home | |  bento: 1 tall, 2 small,
| |  128 items  | | 64   | | 41   | |  1 wide, counts are real
| |             | +------+ +------+ |
| +-------------+ +--------------+ |
| Fresh from sellers                |
| +--------+ +--------+            |
| | image  | | image  |            |  two columns, uneven heights
| | tall   | |        |            |
| | N12,500| | N4,000 |            |
| | (o)Shop| | (o)Shop|  <- seller row on every card
| +--------+ +--------+            |
|  [Home] [Shops] [Cart] [Orders] [Me] |  floating pill, moving indicator
+----------------------------------+
```
**Product**
```
+----------------------------------+
| <-                       share  heart |
| full-bleed gallery  o o o         |  snap scroll, dots
|  +-----------------------------+ |
|  | overlapping detail panel     | |
|  | Linen tote bag               | |
|  | N12,500   old N15,000        | |
|  | *4.6 (38)   Only 3 left      | |
|  | Size / colour chips          | |
|  | (o) Sold by Urban Finds >    | |  store card
|  | Delivery: hub or direct note | |
|  | More from this store  [][][] | |
|  +-----------------------------+ |
| [ - 1 + ]   [   Add to cart    ] |  sticky bar
+----------------------------------+
```
**Store**
```
+----------------------------------+
| cover image                       |
|   (O) Urban Finds  [verified]     |  avatar ring in store accent
|   Ikeja, Lagos                    |
|  4.7 rating | 56 products | 2024  |
|  [Products] [About] [Reviews]     |
|  [filter v] [sort v]       <- sticky
|  two-column product grid          |
|  [share] [report]                 |
+----------------------------------+
```
**Cart**
```
+----------------------------------+
| Cart (3)                          |
| +-- Urban Finds ---------------+ |
| | item  qty -/+        N12,500  | |
| | Subtotal N12,500              | |
| +------------------------------+ |
| +-- TechNest ------------------+ |
| | item  qty -/+         N3,000  | |
| | Subtotal N3,000               | |
| +------------------------------+ |
| (i) 2 sellers: delivered together |
|     from the EverNeed hub         |
| Delivery N1,500   Total N17,000   |
| [      Continue to payment      ] |
+----------------------------------+
```
**Merchant dashboard**
```
+----------------------------------+
| Urban Finds           [rental ok] |
| +----------+ +-----------------+ |
| | Orders   | | Available       | |
| | today 4  | | N48,200         | |
| +----------+ +-----------------+ |
| +----------+ +-----------------+ |
| | Pending  | | Low stock  3    | |
| | N21,000  | |                 | |
| +----------+ +-----------------+ |
| Needs your attention              |
|  [Accept order 3f2a]  21h left    |
|  [Bring 2 parcels to hub] Fri     |
|  [Pay rental]          in 3 days  |
| Sales, last 14 days  ~~~/\~/\~    |  inline SVG sparkline
+----------------------------------+
```
**Admin hub board** (cards on a phone, a four-column board at 1280px)
```
 To receive      | At hub / checking | Ready to ship | Out for delivery
 +-----------+   | +-----------+     | +-----------+ | +-----------+
 | Order 3f2a|   | | Order 91c0|     | | Order 77ab| | | Order 12de|
 | Urban     |   | | 2 sellers |     | | parcel    | | | Bolt, Van3|
 | due Fri   |   | | [check]   |     | | EN-77AB   | | | [enter    |
 | [receive] |   | +-----------+     | | [dispatch]| | |  code]    |
 +-----------+   |                   | +-----------+ | +-----------+
```
Other patterns kept from the brief: cart grouped by store, order tracking with a vertical rail and the delivery code in a prominent card, floating pill tab bar with badges, skeletons for every loading state, `content-visibility: auto` on long feeds. Quality floor: usable from 320px, 44px targets, visible focus, text scaling to 200%.

## 6. Principles
1. Store identity is the one loud thing; the rest is quiet and disciplined.
2. Semantic tokens only. Components never use raw colours (the star and icon colours currently hard-coded in `app.js` move to tokens).
3. Dark mode is designed, not inverted: stepped, tinted surfaces and real borders.
4. Theme (mode and palette) is the user's choice and stays theirs. A store accent colours only that store's header, ring and badges, and must pass contrast in the active mode.
5. Plain, active copy: "Add to cart", "Submit for review". Errors say what to do. Empty states invite an action.
6. Weight matters: no blur outside two bars, no web fonts over the network, no decorative animation.

## 7. Review against the brief, and what I changed
I read the first draft against 2B.2 and removed anything that looked like a generic template default.

| # | Problem in the first draft | Change and why |
|---|---|---|
| 1 | Accent for sale badges and stars was the same terracotta orange in every palette, a template default and weak on the Gold palette. | Accent is now amber for ratings and a separate deeper amber for sale labels in light mode, so it never competes with Gold or Rose, and stays distinct from `--warning`. |
| 2 | Home used a hero, a bento grid and a feed, each with different card styles. | One card system with three sizes and the same seller row. Only the bento tiles get a tinted fill; everything else sits on `surface-1`. |
| 3 | Section headings had small tracked-out capital labels above them. | Removed. Headings are sentence case in display type only. |
| 4 | Product meta was a dot-separated string (rating, stock, delivery). | Split into a rating row, a stock chip and a delivery note with its own icon, so each can be read alone. |
| 5 | The merchant dashboard numbered its attention queue. | Numbers removed. It is not a sequence; items are sorted by deadline and show time left instead. |
| 6 | I proposed CSS columns for uneven feed heights, which reorder items when the feed grows. | Two explicit columns, filled by estimated height, so items never jump. |
| 7 | Glass blur on sheets as well as bars would cost low-end phones. | Blur limited to header and tab bar, 12px, with a solid fallback. |
| 8 | AMOLED was only a toggle, but the brief makes it a mode value. | The attribute stays `light, dark, amoled, system`. The settings screen shows Light, Dark and System plus an AMOLED switch that is enabled only in dark. |
| 9 | Store avatars with rings needed data I had not named. | Ring means "has a product published in the last 7 days", computed from `products.at`; no new column. |
| 10 | Every palette would have shipped with the same warm neutral background. | Light backgrounds and dark surfaces are tinted from each palette's hue, so Indigo looks cool and Rose looks warm without changing layout. |

## 8. Decisions I need from you before building
1. Keep **Bricolage Grotesque and Figtree**, or choose other fonts?
2. Default palette **Emerald** for everyone, or let each country pick a different default?
3. Is the **Dribbble reference** only a mood? If you paste links or screenshots I will take hierarchy and spacing from them and copy no artwork.
4. Do you want the **gallery page** (`gallery.html`, dev only) included in the release APK, or excluded?
