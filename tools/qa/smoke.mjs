// QA-01 smoke run: loads the assembled website in Chromium at 360 px with every Supabase call stubbed.
//
//   node tools/qa/smoke.mjs --site <dir>            run, compare with tools/qa/baseline.json
//   node tools/qa/smoke.mjs --site <dir> --update-baseline
//   add --require-axe in CI so a missing axe-core is a failure, not a skip
//
// <dir> is the web/ folder after the Pages copy step (see .github/workflows/web-checks.yml).
// Nothing here talks to a real Supabase project; any request to the production ref fails the run.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : d; };
const SITE = resolve(opt('--site', 'web'));
const OUT = resolve(opt('--out', join(here, 'out')));
const BASELINE = join(here, 'baseline.json');
const WIDTH = 360; // fixed on purpose: with isMobile, window.innerWidth grows to fit overflowing content
const PROD_REF = 'zpgasfweaixwsktlueje';
const require = createRequire(import.meta.url);

let chromium;
for (const m of ['playwright', 'playwright-core']) { try { ({ chromium } = require(m)); break; } catch {} }
if (!chromium) { console.error('FAIL no playwright or playwright-core available'); process.exit(2); }
let axeSource = null;
try { axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch {}
if (!axeSource && flag('--require-axe')) { console.error('FAIL axe-core is required (--require-axe) but not installed'); process.exit(2); }

// Public routes from the router in web/assets/js/core.js, plus the not-found screen.
const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/about', name: 'about' },
  { path: '/how-it-works', name: 'how-it-works' },
  { path: '/sell', name: 'sell' },
  { path: '/help', name: 'help' },
  { path: '/sign-in', name: 'sign-in' },
  { path: '/create-account', name: 'create-account' },
  { path: '/no-such-page', name: 'not-found', expectText: 'Page not found' },
];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let f = join(SITE, url);
  if (!f.startsWith(SITE) || !existsSync(f) || statSync(f).isDirectory()) f = join(SITE, 'index.html'); // _redirects: /* /index.html 200
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { routes: {} };
mkdirSync(OUT, { recursive: true });
// CI uses the runner's installed Chrome (QA_CHROMIUM_CHANNEL=chrome); locally the bundled Chromium is used.
const browser = await chromium.launch(process.env.QA_CHROMIUM_CHANNEL ? { channel: process.env.QA_CHROMIUM_CHANNEL } : {});
const results = [];
let failures = 0;
const fail = (r, msg) => { r.problems.push(msg); failures++; };

for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const r = { name: route.name, path: route.path, problems: [], notes: [], external: new Set(), touchSmall: 0, axe: null };
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); });
  await page.route('**/*', (rt) => {
    const u = new URL(rt.request().url());
    if (u.origin === ORIGIN) return rt.continue();
    r.external.add(u.host);
    if (u.host.includes(PROD_REF)) { fail(r, 'request reached the PRODUCTION Supabase project: ' + u.pathname); return rt.abort(); }
    if (u.host.endsWith('.supabase.co')) {
      const body = u.pathname.includes('/rest/v1/rpc/') ? 'null' : u.pathname.includes('/rest/v1/') ? '[]' : '{}';
      return rt.fulfill({ status: u.pathname.includes('/auth/v1/') ? 400 : 200, contentType: 'application/json', body });
    }
    return rt.abort();
  });
  try {
    await page.goto(ORIGIN + route.path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(400);
  } catch (e) { fail(r, 'navigation failed: ' + e.message); }

  const m = await page.evaluate(() => {
    const root = document.getElementById('root');
    const vis = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const small = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab]')]
      .filter(vis).filter((el) => { const b = el.getBoundingClientRect(); return b.width < 44 || b.height < 44; })
      .map((el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '')));
    return { rootText: root ? root.innerText.trim().length : -1, text: document.body.innerText.slice(0, 4000), scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), small };
  });
  if (pageErrors.length) fail(r, 'uncaught page errors: ' + pageErrors.slice(0, 3).join(' | '));
  if (consoleErrors.length) fail(r, 'console errors: ' + consoleErrors.slice(0, 3).join(' | '));
  if (m.rootText < 20) fail(r, 'page rendered almost nothing (root text ' + m.rootText + ' chars)');
  if (route.expectText ? !m.text.includes(route.expectText) : /Something went wrong/.test(m.text)) fail(r, route.expectText ? 'expected "' + route.expectText + '" on screen' : 'error screen shown ("Something went wrong")');
  if (m.scrollW > WIDTH + 1) fail(r, 'horizontal overflow at ' + WIDTH + ' px: content is ' + m.scrollW + ' px wide');
  r.touchSmall = m.small.length;
  r.touchSample = [...new Set(m.small)].slice(0, 6);

  if (axeSource) {
    await page.addScriptTag({ content: axeSource });
    const a = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }, resultTypes: ['violations'] }).then((x) => x.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))));
    r.axe = Object.fromEntries(a.map((v) => [v.id, v.nodes]));
    r.axeImpact = Object.fromEntries(a.map((v) => [v.id, v.impact]));
  }
  await page.screenshot({ path: join(OUT, route.name + '-360.png'), fullPage: true });
  await ctx.close();
  results.push(r);
}
await browser.close();
server.close();

if (flag('--update-baseline')) {
  const next = { note: 'QA-01 baseline: counts of KNOWN touch-target and axe issues per route. The run fails only when a count goes UP. Lower the numbers as issues are fixed.', routes: {} };
  for (const r of results) next.routes[r.name] = { touchSmall: r.touchSmall, ...(r.axe ? { axe: r.axe } : {}) };
  writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n');
  console.log('baseline written to ' + BASELINE);
} else {
  for (const r of results) {
    const b = baseline.routes[r.name];
    if (!b) r.notes.push('no baseline for this route (run with --update-baseline)');
    else {
      if (r.touchSmall > b.touchSmall) fail(r, 'touch targets under 44 px went up: ' + b.touchSmall + ' -> ' + r.touchSmall + ' (e.g. ' + r.touchSample.join(', ') + ')');
      if (r.axe) {
        if (!b.axe) r.notes.push('axe baseline missing: ' + JSON.stringify(r.axe));
        else for (const [id, n] of Object.entries(r.axe)) if (n > (b.axe[id] || 0)) fail(r, 'axe ' + id + ' (' + r.axeImpact[id] + '): ' + (b.axe[id] || 0) + ' -> ' + n + ' elements');
      }
    }
  }
}

for (const r of results) {
  console.log((r.problems.length ? 'FAIL ' : 'PASS ') + r.name.padEnd(15) + ' touch<44px: ' + String(r.touchSmall).padStart(3) + (r.axe ? '  axe rules: ' + Object.keys(r.axe).length : '') + (r.external.size ? '  external: ' + [...r.external].join(',') : ''));
  for (const p of r.problems) console.log('     - ' + p);
  for (const n of r.notes) console.log('     . ' + n);
}
if (!axeSource) console.log('NOTE axe-core not installed: accessibility rules were NOT checked in this run.');
writeFileSync(join(OUT, 'report.json'), JSON.stringify(results.map((r) => ({ ...r, external: [...r.external] })), null, 2));
console.log(failures ? failures + ' problem(s)' : 'smoke run clean');
process.exit(failures ? 1 : 0);
