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

There is one codebase and one shared project workflow: the app and website are both maintained in this repository and on `web-portal`, then included together in `main`. Do not create, use or refer to a separate app-development branch. The retired `everneed01` branch is not part of the workflow.

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
