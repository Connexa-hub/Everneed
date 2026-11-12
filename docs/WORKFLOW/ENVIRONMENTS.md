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
| App builds | release builds from `main` | test builds from `web-portal` (not wired yet, see "The app") |
| How migrations get there | by hand, with the owner's approval | automatically by `staging-db.yml` |
| Cost | existing | $0 (free tier) |

## How the website picks a database
`shared/config.js` decides, using the page address. The same file is copied into the site at build time, so there is one place to change.

- `localhost` and `<anything>.everneed.pages.dev` use **staging**.
- `everneed.pages.dev` (the bare production address) and **any other address, including a custom domain**, use **live**. A new domain can never land on staging by accident.
- A yellow "STAGING: test data only" ribbon appears at the bottom of every staging page. Staging is intended for development against the production-compatible schema/contract. It may be ahead of live while newer migrations are tested; it is not connected to the production database's real user records.

**Preview-only staging is now enabled.** `STAGING_READY=true` on `web-portal`; the Cloudflare preview deployment for commit `4afa676` succeeded and its alias is `https://web-portal.everneed.pages.dev`. `shared/config.js` routes `*.everneed.pages.dev` previews and localhost to staging, while the bare production host `everneed.pages.dev` and custom domains remain LIVE. The yellow `STAGING: test data only` ribbon should appear on preview pages. The guarded clean rebuild succeeded on 12 Nov 2026; all 19 historical live migrations were verified against the stored live history and replayed on staging. Staging also carries newer development migrations 016–021: public RPC hardening, authenticated RPC boundary hardening, Turnstile boundary, regional policy/consent catalogue, seller verification activation gate, approval/RLS hardening and anonymous policy-read hardening. Migrations 019–021 were applied automatically to staging on 12 Nov 2026; production is unchanged. The `media` bucket and all six `storage.objects` policies match live. `public-forms` is ACTIVE v3 with JWT verification. Owner reports Auth Site URL/redirect setup complete and `TURNSTILE_SECRET_KEY` plus Paystack test `PAYSTACK_SECRET_KEY` added; secret values/presence cannot be inspected here. `paystack` is deployed to staging as ACTIVE v1 with `verify_jwt=false`, matching production so Paystack signed webhooks can reach the handler's HMAC validation; user actions validate their bearer token inside the function. Turnstile/payment/Auth and seller/admin end-to-end checks remain pending test accounts. Hardening migrations 016–018 and all staging activity remain staging-only; production `Everneed01` and `main` are unchanged.

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
1. Write the migration as `supabase/migrations/NNN_name.sql` (next number: 022). Digits, underscore, name. The `Migration files` check fails the push if it is not named that way.
2. Push to `web-portal`. `staging-db.yml` applies it to staging.
3. Test on the `web-portal` preview site and, once wired, a test app build.
4. Open a pull request to `main`. Tests must be green.
5. Merge. Cloudflare deploys the website to production.
6. **Apply the migration to live by hand, with the owner's approval.** Verify the project reference is `zpgasfweaixwsktlueje` before running anything, then record the result in the migration log in `DB_CONTRACT.md`.

**Never run `supabase db push` against live.** Live records its history by timestamp (for example `20261029014653`), the repo files are numbered, so a push would try to replay the whole history on top of real data. The staging workflow is safe because staging records the repo's own numbers from its first run. The repository now includes staging-only migrations through 021; live still retains its original 19 timestamped migrations until each change is separately reviewed and approved.

## Rules
- Real customer data never goes into staging. If staging needs realistic data, make it up or anonymise it first.
- Staging can be wiped and rebuilt at any time. Live cannot.
- Free Supabase projects pause after about a week of inactivity. If staging sleeps, resume it in the dashboard.
- Public keys (the `anon` key) may sit in the repo. Database passwords, connection strings, service-role keys, Paystack keys and signing keys never do.

- Android debug APK signing: CI no longer reads a keystore from the repository. Generate a replacement locally and add its base64-encoded contents as the GitHub Actions repository secret `ANDROID_DEBUG_KEYSTORE_BASE64`. The workflow writes it to `~/.android/debug.keystore` before building. Never commit the keystore or paste its contents into chat. After the new key is in place, uninstall older Everneed test APKs once before installing the newly signed build.

## The app
The Android app still has its database hard-coded in `js/config.js` (live only). That is task `APP-08`. The plan, so the app and website always agree:
- The app loads the same `shared/config.js` as the website.
- Release builds from `main` use live. Test builds from `web-portal` use staging and show the same ribbon.
- Until then, a seller who signs up on a staging website will not exist in the app, and the other way round. Staging and the app only line up after `APP-08`.

## Where this is tracked
`WEB-F07b` (replay proof), `WEB-ENV01` (steps 1 to 6 above), `APP-08` (app on shared config), `WEB-F08` (signing key) in `WEBSITE_TRACKER.md`.
