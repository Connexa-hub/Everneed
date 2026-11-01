# Push to GitHub and get an APK

The workflow `.github/workflows/build.yml` runs on **every push to any branch**. A push to your build branch
installs, tests, and builds a debug APK. You do not need to merge anything to get an APK.

## First time
Zips unpack **flat** (no extra top-level folder), so unpack into the folder you want as the project:
```bash
mkdir Everneed01 && cd Everneed01
unzip -oq /path/to/Everneed01-<stage>.zip
git init -b main
git add . && git commit -m "Everneed01 baseline"
git remote add origin https://github.com/<your-user>/Everneed01.git
git push -u origin main                 # baseline
git checkout -b marketplace-build       # the branch you test from
git push -u origin marketplace-build    # starts the Action
```
Keep the repository **private**: it contains the debug signing key (`keystore/debug.keystore`).
If you push over HTTPS with a token, the token needs the `workflow` scope or GitHub rejects changes to `.github/workflows`.

## Every new zip (works in Termux on a phone, and on a computer)
Run this from anywhere. Change the branch name and the zip name to match:
```bash
cd ~/Everneed01 && git fetch origin && (git switch everneed01 || git switch -c everneed01 --track origin/everneed01) \
&& unzip -oq ~/storage/downloads/Everneed01-<stage>.zip \
&& sh tools/clean-stale.sh --apply \
&& git add -A && (git diff --cached --quiet || git commit -m "Phase update") && git push -u origin everneed01
```
- `unzip -oq` overwrites files but **never deletes** the ones a release removed. `tools/clean-stale.sh` does that using the release's `MANIFEST.txt`. Run it without `--apply` first to preview.
- A computer with Node can use `node tools/clean-stale.mjs --apply` instead.
- Do **not** unzip into a parent folder or open a nested folder: if you see a second `Everneed01/` folder inside the project, delete it (`git rm -r Everneed01`).

### If "Install and test" fails
The message says why. The common ones:
- `STALE` or `STALE FILE`: leftover files from an older release. Run `sh tools/clean-stale.sh --apply`, commit, push.
- `NESTED COPY`: a zip was unpacked one level too deep. Run `git rm -r Everneed01` (the folder named in the message), commit, push.

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
