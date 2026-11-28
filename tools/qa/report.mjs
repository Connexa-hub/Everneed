// QA-01: turns tools/qa/out/report.json (written by smoke.mjs) and bundle.txt into report.md, which CI posts on the PR.
// QA-02: also includes tests.txt (written by run-tests.mjs) when present.
//   node tools/qa/report.mjs [outDir]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), 'out'));
const reportFile = join(OUT, 'report.json');
if (!existsSync(reportFile)) { console.error('no report.json in ' + OUT + ' (did smoke.mjs run?)'); process.exit(1); }
const results = JSON.parse(readFileSync(reportFile, 'utf8'));
const axeRan = results.some((r) => r.axe);

const md = ['<!-- qa-smoke-360 -->', '### QA-01: smoke at 360 px', '', '| Route | Result | Touch targets < 44 px | axe rules failing |', '|---|---|---|---|'];
for (const r of results) md.push('| ' + r.name + ' | ' + (r.problems.length ? '**FAIL**' : 'pass') + ' | ' + r.touchSmall + ' | ' + (r.axe ? Object.keys(r.axe).length : 'not run') + ' |');
const bad = results.filter((r) => r.problems.length);
if (bad.length) { md.push('', '**Problems**'); for (const r of bad) for (const p of r.problems) md.push('- `' + r.name + '`: ' + p.slice(0, 300)); }
const withAxe = results.filter((r) => r.axe && Object.keys(r.axe).length);
if (withAxe.length) { md.push('', '**axe violations** (rule, impact, elements)'); for (const r of withAxe) md.push('- `' + r.name + '`: ' + Object.entries(r.axe).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => id + ' (' + r.axeImpact[id] + ') x' + n).join(', ')); }
if (!axeRan) md.push('', '_axe-core was not installed: accessibility rules were not checked._');
const bundle = join(OUT, 'bundle.txt');
if (existsSync(bundle)) md.push('', '**Bundle**', '```', readFileSync(bundle, 'utf8').trim(), '```');
const tests = join(OUT, 'tests.txt');
if (existsSync(tests)) md.push('', '**Offline tests (QA-02)**', '```', readFileSync(tests, 'utf8').trim(), '```');
const ext = [...new Set(results.flatMap((r) => r.external || []))];
if (ext.length) md.push('', 'External hosts contacted (all stubbed or blocked): ' + ext.map((h) => '`' + h + '`').join(', '));
md.push('', '<details><summary>Baseline JSON for these results</summary>', '', '```json', JSON.stringify(Object.fromEntries(results.map((r) => [r.name, { touchSmall: r.touchSmall, ...(r.axe ? { axe: r.axe } : {}) }])), null, 2), '```', '</details>', '');
writeFileSync(join(OUT, 'report.md'), md.join('\n'));
console.log('wrote ' + join(OUT, 'report.md'));
