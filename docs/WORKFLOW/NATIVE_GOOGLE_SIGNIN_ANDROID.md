# Native Google Sign-In (Android)

## Expected user experience
On Android, tapping **Continue with Google** should open Google's native Credential Manager account picker and return directly to Everneed. It must not launch Chrome or an OAuth browser tab. The website continues to use Supabase browser OAuth + PKCE.

## Implementation
- Capacitor 6 native integration uses `@capgo/capacitor-social-login` v6 (major version matched to Capacitor 6).
- Android plugin activity-result bridge is wired in `MainActivity`.
- Native Google ID token is exchanged with Supabase Auth using `grant_type=id_token`; Supabase creates/returns the session used by existing email login.
- Native login is Android-only; web login and iOS browser OAuth remain separate.
- Everneed persists only the Supabase session, not Google's token.

## Required Google Cloud setup (owner)
1. Use the same Google Cloud project that hosts the existing Google OAuth/web client.
2. Confirm/create a **Web OAuth client ID**. Put its client ID (not its secret) into `CFG.googleWebClientId` in `js/config.js`.
3. Create an Android OAuth client with package `com.everneed.store` and the SHA-1 of the staging APK signing certificate. **For the currently delivered staging APK (CI run 45349146363, build 1621), the verified SHA-1 is `5B:00:9D:03:C4:E3:53:55:23:2A:E1:02:34:3C:79:90:D3:49:63:FE`.** This CI run confirms it used the repository's stable test signing key. If the signing key is intentionally rotated, extract the fingerprint from the newly built APK and update the Android OAuth client accordingly.
4. If the consent screen is in Testing, add the test Google account as a test user.
5. Enable Google provider in staging Supabase Auth and ensure native ID-token sign-in accepts the configured Google audience. No production configuration is changed for this staging test.

## Acceptance tests
- CI static checks verify the Android-native path and token exchange.
- CI APK build must compile plugin.
- On Android device: native account chooser appears (not Chrome); account selection signs in; cancel returns to login; email/password remains functional; sign-out and repeat sign-in work.
- No production deployment, migrations or provider settings are changed in this feature.
