# Everneed

Everneed is a digital commerce platform whose first product is a multivendor marketplace for independent sellers and shoppers in Nigeria. Sellers operate their own storefronts and list their own products. Shoppers discover and purchase through the Everneed customer app; the website provides the public site, seller portal and admin console.

This repository contains the Android customer app, public website, seller/admin web portal, shared frontend modules, Supabase migrations and Edge Functions.

## Product surfaces

- **Android customer app:** product discovery, store/product details, cart, checkout, account and order experience.
- **Public website:** explains Everneed and directs prospective sellers and partners.
- **Seller portal:** seller onboarding, store profile and product management.
- **Admin console:** seller/store/product review and platform administration.
- **Shared backend:** Supabase Auth, PostgreSQL, RLS, Storage, RPCs and Edge Functions.
- **Payments:** Paystack integration path; live transaction and settlement readiness must be verified before public launch.

The website is not a duplicate customer shopping website. Customer catalogue browsing, cart and checkout are app-first. Do not describe planned or unverified operational features as live services.

## Branch and release workflow

| Branch | Purpose |
|---|---|
| `web-portal` | Development and integration for the app and website |
| `main` | Reviewed production release branch |

All changes are developed on `web-portal`, tested against the staging environment, and released through a reviewed pull request to `main`. Cloudflare Pages production deploys from `main`; previews from `web-portal` use staging.

Read these before making changes:
1. [AI protocol](docs/WORKFLOW/AI_PROTOCOL.md)
2. [Project tracker](docs/WORKFLOW/WEBSITE_TRACKER.md)
3. [Environment guide](docs/WORKFLOW/ENVIRONMENTS.md)
4. [Database contract](docs/WORKFLOW/DB_CONTRACT.md)
5. [Current repository/product audit](docs/WORKFLOW/REPOSITORY_AND_PRODUCT_AUDIT_2026-11-12.md)
6. [Design system](docs/DESIGN_SYSTEM.md)

## Supabase environments

| Environment | Project | Reference | Purpose |
|---|---|---|---|
| Production | Everneed01 | `zpgasfweaixwsktlueje` | Real users and live marketplace data |
| Development/staging | Everneed-staging | `vjiadqygpyebpisxslbx` | Development against a production-compatible schema, with separate test users/data |

Staging is a separate project, not the production database. It may carry unpromoted development migrations while they are being tested. Never reset or run development migrations against production. Production migrations require an owner-approved release plan.

The website selects staging on localhost and `*.everneed.pages.dev` preview hosts; production hosts select live. The Android app still has a separate environment-configuration task tracked as APP-08. Do not assume Android test builds already use staging until that task is completed.

## Website development

The website is a static vanilla-JavaScript application in `web/`. Shared modules and theme assets live in `shared/`, `css/` and `js/`; the Pages packaging workflow copies the required assets into the published web directory.

No framework or build-system change without owner approval. Keep theme colours token-driven and test all six palettes and Light, Dark and AMOLED modes. Target 360–412 px Android screens, older WebViews, low mobile data and 44 px touch targets.

## Authentication setup

Supabase Auth owns account creation, passwords, email confirmation, OAuth and sessions. The website currently has email/password signup, six-digit confirmation and sign-in screens. Email delivery and OAuth are not ready merely because the UI exists.

- [Founder setup guide: account creation, Resend SMTP and Google OAuth](docs/OWNER_GUIDES/ACCOUNT_SIGN_IN_EMAIL_AND_OAUTH.md)
- [Technical authentication setup checklist](docs/WORKFLOW/AUTH_PRODUCTION_SETUP.md)

Configure and test staging first. Production SMTP/OAuth settings are separate. Never commit SMTP passwords, OAuth client secrets, service-role keys, database passwords or signing keys.

## Database changes

- Add numbered SQL files under `supabase/migrations/`.
- Update `docs/WORKFLOW/DB_CONTRACT.md` and the project tracker in the same change.
- Push to `web-portal`; staging workflows and tests run there.
- Test the relevant app/website flow and security boundaries.
- Promote through a reviewed PR and owner-approved live migration procedure.
- Never use `supabase db push` against the existing live project.

## Quality checks

Run the repository's configured checks before opening a PR. GitHub Actions currently checks website JavaScript syntax/references and migration-file naming. Database regression and Android build jobs are separate evidence; a green web check does not prove live authentication, payments, RLS, seller workflows or physical fulfilment.

## Current owner-facing readiness

The repository is under active development. See the project tracker and current audit for open work, including staging E2E, Turnstile verification, password recovery, SMTP/OAuth setup, app environment parity, scheduled jobs, seller order/payout operations and production migration approvals.

**Never claim a feature is production-ready until its code, backend, configuration and real end-to-end behaviour have been verified.**
