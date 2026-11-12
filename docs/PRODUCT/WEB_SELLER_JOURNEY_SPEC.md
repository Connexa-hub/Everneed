# Everneed web seller journey and shopper handoff

**Status:** Approved direction; implementation and end-to-end validation pending  
**Branch:** `web-portal`  
**Date:** 12 November 2026  
**Scope:** Web experience first. Mobile app parity follows after the web flow is tested.

## 1. Product-surface rule

Everneed is a multivendor commerce platform, not a web shop selling its own inventory. The website must distinguish shoppers from prospective sellers.

- A signed-in shopper who chooses **Shop** (or another customer shopping entry point) sees the app handoff page. Do not build a duplicate web catalogue, cart or checkout.
- A signed-in user who chooses **Become a Seller** enters the interactive seller onboarding journey.
- A user with an existing store should be routed to the seller portal/store hub, not asked to create a duplicate store.
- The same Everneed account must resolve to the same profile, store memberships and permissions in the Android app.
- Navigation and visible buttons must be real routes/actions, not decorative mockups.

## 2. Shopper app handoff

Create a dedicated app-handoff route for customer shopping. It should:
- Explain that shopping, cart, checkout and order tracking are in the Everneed app.
- Use a lightweight animated scene with product categories, parcels, delivery vehicle/courier and delivery-related commerce elements. Keep the motion smooth, restrained and mobile-friendly; respect reduced-motion settings.
- Show only verified, published installation destinations.
- Put the Google Play listing first when published.
- Below it, show other official published platform listings and a GitHub Releases/direct APK link only when the release is verified and approved for distribution.
- Hide unpublished or unverified platforms. Never render placeholder links or claim a download is available when it is not.
- Explain that the shopper signs into the app using the same Everneed account.
- Keep the page useful when a platform listing is not yet published, with a clear availability message rather than a dead button.

## 3. Seller onboarding entry and account state

Entry points include the public navigation and the signed-in profile/menu action **Become a Seller**.

On entry:
1. Check the authenticated session.
2. If signed out, route to sign-in and return to onboarding after successful authentication.
3. If the user already owns or manages an active store, route to the existing store hub.
4. If the user has a saved draft application, resume it.
5. Otherwise show a dedicated welcome/intent screen: “Would you like to become a seller?” with a clear explanation of what is required and a continue action.

Do not create multiple store applications for the same user/store identity. Enforce this in the backend, not only in the UI.

## 4. Screen-by-screen onboarding

Use a clear progress indicator, one focused task per screen, Back/Continue controls, save-and-resume, validation, loading states and accessible error messages. Persist drafts as the user progresses.

### Step 1 — What would you like to sell?

- Present a visually rich, searchable grid of animated category tiles.
- Support multiple category selections.
- Categories must come from the platform's managed category catalogue; do not hard-code a second taxonomy in the browser.
- Include an “Other” path that asks for a short description and can be reviewed.
- Category selection informs store discovery and product defaults; it does not guarantee approval.

### Step 2 — Store name

- Ask for the public store name.
- Check availability and naming rules on the server.
- Explain that the store name is public and can be changed only under platform rules.
- Keep the unique store slug separate from the display name.

### Step 3 — Location and region

- Request browser/device location permission with a clear explanation of why it is needed.
- If granted, use geolocation to resolve coordinates to a country/region/state/locality using an approved geocoding service.
- Never silently infer a precise street address from IP location.
- If permission is denied, unavailable or inaccurate, allow the user to select country, state/region, city and enter the relevant address manually.
- Let the user review and correct the resolved region before saving.
- Store coordinates only when required for a defined feature, with explicit consent and appropriate access controls.
- The same country/region profile fields should be available to normal users during account/profile setup, but precise location remains optional and purpose-limited.
- Country and region must be represented by stable country/region codes, not display-name-only strings, to support future markets.

### Step 4 — Store description

- Ask for a concise public store bio/description.
- Show a character count and examples without writing the seller's claims for them.
- Validate length and content server-side.

### Step 5 — Store branding (optional)

- Store logo is optional.
- Store cover photo is optional.
- Provide previews, crop guidance, file-size/type limits and accessible remove/replace actions.
- Optimise images for low-data mobile connections.
- Do not block application submission because optional branding is absent.

### Step 6 — Contact details

- Collect a working phone number with country calling code.
- Normalize and validate the number.
- Send an OTP through a configured SMS/voice provider and mark it verified only after server-side confirmation.
- If verification is not yet available in a target country, show “Not verified” and make the limitation explicit; do not simulate a successful OTP.
- The seller profile/store hub must display a clear phone verification state and provide a way to retry later.
- Do not expose private phone numbers publicly unless the seller explicitly chooses a public contact option.

### Step 7 — Identity and business verification

Use a country-aware verification framework, not a Nigeria-only NIN field.

- Ask for country of residence/business and show only identity document types accepted for that jurisdiction (for example, NIN or other nationally recognised identity documents where legally appropriate).
- Use an approved identity verification provider or secure upload/storage process. Do not put identity numbers or document images in public profile/store tables.
- Include a face/liveness verification step only through a suitable provider and only after explaining purpose, retention and privacy.
- Provide a clear skip-for-now option where policy permits. Skipping must leave the seller marked **Not verified** and must not be represented as verified.
- Apply platform restrictions based on risk and policy: an unverified seller may save a draft and complete onboarding, but publishing products, accepting orders or receiving payouts may be restricted until required checks pass.
- Never store raw face templates or biometric data in ordinary application tables. Obtain legal/privacy review before enabling biometric processing in any market.

### Step 8 — Proof of business/store address

- Collect a proof-of-address document that corresponds to the seller's declared business/store address.
- Explicitly distinguish this from the shopper's delivery address; they serve different purposes.
- Allow the seller to review the declared address and correct it before uploading evidence.
- State accepted documents, recency requirements, file limits and review time based on the selected country.
- Store documents in a private, access-restricted bucket with short-lived signed access; never expose public URLs.
- Skipping leaves address verification pending/not verified and is subject to the same capability restrictions.

### Step 9 — Review and submit

- Present a complete review summary with edit links.
- Clearly label optional, pending, skipped and verified items.
- Require explicit confirmation that the submitted information is accurate.
- Submit through a server-authorised function/RPC and show a reference plus application status.
- Application states should distinguish draft, submitted/pending review, needs changes, approved, rejected and suspended.
- Show admin review notes and next steps to the seller. Do not imply that document checks are instant if manual/provider review is pending.

## 5. Seller verification states

Keep independent verification states for phone, identity/face and address rather than one misleading boolean. At minimum support:
- Not started
- Pending
- Verified
- Needs attention / rejected
- Skipped (where allowed)
- Expired (where applicable)

A seller who skipped verification must visibly show **Not verified** in the seller profile/store hub. Verification status and permissions must be derived and enforced server-side. A frontend badge alone is not access control.

## 6. Plans and subscriptions

After application submission (and according to the approved business policy), show four plan cards.

- Plan names, prices, billing cadence, features, limits, trial terms and availability must come from managed backend configuration.
- Do not invent plan prices or promise benefits that are not configured.
- Show the Basic plan as the entry-level choice. If Basic is free, state that only after the owner confirms the plan configuration.
- Explain what each tier unlocks and what happens when a subscription expires or payment fails.
- Plan selection and payment must be separate from identity verification status. A paid plan must never bypass verification or moderation.
- The selected plan should be associated with the user's store and visible in the portal.
- If plans are not configured or payment is not ready, keep the plan screen informational and allow the approved Basic/onboarding path without fake payment success.

## 7. Seller portal after onboarding

On choosing an available plan and completing required steps, open a premium-quality responsive seller portal/store hub. It should be designed as an operational tool, not a static marketing dashboard.

The first implementation should reuse the existing portal shell, Supabase client, store application and product RPC/data contracts. Avoid replacing existing tables or creating a parallel seller database.

Portal navigation should be prepared for:
- Store overview and application/verification status.
- Store profile, branding, contact and locations.
- Product catalogue and product creation.
- Bulk product creation/import, barcode entry/scanning fallback, multiple images, variants, SKU and inventory.
- Product review/publishing states.
- Orders, seller fulfilment actions and delivery handover.
- Earnings, ledger and payout history.
- Subscription/plan management.
- Notifications and support/messages.
- Team/staff access as a later permissioned capability.

The tracker currently records product variants/multiple images, seller orders, earnings and payouts as incomplete. Do not present these as finished merely because navigation placeholders exist.

## 8. Shared web and app account/store experience

The website is the first implementation and test surface. The Android app must later:
- Offer the same **Become a Seller** entry from the profile.
- Use the same screen sequence, country-aware rules and verification statuses.
- Read and update the same backend application/store records.
- Show every store the signed-in user is authorised to manage.
- Open the mobile seller hub with the same store identity, products, plan and status as the web portal.
- Avoid a second account or duplicate store registration.
- Respect server-side role, store-membership and RLS checks.

Create or extend a shared API/status contract before app parity work so web and app do not invent different RPC names, payloads or status labels.

## 9. Security, privacy and country expansion

- Location, phone, identity, face and proof-of-address data are sensitive. Collect only what is necessary, explain purpose and retention, and obtain appropriate consent.
- Use private storage and least-privilege access. Admin review access must be audited.
- Never trust client-supplied verification status, store role, subscription tier, location or plan price.
- Apply server-side validation, RLS and explicit authorisation for every read/write.
- Use country configuration for supported identity documents, phone providers, currencies, regions, legal terms and plan availability.
- Complete legal/privacy review for each country before enabling identity/biometric checks or seller payouts there.
- Nigeria is the initial market. Additional countries are enabled through configuration and operational readiness, not by assuming all providers work globally.

## 10. Web-first delivery sequence

1. Shopper app-handoff route with verified-download configuration.
2. Seller entry routing: signed-out, existing seller, draft applicant and new applicant.
3. Screen-by-screen onboarding shell, progress, draft persistence and category selection.
4. Store name and country-aware location with manual fallback.
5. Store bio and optional logo/cover upload.
6. Phone verification integration and honest unverified state.
7. Country-aware identity/face/address verification integration, with skip and pending states.
8. Review/submit and admin review round trip.
9. Four plan cards driven by real plan configuration; Basic path.
10. Seller portal landing and store context.
11. Staging end-to-end tests and responsive/mobile checks.
12. Only after web acceptance, implement mobile parity using shared contracts.

## 11. Acceptance criteria

- Customer Shop route never exposes a web cart/checkout and shows only verified app download links.
- Seller entry handles signed-out, existing store, saved draft and new applicant correctly.
- Onboarding is navigable, keyboard accessible, mobile responsive and resumes saved drafts.
- Category choices and store-name uniqueness are server-backed.
- Location permission is optional; manual correction/fallback works.
- Country/region codes are saved consistently.
- Logo and cover are optional and stored safely.
- Phone shows verified only after real provider confirmation.
- Identity, face and address checks show independent truthful states; skipped checks remain Not verified.
- Proof-of-address is separate from delivery address.
- Plan information is backend-configured; no fake subscription/payment success.
- Submitted applications appear in the admin queue and seller sees the real decision/status.
- Store data is shared across web and app for the same account.
- RLS tests prove one seller cannot read or mutate another seller's private data, documents or store.
- Tests run on staging only until explicitly promoted; no live customer data is used for development.

## 12. Explicitly pending dependencies

- Approved geocoding provider and country/region dataset.
- SMS/OTP provider, sender registration and country coverage.
- Identity verification and liveness provider, legal basis and retention policy.
- Private proof-of-address storage and admin review policy.
- Four approved plan definitions and billing/payment behaviour.
- Verified Google Play, other platform and GitHub release destinations.
- Country-specific seller terms, privacy notice and document acceptance rules.
