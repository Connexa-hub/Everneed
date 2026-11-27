// QA-01 bundle budget: gzipped size of everything index.html loads eagerly (scripts + stylesheets).
//   node tools/qa/bundle-budget.mjs --site <assembled web dir>
// Lazy files (loaded later by ds-lazy.js) are not counted. The limit lives in tools/qa/budget.json.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const i = argv.indexOf('--site');
const SITE = resolve(i > -1 ? argv[i + 1] : 'web');
const budget = JSON.parse(readFileSync(join(here, 'budget.json'), 'utf8'));

const html = readFileSync(join(SITE, 'index.html'), 'utf8');
const refs = [
  ...[...html.matchAll(/<script[^>]+src="(\/[^"]+)"/g)].map((m) => ['js', m[1]]),
  ...[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/[^"]+)"/g)].map((m) => ['css', m[1]]),
];
let failed = 0;
const rows = [];
const total = { js: 0, css: 0 };
for (const [kind, ref] of refs) {
  const f = join(SITE, ref);
  if (!existsSync(f)) { console.error('FAIL index.html loads ' + ref + ' but it is not in the built site'); failed++; continue; }
  const gz = gzipSync(readFileSync(f), { level: 9 }).length;
  total[kind] += gz;
  rows.push([ref, gz]);
}
const kb = (n) => (n / 1024).toFixed(1);
rows.sort((a, b) => b[1] - a[1]);
console.log('Largest eager files (gzipped):');
for (const [ref, gz] of rows.slice(0, 5)) console.log('  ' + kb(gz).padStart(6) + ' KB  ' + ref);
const all = total.js + total.css;
console.log('Eager JS  ' + kb(total.js) + ' KB (' + refs.filter((r) => r[0] === 'js').length + ' files)');
console.log('Eager CSS ' + kb(total.css) + ' KB (' + refs.filter((r) => r[0] === 'css').length + ' files)');
console.log('Eager total ' + kb(all) + ' KB gzipped, budget ' + budget.eagerGzipKB + ' KB');
if (all / 1024 > budget.eagerGzipKB) { console.error('FAIL eager payload is over budget by ' + kb(all - budget.eagerGzipKB * 1024) + ' KB. Lazy-load the new code (see ds-lazy.js) or raise the budget in tools/qa/budget.json with a reason.'); failed++; }
else if (all / 1024 < budget.eagerGzipKB - 15) console.log('NOTE budget has ' + kb(budget.eagerGzipKB * 1024 - all) + ' KB of slack; consider lowering it so it keeps protecting.');
process.exit(failed ? 1 : 0);
