# Claude 2 integration direction — R23 universal access and safest app shell

**Date:** 25 November 2026  
**From:** ChatGPT / Codex (backend, security, integration review)  
**To:** Claude 2 (app shell and integration)  
**Branch:** `web-portal` only  
**Status:** ACCEPTED DIRECTION / IMPLEMENTATION HANDOFF  
**Environment:** Everneed-staging for verification; production remains protected.

## Decision

Yes: build Claude 2's app-shell and web-in-app integration toward the newer owner-approved **universal modular platform architecture** and accepted **R23 unified access** contract. Do not build another owner-only or role-name-based authorization system. Do not invent a second permissions registry.

The four-agent review remains the integration baseline. Claude 2 owns the shell, packaging, route base, environment stamping, native adapters and session coordination. Codex owns backend authorization, migrations, RPCs, RLS and security tests.

## Canonical access direction

R23 in `SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md` is **ACCEPTED**. Canonical contract is the two-plane proposal in `ROLES_AND_ACCESS_PROPOSAL.md` and `EVERNEED_UNIVERSAL_PLATFORM_ARCHITECTURE.md`:

- A single read-only `public.my_access()` returns all active platform/store contexts, fixed role templates, canonical permission keys and scoped store metadata for the signed-in user.
- The access response is descriptive, not an authorization token. It never grants, mutates, elevates, impersonates or broadens access.
- Backend RPC/RLS guards remain authoritative on every read/write. UI context selection is presentation state only.
- Canonical permission vocabulary follows the accepted proposal (e.g. `store.catalogue.write`, `store.orders.transition`, `platform.staff.manage`). Do not hardcode role names as authorization conditions.
- Initial release uses fixed role templates only. No custom permission overrides, view-as, auto-owner assignment or client-side self-grant.
- Revocation/expiry must take effect at the next server authorization check. Unknown permissions and scope mismatch fail closed.
- Required security tests include unauthenticated, no-context, ownerless store, owner, store member, revoked/expired member, two stores, platform-only, store-only, legacy admin, cross-plane non-escalation, unknown permission, final-owner protection, no self-grant and scope mismatch.

## Critical current-state caveat

A read-only inspection of Everneed-staging `vjiadqygpyebpisxslbx` confirms `public.my_access()` is **not deployed yet**. Therefore:

1. Do not call it in the current build or treat a 404 as "no access".
2. Preserve the current compatibility fallback for now: authenticated `stores` read filtered by `owner_id = Supa.uid()`, plus the existing admin behavior.
3. Keep this fallback behind one access/context adapter so the later RPC can replace it without rewriting screens.
4. When Codex supplies the migration and staging test evidence, switch to `my_access()` behind a version/capability check; remove the fallback only after the accepted test matrix passes.
5. Never infer a store context from local storage, a URL, a cached role string or a client-side owner flag.

## Claude 2 implementation requirements

1. **One session across shells.** Define one canonical session key/adoption protocol, one refresh lock, token adoption and logout propagation. Prevent the shopper and seller Supabase clients from refreshing the same token concurrently. Native Google Sign-In is an adapter into the same Supabase session, not a second identity system.
2. **Access/context adapter.** Create one app-shell boundary for loading access contexts and selecting the active context. Current implementation uses the compatibility fallback above. Keep platform/store contexts distinct and pass only context identifiers to UI; backend still rechecks permissions.
3. **Route and bundle integrity.** Package every script, stylesheet, font, icon and runtime asset referenced by the seller web entry. Add build-time missing-asset failure. Runtime route base must support nested paths, direct open, reload, back/forward and Android Back without fragile string replacement.
4. **Environment isolation.** Use CI build stamping, never hostname inference inside Capacitor. Assert every non-`main` artifact uses staging ref `vjiadqygpyebpisxslbx`; production ref `zpgasfweaixwsktlueje` must be absent from staging APK/assets. `main` release remains a reviewed path only.
5. **Native adapter boundary.** Camera, notifications, geolocation, browser, lifecycle and future offline capabilities go through shared native adapters, not direct screen-specific plugin calls.
6. **Truthful states.** No fake team/dispatch metrics, balances, ETAs, order counts or permissions. Unimplemented APIs show unavailable; prototypes remain visibly MOCK and non-actionable.
7. **Shared visual language.** Consume the shared tokens/fonts/palettes and touch/accessibility rules. Do not fork another permission, status, money-format or component system.

## Acceptance gates

- CI proves staging bundle contains the staging Supabase project ref and no production endpoint.
- Asset/package checks prove every web dependency is present in the final APK.
- Browser tests cover nested route open/reload/history; physical Hot 70 test covers Android Back and app resume.
- Race tests cover simultaneous shell startup, refresh in either shell, expiry while navigating and logout in either shell.
- Access tests cover every R23 case above once `my_access()` is deployed. Before that, test the compatibility fallback and explicitly label R23 as pending backend deployment.
- No production migration, config or deployment is part of this task.

## Staging order-fixture status / integration dependency

Owner authorized 10 clearly identified staging fixtures: 5 unpaid checkout orders and 5 simulated-paid seller-queue orders, using existing test accounts. Staging currently has 4 Auth users, Shopflow with one published Wallpaper product (NGN 30,000, stock 10), and zero orders/seller_orders.

The existing checkout RPC is `create_order_with_financial_snapshot_v2(...)`; bank-transfer reporting is `report_payment(order_id, reference, note)`; the admin confirmation path is `admin_confirm_payment(p_order)`, which requires an authenticated admin context. Paid confirmation performs the real release/ledger/notification/audit side effects. Do not bypass it by direct SQL updates or invent a Paystack reference. A service-role SQL session cannot safely stand in for the authenticated customer/admin session. We will use the real staging app/admin UI or a dedicated test-only provider/authenticated harness, clearly marked TEST, for the paid half. Record order IDs, test labels, stock before/after, ledger/audit effects and cleanup outcomes. Production is not to be queried or changed.

## Required response from Claude 2

Append an implementation response here or in the app-shell handoff with:
- files/commits changed;
- exact access adapter and session-lock contracts;
- route/environment/package test evidence;
- what remains blocked on Codex's `my_access()` migration;
- device evidence or explicit not-tested status.

Do not mark the work DONE until the acceptance gates are evidenced.
