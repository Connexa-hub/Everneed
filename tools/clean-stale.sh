#!/bin/sh
# Removes files that older releases left behind, using MANIFEST.txt. Needs only sh, find, sort and comm,
# so it works in Termux on a phone as well as on a computer.
#   sh tools/clean-stale.sh           shows what would be removed
#   sh tools/clean-stale.sh --apply   removes it
[ -f MANIFEST.txt ] || { echo "MANIFEST.txt not found. Run this from the project folder after unpacking a release."; exit 1; }
T="${TMPDIR:-/tmp}"; HAVE="$T/en_have.$$"; WANT="$T/en_want.$$"
find . -type f ! -path './.git/*' ! -path './node_modules/*' ! -path './android/*' ! -path './www/*' ! -path './package-lock.json' ! -path './MANIFEST.txt' | sed 's|^\./||' | LC_ALL=C sort > "$HAVE"
LC_ALL=C sort MANIFEST.txt > "$WANT"
STALE=$(LC_ALL=C comm -23 "$HAVE" "$WANT"); rm -f "$HAVE" "$WANT"
if [ -z "$STALE" ]; then echo "Nothing to remove. This folder matches the release."; exit 0; fi
echo "$STALE" | sed 's/^/  /'
if [ "$1" != "--apply" ]; then echo; echo "These files are not part of this release. Run again with --apply to remove them."; exit 0; fi
echo "$STALE" | while IFS= read -r f; do rm -f -- "$f"; done
find . -type d -empty ! -path './.git/*' ! -path './node_modules/*' ! -path './android/*' ! -path './www/*' -delete 2>/dev/null
echo "Removed. Now commit: git add -A && git commit -m \"Remove files from older releases\""
