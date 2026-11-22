# Environments: live and staging

Everneed has two separate Supabase databases. Staging is the development environment used to build and test changes against a production-compatible schema, migration history, policies and expected backend behaviour. It is deliberately separate from live customer data. The app and website should use the same environment at the same time, so a change made on the website shows up in the app when both are pointed at the same project.

| | Live | Staging |
|---|---|---|
| Supabase project | `Everneed01` | `Everneed-staging` |
| Project ref | `zpgasfweaixwsktlueje` | `vjiadqygpyebpisxslbx` |
| URL | `https://zpgasfweaixwsktlueje.supabase.co` | `https://vjiadqygpyebpisxslbx.supabase.co` |
| Region | eu-west-2 | eu-west-2 |
| Who uses it | real users | developers, owner and testers |
| Data | real, never wiped | test data only; can be wiped any time |
| Website served from | `main` (Cloudflare production, `everneed.pages.dev`) | `web-portal` and other previews (`*.everneed.pages.dev`), and `localhost` |
| App builds | release builds from `main` use live | manually dispatched test APKs from `web-portal` use staging |
| How migrations get there | manually, with explicit owner approval | manual `staging-db.yml` dispatch only; no push-triggered deployment |
| Cost | existing | $0 (free tier) |

## How the website picks a database
`shared/config.js` decides, using the page address. The same file is copied into the site at build time, so there is one place to change.

- `localhost` and `<anything>.everneed.pages.dev` use **staging**.
- `everneed.pages.dev` (the bare production address) and **any other address, including a custom domain**, use **live**. A new domain can never land on staging by accident.
- A yellow "STAGING: test data only" ribbon appears at the bottom of every staging page. Staging is intended for development against the production-compatible schema/contract. It may be ahead of live while newer migrations are tested; it is not connected to the production database's real user records.

**Preview-only staging is now enabled.** `STAGING_READY=true` on `web-portal`; the Cloudflare preview deployment for commit `4afa676` succeeded and its alias is `https://web-portal.everneed.pages.dev`. `shared/config.js` routes `*.everneed.pages.dev` previews and localhost to staging, while the bare production host `everneed.pages.dev` and custom domains remain LIVE. The yellow `STAGING: test data only` ribbon should appear on preview pages. The guarded clean rebuild succeeded on 12 Nov 2026; all 19 historical live migrations were verified against the stored live history and replayed on staging. Staging also carries newer development migrations 016–025: public RPC hardening, authenticated RPC boundary hardening, Turnstile boundary, regional policy/consent catalogue, seller verification activation gate, approval/RLS hardening and anonymous policy-read hardening. Migrations 019–023 were applied automatically to staging on 12 Nov 2026; migration 024 adds structured public seller storefront details and migration 025 grants the seller write access to that public-details column; both are applied on staging. Production is unchanged. The `media` bucket and all six `storage.objects` policies match live. `public-forms` is ACTIVE v3 with JWT verification. Owner reports Auth Site URL/redirect setup complete and `TURNSTILE_SECRET_KEY` plus Paystack test `PAYSTACK_SECRET_KEY` added; secret values/presence cannot be inspected here. `paystack` is deployed to staging as ACTIVE v1 with `verify_jwt=false`, matching production so Paystack signed webhooks can reach the handler's HMAC validation; user actions validate their bearer token inside the function. Turnstile/payment/Auth and seller/admin end-to-end checks remain pending test accounts. Hardening migrations 016–018 and all staging activity remain staging-only; production `Everneed01` and `main` are unchanged.

## Turning staging on (one time)
Steps 1 and 2 are for the owner. Everything else is automatic or done by Claude.

1. **Get the connection string.** Supabase dashboard, project `Everneed-staging`, press **Connect**, choose **Session pooler**, copy the URI. Reset the database password first if you do not have it (Project settings, Database). Use the pooler string, not the direct one: GitHub's runners cannot reach the direct address.
2. **Add it to GitHub as a secret.** Repository Settings, Secrets and variables, Actions, New repository secret. Name: `STAGING_DB_URL`. Value: the string with your password filled in. Never paste it into a file, a chat or an issue.
3. **Clean-rebuild staging once (destructive to staging only).** Actions tab, choose **Reset staging database**, Run workflow, branch `web-portal`, and confirm `RESET_STAGING`. The workflow requires the `STAGING_DB_URL` secret, checks for the exact staging project ref `vjiadqygpyebpisxslbx`, rejects the live ref, then runs the Supabase CLI remote reset and replays the repository migrations. It never runs automatically on a push. This clears staging's old test schema/data; do not use it for live.
4. **Verify the result.** Completed 12 Nov 2026: workflow run `43234686076` succeeded, all 19 migration files were replayed, and executable SQL was compared with the 19 stored live migration statements. Public columns, policies and RLS-enabled table sets match live. The temporary duplicate signup catch-up migration has been removed from the repository; its no-op staging history row has been removed after confirming it duplicated version `0030`. This completes `WEB-F07b`.
5. **Preview switch — completed 12 Nov.** `STAGING_READY=true` is committed on `web-portal` (commit `4afa676`); Cloudflare preview deployment `e13fb39c` succeeded and owns the `web-portal.everneed.pages.dev` alias. Production `everneed.pages.dev` and custom domains remain on live.
6. **Staging settings that migrations do not carry:**
   - Auth: owner reports Site URL and redirect `https://web-portal.everneed.pages.dev/**` configured on `Everneed-staging`.
   - Storage: **verified 12 Nov** — the `media` bucket exists (public read, 5 MiB, JPEG/PNG/WebP/GIF), and all six `storage.objects` policies match live exactly. No storage change is needed.
   - Create one test admin and two test sellers. Use staging only; do not promote real production accounts.
   - Payments: owner reports adding Paystack **test** `PAYSTACK_SECRET_KEY`; `paystack` deployed to staging as ACTIVE v1 with `verify_jwt=false`, matching production's webhook-compatible setting. Never use a live `sk_live_` key in staging.
   - Public forms: owner reports adding `TURNSTILE_SECRET_KEY`. `public-forms` is ACTIVE v3 with JWT verification enabled. Never put the secret in Git, a browser config, GitHub Actions or chat. The public sitekey is in `shared/config.js`; the widget is restricted to `everneed.pages.dev` and its subdomains.
    - The `public-forms` function requires successful Siteverify, the expected action (`waitlist` or `guest_open`) and a hostname under `everneed.pages.dev`. Preview uses the Edge Function only when `CFG.env` is `staging`.

## Moving a change from idea to live
1. Write new migrations using the timestamp version returned by the staging migration apply operation, e.g. `supabase/migrations/YYYYMMDDHHMMSS_name.sql`, and keep `.github/workflows/migrations-check.yml`'s exact replay list aligned. Historical migrations 000–033 retain their original numbered filenames.
2. Push to `web-portal` for CI only. Staging is not updated by a push; after review, the owner must manually dispatch `Staging database` and select `APPLY` (the default is `NO`).
3. Test on the `web-portal` preview site and, once wired, a test app build.
4. Open a pull request to `main`. Tests must be green.
5. Merge. Cloudflare deploys the website to production.
6. **Apply the migration to live by hand, with the owner's approval.** Verify the project reference is `zpgasfweaixwsktlueje` before running anything, then record the result in the migration log in `DB_CONTRACT.md`.

**Never run `supabase db push` against live.** Live records its own timestamped history and is never targeted by the staging workflow. Staging retains historical repository versions `000`–`033` and now also records `20261116201132` (`seller_onboarding_entitlements_and_quotas`). Its matching timestamped source file is committed on `web-portal`. The guarded staging workflow remains manual-dispatch only; never run it against live. Each live change requires separate review and explicit owner approval.

## Rules
- Real customer data never goes into staging. If staging needs realistic data, make it up or anonymise it first.
- Staging can be wiped and rebuilt at any time. Live cannot.
- Free Supabase projects pause after about a week of inactivity. If staging sleeps, resume it in the dashboard.
- Public keys (the `anon` key) may sit in the repo. Database passwords, connection strings, service-role keys, Paystack keys and signing keys never do.

- Android test APK signing: CI uses the stable repository secret `ANDROID_DEBUG_KEYSTORE_BASE64` when configured. If absent, it creates a temporary debug key for that run; uninstall any older Everneed test APK before installing a build signed with a different key. Never commit a keystore or paste its contents into chat.

## Persistent Android native project

**Decision, 22 Nov 2026:** keep the Capacitor Android native project committed under `android/`; `.gitignore` no longer excludes it. The manual workflow `.github/workflows/initialize-android.yml` creates the project once on a non-`main` branch after the required typed confirmation `INITIALIZE_ANDROID`. It is not a release/build workflow.

**Initialization completed successfully on 22 Nov 2026.** The workflow generated and committed the native project to `web-portal` in commit `0b1ab6f68f29776611227d5f5f276c62f1fb2c48` (`chore(android): persist Capacitor native project`). Verified committed files include `android/gradlew`, Gradle wrapper files, `android/settings.gradle`, `android/app/build.gradle`, `AndroidManifest.xml`, and `MainActivity.java` using package `com.everneed.store`. The permanent native project now exists in Git; it has not been built into a new APK as part of this initialization.

Regular builds use the committed native project and `npx cap sync android`, then run `tools/prepare-android.mjs` to apply the required manifest permissions and AdMob metadata idempotently. Do not run `npx cap add android` again unless deliberately regenerating the native project as a reviewed change. Owner-approved test APK builds are now enabled only by manual dispatch on `web-portal`; PR and `main` builds do not produce test APKs.

## The app
**Staging isolation for app test builds — partially implemented 22 Nov 2026.** `js/build.js` is stamped by CI before `js/config.js` loads. `js/config.js` now selects the staging Supabase project for every non-`main` build and live only when the stamped branch is `main`. Staging test builds display a visible `STAGING · TEST DATA ONLY` ribbon. This prevents a `web-portal` APK from writing to live customer data. It is a safe environment selector, but APP-08 remains PARTIAL until the app's config/client helpers are consolidated with the shared modules and verified end to end.

The APK job in `.github/workflows/build.yml` runs only when manually dispatched on `web-portal`; it requires the install/test job, syncs the committed native project, and publishes `everneed-apk` as a workflow artifact. The local database test job still runs and reports independently, but does not block creation of this manual test-only APK. APK success is not backend-readiness approval. `main` and ordinary pull-request runs do not build an APK. If the stable signing secret is absent, CI creates a temporary debug key; uninstall an older Everneed test APK before installing that build.

A staging APK should show the staging ribbon and use project `vjiadqygpyebpisxslbx`. Do not use it for live customer operations.

## Where this is tracked
`WEB-F07b` (replay proof), `WEB-ENV01` (steps 1 to 6 above), `APP-08` (remaining shared-module consolidation and E2E verification), `APP-12` (persistent Android project), `WEB-F08` (signing key) in `WEBSITE_TRACKER.md`.


## Verified baseline — 16 Nov 2026

A read-only Supabase migration-history check of `Everneed-staging` (`vjiadqygpyebpisxslbx`) confirms historical repository versions `000`–`033` and timestamped migrations `20261116201132` and `20261116201843` are applied. The latter add seller onboarding, plan entitlements, admin-configurable catalogue limits, daily listing enforcement and the secure quota-trigger execution context. Do not reapply them. Production is untouched. This is the staging database history, not proof that the matching Edge Function source is deployed. The staging Edge Function inventory reports `public-forms` ACTIVE v3 and `paystack` ACTIVE v1 (`verify_jwt=false`). The GitHub `web-portal` source has newer Paystack webhook retry handling; that source has **not** been deployed to staging. Do not deploy as part of documentation reconciliation.

The latest completed CI results must be read from the linked PR and Actions runs; Phase 2 migration 030 and recovery-worker changes are currently undergoing verification. See [PR #31](https://github.com/Connexa-hub/Everneed/pull/31). `APP-08` is PARTIAL: branch-based staging/live selection is now implemented in `js/config.js`; shared-module consolidation and end-to-end verification remain.
