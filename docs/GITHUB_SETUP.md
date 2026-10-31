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
Replace the files (including deletions) without touching git history, then push the same branch:
```bash
git checkout marketplace-build
unzip -q ../Everneed01.zip -d /tmp/en
rsync -a --delete --exclude .git /tmp/en/Everneed01/ ./
git add -A && git commit -m "Phase N"
git push
```

## Where the APK is
1. GitHub, **Actions** tab, open the newest run for your branch. The run summary says where the APK is.
2. **Releases** tab: a pre-release named `EverNeed build <number> (<branch>)` with `EverNeed.apk`. Open it on your phone and install.
3. The same run also keeps it under **Artifacts** as `everneed-apk` (zip).
Each build has a higher version number, so it installs over the last one. A newer push to the same branch cancels the older run.

## What the jobs do
| Job | Blocks the APK? | What it checks |
|---|---|---|
| Install and test | yes | JS syntax, JSON, script tags, no removed dropshipping terms (`npm test`) |
| Database tests | no (until proven on GitHub) | starts a local Supabase, applies all migrations, runs `supabase/tests/phase2_checks.sql` |
| apk | n/a | generates the Android project with Capacitor and builds `app-debug.apk` |

## Rule for every future zip from Claude
Each zip must keep a working APK workflow and be pushable to a non-main branch to start it.
