# Everneed branch guide
Status checked 22 Nov 2026. Branches are development snapshots, not separate apps or databases. Keep production protected and merge only through reviewed pull requests.

## Current branches
- `main`: stable/default branch. Treat as protected and do not use for unfinished changes.
- `web-portal`: current web application baseline/working branch. PR #32 targets this branch; it contains the web-first project direction.
- `feature/variant-checkout`: isolated integration branch for variants/inventory checkout, payment and finance hardening. It is the current active draft PR #32 branch; not merged. Latest work includes FIN-02A and migration 056 checkout-expiry draft.

## Legacy branches not currently listed as active remote branches
- `feature/multivendor-cleanup`: historical clean multi-vendor refactor branch created to remove the former external fulfilment connector and preserve marketplace features. Branch search did not find it now; treat it as archived/deleted, not current.
- `everneed01`: historical branch based on a separate phase-2 build. User previously said it was no longer useful. Branch search did not find it now; do not revive.
- Other experiments/variants: if not found in current branch list, they are not assumed active.

## Recommended workflow
1. Start web features from `web-portal`.
2. Isolate risky DB/payment/inventory work in a feature branch and open a draft PR targeting the intended baseline.
3. CI + staging evidence + docs before merge.
4. Only owner-approved PR merges advance the baseline. Never merge/deploy production automatically.
5. Android build workflow remains paused while web-first development continues.
