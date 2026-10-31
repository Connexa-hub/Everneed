# Design system

Built from `docs/DESIGN_PLAN.md`. Decisions taken: keep Bricolage Grotesque and Figtree; Emerald is the default palette everywhere; the Dribbble reference is mood only; `gallery.html` is dev only and is not copied into the APK (the build copies only the files listed in `.github/workflows/build.yml`).

## Files
| File | What it is |
|---|---|
| `css/tokens.css` | **Generated.** 6 palettes x 3 modes, every value an explicit hex or rgba. Do not edit by hand. |
| `css/fonts.css` | Bundled woff2 fonts (`fonts/`), latin and latin-ext so the naira and cedi signs render in the brand faces. |
| `css/app.css` | Layout and component rules. Tokens only: no hex or rgb colours. |
| `css/components.css` | Typography roles, glass bars, raised surfaces, store identity, skeletons, Appearance controls. |
| `js/theme.js` | Mode, AMOLED and palette. Saves on the device, mirrors to `profiles.settings` when signed in, updates the browser colour and the Android status bar. |
| `tools/build-tokens.mjs` | Generates `tokens.css` from the six brand colours. |
| `tools/check-contrast.mjs` | Reads the shipped `tokens.css` and checks all 18 themes (666 checks). |
| `gallery.html` | Every component in all 18 themes, for review. Open it in a browser from the repo root. |

## Using themes
`<html data-mode="light|dark|amoled" data-palette="emerald|indigo|rose|violet|ocean|gold">`. A script in `index.html` sets both before first paint, so there is no flash. Mode "System" follows the phone and updates live. AMOLED is only available while the app is dark.
Any element can carry the two attributes to preview a theme locally (the gallery does this).

## Tokens
Surfaces `--bg`, `--surface-1..3`, `--border`, `--border-strong`. Text `--text-1..3`. Brand `--brand` (fills, rings), `--brand-ink` (brand-coloured text and links, adjusted to read at 4.5:1), `--brand-hover`, `--brand-soft`, `--text-on-brand`. Status `--success`, `--warning`, `--danger`, `--info` with `-soft` fills, plus `--accent`, `--star`. Effects `--shadow-1`, `--shadow-2`, `--glow`, `--glass`, `--scrim`, `--on-image`.
Static: radius `--r-chip 10`, `--r-input 14`, `--r-card 20`, `--r-sheet 28`; spacing `--sp-1..6` (4 to 32); motion `--t-fast 120ms`, `--t-base 220ms`, `--t-slow 360ms`; fonts `--font-display`, `--font-body`.

## Rules the checks enforce
- Body and secondary text 4.5:1 or better on all four surfaces (dark `text-2` on the page background 7:1); `text-3` 4.5:1 on the three main surfaces.
- Brand fills 3:1 against the page; `--brand-ink` 4.5:1 on page, cards and `brand-soft`; text on brand buttons 4.5:1.
- Status text 4.5:1 on page and cards, and on their own soft fills.
- Borders 1.3:1 against the page and card surfaces.
- No raw colours in `app.css` or `components.css`; every font file referenced exists; `tokens.css` matches the generator (CI runs `node tools/build-tokens.mjs && git diff --exit-code css/tokens.css`).

## Change or add a palette
Edit `PALETTES` in `tools/build-tokens.mjs`, run `npm run tokens`, commit `css/tokens.css`. If a rule fails, the generator can usually be tuned (it already nudges borders and status colours to pass); the checker tells you which theme and pair failed.

## Store accent (for Phase 3)
A store picks one of the six palette names. Its header, ring and badges use that palette's `brand` for the active mode, which is already contrast-checked against every surface, so a store can never produce unreadable text.

## Known limits
- The Android navigation bar colour is not set: that needs a third-party Capacitor plugin. The status bar follows the theme through `@capacitor/status-bar`.
- Home cards do not show the seller row yet; it needs store data from Phase 3 (`.seller-row`, `.store-ring` and `.verified` styles are ready).
- Screen-by-screen redesign (bento home, floating tab pill, order rail) is Phase 3; this phase delivers the tokens, themes, fonts, component layer and the Appearance screen.
