# Environments: live and staging

Everneed has two databases. Both the website and the app are meant to use the same one at the same time, so a change made on the website shows up in the app. Which one they use depends on where the code is running.

| | Live | Staging |
|---|---|---|
| Supabase project | `Everneed01` | `Everneed-staging` |
| Project ref | `zpgasfweaixwsktlueje` | `vjiadqygpyebpisxslbx` |
| URL | `https://zpgasfweaixwsktlueje.supabase.co` | `https://vjiadqygpyebpisxslbx.supabase.co` |
| Region | eu-west-2 | eu-west-2 |
| Who uses it | real users | us, testing |
| Data | real, never wiped | fake, can be wiped any time |
| Website served from | `main` (Cloudflare production, `everneed.pages.dev`) | `web-portal` and other previews (`*.everneed.pages.dev`), and `localhost` |
| App builds | release builds from `main` | test builds from `web-portal` (not wired yet, see "The app") |
| How migrations get there | by hand, with the owner's approval | automatically by `staging-db.yml` |
| Cost | existing | $0 (free tier) |

## How the website picks a database
`shared/config.js` decides, using the page address. The same file is copied into the site at build time, so there is one place to change.

- `localhost` and `<anything>.everneed.pages.dev` use **staging**.
- `everneed.pages.dev` (the bare production address) and **any other address, including a custom domain**, use **live**. A new domain can never land on staging by accident.
- A yellow "STAGING: test data only" ribbon appears at the bottom of every staging page.

**Staging is currently switched off.** `STAGING_READY` in `shared/config.js` is `false`, so every address still uses live, exactly as before. The preview's public waitlist/support forms therefore continue using the legacy direct RPC path until staging is enabled; the new Turnstile proxy and restricted RPC grants are staging-only for now. Do not merge the new frontend path to `main` until the production Edge Function secret and migration are separately configured and approved. The guarded clean rebuild succeeded on 12 Nov 2026; all 19 historical migrations were verified against live history, and staging now contains migrations 000–018. The `media` bucket and all six `storage.objects` policies have since been read-only compared with live and match exactly. The `public-forms` Edge Function is ACTIVE v2 with JWT verification. The owner reports adding `TURNSTILE_SECRET_KEY`, but its presence/value cannot be inspected through the available connection, so Turnstile end-to-end validation remains pending. Hardening migrations 016, 017 and 018 are staging-only; live remains unchanged. Do not flip the switch until Auth URLs, Paystack test setup, test users and preview E2E checks are complete.

## Turning staging on (one time)
Steps 1 and 2 are for the owner. Everything else is automatic or done by Claude.

1. **Get the connection string.** Supabase dashboard, project `Everneed-staging`, press **Connect**, choose **Session pooler**, copy the URI. Reset the database password first if you do not have it (Project settings, Database). Use the pooler string, not the direct one: GitHub's runners cannot reach the direct address.
2. **Add it to GitHub as a secret.** Repository Settings, Secrets and variables, Actions, New repository secret. Name: `STAGING_DB_URL`. Value: the string with your password filled in. Never paste it into a file, a chat or an issue.
3. **Clean-rebuild staging once (destructive to staging only).** Actions tab, choose **Reset staging database**, Run workflow, branch `web-portal`, and confirm `RESET_STAGING`. The workflow requires the `STAGING_DB_URL` secret, checks for the exact staging project ref `vjiadqygpyebpisxslbx`, rejects the live ref, then runs the Supabase CLI remote reset and replays the repository migrations. It never runs automatically on a push. This clears staging's old test schema/data; do not use it for live.
4. **Verify the result.** Completed 12 Nov 2026: workflow run `43234686076` succeeded, all 19 migration files were replayed, and executable SQL was compared with the 19 stored live migration statements. Public columns, policies and RLS-enabled table sets match live. The temporary duplicate signup catch-up migration has been removed from the repository; its no-op staging history row has been removed after confirming it duplicated version `0030`. This completes `WEB-F07b`.
5. **Flip the switch.** In a pull request, change `STAGING_READY` to `true` in `shared/config.js`. After the merge, preview builds use staging.
6. **Staging settings that migrations do not carry:**
   - Auth: set the Site URL and add the redirect URL `https://web-portal.everneed.pages.dev/**` under Authentication, URL configuration.
   - Storage: **verified 12 Nov** — the `media` bucket exists (public read, 5 MiB, JPEG/PNG/WebP/GIF), and all six `storage.objects` policies match live exactly. No storage change is needed.
   - Create a test admin and two test sellers (`WEB-Q01` needs them).
   - Payments: the `paystack` edge function is not deployed to staging. Use Paystack **test** keys there, never live keys. 
   - Public forms: `public-forms` is deployed to staging with JWT verification enabled. Add `TURNSTILE_SECRET_KEY` under Project → Edge Functions → Secrets in `Everneed-staging`; copy the secret from the Cloudflare Turnstile widget named **Everneed public forms**. Never put it in Git, a browser config, GitHub Actions or chat. The public sitekey is in `shared/config.js`; the widget is restricted to `everneed.pages.dev` and its subdomains.
    - The `public-forms` function requires a successful Siteverify response, the expected action (`waitlist` or `guest_open`) and a hostname under `everneed.pages.dev`. The preview client switches to the Edge Function only when `CFG.env` is `staging`.

## Moving a change from idea to live
1. Write the migration as `supabase/migrations/NNN_name.sql` (next number: 019). Digits, underscore, name. The `Migration files` check fails the push if it is not named that way.
2. Push to `web-portal`. `staging-db.yml` applies it to staging.
3. Test on the `web-portal` preview site and, once wired, a test app build.
4. Open a pull request to `main`. Tests must be green.
5. Merge. Cloudflare deploys the website to production.
6. **Apply the migration to live by hand, with the owner's approval.** Verify the project reference is `zpgasfweaixwsktlueje` before running anything, then record the result in the migration log in `DB_CONTRACT.md`.

**Never run `supabase db push` against live.** Live records its history by timestamp (for example `20261029014653`), the repo files are numbered, so a push would try to replay the whole history on top of real data. The staging workflow is safe because staging records the repo's own numbers from its first run.

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
