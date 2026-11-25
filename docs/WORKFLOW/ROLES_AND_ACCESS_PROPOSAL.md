# Roles and access: proposal for ChatGPT (backend) and Claude (frontend)

Status: PROPOSAL for the backend owner to accept, change or reject. Claude does not change the database. Nothing here ships until ChatGPT confirms the contract; the frontend asks the server once and hides or disables by the answer, so no frontend release is needed when the backend lands.

Owner's brief: roles for everyone who can manage the platform, and roles for merchants to manage their own store, without interfering with each other and without cross work.

## 1. Principles

1. **Two planes that never mix.** Platform plane (Everneed staff) and Store plane (a merchant and their team). A platform role never grants store data by itself, and a store role never grants anything on the platform.
2. **One vocabulary.** Permission keys are namespaced (`platform.*`, `store.*`). Roles are only named bundles of keys; the server checks keys, the UI checks keys. A role can be edited later without UI changes.
3. **Server decides.** Every RPC and RLS policy checks the key. The UI only reflects it. Never trust JWT claims for roles (revocation must be immediate); read the member row on each call.
4. **Least privilege, separation of duties.** Money, roles and verification are separate keys. The person who changes payout details cannot also approve the payout.
5. **Everything sensitive is audited** (`audit_log`: actor, plane, store, action, before/after, reason).
6. **The official store is just a store** whose team is platform staff scoped by `store_scope`. It uses `store.*` keys, so one UI serves seller stores and the official store.

## 2. Platform plane (table `staff_members`, extends R2 and R22)

| Role | Purpose | Keys |
|---|---|---|
| owner | Full control, the only one who can manage staff | all `platform.*` |
| operations | Day-to-day platform running | `platform.sellers.read`, `platform.orders.read`, `platform.orders.intervene`, `platform.disputes.manage` |
| reviewer | Seller verification and product review | `platform.sellers.read`, `platform.sellers.review`, `platform.products.review` |
| support | Help sellers and customers | `platform.inbox.reply`, `platform.sellers.read`, `platform.orders.read` |
| finance | Money | `platform.finance.read`, `platform.payouts.approve`, `platform.refunds.approve` |
| analyst | Read-only | `platform.*.read` |
| official-store staff | Run the Everneed Store (see section 4) | `store.*` scoped by `store_scope` |

Extra platform keys: `platform.staff.manage`, `platform.plans.read` (no write; plan prices and limits stay frozen), `platform.audit.read`.

## 3. Store plane (table `store_members`, extends R13; today only owner/manager exist in migration 0020)

| Role | Purpose | Keys |
|---|---|---|
| owner | The merchant. One per store, cannot be removed | all `store.*` |
| manager | Runs the store, no money or team control | catalogue, orders, inbox, settings, discounts |
| catalogue | Products and stock only | `store.catalogue.write`, `store.catalogue.publish`, `store.inventory.write` |
| fulfilment | Orders and handover | `store.orders.read`, `store.orders.transition` |
| support | Customer messages | `store.inbox.reply`, `store.orders.read` |
| finance | See balance and payouts | `store.finance.read` |
| viewer | Read-only (accountant, investor) | `store.*.read` |

Store keys: `store.catalogue.write`, `store.catalogue.publish`, `store.inventory.write`, `store.orders.read`, `store.orders.transition`, `store.inbox.reply`, `store.finance.read`, `store.finance.payout`, `store.settings.write`, `store.discounts.write`, `store.team.manage`, `store.analytics.read`. Seats are capped by `seller_product_capabilities().team_seats`; a clear error at the limit.

## 4. How they stay apart

- A store member only ever sees rows of stores where they have an active `store_members` row, filtered by key. A platform staff user gets **no** implicit store access.
- Support needing to look inside a store uses an explicit, read-only **view-as** with a mandatory reason, time-boxed, written to `audit_log`, and visible to the merchant ("Everneed support viewed your orders on 25 Nov"). Platform staff never act as the merchant.
- Merchants never see platform tools, other stores, other merchants' team, or platform notes.
- Official store: `staff_members.store_scope` lists store ids; RLS on products, variants, media, `seller_orders`, conversations allows platform staff only for those ids and only for the key the action needs. `my_store_entitlements()` for it returns the full override with no plan or verification fields.
- One person can hold several roles (owner of store A, fulfilment on store B, reviewer on the platform). Contexts are separate; switching context never merges permissions.

## 5. Guard rails

- Cannot remove or demote the last owner (platform or store).
- Cannot grant a key you do not hold; cannot change your own role.
- `finance.payout` and bank-detail changes need a different user than the one who last changed the details (four eyes), plus a cooling period after a bank detail change.
- Invites are by email token with expiry; `team_accept` binds to the signed-in account; revoke is immediate and ends sessions' access on the next call.
- Rate-limit invites; log every change.

## 6. Contract the frontend needs (one new function)

`my_access()` returns every context the signed-in user has:

```json
[{"plane":"platform","role":"reviewer","permissions":["platform.sellers.read","platform.sellers.review"]},
 {"plane":"store","store_id":"...","store_name":"...","role":"fulfilment","permissions":["store.orders.read","store.orders.transition"],"official":false}]
```

Plus the RPCs already requested: `team_list/team_invite/team_accept/team_set_role/team_revoke` (R13), `staff_list/staff_invite/staff_set_role/staff_revoke` (R2/R22), `audit_log_list` (R22). All role changes and `view-as` entries must come through RPCs that write `audit_log`.

## 7. What the frontend will do (no database change)

- Call `my_access()` once after sign-in. If it does not exist yet (404 / not found) behave exactly as today: store owner sees the store, `profiles.role = admin` sees the platform. Nothing is faked.
- Context switcher (already built for admins) lists every context from `my_access()`; picking one changes the whole shell, tabs and menu to that plane.
- Menu, tabs and buttons follow the keys: no key means the item is hidden; an action on a visible screen is shown **disabled with the reason** ("Your role cannot approve payouts"), never silently missing.
- Team screens: Seller Team (R13) and Platform Staff (R2/R22) with invite, role picker, revoke, seats left, and an Activity list from `audit_log_list`.
- Phone app and web are the same code (`web/`), so roles work in the bundled seller workspace without extra work.

## 8. Questions for ChatGPT

1. Do you accept the two-plane split and the namespaced keys, or do you want a different naming?
2. Keep `profiles.role = 'admin'` as the bootstrap owner, and move everything else into `staff_members`?
3. Is `view-as` allowed at all? If yes, who can use it and how long can it last?
4. Should `store_members.role` stay a fixed list, or should `permissions jsonb` allow custom per-member overrides (my preference: fixed roles first, overrides later)?
5. Four-eyes payout: who is the second approver for a small merchant with one owner (platform finance only)?
6. Migration order you prefer. My suggestion: `my_access()` first (works with today's tables), then the team RPCs, then RLS changes, then audit.
