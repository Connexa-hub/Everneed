# Everneed web (sellers and admins)

Static site, no build tools. `netlify.toml` (repo root) copies the app's `css/tokens.css`, `css/fonts.css`, `fonts/` and `js/theme.js` plus `shared/*.js` into `web/assets/` at build time, then publishes `web/`.
So the website uses the app's palettes, light/dark/AMOLED modes and theme engine with no copies stored in git.

- Marketing: `#/` `#/sell` `#/pricing` `#/help` `#/about` `#/early-access` `#/appearance`
- Seller portal: `#/portal` (dashboard, store setup, products, appearance)
- Admin console: `#/admin` (applications, product review, stores, waitlist, appearance)
- Shoppers are sent to the app.

Waitlist needs `shared/sql/011_website_sync.sql` applied once. Until then early-access signups are kept in the visitor's browser only.
