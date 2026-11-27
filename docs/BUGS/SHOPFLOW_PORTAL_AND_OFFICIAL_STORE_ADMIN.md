# Incident: Shopflow seller portal blank/refresh + missing Official Store admin panel

**Reported:** 16 Nov 2026  
**URL:** https://web-portal.everneed.pages.dev/portal  
**Browser context supplied:** Android 10 / Chrome 155 user agent  
**Target:** `web-portal` + Everneed-staging only  
**Production:** Do not touch; PR #31 stays open/unmerged.

## User report

Signing in with the Shopflow store-related account leads to an error/refresh and no useful portal content. The Platform Admin also has no navigation item or dedicated page for managing the Everneed Official Store.

The supplied “Everneed web diagnostics” text contains the page URL, timestamp and browser user agent, but **does not contain the actual JavaScript exception, stack trace, failed network request, HTTP status, or Supabase error message**. Do not claim the exact runtime exception is known from this report.

## Verified staging facts

Read-only inspection of Everneed-staging project `vjiadqygpyebpisxslbx` returned this Shopflow store:

| Field | Value |
|---|---|
| Store ID | `faf7c554-6b88-42f1-bf69-f5bce3924cb6` |
| Store | Shopflow |
| Slug | `shopflow` |
| Owner user ID | `a4db0712-8d2d-41f2-9e34-9b6e8bf85d9d` |
| Owner profile email | `connexabot@gmail.com` |
| Profile role | `merchant` |
| Store status | `approved` |
| Activation status | `verification_required` |
| Official | `false` |

The four enabled Nigerian verification rules currently returned by staging are phone, identity, face/liveness and business address; no corresponding verification-check rows were found for Shopflow. The seller is approved as an application, but it is not activated/live.

## Code findings

### Shopflow portal

- `web/assets/js/portal.js` loads the current user's store by `owner_id`.
- For an approved store whose `activation_status` is not `live`, the intended dashboard is an activation/verification card, not the live seller dashboard.
- `web/assets/js/workspace.js` delegates non-live approved stores back to the portal implementation.
- `web/assets/js/core.js` catches route/render promise errors and replaces the page with a generic “Something went wrong” state containing the error message.
- Therefore the supplied metadata is insufficient to identify why the expected activation card fails to render. Reproduce the login with the Shopflow account on the deployed staging preview and capture the actual console exception plus failed fetch/RPC details. Do not weaken verification or mark the store live to hide the issue.

### Official Store administration

- `web/assets/js/core.js` admin sidebar currently includes Overview, Inbox, Applications, Product review, Stores, Waitlist, Support settings and Appearance. It has no Official Store entry.
- `web/assets/js/admin.js` fetches all stores for the Stores page and labels official stores as “(Everneed)”.
- Its `stores()` renderer deliberately suppresses the ordinary suspend/reinstate actions for `is_official` stores.
- There is no dedicated Official Store admin route or management interface. This matches the user's report: the current Stores list is not an official-store control panel.

## Required implementation

### A. Fix the Shopflow portal failure

1. Reproduce with the exact staging Shopflow owner account and the current Cloudflare preview.
2. Capture actual browser console exception, stack, failed request URL/status/body (redact access tokens, cookies and secrets), and Supabase/PostgREST/RPC error.
3. Confirm `Supa.profile()` resolves to merchant and `Supa.uid()` matches the Shopflow owner ID.
4. Confirm `stores?select=*&owner_id=eq.<uid>` returns the Shopflow row under the signed-in user's RLS context.
5. Trace `V.portal` resolution, `load()`, verification-rule/check/policy fetches, activation card render and the `core.js` route catch.
6. Fix the actual root cause. Add defensive handling so optional verification/policy fetches cannot blank the entire portal. Required store/profile failures must show a clear recoverable error and retry action; do not silently convert permission errors into an empty dashboard.
7. Add a regression test for an approved-but-not-live seller with no verification records. It must show the activation checklist and not render a blank page or redirect into a new seller application.
8. Keep the store `verification_required` until valid verification checks and server-side activation policy permit activation. Do not bypass the four configured checks or fabricate completion.

### B. Add a dedicated Official Store admin panel

1. Add a clear **Official Store** item to the Platform Admin sidebar.
2. Add an admin-only route, e.g. `/admin/official-store`, backed by the canonical `everneed-official` record.
3. The page must load the existing record; never create a duplicate and never require a seller login.
4. Admin-only controls: store profile/branding, public contact email and verified status, catalogue/product management, categories/collections, pricing, stock, storefront visibility, and relevant order/fulfilment links.
5. Contact email `everneed@zohomail.eu` is only a proposed contact. Do not show it as verified until a real, expiring, single-use email challenge succeeds.
6. Keep Official Store ownership, official badge and email verification as separate concepts.
7. Protect the canonical store from seller changes/deletion and protect admin mutations with server-side role checks and audit logging.
8. Reuse existing product/order workflows. The official store is exempt from seller subscriptions/quotas only through a trusted server-side canonical-store rule; do not trust client-supplied flags.
9. Add authorization tests for anonymous, customer, seller and platform-admin access, plus storefront and catalogue regression tests.

## Acceptance criteria

- Shopflow sign-in reliably renders its approved-but-not-live verification state on mobile and desktop.
- Actual error handling is visible and actionable; no silent blank/refresh loop.
- Shopflow is not made live without valid required checks.
- Platform Admin sees an **Official Store** navigation item and can manage the existing canonical store.
- Ordinary sellers cannot access or mutate official-store admin operations.
- Shoppers see correct official-store identity; “Email verified” appears only after real verification.
- Tests and migrations run only against staging; no production deployment or PR merge without the full end-to-end gate and user's explicit release approval.

## Claude handoff

Investigate and implement both sections above on `web-portal`. First reproduce the Shopflow runtime issue and report the exact exception/request before changing code. Implement security and regression tests before exposing the Official Store UI. Update the tracker and contract with actual changed files, migration names, staging results and unresolved issues. Do not touch production or merge PR #31.
