// QA-01 axe canary: proves axe-core can actually fail in this environment before its "0 violations" is trusted.
// Loads deliberately bad markup and requires axe to flag it. Exit 1 if it does not, 2 if axe-core is missing.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
for (const m of ['playwright', 'playwright-core']) { try { ({ chromium } = require(m)); break; } catch {} }
if (!chromium) { console.error('FAIL no playwright or playwright-core available'); process.exit(2); }
let axeSource;
try { axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch { console.error('FAIL axe-core is not installed'); process.exit(2); }

const BAD = '<!doctype html><html lang="en"><head><title>canary</title></head><body><main>' +
  '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">' + // image-alt
  '<button></button>' + // button-name
  '<input type="text">' + // label
  '</main></body></html>';
const REQUIRED = ['image-alt', 'button-name', 'label'];

const browser = await chromium.launch(process.env.QA_CHROMIUM_CHANNEL ? { channel: process.env.QA_CHROMIUM_CHANNEL } : {});
const page = await browser.newPage();
await page.setContent(BAD);
await page.addScriptTag({ content: axeSource });
const found = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }, resultTypes: ['violations'] }).then((r) => r.violations.map((v) => v.id)));
await browser.close();
const missing = REQUIRED.filter((id) => !found.includes(id));
if (missing.length) { console.error('FAIL axe canary: known-bad markup did not trigger ' + missing.join(', ') + ' (axe reported: ' + (found.join(', ') || 'nothing') + '). Zero violations on real pages cannot be trusted.'); process.exit(1); }
console.log('axe canary ok: axe flagged ' + REQUIRED.join(', ') + ' on known-bad markup');
