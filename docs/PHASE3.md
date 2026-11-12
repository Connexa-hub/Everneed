# Phase 3, checkpoint A: stores, sellers and admin review

What a shopper, a seller and an admin can do now, and what is still to come in Phase 3.

## Shopper
- Every product card shows who sells it (a small avatar and the store name, with a tick for the official EverNeed store). Tapping it opens the store page.
- Store page `#/store/<link>`: cover, avatar ring (a coloured ring means something new was added this week), name, place, tagline, product count, rating, year, About, and that store's products. Share uses the phone's share sheet where available.
- Product page: a "Sold by" row linking to the store.
- The customer feed only ever shows **published** products. Sellers and admins can read their own drafts in the database, so the feed filters them out.

## Seller (`#/m`, reached from Me or Settings, "Sell on EverNeed")
- No store yet: an invitation, then a five-step application: store, about and location, delivery, payout, business and agreement. Each step is saved as you go, so you can stop and continue. The store link preview comes from the database (`next_slug`), so it is exact.
- Draft, under review, rejected (with the reason from the admin and a button to edit and resubmit) and suspended each have their own screen.
- Approved: a small dashboard (live, in review, draft and needs-changes counts, messages from EverNeed) and product management: add or edit a product with one photo, save as draft, submit for review, archive or restore. A rejected product shows the admin's note.
- Photos upload to `stores/<store id>/` only; the database refuses any other folder.

## Admin (Admin, **Sellers** tab)
- **Applications**: the owner, business, ID, bank details, categories, delivery areas and about text for each pending store, with Approve (optional note) and Reject (reason required).
- **Product review**: price, stock, registration number and description, with Publish and Ask for changes (reason required).
- **Stores**: every store with its status and rental; Suspend (reason required) and Reinstate.
- All of these call database functions that check the caller is an admin, notify the seller, and write the audit log.

## What the database enforces (not the screens)
A seller cannot approve a store, publish a product, make a store official, change a commission, read another store or any customer's details; the wizard only ever creates a **draft** store and a **draft** product. The UI test suite also checks that no request asks for `approved`, `published` or `official` from the seller side.

## Tests
- `supabase/tests/phase2_checks.sql`: 93 database checks (includes `next_slug`).
- `tests/ui/phase3_ui.py`: 34 end-to-end checks that run the real app in Chromium against an in-memory stand-in for the API (shopper, application wizard, admin approval, seller product, admin publish). Developer tool; needs Python Playwright; not part of CI.

## Still to do in Phase 3
Seller: orders list and the accept, prepare, hand-over flow; earnings, payouts and rental screens; store profile and settings editor; bulk product tools. Admin: hub board, payouts and rentals, refunds and disputes, policy settings. Shopper: store follow and report, cart grouped by seller with the route explanation, order tracking with the delivery code, store search and the Stores directory tab.
