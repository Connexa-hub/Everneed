// Static checks run on every push: JS syntax, JSON validity, edge function sanity.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

let failed = 0;
const fail = (msg) => { console.error('FAIL', msg); failed++; };

// 1. Every browser script must parse.
const jsFiles = (d) => readdirSync(d).flatMap((n) => (statSync(d + '/' + n).isDirectory() ? jsFiles(d + '/' + n) : n.endsWith('.js') ? [d + '/' + n] : []));
for (const f of jsFiles('js')) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log('ok  ' + f);
  } catch (e) {
    fail(f + '\n' + e.stderr);
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

// 4b. A durable Paystack event that fails inline processing must not be acknowledged as delivered.
const paystackSource = readFileSync('supabase/functions/paystack/index.ts', 'utf8');
if (!paystackSource.includes('return json({ ok: false, retry: true }, 503);')) {
  fail('Paystack webhook processing failures must return HTTP 503 so the provider retries the durable event');
}
if (paystackSource.includes('return json({ ok: true, queued: true });')) {
  fail('Paystack webhook processing failure must not return a successful 2xx acknowledgement without a retry worker');
}

// 4c. Payment recovery worker must authenticate service-role calls and verify with Paystack before settlement.
const recoveryWorkerPath = 'supabase/functions/payment-recovery/index.ts';
if (existsSync(recoveryWorkerPath)) {
  const recoverySource = readFileSync(recoveryWorkerPath, 'utf8');
  for (const required of [
    'claim_provider_event_recovery',
    'finish_provider_event_recovery',
    'get_payment_attempt_recovery_context',
    'claim_stale_payment_attempt_recovery',
    'finish_stale_payment_attempt_recovery',
    'payment_attempt_id',
    '/transaction/verify/',
    'settle_verified_payment_attempt',
    'Bearer " + SERVICE_KEY',
  ]) {
    if (!recoverySource.includes(required)) fail(recoveryWorkerPath + ' is missing required recovery safety check: ' + required);
  }
  const handlerStart = recoverySource.indexOf('Deno.serve');
  const verifyCall = recoverySource.indexOf('await verifyPaystack(', handlerStart);
  const contextCall = recoverySource.indexOf('db.rpc("get_payment_attempt_recovery_context"', handlerStart);
  const settlementCall = recoverySource.indexOf('db.rpc("settle_verified_payment_attempt"', handlerStart);
  if (verifyCall < 0 || contextCall < verifyCall || settlementCall < contextCall) {
    fail(recoveryWorkerPath + ' must verify Paystack and match trusted attempt context before settlement');
  }
  if (!recoverySource.includes('event.signature_verified !== true')) {
    fail(recoveryWorkerPath + ' must refuse inbox events without a verified provider signature');
  }
  if (recoverySource.includes('/transaction/initialize') || recoverySource.includes('/transaction/charge_authorization')) {
    fail(recoveryWorkerPath + ' must never create or charge a new Paystack transaction during recovery');
  }
}

// 4c2. Shopper checkout recovery (SHOP-01): stable idempotency key, resume of reused attempts, no double charge.
const cardsSource = readFileSync('js/cards.js', 'utf8');
for (const required of ['function makeKey(order,fresh)', 'S.set(keyName(order),k)', 'action:"verify"', 'btn("cretry"', 'if(inflight)return', 'window.PaystackPop']) {
  if (!cardsSource.includes(required)) fail('js/cards.js is missing payment-recovery guard: ' + required);
}
if (!cardsSource.includes('action:"init",order_id:order,idempotency_key:idem')) fail('js/cards.js init must send the stored idempotency key');
if (!/action:"charge"[^}]*idempotency_key:/.test(cardsSource)) fail('js/cards.js saved-card charge must send the stored idempotency key (the server otherwise makes a new attempt per tap)');
if (cardsSource.includes('r.url&&r.access_code')) fail('js/cards.js must not require access_code: a reused attempt returns a url only');
if (/window\.open\([^)]*noopener/.test(cardsSource)) fail('js/cards.js: window.open with noopener always returns null, so a popup-blocked check would always fire');
try { execFileSync(process.execPath, ['tools/shop-tests/cards.test.mjs'], { stdio: 'pipe' }); console.log('ok  cards behaviour tests'); }
catch (e) { fail('cards behaviour tests failed\n' + e.stdout + e.stderr); }

// 4d. Native Android Google sign-in must use the Web OAuth client ID and preserve browser PKCE.
const googleConfigSource = readFileSync('js/config.js', 'utf8');
const googleAuthSource = readFileSync('js/auth.js', 'utf8');
const googleAppSource = readFileSync('js/app.js', 'utf8');
const googleSupaSource = readFileSync('js/supa.js', 'utf8');
const googleMainActivitySource = readFileSync('android/app/src/main/java/com/everneed/store/MainActivity.java', 'utf8');
const googlePackage = JSON.parse(readFileSync('package.json', 'utf8'));
for (const [file, source, required] of [
  ['js/config.js', googleConfigSource, 'googleWebClientId:"659136945947-dlum233ke4ruu48uk9ir0bli0nvfcs60.apps.googleusercontent.com"'],
  ['js/auth.js', googleAuthSource, 'function googleNativeAndroid()'],
  ['js/auth.js', googleAuthSource, 'plugin.initialize({google:{webClientId:clientId}})'],
  ['js/auth.js', googleAuthSource, 'plugin.login({provider:"google",options:{}})'],
  ['js/auth.js', googleAuthSource, 'Supa.signInIdToken("google",token)'],
  ['js/auth.js', googleAuthSource, 'nativeGoogleAccountReauthFailure'],
  ['js/auth.js', googleAuthSource, 'location.href=url'],
  ['js/auth.js', googleAuthSource, 'com.everneed.store://auth/callback'],
  ['js/auth.js', googleAuthSource, 'Capacitor.Plugins.Browser'],
  ['js/supa.js', googleSupaSource, 'grant_type=id_token'],
  ['js/supa.js', googleSupaSource, 'id_token:idToken'],
  ['js/app.js', googleAppSource, 'function clearNativeGoogleProvider()'],
  ['js/app.js', googleAppSource, 'p.logout({provider:"google"})'],
  ['js/app.js', googleAppSource, 'function signOutCurrentUser()'],
  ['MainActivity.java', googleMainActivitySource, 'ModifiedMainActivityForSocialLoginPlugin'],
  ['MainActivity.java', googleMainActivitySource, 'handleGoogleLoginIntent(requestCode, data)'],
]) if (!source.includes(required)) fail(file + ' is missing native Google sign-in requirement: ' + required);
if (!googlePackage.dependencies || !googlePackage.dependencies['@capgo/capacitor-social-login']) {
  fail('package.json must include @capgo/capacitor-social-login for native Android Google sign-in');
}
if (googleConfigSource.includes('googleWebClientId:"659136945947-tv0q8nrivcca6rv5areu2vrtca1qnekm.apps.googleusercontent.com"')) {
  fail('js/config.js must not use the Android OAuth client ID as googleWebClientId');
}
if (!googleAuthSource.includes('code_challenge_method=s256') && !googleSupaSource.includes('code_challenge_method=s256')) {
  fail('website Google sign-in must retain OAuth PKCE');
}
if (!googleAppSource.includes('else if(k==="out"){signOutCurrentUser()}') || !googleAppSource.includes('signout:function(){signOutCurrentUser()}')) {
  fail('all explicit sign-out entry points must clear native Google state');
}

// 4d. Staging migrations must never deploy on a branch push.
const stagingWorkflowPath = '.github/workflows/staging-db.yml';
if (existsSync(stagingWorkflowPath)) {
  const stagingWorkflow = readFileSync(stagingWorkflowPath, 'utf8');
  if (/^  push:/m.test(stagingWorkflow)) fail(stagingWorkflowPath + ' must not apply migrations automatically on push');
  if (!stagingWorkflow.includes('confirm_staging') || !stagingWorkflow.includes('APPLY')) {
    fail(stagingWorkflowPath + ' must require the explicit APPLY workflow-dispatch input');
  }
}

// 5. No retired dropshipping integrations outside history files. Do not ban the word
// "supplier" by itself: it is legitimate marketplace/legal terminology for independent sellers.
const BAN = /\b(cj|cjdropshipping|eprolo|sup_[a-z]+)\b/i;
const SKIP = new Set(['node_modules', '.git', 'assets', 'keystore', 'android']);
const HISTORY = new Set(['supabase/migrations/000_baseline.sql', 'supabase/migrations/001_remove_cj.sql', 'docs/AUDIT.md', 'docs/EVERNEED_MARKETPLACE_PROMPT.md', 'docs/WORKFLOW/REPOSITORY_AND_PRODUCT_AUDIT_2026-11-12.md', 'tools/check.mjs']);
const MANIFEST = existsSync('MANIFEST.txt') ? new Set(readFileSync('MANIFEST.txt', 'utf8').split('\n').filter(Boolean)) : null;
// A second copy of the project inside the repository means a zip was unpacked one level too deep.
for (const n of readdirSync('.')) {
  if (SKIP.has(n) || !statSync(n).isDirectory()) continue;
  if (existsSync(n + '/tools/check.mjs') && existsSync(n + '/package.json')) {
    fail(`NESTED COPY: the folder "${n}/" is a second copy of the project inside the repository (a zip was unpacked one level too deep). Delete it with: git rm -r ${n}`);
    SKIP.add(n);   // reported once above instead of line by line
  }
}
// Paths retired in earlier phases. If one exists, an old zip was unpacked on top without deleting what it removed.
for (const r of ['supabase/functions/cj', 'supabase/schema.sql']) {
  if (existsSync(r)) fail(`STALE: ${r} was removed from the project in Phase 1 but is still in this repository. Delete it (git rm -r ${r}) or run: node tools/clean-stale.mjs --apply`);
}
(function scan(dir) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = dir === '.' ? n : dir + '/' + n;
    if (statSync(p).isDirectory()) { scan(p); continue; }
    if (HISTORY.has(p) || !/\.(js|ts|json|md|html|css|sql|yml)$/.test(p)) continue;
    const hits = [];
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      if (/"(key|apikey)"|key:"eyJ/.test(line)) return;
      if (BAN.test(line)) hits.push(i + 1);
    });
    if (!hits.length) continue;
    if (MANIFEST && !MANIFEST.has(p)) fail(`STALE FILE ${p} mentions removed dropshipping terms (${hits.length} lines) and is not part of this release. Delete it: node tools/clean-stale.mjs --apply`);
    else for (const l of hits) fail(p + ':' + l + ' mentions removed dropshipping term');
  }
})('.');

// 6. Design system rules: no raw colours in component CSS, bundled fonts exist, contrast passes for all 18 themes.
for (const f of ['css/app.css', 'css/components.css']) {
  const css = readFileSync(f, 'utf8');
  for (const m of css.matchAll(/\{([^{}]*)\}/g)) {
    if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(m[1])) fail(f + ': raw colour in "' + m[1].slice(0, 60) + '..." (use a token from css/tokens.css)');
  }
}
for (const m of readFileSync('css/fonts.css', 'utf8').matchAll(/url\(\.\.\/(fonts\/[^)]+)\)/g)) {
  try { statSync(m[1]); } catch { fail('css/fonts.css references missing font ' + m[1]); }
}
try { execFileSync(process.execPath, ['tools/check-contrast.mjs'], { stdio: 'pipe' }); console.log('ok  contrast (18 themes)'); }
catch (e) { fail('contrast check failed\n' + e.stdout + e.stderr); }

if (failed) {
  console.error(failed + ' check(s) failed');
  process.exit(1);
}
console.log('All checks passed');
