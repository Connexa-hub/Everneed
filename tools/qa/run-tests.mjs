// QA-02: runs every offline test script in tools/web-seller-tests and tools/shop-tests, so a new test file is picked up
// without editing CI. Each file runs as its own node process; the run fails if any exits non-zero, times out or prints nothing.
//
//   node tools/qa/run-tests.mjs [--out tools/qa/out]
//
// Helpers that are not tests are listed in HELPERS (or start with "_"). A REQUIRED directory that is missing fails the run;
// an optional one (tools/shop-tests, until PR #55 merges) is noted and skipped. Any existing directory with no test files fails,
// so a rename cannot silently turn the check off.
import { readdirSync, existsSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..');
const argv = process.argv.slice(2);
const OUT = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : join(here, 'out'));
const DIRS = [{ path: 'tools/web-seller-tests', required: true }, { path: 'tools/shop-tests', required: false }];
const HELPERS = new Set(['harness.js']);
const TIMEOUT_MS = 60000;

const rows = [];
const notes = [];
let failures = 0;
const t0 = Date.now();

for (const { path: d, required } of DIRS) {
  const dir = join(ROOT, d);
  if (!existsSync(dir)) {
    if (required) { failures++; rows.push({ file: d + '/', ok: false, ms: 0, note: 'required test directory is missing' }); }
    else notes.push(d + ' does not exist on this branch; skipped');
    continue;
  }
  const files = readdirSync(dir).filter((f) => /\.(m?js|cjs)$/.test(f) && !HELPERS.has(f) && !f.startsWith('_')).sort();
  if (!files.length) { failures++; rows.push({ file: d + '/', ok: false, ms: 0, note: 'directory has no test files' }); continue; }
  for (const f of files) {
    const s = Date.now();
    const r = spawnSync(process.execPath, [join(dir, f)], { cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT_MS });
    const ms = Date.now() - s;
    const out = ((r.stdout || '') + (r.stderr || '')).trim();
    const last = out.split('\n').filter(Boolean).pop() || '';
    let note = last.slice(0, 120), ok = true;
    if (r.error && r.error.code === 'ETIMEDOUT') { ok = false; note = 'timed out after ' + TIMEOUT_MS / 1000 + ' s'; }
    else if (r.status !== 0) { ok = false; note = 'exit ' + r.status + (last ? ': ' + last.slice(0, 200) : ''); }
    else if (/\b[1-9]\d* failed\b/.test(out)) { ok = false; note = 'exit 0 but output reports failures: ' + last.slice(0, 120); }
    else if (!out) { ok = false; note = 'passed silently: a test that prints nothing cannot be trusted'; }
    if (!ok) { failures++; console.log('---- ' + d + '/' + f + ' output ----\n' + out.slice(-3000)); }
    rows.push({ file: d + '/' + f, ok, ms, note });
  }
}

const total = Date.now() - t0;
const lines = rows.map((r) => (r.ok ? 'PASS ' : 'FAIL ') + r.file.padEnd(46) + String(r.ms).padStart(5) + ' ms  ' + r.note);
for (const n of notes) lines.push('NOTE ' + n);
lines.push((failures ? failures + ' failing' : rows.length + ' test files passed') + ', ' + (total / 1000).toFixed(1) + ' s total');
console.log(lines.join('\n'));
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'tests.txt'), lines.join('\n') + '\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### QA-02 offline tests\n```\n' + lines.join('\n') + '\n```\n');
process.exit(failures ? 1 : 0);
