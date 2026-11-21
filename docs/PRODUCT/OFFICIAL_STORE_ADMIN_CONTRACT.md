# Everneed Official Store — Platform Administration Contract

**Status:** Approved product direction; implementation pending  
**Target branch:** `web-portal`  
**Environment:** Staging only  
**Production:** No production changes; do not merge PR #31 until the complete release gate passes.

## 1. Decision and ownership

The Everneed Official Store is a platform-owned storefront, not a normal seller account.

- The platform owns the store identity and catalogue.
- Platform Admin is the only role allowed to manage its configuration and operations.
- It must not require seller registration, seller onboarding, a seller subscription, seller payout setup, or seller-tier entitlements.
- Ordinary sellers must never be able to claim, edit, suspend, delete, or change the official status of this store.
- Shoppers can browse and purchase its products through the same trusted marketplace order experience as other stores.

## 2. Existing staging record — preserve, do not duplicate

Staging inspection found an existing row:

| Field | Value |
|---|---|
| `stores.id` | `everneed-official` |
| `slug` | `everneed` |
| `name` | `EverNeed` |
| `status` | `approved` |
| `is_official` | `true` |
| `owner_id` | `NULL` |
| Store application | None |
| Products currently linked | 0 |

This row is already the platform-owned official-store shell. Preserve its primary key and slug. Do not insert a second official store and do not recreate the row merely because a previous login/account was deleted. Before any data migration, inspect foreign-key references and existing product/order records in both staging and production; do not infer production state from staging.

The database seed/backfill migration 005 also defines `everneed-official` as the official store ID. Keep application code, tests, and migrations consistent with that canonical ID.

## 3. Contact email and verification

The proposed public contact email is `everneed@zohomail.eu`. It is a candidate contact address, not a verified identity or login account.

- Platform Admin controls the contact address in the official-store settings.
- A change of address must invalidate the prior verification.
- Verification must use a time-limited, single-use challenge sent to the address, with server-side validation and expiry.
- Record verification state, verified timestamp, and the address verified. Never mark an address verified merely because an admin typed it.
- Admin may initiate/resend verification and inspect status; the system marks it verified only after successful challenge confirmation.
- Do not create a seller login or link this address as a store owner just to verify contact.
- Until verified, show the contact as unverified or omit the public email. Do not show an “Email verified” badge.
- Email verification proves control of the mailbox only. It does not, by itself, establish legal business verification.

## 4. Public trust presentation

Display the store as **Everneed Official Store** (subject to final brand casing) with a distinct **Official store** indicator on:
- the storefront header;
- product cards and product detail seller information;
- the shop/store details section; and
- relevant order seller summaries where the seller identity is shown.

Show **Email verified** only when the current public contact address has passed the verification flow. Keep official ownership and contact-email verification as separate statuses. Do not expose internal verification evidence, tokens, admin IDs, or audit metadata to shoppers.

## 5. Admin capabilities

Provide an Official Store section within Platform Admin, protected by the existing platform-admin authorization system. It should support:

- view current store identity and status;
- edit name, tagline, about, logo, cover, accent, categories, location and public storefront details;
- manage public contact email and initiate/resend verification;
- view contact verification state and timestamp;
- manage official catalogue products, pricing, inventory, publication state and collections using existing product workflows;
- control storefront visibility/status;
- view relevant store orders and fulfilment state through existing order tools; and
- view an audit history of privileged changes.

Use existing product/order workflows and validation wherever possible. Do not create a parallel catalogue, order system, wallet, or payment flow for the official store.

## 6. Privileges and limits

The official store is exempt from seller subscriptions and seller-tier product quotas because it is a platform-owned store. This exemption must be explicit and narrowly scoped to the canonical official store ID / trusted platform context, never a client-supplied `is_official` flag.

The store may receive platform merchandising privileges (for example, featured placement and official collections), but:
- do not silently boost ranking in ways that misrepresent relevance;
- do not bypass inventory, pricing, order integrity, payment, fraud, safety, delivery, refund, dispute, or consumer-protection rules;
- do not bypass audit logging or authorization;
- do not grant arbitrary database or finance privileges to the store; and
- do not allow official-store status to be assigned by seller-facing APIs.

## 7. Security and database requirements

Before implementation, inspect current schema, RLS policies, grants, RPCs, admin authorization helpers, product triggers, and audit-log conventions. Reuse existing secure patterns; do not invent parallel authorization.

If schema changes are required, create a new forward-only migration on `web-portal` and apply/test it only in the staging Supabase project. Never edit an already-applied migration.

Requirements:
1. Server-side authorization for every official-store admin mutation.
2. Deny ordinary authenticated users and sellers from changing `is_official`, `owner_id`, canonical ID, or protected store configuration.
3. Prevent deletion or reassignment of the canonical official store through seller flows and ordinary admin flows. If exceptional deletion is ever supported, require a separate high-privilege action with explicit safeguards and dependency checks; default behavior is protected.
4. Keep contact-email verification server-validated, expiring, single-use, and resistant to replay/enumeration.
5. Audit actor, action, target, timestamp, and safe before/after metadata for privileged changes. Never log secrets or verification tokens.
6. Ensure product create/update/publish operations for the official store are authorized by platform-admin role and continue to enforce all normal product and commerce validation.
7. Do not use a service-role key in browser code.
8. Add RLS/RPC regression tests for seller denial, customer denial, unauthenticated denial, authorized platform-admin success, email verification lifecycle, audit creation, and official-store deletion/reassignment protection.

## 8. Frontend and UX requirements

- Add a clear Platform Admin navigation entry: **Official Store**.
- Use existing design system and responsive patterns; keep mobile layout robust at 360–412 px.
- Avoid circular icon-only controls without clear labels; use accessible labels, loading, success and error states.
- No dead buttons, fake verification, placeholder success, fabricated metrics, or mock product/order data in production UI.
- Show an explicit “Not verified” state until the email challenge is completed.
- Keep admin-only controls out of shopper and seller interfaces.
- Reuse existing store/product/order components where practical.

## 9. Test and release gate

All work is staging-only. Required checks:
- migration applies cleanly to staging and is recorded once;
- official store remains exactly one canonical row;
- no duplicate store is created;
- public storefront and product seller labels identify the official store correctly;
- admin can edit permitted settings and manage products;
- seller/customer/anonymous attempts to mutate protected settings are denied;
- email verification succeeds only with a valid challenge and expires/rejects replay;
- changing email resets verification;
- audit records are written;
- official-store products do not consume seller plan quotas;
- stock, order, payment, fulfilment, refund and dispute flows remain intact;
- existing marketplace, Phase 1/2 database, RLS, RPC security, web and Android checks pass.

Do not merge PR #31 or deploy production until the complete staging end-to-end suite passes and the user explicitly approves release.

## 10. Claude implementation handoff

Implement this contract in the existing Everneed project on `web-portal`, using the existing `everneed-official` store row. First inspect the current admin architecture, schema, authorization helpers, audit conventions, store/product/order workflows, and current frontend routes. Report the concrete files and existing functions you intend to reuse before adding new abstractions.

Do not assume an email address is linked or verified. Treat `everneed@zohomail.eu` as the proposed contact address pending Platform Admin configuration and real verification. Do not create a new seller account. Do not create duplicate store records. Do not change production, merge PR #31, or weaken existing guards.

Implement backend security and tests before exposing admin UI. Add a migration only if required, and apply it only to staging. Preserve current customer and seller experiences. Update the project docs and report commit SHA, migration name/status, test results, and any unresolved decisions.
