# Migration history (not replayed)

These three files are the exact SQL of live migrations that were applied to the live database but never had a file in this repository. They were recovered on 12 Nov 2026 from `supabase_migrations.schema_migrations.statements` and are kept here **unchanged** as a historical record.

**They are deliberately outside `supabase/migrations/`, so the Supabase CLI never replays them.** The CLI orders migrations by version number, and these three were applied live *between* `002` and `004`, a slot that cannot be expressed with the three-digit numbering used in `supabase/migrations/`. Putting them in the chain made staging run `0030` after `003` had been meant to remove its tables, and `004` then failed with "already exists".

| File | What it did live | Why it is safe to leave out of a rebuild |
|---|---|---|
| `20261029044105_multivendor_foundation.sql` | Created `stores`, `store_members`, `order_items`, `seller_orders`, `fulfilment_batches` and two helper functions (all empty) | `003_remove_unrecorded_multivendor` drops all of it again, and `004_marketplace_core` recreates what the marketplace needs |
| `20261029044131_multivendor_function_grants_hardening.sql` | Changed grants on the two helper functions | The functions are dropped by `003` |
| `20261029134730_signup_profile_fields.sql` | Redefined `on_signup()` to save date of birth and photo at sign-up | **Not safe to leave out.** Nothing else in the chain adds those two fields. Its effect is carried by `supabase/migrations/016_signup_profile_fields.sql`, which sets `on_signup()` to exactly this definition |

Verified on 12 Nov 2026: live has none of the `store_members` or `fulfilment_batches` tables and none of the two helper functions, and live's `on_signup()` is identical to the definition in the third file.

The file names are the live version numbers (timestamps), which is how Supabase records them.
