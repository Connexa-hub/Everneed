# Everneed shared-feature development policy

**Owner-approved direction:** The web experience is the shared feature source for Everneed's shopper, seller, and admin interfaces. Claude and other contributors should not implement a feature twice merely because the Android app exists.

## Default delivery rule
- Build and improve the web interface and shared business logic first.
- Keep features in shared web modules wherever practical; avoid Android-only forks of ordinary UI/business workflows.
- Android packaging must include the shared web features at build time so the next app build inherits the latest approved web changes.
- Seller and admin web experiences should be packaged into the app when appropriate, with role/permission gating and mobile adaptation.
- Native-specific integrations (camera capture, push notifications, biometric auth, OS share, background tasks, native navigation, secure storage) may use native code/plugins, but their user-facing workflow should remain integrated with the shared interface.

## Required release checks
1. Web CI: syntax, asset references, tests, and packaged-interface checks.
2. Android CI: package current shared web assets, seller/admin modules, and build an installable APK.
3. Test auth/session sharing, role/ownership permissions, deep links, navigation/back, sign-out, and offline/error states.
4. No feature is considered inherited by the installed app until the Android build/package has passed. Existing installs receive changes only after an app update is installed; web content does not magically update inside an already-installed offline/native bundle unless a separately approved live-update system is used.
5. Avoid duplicate feature implementations. If native code is required, document the bridge and keep the web workflow consistent.

## Branching and safety
Work on feature branches based on `web-portal`; keep PRs draft until CI and required checks pass. Do not merge into `main`, alter production deployments, or change hosted Supabase settings/migrations without explicit authorization.
