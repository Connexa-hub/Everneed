# Seller onboarding, plan carousel, seller overview and admin overview: frontend report

**Branch:** `web-portal` (staging only). Not merged, nothing deployed to production, PR #31 untouched.
**Spec:** `docs/PRODUCT/SELLER_ONBOARDING_SIMPLIFICATION_AND_PLAN_SELECTOR.md`

## What changed

| File | Change |
| --- | --- |
| `web/assets/js/setup.js` | Store creation is now four short screens: Your store, What you sell, Plan, Send. No bank, identity, face, address, tax or verification content. One consent to the current seller policies (an `accept_policy` call per document), links to the full policies. |
| `web/assets/js/plans.js`, `web/assets/css/plans.css` | Plan carousel. Plans come from `store_plans`; if the backend later exposes `seller_plan_catalog` (same fields as `seller_plan_entitlements`) daily quota and verification inclusion appear automatically. Swipe (native scroll snap), mouse drag, arrow buttons, dots, keyboard (arrows, Home, End), live-region announcement of the focused plan. Depth is CSS transforms driven by scroll position, no WebGL. Reduced motion: no transforms, instant scrolling. |
| `web/assets/js/seller-flow.js` | Plan-directed screens for an approved store, the plan screen (`/portal/plan`) and the commerce-first overview. Wraps `V.portal` and falls back to the previous portal if `my_store_entitlements` is unavailable. |
| `web/assets/js/core.js` | Seller menu: Dashboard, Messages, Products, Appearance (no permanent Verification). Admin menu: Seller operations replaces Applications and Stores. |
| `web/assets/js/admin.js` | Overview shows business and operations metrics. Seller operations has four tabs: Applications, Stores and plans, Plan limits, Verification cases. |
| `web/index.html` | Loads `plans.css`, `plans.js`, `seller-flow.js`. |
| `tools/web-seller-tests/` | Repeatable harness (22 checks) that runs the page builders against real staging data shapes. |

Also fixed: the wizard Back action was named `sback`, the same as the admin Reinstate action. Because `admin.js` loads later, the wizard Back button called the admin handler. The wizard now uses `ssback`.

## Behaviour by plan (from the backend, nothing hard-coded)

- **Free, Starter:** after submission and approval the seller sees "Open my store". No verification wording anywhere in the path or the dashboard.
- **Growth, Pro:** once the subscription exists, `my_store_entitlements.verification_required_to_activate` routes to the included verification screens, one check per screen, with progress, status, provider and support states. The page never marks a check verified and never opens a store. "Check again" calls `request_store_activation`, and success is shown only if the server returns `activated`.
- **Mandatory regional checks:** shown only for rules the backend scopes as `mandatory_compliance` (or unclassified), with the exact check named in the message.
- The server decides live. The frontend never writes `activation_status`.

## Tests actually run

1. **JS syntax:** `node --check` on every changed script, all pass. Repo-banned terms scan: clean.
2. **Page-builder tests (22/22 pass):** `node tools/web-seller-tests/run.js`. Covers plan carousel markup and accessibility attributes, prices and limits from backend data, catalogue-aware daily quota and verification lines, fallback when the entitlements RPC is missing, Free and Starter routing (no verification wording), Growth and Pro routing, all-checks-verified path, plan applied from the application choice, plan chooser when none chosen, no false success on activation, live overview content and tasks, empty overview, plan-change message, admin live-store count (approved-not-live and official excluded), no verification KPI, Seller operations tabs, Free-only plan editor, plan limit validation, verification case list and audit-history control.
3. **Staging backend contract test (rolled back, no data kept):** as a throwaway authenticated seller: store and application insert allowed; 4 plans readable; 0 rows readable from `seller_plan_entitlements`; `choose_plan` saves `store_applications.plan_id` and rejects an unknown plan; `my_store_entitlements` before approval returns `configured:false, PLAN_NOT_SELECTED`; non-admin `admin_set_plan_entitlements` is refused; `submit_store` no longer references bank details.
4. **Byte-for-byte check:** git blob hashes of the pushed files match the tested local copies.

## Not tested (needs the owner, on real devices)

- Visual check in a browser on 360, 390, 412 px Android and desktop (no browser was available to the author). Please check: carousel swipe and depth effect, 44 px targets, dark and AMOLED themes, reduced-motion setting.
- A full click-through with a real new account: register, create store, choose plan, submit, admin approve, seller open store.
- Admin Free-limit save against the live RPC with an admin session.
- Cloudflare deploy of this branch and CI results.

## Backend items for ChatGPT

1. `approve_store` creates `store_subscriptions` with a NULL `plan_id` and ignores `store_applications.plan_id`. The frontend works around it by calling `choose_plan` with the seller's own earlier choice after approval (allowed while trialing). Better fix: copy the application plan into the subscription when approving.
2. Sellers cannot read daily quota or verification flags for plans they are comparing (`seller_plan_entitlements` is admin-only). Please add a seller-readable catalogue RPC, `seller_plan_catalog()`, returning `plan_id, active_product_limit, active_products_unlimited, daily_new_product_limit, daily_new_products_unlimited, verification_included, verification_required_to_activate`. Until then the cards omit those lines, and Growth and Pro verification screens start after approval, not before submission.
3. No RPC exists to start or record a verification check, so those screens show true statuses but cannot start a check. They say so plainly.
4. Pickup address and delivery zones are no longer collected during store creation. If hub orders need a pickup address before the first order, they should be collected as a task near the first order, or by a settings screen.
5. Admin Reinstate calls `approve_store`, which resets `activation_status` to `verification_required` (existing behaviour).
6. Two migration files are numbered 034 in the repository.
