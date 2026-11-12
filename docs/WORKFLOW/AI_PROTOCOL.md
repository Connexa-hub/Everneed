# AI protocol: how everyone works on Everneed

Read this before touching anything. Several AIs and the owner push to this repo. These rules keep it clean.

## The 8 rules
1. **Pull first, every time.** Before you read or edit, fetch the latest of your working branch and `main`. If `main` moved, bring it into your branch first. Never work from memory of an earlier session.
2. **One task, one claim.** Open `WEBSITE_TRACKER.md`, find your task ID, change its status to `IN PROGRESS`, fill `Owner` and `Branch`, and push that one-line change **before** you start. If a task is already `IN PROGRESS` by someone else, pick another.
3. **Small commits.** One concern per commit. Message format: `area: what` (for example `web/admin: orders list`). Never mass-reformat a file.
4. **Never rewrite a file you did not read in this session.** Read it, change the smallest part, push using the file's current SHA so a concurrent change is rejected rather than overwritten.
5. **Database changes go through a migration file.** Write `supabase/migrations/NNN_name.sql` first (next number is in `DB_CONTRACT.md`), then apply it, then record it in the change log in `DB_CONTRACT.md`. Never change the live database without a file in the repo.
6. **Shared things live in `shared/`.** Config, icons, art, the Supabase client and any helper both the app and the website need. Do not copy them into `web/` or `js/`.
7. **Do not mark a task `DONE` until it is verified.** Verified means: CI is green, you checked the screen at phone width and desktop width, and the owner (or you, with evidence) confirmed it works against the real database.
8. **Leave the tracker true.** When you finish, update the row (status, commit, notes) and the `Last updated` line. If you find something broken or missing, add a row. Do not hide it.

## Branches
| Branch | Purpose |
|---|---|
| `main` | What is released. Kept identical to `web-portal` after each merge. |
| `web-portal` | Website work in progress. Cloudflare Pages deploys from here (or `main`, owner's choice). |
| `everneed01` | App marketplace work. |

Website AIs work on `web-portal`. App AIs work on `everneed01`. Anything both need goes to `shared/` and is announced in the tracker.

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
- [ ] It works at 360px wide and at desktop width. No sideways scroll.
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
