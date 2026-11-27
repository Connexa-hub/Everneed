# CX-01 Everneed-staging fixture handoff

**Target:** staging project `vjiadqygpyebpisxslbx` only. Created 27 Nov 2026. No production changes.

## Test identities (existing Auth accounts; no new accounts or credentials)

- Customer: `b1eb7804-30d2-4aaf-b580-688cd8a77b2c` (profile customer; email not confirmed)
- Admin: `9c3bd65b-4d23-42ca-838a-6eaca8133459` (profile admin)
- Seller Shopflow: `e8349848-7c00-454e-9f02-8616d233674c`, store `382b84b5-5bd9-4448-bd07-b0bada0121ca`
- Seller Testing: `f06d64d1-4c4c-4524-b288-418771341e7b`, store `23a664c8-0dd8-4129-8025-c1c9cc4cbb9f`

Role-authenticated SQL smoke tests set JWT claims for these existing IDs; this is a DB-level test harness, not proof of live browser sessions.

## Products

- Existing published product: Wallpaper `1f4010a6-d1ee-415c-92c5-e69931af6c6b` (Shopflow, NGN 30,000, original stock 10)
- QA product: `cx01-fixture-product` (Testing, NGN 1,000, stock 10, clearly titled “CX-01 fixture product”, seller insert then admin review/publish)

Each order has one item from each store, total NGN 31,000, route hub, customer delivery city Ikeja/Lagos. Checkout inventory reservations consumed 10 units of each product; staging available stock is now 0 for both. This is intentional fixture reservation, not a production stock change.

## Ten orders

| Fixture | Order ID | Payment | Current state |
|---|---|---|---|
| CX01-01 | `1af0eb00-a8f5-4c56-9e00-a11936849a23` | unpaid | awaiting_transfer |
| CX01-02 | `45fce55a-a7c7-4a3d-9e5a-6ce375b97ad0` | unpaid | awaiting_transfer |
| CX01-03 | `fdaf9ea0-a666-4bf8-87a2-5659d9213a2e` | unpaid | awaiting_transfer |
| CX01-04 | `cbf5b6af-7960-4108-a7c5-488f3628b121` | unpaid | awaiting_transfer |
| CX01-05 | `4b59946d-f0d1-436a-a79b-123ab5f57a1d` | unpaid | awaiting_transfer |
| CX01-06 | `13b95e5d-751f-4b35-a4ad-357d617aade3` | simulated-paid | Shopflow handover_pending; Testing cancelled via admin RPC (reversal/refund) |
| CX01-07 | `a4d0c42f-fe86-4d18-8b12-86c3226779dc` | simulated-paid | partial hub receipt: Shopflow at_hub; Testing handover_pending |
| CX01-08 | `5cb93362-9d03-405f-a5f0-ab3a0e4b91aa` | simulated-paid | both at_hub; consolidated |
| CX01-09 | `8c730b4e-2292-4068-a80b-68363917f605` | simulated-paid | both consolidated; dispatch attempted, blocked by orders_guard defect |
| CX01-10 | `10032bae-47e7-4901-91ec-305d57d39db2` | simulated-paid | intended hub issue; hub_receive blocked by missing notify_admins helper |

Paid fixtures were transitioned using the authenticated admin `admin_confirm_payment()` RPC; no payment/ledger status was directly written and no real Paystack transactions were run.

## Dispute

- Open dispute: `4d095dbf-de88-4f41-b73e-ba82dfaa1be9`
- Order CX01-10, Shopflow seller order `3470710b-67ff-452d-8d95-1255334e17d7`
- Created by authenticated customer insert under the RLS “disputes open” policy; reason clearly identifies it as a staging fixture.

## Finance entries so far

Payment confirmation created 20 legacy ledger entries (10 sale + 10 commission across both sellers), initially `pending`. Admin cancellation of the Testing seller order on CX01-06 exercised the approved reversal path, leaving 18 pending entries and 2 reversed entries. This also generated a partial-refund record. No manual ledger rows were fabricated.

CX01-09 was delivered through dispatch and customer confirmation. A payout/release test was attempted with a temporary payout-hold override, but the SQL mutation was blocked by safety controls and rolled back; no payout or available ledger rows were created. The live payout hold remains 3 days. Adjustment/rental kinds and the `available`/`paid` payout states still need a safe fixture path; do not fabricate direct rows.

## Blockers / handoff

- PR #62 fixes `hub_receive()` issue notifications (`private.notify_admins`) and dispatch's guarded `out_for_delivery` update; it also rejects blank courier names. Migration `20261127123000` is applied to staging and both RPCs have been verified against CX01-09/CX01-10.
- PR #61 CX-04 is its base and must merge first. PR #62 CI is green (Database tests, Install and test, migration order) on current head `0fdf05ce`.
- CX-02 `my_access()` remains absent from staging and depends on corrections to PR #49.
- CX-04 narrow TRUNCATE/TRIGGER/REFERENCES revocation is applied and verified on staging via #61. Broad DML/default ACL review remains incomplete.
