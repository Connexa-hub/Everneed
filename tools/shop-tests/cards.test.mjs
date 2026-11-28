// SHOP-01: behaviour tests for js/cards.js (checkout recovery). Runs offline with stubbed Supa/A/S; no network, no Paystack.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const SRC = readFileSync(new URL('../../js/cards.js', import.meta.url), 'utf8');
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
let failed = 0, passed = 0;

function env(script, initial) {
  const log = { notes: [], sheets: [], calls: [], opens: [], cleared: 0, handlers: {}, store: Object.assign({}, initial || {}), timers: [] };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = {
    get: (k, d) => (log.store[k] == null ? d : log.store[k]),
    set: (k, v) => { log.store[k] = v; },
    load: () => Promise.resolve(),
  };
  const A = {
    $: () => null, esc, fmt: (n) => String(n), notify: (m, k) => log.notes.push([k || 'ok', m]),
    sheet: (h) => log.sheets.push(h), clearCart: () => { log.cleared++; }, refresh: () => {}, toCart: () => {},
    netErr: (e) => log.notes.push(['neterr', String(e && e.message || e)]),
  };
  const Supa = {
    on: () => true, sess: () => ({}), q: () => Promise.resolve([]),
    fn: (name, body) => {
      log.calls.push({ name, body });
      const next = script.shift();
      const v = typeof next === 'function' ? next(body) : next;
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
    },
  };
  const document = {
    hidden: false,
    addEventListener: (ev, fn) => { log.handlers[ev] = fn; },
    createElement: () => ({}),
    head: { appendChild: (s) => { if (s.onload) s.onload(); } },
  };
  const ctx = { S, A, Supa, document, crypto: webcrypto, Date, Promise, String, Number, Math, JSON, Array, Object, RegExp, Error,
    setTimeout: (fn) => { log.timers.push(fn); return 0; },
    encodeURIComponent };
  ctx.window = ctx;
  ctx.open = (url) => { log.opens.push(url); return {}; };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { log, Cards: ctx.Cards, ctx };
}
const last = (log) => log.sheets[log.sheets.length - 1] || '';
const initKeys = (log) => log.calls.filter((c) => c.body.action === 'init' || c.body.action === 'charge').map((c) => c.body.idempotency_key);
function t(name, fn) { return fn().then(() => { passed++; console.log('ok   ' + name); }, (e) => { failed++; console.error('FAIL ' + name + '\n     ' + (e && e.message || e)); }); }
function eq(a, b, m) { if (a !== b) throw new Error((m || 'expected equal') + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }
function ok(c, m) { if (!c) throw new Error(m); }

await t('new attempt (url + access_code) shows the pay sheet and sends a stable key', async () => {
  const { log, Cards } = env([{ url: 'https://pay/x', access_code: 'AC', reference: 'R1', attempt_id: 'A1' }]);
  Cards.act('cnew', { o: 'o1' }); await tick();
  ok(/Complete your payment/.test(log.sheets[0]), 'pay sheet expected');
  ok(/^enpay_/.test(log.calls[0].body.idempotency_key), 'key prefix');
  eq(log.store.pay.ref, 'R1', 'pending reference saved');
  eq(log.opens[0], 'https://pay/x', 'secure checkout opened');
});

await t('REUSED attempt (url only, no access_code) resumes instead of failing', async () => {
  const { log, Cards } = env([{ url: 'https://pay/x', reference: 'R1', attempt_id: 'A1', reused: true }]);
  Cards.act('cnew', { o: 'o1' }); await tick();
  ok(/Complete your payment/.test(log.sheets[0]), 'should show the pay sheet');
  ok(!/could not start/i.test(log.sheets.join('')), 'must not show an error sheet');
  eq(log.opens[0], 'https://pay/x', 'saved session reopened');
});

await t('network failure keeps the SAME key on retry', async () => {
  const { log, Cards } = env([new Error('Failed to fetch'), { url: 'https://pay/x', reference: 'R1', attempt_id: 'A1', reused: true }]);
  Cards.act('cnew', { o: 'o1' }); await tick();
  ok(/data-act="cnew"/.test(last(log)) && !/data-act="cretry"/.test(last(log)), 'retry must reuse key (cnew), not cretry');
  Cards.act('cnew', { o: 'o1' }); await tick();
  const k = initKeys(log); eq(k.length, 2); eq(k[0], k[1], 'same key on retry');
});

await t('server-confirmed terminal attempt gets a NEW key only via cretry', async () => {
  const { log, Cards } = env([new Error('This payment attempt is terminal. Start a new payment attempt to retry.'), { url: 'https://pay/y', access_code: 'AC2', reference: 'R2', attempt_id: 'A2' }]);
  Cards.act('cnew', { o: 'o1' }); await tick();
  ok(/data-act="cretry"/.test(last(log)), 'cretry offered');
  Cards.act('cretry', { o: 'o1' }); await tick();
  const k = initKeys(log); ok(k[0] !== k[1], 'fresh key after terminal');
});

await t('double tap sends one request', async () => {
  const { log, Cards } = env([{ url: 'https://pay/x', reference: 'R1' }]);
  Cards.act('cnew', { o: 'o1' }); Cards.act('cnew', { o: 'o1' }); await tick();
  eq(log.calls.length, 1, 'one init call');
});

await t('202 initializing shows "do not pay twice" and no retry button', async () => {
  const { log, Cards } = env([{ status: 'initializing', reference: 'R3', attempt_id: 'A3', retryable: true }, { error: 'x' }]);
  Cards.act('cnew', { o: 'o1' }); await tick();
  const s = log.sheets.find((h) => /do not pay twice/i.test(h));
  ok(s, 'initializing sheet'); ok(!/cretry/.test(s), 'no fresh-key retry while initializing');
});

await t('saved-card charge sends the stored key and reuses it', async () => {
  const { log, Cards } = env([{ status: 'pending', reference: 'R4', attempt_id: 'A4', verify_required: true }, { paid: false, status: 'ongoing' }, { status: 'pending', reference: 'R4', verify_required: true }, { paid: false, status: 'ongoing' }]);
  Cards.act('cpay', { o: 'o1', id: 'c1' }); await tick();
  Cards.act('cpay', { o: 'o1', id: 'c1' }); await tick();
  const k = initKeys(log); eq(k.length, 2); ok(!!k[0], 'charge has a key'); eq(k[0], k[1], 'same key for repeat charge');
  ok(!/Payment received/.test(log.sheets.join('')), 'never shows paid without the server saying so');
});

await t('declined saved card clears the key and returns to the method chooser', async () => {
  const { log, Cards } = env([{ paid: false, status: 'failed', message: 'Declined', reference: 'R5' }]);
  Cards.start({ id: 'o1', total: 100 }); await tick();
  Cards.act('cpay', { o: 'o1', id: 'c1' }); await tick();
  eq(log.store['pay_idem_o1'], null, 'dead key dropped');
  ok(log.notes.some((n) => n[0] === 'err' && n[1] === 'Declined'), 'gateway message shown');
  ok(/Pay by card/.test(last(log)), 'chooser shown again');
});

await t('paid is applied exactly once even if two checks resolve', async () => {
  const { log, Cards } = env([{ url: 'https://pay/x', reference: 'R6' }, { paid: true, status: 'success' }, { paid: true, status: 'success' }]);
  Cards.act('cnew', { o: 'o1' }); await tick();
  Cards.act('cchk', {}); Cards.act('cchk', {}); await tick();
  eq(log.cleared, 1, 'cart cleared once');
  eq(log.store.pay, null, 'pending cleared'); eq(log.store['pay_idem_o1'], null, 'key cleared');
  eq(log.sheets.filter((h) => /Payment received/.test(h)).length, 1, 'one success sheet');
});

await t('init returning paid:true finishes without a payment sheet', async () => {
  const { log, Cards } = env([{ paid: true }]);
  Cards.act('cnew', { o: 'o1' }); await tick();
  ok(/Payment received/.test(log.sheets[0]));
});

await t('verify failed -> new-payment button; abandoned -> continue button; ongoing -> nothing', async () => {
  let e = env([{ url: 'u', reference: 'R7' }, { paid: false, status: 'failed' }]);
  e.Cards.act('cnew', { o: 'o1' }); await tick(); e.Cards.act('cchk', {}); await tick();
  ok(/data-act="cnew"/.test(last(e.log)) && !/cretry/.test(last(e.log)), 'failed -> same-key retry, never a fresh key before the server ends the attempt');
  e = env([{ url: 'u', reference: 'R8' }, { paid: false, status: 'abandoned' }]);
  e.Cards.act('cnew', { o: 'o1' }); await tick(); e.Cards.act('cchk', {}); await tick();
  ok(/Continue payment/.test(last(e.log)) && !/cretry/.test(last(e.log)), 'abandoned -> continue with same key');
  e = env([{ url: 'u', reference: 'R9' }, { paid: false, status: 'ongoing' }]);
  e.Cards.act('cnew', { o: 'o1' }); await tick(); const n = e.log.sheets.length; e.Cards.act('cchk', {}); await tick();
  eq(e.log.sheets.length, n, 'ongoing leaves the sheet alone');
  ok(e.log.notes.some((x) => /Not confirmed yet/.test(x[1])), 'tells the user it is not confirmed');
});

await t('after a Paystack-reported failure the SAME dead attempt is never reopened; a server-ended attempt then gets a new key', async () => {
  const { log, Cards } = env([
    { url: 'https://pay/dead', reference: 'RD', attempt_id: 'AD' },            // first init
    { paid: false, status: 'failed' },                                          // verify: Paystack says failed
    { url: 'https://pay/dead', reference: 'RD', attempt_id: 'AD', reused: true }, // DB not closed yet: same attempt handed back
    new Error('This payment attempt is terminal. Start a new payment attempt to retry.'), // later the worker closed it
    { url: 'https://pay/new', access_code: 'AC9', reference: 'RN', attempt_id: 'AN' },
  ]);
  Cards.act('cnew', { o: 'o1' }); await tick();
  Cards.act('cchk', {}); await tick();
  const opened = log.opens.length;
  Cards.act('cnew', { o: 'o1' }); await tick();
  ok(/Still closing the previous attempt/.test(last(log)), 'tells the shopper the old attempt is still closing');
  eq(log.opens.length, opened, 'the dead session is not reopened');
  Cards.act('cnew', { o: 'o1' }); await tick();
  ok(/data-act="cretry"/.test(last(log)), 'terminal 409 -> fresh key offered');
  Cards.act('cretry', { o: 'o1' }); await tick();
  const k = initKeys(log); eq(k[0], k[1], 'first retry reused the key'); eq(k[1], k[2], 'second retry reused the key'); ok(k[2] !== k[3], 'new key only after the server ended the attempt');
  eq(log.store.pay.ref, 'RN', 'new attempt is now the pending one');
});

await t('returning to the app (visible) asks the server; soft start only reacts to paid', async () => {
  let e = env([{ url: 'u', reference: 'R10' }, { paid: false, status: 'abandoned' }]);
  e.Cards.act('cnew', { o: 'o1' }); await tick();
  const n = e.log.sheets.length; e.log.timers[0](); await tick();   // cold-start soft check
  eq(e.log.sheets.length, n, 'soft check must not pop a sheet');
  e = env([{ url: 'u', reference: 'R11' }, { paid: true }]);
  e.Cards.act('cnew', { o: 'o1' }); await tick(); e.log.handlers.visibilitychange(); await tick();
  ok(/Payment received/.test(last(e.log)), 'visible again -> verified paid');
});

await t('a pending payment older than 48h is dropped instead of polled forever', async () => {
  const e = env([{ paid: true }], { pay: { ref: 'OLD', order: 'o1', at: Date.now() - 3 * 864e5 } });
  e.log.handlers.visibilitychange(); await tick();
  eq(e.log.calls.length, 0, 'no verify call for a stale pending payment');
  eq(e.log.store.pay, null, 'stale pending cleared');
});

await t('a recent pending payment persisted from a previous session is verified on app start', async () => {
  const e = env([{ paid: true }], { pay: { ref: 'R12', order: 'o1', at: Date.now() - 1000 } });
  e.log.timers[0](); await tick();
  eq(e.log.calls[0].body.action, 'verify'); eq(e.log.calls[0].body.reference, 'R12');
  ok(/Payment received/.test(last(e.log)), 'paid state read from the server');
});

if (failed) { console.error(failed + ' cards test(s) failed'); process.exit(1); }
console.log('cards tests passed: ' + passed);
