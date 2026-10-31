// Removes files that an older release left behind (unzipping never deletes anything).
//   node tools/clean-stale.mjs            shows what would be removed
//   node tools/clean-stale.mjs --apply    removes it
// Works on Windows, Mac and Linux. Then commit: git add -A && git commit -m "Remove files from older releases"
import { readFileSync, rmSync, existsSync, readdirSync, rmdirSync, statSync } from 'node:fs';
import { listFiles } from './make-manifest.mjs';

if (!existsSync('MANIFEST.txt')) { console.error('MANIFEST.txt not found. Run this from the project folder after unzipping a release.'); process.exit(1); }
const keep = new Set(readFileSync('MANIFEST.txt', 'utf8').split('\n').filter(Boolean));
const stale = listFiles().filter((f) => !keep.has(f));
if (!stale.length) { console.log('Nothing to remove. This folder matches the release.'); process.exit(0); }
console.log((process.argv.includes('--apply') ? 'Removing' : 'Would remove') + ' ' + stale.length + ' file(s) that are not part of this release:');
for (const f of stale) console.log('  ' + f);
if (!process.argv.includes('--apply')) { console.log('\nRun again with --apply to remove them.'); process.exit(0); }
for (const f of stale) rmSync(f, { force: true });
// tidy empty folders left behind
(function prune(dir) { for (const n of readdirSync(dir)) { const p = dir + '/' + n; if (['.git', 'node_modules', 'android', 'www'].includes(n)) continue; if (statSync(p).isDirectory()) { prune(p); if (!readdirSync(p).length) rmdirSync(p); } } })('.');
console.log('Done. Now commit: git add -A && git commit -m "Remove files from older releases"');
