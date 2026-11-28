# Trust and safety audit: verification and fraud-report queues
**Author: Claude 7 | 28 Nov 2026 | Read-only audit of staging (`vjiadqygpyebpisxslbx`) and the repo at `web-portal` @ `5840ed3`. Nothing was changed. Production untouched.**

## Result in one paragraph
A verification-cases view **already exists** (`/admin/sellers/verification` in `admin.js`), so no new queue is needed there. What is missing is a way for an admin to **review** a check (no function writes the reviewer columns) and an entire **fraud / abuse report** capability (no table, function or policy). Both are backend work. Until they exist, the only honest UI is the existing read-only verification tab and, for reports, nothing. I will build no fraud-report screen that implies data exists.

## What exists today
| Area | Found on staging | Evidence |
|---|---|---|
| `store_verification_checks` | 15 columns including `status`, `provider`, `provider_outcome`, `reviewed_by`, `reviewed_at`, `safe_note`, `is_sandbox`. **0 rows.** RLS on, one SELECT policy: owner of the store or `is_admin()`. Grant to `authenticated` is **SELECT only** | catalog queries 28 Nov |
| `seller_verification_rules` | 7 columns, 4 policies, RLS on | catalog query |
| Writers of `store_verification_checks` | Only `request_store_activation(p_store)` (SECURITY DEFINER, authenticated). **No function sets `reviewed_by`, `reviewed_at` or a review outcome** | function-body search |
| `admin_set_verification_scope(country, check_type, scope, reason)` | Edits which checks are required per country; admin-only; not a case review | function list |
| Fraud, abuse, report, flag, moderation tables | **None** (searched `public` for verif, fraud, report, flag, abuse, risk, kyc, moderat, block, suspen) | catalog query |
| Report-like functions | `report_payment(order_id, reference, note)`: a customer payment self-report on the legacy payment path, **not** a fraud report. `suspend_store(p_store, p_reason)`: admin store suspension (exists, used by the Stores tab) | function list |
| Provider functions | `record_verified_provider_event`, `settle_verified_payment_attempt`: authenticated has **no** execute; correct | function list |

Good news worth keeping: unlike `disputes` (CX-04), `store_verification_checks` has no write grant for `authenticated`.

## The existing verification view (`admin.js`, `verificationTab`)
Read-only. Per store with plan-required or mandatory checks it shows each check's status, provider, reviewer (short id or "provider"), last update, safe note and next action, plus an audit-history toggle from `audit_log`. It says results are recorded by the provider or an authorised review, never from the screen.
Gaps, none of them mine to fix in `admin.js`:
1. Old markup (not the design system). Claude 4 owns the Sellers tabs.
2. `store_verification_checks?select=*` is read **without a limit**. Fine at 0 rows; cap it before real volume.
3. There is no reviewer action, because there is no backend for one (BR-AD11-03).
4. With 0 check rows every required check shows `not_started`. That is true, but staging has no provider-recorded example, so the `pending`, `needs_attention`, `expired` and `verified` states cannot be seen against real data.

## BACKEND REQUEST BR-AD11-03: review a verification check (Codex)
- **Workflow:** an admin or authorised reviewer records a manual outcome for a check the provider cannot settle (for example `business_address`), with a safe note.
- **Inputs:** `p_store text`, `p_check text` (one of the existing check types), `p_status text` (`verified` | `needs_attention` | `expired`), `p_note text` (required, 3 to 300 chars, no personal data).
- **Permissions:** admin only (or a named verification-reviewer role if CX-02 adds one), checked server-side. The seller can read, never write.
- **States:** a manual decision must not overwrite a provider result for `identity` or `face_liveness`; refuse with a clear error. Sandbox checks (`is_sandbox`) must never count as real verification.
- **Errors:** not found, not permitted, illegal transition, provider-owned check, note too short.
- **Idempotency:** same status twice returns the current row; lock the row.
- **Side effects:** set `reviewed_by`, `reviewed_at`, `safe_note`; `audit_log` row (`target_id` = store id, `after` holds the reason); notify the seller; re-evaluate activation using the existing `request_store_activation` rules, never duplicated.
- **Owner decision needed:** may a human ever mark identity or face checks verified? (compliance question, default: no.)

## BACKEND REQUEST BR-AD11-02: report and flag intake (Codex)
There is nothing to build a fraud-report queue on. Proposal for review, not for implementation by me:
- **Workflow:** a signed-in customer or seller reports a store, product, order or message; an admin triages (open, investigating, actioned, dismissed) and records an outcome; any enforcement uses the **existing** functions (`suspend_store`, product review), never a hidden side effect of closing a report.
- **Table:** `trust_reports(id, reporter_id, target_type, target_id, category, details, status, resolution, resolved_by, resolved_at, created_at)`. `category`: counterfeit, not_as_described, scam, prohibited_item, harassment, payment_fraud, other. `details` 10 to 1000 chars.
- **Writes only through functions:** `report_trust_issue(p_target_type, p_target_id, p_category, p_details)` (any signed-in user, not on own store) and `admin_resolve_report(p_report, p_to, p_note)` (admin only). No direct INSERT/UPDATE/DELETE grant for `authenticated`.
- **Reads:** admin all; the reporter their own; the reported seller sees **nothing** about who reported.
- **Abuse limits:** per-reporter daily cap (suggest 10) and one open report per reporter and target.
- **Side effects:** `audit_log` row; optional notification to the reporter on closure (no outcome detail beyond "reviewed").
- **Owner decisions needed:** categories, whether the reported seller is told, retention period for reports and reporter identity, and who may act on payment-fraud reports (finance, not support).

## What I will and will not build
- **Will, after the contracts exist:** an admin reports queue and case view, a reviewer action on verification cases, each modelled on the disputes page (honest states, read first, actions only when a function exists).
- **Will not:** a fraud or risk score, a "suspicious sellers" list, or any metric derived from guesses. There is no data to base one on.
- **Now:** nothing to ship here. This document is the deliverable.

## Related finding (not a trust-and-safety item)
Admin overview rows "Open disputes" and "Delivery exceptions" and the tile "Open disputes" are built without a link in `ds-admin.js` (and `kp()` in `admin.js`), so they do nothing when tapped. Claude 4 owns those files. Suggested one-line changes once `/admin/disputes` is merged: add `href:"/admin/disputes"` to the disputes row and tile; link "Delivery exceptions" to `/admin/hub` only after the hub section is registered. Linking before the pages exist would only move the dead end.
