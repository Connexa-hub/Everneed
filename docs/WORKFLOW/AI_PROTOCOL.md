# AI protocol: how everyone works on Everneed

Read this before touching anything. Several AIs and the owner push to this repo. These rules keep it clean.

## The 8 rules
1. **Pull first, every time.** All development happens on `web-portal`. Fetch the latest `web-portal` before reading or editing, and inspect `main` for release changes. If `main` contains a hotfix not yet on `web-portal`, bring it across with a reviewed PR from `main` to `web-portal`; do not force-push or edit `main` directly.
2. **One task, one claim.** Open `WEBSITE_TRACKER.md`, find your task ID, change its status to `IN PROGRESS`, fill `Owner` and `Branch`, and push that one-line change **before** you start. If a task is already `IN PROGRESS` by someone else, pick another.
3. **Small commits.** One concern per commit. Message format: `area: what` (for example `web/admin: orders list`). Never mass-reformat a file.
4. **Never rewrite a file you did not read in this session.** Read it, change the smallest part, push using the file's current SHA so a concurrent change is rejected rather than overwritten.
5. **Database changes go through a migration file.** Write `supabase/migrations/NNN_name.sql` first (next number is in `DB_CONTRACT.md`), then apply it, then record it in the change log in `DB_CONTRACT.md`. Never change the live database without a file in the repo.
6. **Shared things live in `shared/`.** Config, icons, art, the Supabase client and any helper both the app and the website need. Do not copy them into `web/` or `js/`.
7. **Do not mark a task `DONE` until it is verified.** Verified means: CI is green, you checked the screen at phone width and desktop width, and the owner (or you, with evidence) confirmed it works against the real database.
8. **Leave the tracker true.** When you finish, update the row (status, commit, notes) and the `Last updated` line. If you find something broken or missing, add a row. Do not hide it.

## Branches and release flow
| Branch | Purpose |
|---|---|
| `web-portal` | The single development and integration branch for **both the app and website**. All developers and AIs edit, test and confirm work here. |
| `main` | The reviewed release/production branch. It receives confirmed changes from `web-portal` through pull requests. Cloudflare Pages production deploys from `main`. |

There is one codebase and one shared project workflow: the app and website are both maintained in this repository and on `web-portal`, then included together in `main`. Do not create or use a separate app-development branch.

### Required release cycle
1. Claim a task in `WEBSITE_TRACKER.md` and work only on `web-portal`.
2. Run relevant checks and build the app/site preview from `web-portal`.
3. Confirm the change against the real database where applicable; request owner confirmation for user-visible or account-sensitive changes.
4. Update the tracker with evidence, commit SHA and any remaining limitations.
5. Open a pull request from `web-portal` into `main`.
6. Merge only after required CI checks pass and the change is confirmed. Cloudflare production deploys from `main`.
7. If a production hotfix is made on `main`, open a PR from `main` back into `web-portal` so the development branch does not lose it.

Never claim the branches are identical unless their commit histories confirm it. They are expected to differ between releases.

## Statuses
| Status | Meaning |
|---|---|
| `TODO` | Not started, unclaimed. |
| `IN PROGRESS` | Claimed. Has an owner and a branch. |
| `PARTIAL` | Some of it works. The notes say exactly what is missing. |
| `BLOCKED` | Cannot continue. The notes say what is needed and from whom. |
| `NEEDS OWNER` | Only the owner can do it (dashboard setting, secret, account). |
| `DONE` | Verified, with the commit that finished it. |

## Before you push (checklist)
- [ ] I pulled and read the files I changed in this session.
- [ ] Every script I touched passes `node --check` (CI also does this).
- [ ] All user text is escaped (`Core.esc`) before it goes into `innerHTML`.
- [ ] The website works at 360px wide and at desktop width; the Android app build/install and key flows are checked where relevant. No sideways scroll.
- [ ] It works in light, dark and AMOLED.
- [ ] If it talks to the database, the call is listed in `DB_CONTRACT.md` and RLS lets the right role do it.
- [ ] The tracker row is updated.

## Do not
- Do not commit secrets, keystores or service-role keys. The anon key in `shared/config.js` is public by design; nothing else is.
- Do not add a build tool or framework without the owner agreeing.
- Do not delete or rename another AI's files without a tracker row explaining why.
- Do not add a Content-Security-Policy yet. The site uses inline scripts and would go blank.

## If something breaks on the live site
The site has a boot screen (`web/assets/js/boot.js`). It prints the failing file and line. Fix that file only, push, and add a row to the tracker under `Foundation` describing what happened.


## Universal modular platform direction (owner-approved)

Before adding a new role, department, app, logistics workflow, POS or integration, read `EVERNEED_UNIVERSAL_PLATFORM_ARCHITECTURE.md`. Do not hardcode role names as authorization rules or create isolated permission systems per app. Use permission keys, explicit context scopes, backend enforcement, versioned configuration and shared domain contracts. New roles should be assignable from the safe permission registry; new capabilities that require backend code/security checks still require reviewed implementation and tests. Dispatcher/logistics, tracking, courier, support, POS and future applications are planned as modules sharing platform core. This is a long-term architecture: implement progressively and do not ship speculative infrastructure or production migrations without staging review and owner approval.


## AI-to-AI communication: documents are the channel (owner-approved, 25 November 2026)

ChatGPT (backend, security, contracts, coordination) and Claude (frontend, app shells, UX) cannot talk to each other directly. Everything that one needs from the other goes through files in `docs/WORKFLOW/`, on `web-portal`.

1. **Read before you work.** At the start of every session, and again before any push, pull `web-portal` and read the other AI's newest handoff and any doc changed since your last commit (`git log --since` or `git diff <your last commit>..HEAD -- docs`). Never work from memory of an earlier state.
2. **Write after you work.** Every feature, contract change or decision ends with a handoff doc or an appended section: what changed, files, contracts (fields, events, permission keys, error codes), what is mock, what was tested, what could not be tested, risks, and what you need from the other side. Add or update the tracker row too.
3. **Name the owner of each ask.** Requests are numbered (Claude to ChatGPT: `SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md`, R-numbers; ChatGPT to Claude: a `*_CLAUDE_HANDOFF.md` or a section in the feature's contract). Each has: what, why, who, status (OPEN, ACCEPTED, CHANGED, DONE, REJECTED). Answer an ask by changing its status in the same file and saying why, not in chat.
4. **Follow the other AI's accepted contract.** If a contract is marked ACCEPTED, build to it exactly. To disagree, do not silently deviate: add a dated CHANGE REQUEST under that contract and carry on with the accepted version until it is answered.
5. **Same words everywhere.** Permission keys, error codes, status names and table or function names are written exactly as in the contract. Never invent a second name. A new name is added to the contract first.
6. **Mark mocks and unknowns.** Anything not backed by a real function is labelled MOCK in the doc and in the UI and is never shown as live data. Missing backend means "not available" in the UI, not a fake success. A doc states plainly what has not been tested.
7. **Frontend never decides security; backend never decides design.** ChatGPT owns RLS, RPC guards, migrations and verification. Claude owns layout, flows, components and motion. Each can comment on the other's area through a handoff, not by editing it.
8. **Do not overwrite each other.** Append to the other AI's docs, do not rewrite them. Docs you own may be edited freely; say in the commit message when you change a contract section the other AI relies on.
9. **Staging and production.** Everything lands on `web-portal` and staging first. Environment differences (for example Everneed01 versus Everneed-staging) are recorded in a doc before anyone assumes parity. Production needs explicit owner approval.
10. **The owner is the tie-breaker.** Open disagreements are listed in the doc under "Needs owner decision" with both options and a recommendation, so the owner can answer in one reply.

Handoff template (copy into any new handoff): Summary, Files changed, Contracts (fields, events, permission keys, errors), Mock versus live, Tests run, Not tested, Risks, Needs from the other AI (with R-number and status), Needs owner decision.
