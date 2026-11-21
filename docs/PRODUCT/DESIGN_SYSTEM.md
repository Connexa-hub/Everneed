# Everneed design system (seller workspace and admin console)

**Files:** `web/assets/css/ds.css` (tokens and components, about 5.7 KB gzipped), `web/assets/js/ds.js` (runtime, about 14 KB gzipped), `tools/check-ds-contrast.mjs`.
**Rules it follows:** dependency free, vanilla JS, no framework, no build step. Added JS and CSS stay far under the 60 KB gzipped budget. Staging only; the database is not touched.
**Tracker row:** WEB-X01. Backend needs are in `docs/WORKFLOW/SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md` (R1 to R9).

## 1. Principles

1. **Calm, fast, tactile.** Few colours, generous spacing, one soft-square shape language. Press feedback on everything tappable.
2. **Real data or a true empty state.** No mock numbers, charts or success states. A module whose backend is missing says "not available yet".
3. **Phone first.** Designed at 360 to 412 px (Nigerian Android), then tablet and desktop. Touch targets are at least 44 px. No sideways page scroll.
4. **Cheap to render.** Motion uses transform and opacity only. One SVG sprite for icons. Art is inline SVG, no image downloads. Works on low-end devices.
5. **Respect the user.** `prefers-reduced-motion` switches motion off. Everything works with a keyboard and a screen reader.

## 2. Tokens

The colour roles come from the generated `css/tokens.css` (6 palettes: emerald, gold, indigo, ocean, rose, violet; each in light, dark and AMOLED, so 18 themes). `ds.css` never hard-codes a colour; it only uses these roles, so every theme is covered.

| Role | Tokens |
|---|---|
| Surfaces | `--bg`, `--surface-1`, `--surface-2`, `--surface-3` |
| Lines | `--border`, `--border-strong` |
| Text | `--text-1` (primary), `--text-2` (secondary), `--text-3` (placeholder, faint) |
| Brand | `--brand` (fills, rings), `--brand-ink` (brand-coloured text and icons), `--brand-soft` (tinted backgrounds), `--text-on-brand` |
| Status | `--success`, `--warning`, `--danger`, `--info` and `--success-soft`, `--warning-soft`, `--danger-soft` |
| Accent | `--accent` (small warm highlights in art only) |
| Depth | `--shadow-1`, `--shadow-2`, `--scrim` |

Added by `ds.css`:

| Scale | Tokens |
|---|---|
| Type (rem) | `--ds-t-xs` .75, `-s` .8125, `-m` .9375, `-l` 1.0625, `-xl` 1.375, `-2xl` 1.75, `-3xl` 2.25. Display font `--font-display` for titles and numbers, body font `--font-body`. |
| Space | `--ds-s1..s8` = 4, 8, 12, 16, 20, 24, 32, 40 px |
| Radius (soft squares) | `--ds-r1` 8, `r2` 12, `r3` 16, `r4` 22 (cards), `r5` 28 (sheets, hero). Circles only for avatars and status rings. |
| Elevation | Cards `--shadow-1`, hover and sheets `--shadow-2`. On AMOLED the border carries the edge, because shadows vanish on black. |
| Motion | `--ds-d1` 120 ms (press), `--ds-d2` 200 ms (fade), `--ds-d3` 320 ms (sheet, reveal); `--ds-out` ease-out, `--ds-spring` slight overshoot. |
| Touch | `--ds-hit` 44 px |

### Contrast
`node tools/check-contrast.mjs` (generic roles, 666 checks) and `node tools/check-ds-contrast.mjs` (the pairs the design system adds, 414 checks) must both pass for all 18 themes. The danger button uses `--danger` on `--danger-soft`, not white on red, because white fails on the light red used in dark mode.

## 3. Components

Class names use the `ds-` prefix. HTML builders live on `window.DS` (also `Core.ds`).

| Component | Markup / API | Notes |
|---|---|---|
| Card | `.ds-card` (`.pad0`, `.flat`, `.soft`); link or `data-act` cards lift on hover and shrink on press | Cover and logo: `.ds-cover` + `.ds-body` + `.ds-logo` |
| List row | `DS.row({icon,title,sub,end,href\|act,tone})` | 44 px minimum, chevron when tappable |
| Stat tile | `DS.stat({icon,value,label,href,tone,money})` | Numbers count up. Money from 1,000,000 shows as `₦2.45M` (full value in `title`) so it never clips on 360 px |
| Segmented control | `DS.seg(items)` and automatic upgrade of `.tabs` and `.so-tabs` | Scroll-snap, edge fades, active tab scrolled into view, more than four tabs adds a switcher button that opens a bottom sheet |
| Chip | `DS.chip(label,tone,icon,n)`; tones `ok warn bad info brand` | Status is never colour alone: text plus icon |
| Plan badge | `DS.plan(name, isOfficial)` | free, starter, growth, pro, official |
| Status ring | `DS.ring(percent, tone, label)` | Static SVG ring, with an accessible label |
| Avatar | `DS.avatar(name, photo)`, `DS.avatars(list, max)` | Circle, initials fallback |
| Buttons | `.ds-btn` (`.o` outline, `.g` quiet, `.d` danger, `.s` small, `.w` full) | |
| Form fields | `.ds-field`; every native `<select>` becomes a sheet picker (the native select stays hidden in the form, so `FormData`, `required` and `change` keep working). Opt out with `data-ds-native`. | `select multiple` stays native |
| Picker | `DS.pick({title,options,value\|values,multi,tiles,search,recents})` returns the value (array when `multi`) or `null` | Search, recents, icon or art, description, groups, parent then child drill-down, multi-select chips with counts, animated tick |
| Category picker | Any select named `col` (or `data-ds-cat`) shows art tiles | Art comes from the category name via `DS.artFor`; real database ids can later use `collections.art_key` (request R3) |
| Sheet | `DS.sheet({title,html\|node,snap,start})` returns `{el,body,close,done}` | Drag handle, snap points (half and full) on phones, centred dialog from 720 px, focus trap, Escape, scroll lock, page behind is `inert`, focus returns to the opener |
| Confirm | `DS.confirm({title,text,ok,cancel,danger,input})` resolves `true`, the reason text, or `null` | `Core.ask` now uses it |
| Action sheet | `DS.actions({title,items:[{label,icon,tone,run}]})` | Long-press a card marked `data-lp` that contains `.ds-acts [data-act]` buttons |
| Toast | `DS.toast(msg,{kind,undo,undoLabel,duration})` | Stacked (max 3), swipe to dismiss, timer bar, Undo only where the caller passes `undo`, moves to the top while a sheet is open. `Core.toast` now uses it |
| Banner | `DS.banner(kind,title,text,{label,href\|act})` | info, success, warning, error |
| Empty state | `DS.empty({icon,title,text,action})`; duotone icon tile | `Core.empty` now draws it |
| Gate | `DS.gate({icon,title,text,action})` | Shown only when a backend entitlement flag is false |
| Skeleton | `DS.skel(kind,n)` (`card`, `line`, `circ`) | Shimmer is a transform animation |
| Progress, success | `DS.progress(0..1)`, `DS.success()` | Progress is `scaleX`; success is a scale and fade |

## 4. Icons and art
- **Icons:** one line set, 24 grid, 1.8 stroke, round caps, as an inline SVG sprite (`<use href="#dsi-name">`). `DS.icon(name,size)`. It extends `shared/icons.js`. Duotone for large empty states is `DS.duo(name)`. No emoji is used as UI. (The old emoji in `collections.icon` is not displayed.)
- **Category art:** 25 original, transparent, theme-coloured SVG drawings at a 64 grid (`DS.ART`, `DS.art(key,size)`): apparel, shoes, bags, phones, computers, audio, home, kitchen, beauty, hair, health, grocery, food, baby, toys, sports, auto, tools, books, office, pets, jewellery, art, garden, other. All 22 current categories map to one (checked by test). No photos, no hot-linked images.

## 5. Motion
- Allowed: `transform` and `opacity`. Shimmer, sheets, toasts, press, reveal and the shared-element transition all use only these.
- Staggered reveal: children of `.ds-grid`, `.ds-rows`, `.ds-stats` fade up with a 40 ms step (max 10).
- Count-up on `[data-count]` numbers (text update, 400 to 900 ms).
- Shared-element transitions: in the app shell, links to `/admin`, `/portal`, `/inbox` and `/me` use `document.startViewTransition` when available; an element with `data-vt` morphs into the target's `data-vt-t`. Without the API, navigation is the plain router call.
- `prefers-reduced-motion: reduce`: reveal, shimmer, press scale, sheet and toast travel, count-up and view transitions are all disabled.

## 6. Layout
- App shell: bottom tab bar on phones, left rail on desktop (`appshell.css`). `ds-hastabs` on `<html>` lifts toasts above the tab bar.
- Cards flow in `.ds-grid` (1 column on phones, `.c2` 2 columns from 640 px, `.c3` 3 columns from 1000 px).
- Admin and seller screens open as pages; confirmation, pickers and switchers open as bottom sheets on phones and centred dialogs on larger screens.

## 7. Accessibility
Focus ring on every control (`:focus-visible`), 44 px targets, `role="dialog"` with `aria-modal` and a labelled title, `role="listbox"` with `aria-selected` for pickers, `role="status"` or `role="alert"` for toasts and banners, rings have text labels, and nothing relies on colour alone.

## 8. What is not covered yet
See the final report in `docs/WORKFLOW/`. Anything that needs backend data that does not exist is listed in the handoff (R1 to R9) and shows a "not available yet" state.
