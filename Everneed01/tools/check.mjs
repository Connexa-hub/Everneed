// Static checks run on every push: JS syntax, JSON validity, edge function sanity.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

let failed = 0;
const fail = (msg) => { console.error('FAIL', msg); failed++; };

// 1. Every browser script must parse.
for (const f of readdirSync('js').filter((n) => n.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', join('js', f)], { stdio: 'pipe' });
    console.log('ok  js/' + f);
  } catch (e) {
    fail('js/' + f + '\n' + e.stderr);
  }
}

// 2. Every JSON file must be valid.
for (const f of ['package.json', 'capacitor.config.json', ...readdirSync('data').map((n) => 'data/' + n)]) {
  if (!f.endsWith('.json')) continue;
  try {
    JSON.parse(readFileSync(f, 'utf8'));
    console.log('ok  ' + f);
  } catch (e) {
    fail(f + ': ' + e.message);
  }
}

// 3. Every script tag in index.html must point at a real file.
const html = readFileSync('index.html', 'utf8');
for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
  try {
    statSync(m[1]);
  } catch {
    fail('index.html references missing file ' + m[1]);
  }
}

// 4. Edge functions must exist and not be empty.
for (const fn of readdirSync('supabase/functions')) {
  const p = join('supabase/functions', fn, 'index.ts');
  try {
    if (statSync(p).size < 50) fail(p + ' looks empty');
    else console.log('ok  ' + p);
  } catch {
    fail('missing ' + p);
  }
}

// 5. No dropshipping leftovers outside history files (baseline migration, audit and prompt docs).
const BAN = /\b(cj|cjdropshipping|eprolo|supplier|sup_[a-z]+)\b/i;
const SKIP = new Set(['node_modules', '.git', 'assets', 'keystore', 'android']);
const HISTORY = new Set(['supabase/migrations/000_baseline.sql', 'supabase/migrations/001_remove_cj.sql', 'docs/AUDIT.md', 'docs/EVERNEED_MARKETPLACE_PROMPT.md', 'tools/check.mjs']);
(function scan(dir) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = dir === '.' ? n : dir + '/' + n;
    if (statSync(p).isDirectory()) { scan(p); continue; }
    if (HISTORY.has(p) || !/\.(js|ts|json|md|html|css|sql|yml)$/.test(p)) continue;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      if (/"(key|apikey)"|key:"eyJ/.test(line)) return;
      if (BAN.test(line)) fail(p + ':' + (i + 1) + ' mentions removed dropshipping term');
    });
  }
})('.');

if (failed) {
  console.error(failed + ' check(s) failed');
  process.exit(1);
}
console.log('All checks passed');
