# Native Google sign-in — Claude implementation handoff

**Date:** 25 November 2026  
**Request:** R24 — ChatGPT to Claude  
**Status:** OPEN  
**Owner:** Claude (app/frontend integration)  
**Target:** `web-portal` only  
**Related:** PR #43 (review source only; do not merge or rebase it)

## Summary

The owner wants Android Google sign-in to show the native Google Credential Manager account picker, not Chrome. The web login must retain browser OAuth/PKCE. The native implementation in PR #43 is a useful starting point, but its branch is stale and includes unrelated changes. The current `AI_PROTOCOL.md` requires all app and website work to be integrated on `web-portal`; there must not be a separate app-development branch.

## Confirmed configuration

- Package: `com.everneed.store`.
- **Web OAuth client ID (use as native plugin `webClientId` / server client ID):** `659136945947-dlum233ke4ruu48uk9ir0bli0nvfcs60.apps.googleusercontent.com`
- **Android OAuth client ID (do not put this in `CFG.googleWebClientId`):** `659136945947-tv0q8nrivcca6rv5areu2vrtca1qnekm.apps.googleusercontent.com`
- Staging APK signing SHA-1 previously verified: `5B:00:9D:03:C4:E3:53:55:23:2A:E1:02:34:3C:79:90:D3:49:63:FE`.
- Staging Supabase project: `vjiadqygpyebpisxslbx`; callback for the browser PKCE flow: `https://vjiadqygpyebpisxslbx.supabase.co/auth/v1/callback`.
- Do not change Supabase provider settings, secrets, production config or release signing registrations.

## Review findings from PR #43

1. **Blocking client-ID mismatch:** PR #43's `js/config.js` assigns the Android client ID to `CFG.googleWebClientId`. Correct it to the Web OAuth client ID above. The Android client remains registered separately against package + SHA-1.
2. **Logout/re-auth is incomplete:** native sign-in initializes and calls `SocialLogin.login`, then exchanges the ID token with Supabase. Both sign-out paths in `js/app.js` (`data-act="out"` and `A.signout`) call `Supa.out()` only. No native provider logout/credential cleanup is present. Check the exact installed Capgo v6 API and its documented semantics before adding a call; do not guess a method signature. Clear provider state only on explicit sign-out, not during ordinary Supabase session restoration.
3. **Cancellation handling is fragile:** cancellation is detected by matching error-message text. Use documented plugin error codes/types if available; cancellation should return to the login screen without a scary error or partially-created Supabase session.
4. **Potential iOS regression:** PR #43 changes the previous native Browser branch to a plain `location.href` OAuth redirect for all non-Android platforms. Verify the current agreed iOS behavior and preserve it; the stated scope is Android native picker + unchanged website flow.
5. **Do not port the PR wholesale:** its 23-file diff includes payment/client hardening and seller/admin UI work in addition to native sign-in. Isolate only the necessary native auth changes and reconcile each file with the current `web-portal` version. In particular, do not replace current `js/app.js`, `js/auth.js`, `js/supa.js`, workflow or tracker with stale PR snapshots.
6. **Static checks are insufficient:** PR's marker-based tests prove strings exist, not that the native plugin compiles, returns an ID token, handles cancellation or permits repeat sign-in. Keep device acceptance outstanding until it is actually run.

## Required implementation on web-portal

- Re-read current `AI_PROTOCOL.md`, tracker, latest Claude handoffs and the current versions of every file before editing.
- Port only the Android-native path, plugin dependency/Gradle wiring, MainActivity activity-result bridge, and required focused tests/docs.
- Set `CFG.googleWebClientId` to the confirmed Web client ID.
- Keep web browser OAuth/PKCE unchanged. Do not route the website into native code.
- Audit explicit logout and repeat-login behavior using the exact Capgo v6 API. Preserve the Supabase session refresh/restore path.
- Ensure cancellation, missing token, expired/invalid token and network failure leave the user in a recoverable signed-out/login state and do not log sensitive tokens.
- Preserve the current shared frontend on `web-portal`; do not cherry-pick unrelated seller, admin, payment or visual changes from PR #43.
- Do not modify the Google Cloud console, Supabase dashboard/provider configuration, production database, or `main`.

## Contracts

- Native provider: Google.
- Native token exchange: Supabase Auth `POST /auth/v1/token?grant_type=id_token` with `provider=google` and the Google ID token; only the resulting Supabase session is persisted.
- Browser flow: existing Supabase OAuth + PKCE; retain one-time verifier handling and existing callback allow-list.
- User-visible outcomes: successful sign-in routes through the existing `A.authed`; cancellation returns to login quietly; failures show a concise recoverable error.
- No new permission keys, database tables, migrations or backend RPCs are required for this client-side integration.

## Validation required

1. Run `npm test`, `node --check` for changed JS, Android Gradle build, and the full required CI suite on `web-portal`.
2. Produce an installable **staging** APK only from `web-portal`; confirm yellow staging ribbon and staging Supabase URL.
3. On the Infinix Hot 70: native account picker (no Chrome), successful existing-account sign-in, first-time account completion, cancellation, explicit sign-out, repeat sign-in, app restart/session restore, and email/password + email-code fallback.
4. Verify website Google sign-in still uses browser OAuth/PKCE and is not affected.
5. Record build/run IDs, device results and remaining failures in the tracker. Keep task PARTIAL until owner/device acceptance is complete.

## Risks / not tested

- PR #43 is OPEN/DRAFT and its head is `f4e2132babae90e69577422e0900639272da0e76`; it is not a release candidate.
- Its base SHA is `d7767f16870354ec4571bd9b89e8f75eb8279a77`, while current `web-portal` has advanced to commit `2616714d3fa04a6a961629f98bae68ef02e53fc9`. Do not merge the stale branch.
- No verified native device acceptance, no confirmed logout API behavior, and no confirmed green CI for the current native implementation.
- Google Cloud Android OAuth registration is not yet independently verified in this review.

## Needs from Claude (R24)

Port the isolated Android-native Google sign-in implementation onto `web-portal`, correct the Web client ID, resolve the logout/repeat-login and cancellation behavior from the documented plugin API, preserve current web/iOS behavior, and return a commit + CI/APK evidence. Mark R24 ACCEPTED/CHANGED and update the tracker when complete.
