// Verifies the shipped css/tokens.css: every palette in every mode must meet the contrast rules.
import { readFileSync } from 'node:fs';
import { contrast, over, hexToRgb } from './colors.mjs';

const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
const themes = {};
for (const m of css.matchAll(/\[data-palette=(\w+)\]\[data-mode=(\w+)\]\{([^}]*)\}/g)) {
  const t = {}; for (const kv of m[3].split(/;(?![^(]*\))/)) { const i = kv.indexOf(':'); if (i > 0) t[kv.slice(0, i).replace(/^--/, '')] = kv.slice(i + 1).trim(); }
  themes[`${m[1]}/${m[2]}`] = t;
}
let fails = 0, checks = 0;
const solid = (v, behind) => { const r = /^rgba\((\d+),(\d+),(\d+),([.\d]+)\)$/.exec(v); if (!r) return v; const fg = '#' + [r[1], r[2], r[3]].map((x) => (+x).toString(16).padStart(2, '0')).join(''); return over(fg, +r[4], behind); };
function need(name, a, b, min, label) {
  checks++; const c = contrast(a, b);
  if (c < min) { fails++; console.error(`FAIL ${name}: ${label} ${c.toFixed(2)}:1 (needs ${min}) [${a} on ${b}]`); }
}
if (Object.keys(themes).length !== 18) { console.error('expected 18 themes, found', Object.keys(themes).length); process.exit(1); }
for (const [name, t] of Object.entries(themes)) {
  const dark = !name.endsWith('/light'), surfaces = ['bg', 'surface-1', 'surface-2', 'surface-3'];
  for (const s of surfaces) {
    need(name, t['text-1'], t[s], 7, `text-1 on ${s}`);
    need(name, t['text-2'], t[s], dark && s === 'bg' ? 7 : 4.5, `text-2 on ${s}`);
  }
  for (const s of ['bg', 'surface-1', 'surface-2']) need(name, t['text-3'], t[s], 4.5, `text-3 on ${s}`);
  for (const s of ['bg', 'surface-1']) {
    need(name, t['brand-ink'], t[s], 4.5, `brand-ink (links) on ${s}`);
    need(name, t.brand, t[s], 3, `brand (buttons, rings) on ${s}`);
    for (const k of ['accent', 'success', 'warning', 'danger', 'info']) need(name, t[k], t[s], 4.5, `${k} on ${s}`);
    need(name, t.star, t[s], 3, `star on ${s}`);
  }
  need(name, t['text-on-brand'], t.brand, 4.5, 'text on brand button');
  need(name, t['text-on-brand'], t['brand-hover'], 4.5, 'text on brand hover');
  need(name, t['brand-ink'], t['brand-soft'], 4.5, 'brand-ink text on brand-soft');
  need(name, t['brand-ink'], t['surface-2'], 4.5, 'brand-ink on surface-2');
  need(name, t.danger, t['danger-soft'], 4.5, 'danger text on danger-soft');
  need(name, t.success, t['success-soft'], 4.5, 'success text on success-soft');
  need(name, t.warning, t['warning-soft'], 4.5, 'warning text on warning-soft');
  for (const s of ['bg', 'surface-1']) need(name, solid(t.border, t[s]), t[s], 1.3, `border vs ${s}`);
  need(name, '#FFFFFF', '#000000', 1, 'sanity');
}
console.log(`${checks} contrast checks across ${Object.keys(themes).length} themes: ${fails ? fails + ' failed' : 'all passed'}`);
process.exit(fails ? 1 : 0);
