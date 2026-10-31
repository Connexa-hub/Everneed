# Push to GitHub and get an APK

The workflow `.github/workflows/build.yml` runs on **every push to any branch**. A push to your build branch
installs, tests, and builds a debug APK. You do not need to merge anything to get an APK.

## First time
```bash
unzip Everneed01.zip && cd Everneed01
git init -b main
git add . && git commit -m "Everneed01 baseline"
git remote add origin https://github.com/<your-user>/Everneed01.git
git push -u origin main                 # baseline
git checkout -b marketplace-build       # the branch you test from
git push -u origin marketplace-build    # starts the Action
```
Keep the repository **private**: it contains the debug signing key (`keystore/debug.keystore`).
If you push over HTTPS with a token, the token needs the `workflow` scope or GitHub rejects changes to `.github/workflows`.

## Every new zip
Unzipping on top of your folder **never deletes files**. Files a release removed stay behind and can break the checks (that is what stopped build 1 of Phase 2B). Every release has a `MANIFEST.txt` listing its files, and a cleanup script uses it. These commands work on Windows (Git Bash or PowerShell), Mac and Linux:
```bash
git checkout marketplace-build
# copy the contents of the unzipped Everneed01 folder over your project folder (overwrite when asked), then:
node tools/clean-stale.mjs            # shows files that are not part of this release
node tools/clean-stale.mjs --apply    # removes them
git add -A && git commit -m "Phase N" && git push
```
If you have rsync you can instead run `rsync -a --delete --exclude .git /path/to/Everneed01/ ./`.

### If the "Install and test" job fails with STALE
The message names the leftover files. Remove them and push again:
```bash
node tools/clean-stale.mjs --apply
git add -A && git commit -m "Remove files from older releases" && git push
```
The script also removes the two items Phase 1 retired: the old dropshipping function folder under `supabase/functions/` and `supabase/schema.sql`.

## Where the APK is
1. GitHub, **Actions** tab, open the newest run for your branch. The run summary says where the APK is.
2. **Releases** tab: a pre-release named `EverNeed build <number> (<branch>)` with `EverNeed.apk`. Open it on your phone and install.
3. The same run also keeps it under **Artifacts** as `everneed-apk` (zip).
Each build gets a higher version number (minutes since 1970), so it installs over the last one, even over an older EverNeed from a different repository. Open **Settings** or the **Appearance** screen: the last line shows `Build <n> · <commit> · <branch>`, so you can always tell which build is on the phone. A newer push to the same branch cancels the older run.

## What the jobs do
| Job | Blocks the APK? | What it checks |
|---|---|---|
| Install and test | yes | JS syntax, JSON, script tags, no removed dropshipping terms (`npm test`) |
| Database tests | no (until proven on GitHub) | starts a local Supabase, applies all migrations, runs `supabase/tests/phase2_checks.sql` |
| apk | n/a | generates the Android project with Capacitor and builds `app-debug.apk` |

## Rule for every future zip from Claude
Each zip must keep a working APK workflow, be pushable to a non-main branch to start it, and include an up-to-date `MANIFEST.txt`.
