# Native Google Sign-In (Android)

Everneed's Android app uses the native Google Credential Manager account chooser, then exchanges the Google ID token for a Supabase Auth session. Android should not open the website or an OAuth browser for this flow. Web builds retain the Supabase PKCE redirect flow.

## Client ID configuration

Set `CFG.googleWebClientId` in `js/config.js` to the **Web application OAuth client ID** from the Google Cloud project used by Supabase Google Auth. It must end in `.apps.googleusercontent.com`. This is a public client identifier, not a secret.

Google Cloud Console must contain OAuth clients in the same project:
- Web application client (the ID used in `googleWebClientId` and configured as the Google provider in Supabase).
- Android client for package `com.everneed.store`, registered with the SHA-1 certificate fingerprint for each build-signing key used to install the app.

For test APKs, register the SHA-1 of the signing certificate used by GitHub Actions. If the workflow generates a temporary key, that fingerprint changes per build and native login will fail; use the repository's stable debug keystore secret. For Play releases, register the Play App Signing SHA-1 separately.

If Google OAuth consent is in Testing mode, add the tester's Google account to the OAuth consent-screen test users.

## Authentication sequence

1. Capacitor Android invokes the Google Credential Manager UI (bottom-sheet style).
2. The plugin requests an online ID token and uses a nonce digest.
3. Everneed sends the ID token and original nonce to Supabase Auth `/auth/v1/token?grant_type=id_token`.
4. Supabase session is saved using the existing session persistence.
5. Existing profile and age-confirmation flow remains in place.

## Troubleshooting

- `Developer console is not set up correctly`: verify the package ID, installed APK SHA-1, Web client ID, and that the OAuth clients are in the same Google Cloud project.
- Missing client ID message: configure `CFG.googleWebClientId`.
- Native sign-in unavailable: rebuild the APK after the native plugin dependency is added and Capacitor sync runs.
- The old native PKCE browser callback is not used by Android anymore. The web OAuth redirect remains supported.
