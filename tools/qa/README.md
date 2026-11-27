# QA-01: 360 px smoke, accessibility and bundle budget

Runs in CI inside **Install and test** through the composite action `.github/actions/qa-smoke`. Owner: Claude 9.

| Check | File | Fails when |
|---|---|---|
| Smoke at 360 px | `smoke.mjs` | uncaught page error, console error, blank or error screen, horizontal overflow, any request reaching the production Supabase ref, touch targets under 44 px or axe violations **above the baseline** |
| axe canary | `axe-canary.mjs` | axe does not flag known-bad markup (so a blind axe can never report a false "0 violations") |
| Bundle budget | `bundle-budget.mjs` | eager JS+CSS (gzipped) over `budget.json` |
| Report | `report.mjs` | never; writes the Markdown that CI posts as one updating PR comment |

Supabase is stubbed (REST `[]`, RPC `null`); no real project is contacted.

## Run locally
```
mkdir -p web/assets/css web/assets/js && cp css/tokens.css css/fonts.css web/assets/css/ && cp -r fonts web/assets/fonts && cp js/theme.js web/assets/js/ && cp shared/*.js web/assets/js/
npm install            # playwright-core + axe-core (axe is skipped, with a notice, if missing)
node tools/qa/bundle-budget.mjs --site web
node tools/qa/smoke.mjs --site web        # screenshots and report.json land in tools/qa/out/
```

## Baseline
`baseline.json` holds the counts of known issues per route. The run fails only when a count goes up. When you fix issues, lower the numbers with `--update-baseline` in the same PR. axe is baselined at zero violations per route.

## When the budget fails
Do not raise `budget.json` first. Code used by one screen belongs behind `ds-lazy.js`, not in `index.html`. Raise the limit only with a reason in the PR.

## Not covered yet
Seller shell and admin (need a stubbed signed-in session), the root shopper app (`index.html` at the repo root), staging E2E (WEB-Q02, needs test accounts), real-device checks (APP-10).
