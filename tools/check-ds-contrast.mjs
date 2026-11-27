// Verifies the colour pairs used by web/assets/css/ds.css in every palette and mode (6 palettes x 3 modes = 18 themes).
// The generic token pairs are covered by check-contrast.mjs; this file covers the pairs the design system layer adds.
import { readFileSync } from 'node:fs';
import { contrast } from './colors.mjs';

const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
const themes = {};
for (const m of css.matchAll(/\[data-palette=(\w+)\]\[data-mode=(\w+)\]\{([^}]*)\}/g)) {
  const t = {}; for (const kv of m[3].split(/;(?![^(]*\))/)) { const i = kv.indexOf(':'); if (i > 0) t[kv.slice(0, i).replace(/^--/, '')] = kv.slice(i + 1).trim(); }
  themes[`${m[1]}/${m[2]}`] = t;
}
if (Object.keys(themes).length !== 18) { console.error('expected 18 themes, found', Object.keys(themes).length); process.exit(1); }
// [foreground role, background role, minimum ratio, where it is used]
const PAIRS = [
  ['text-2', 'surface-3', 4.5, 'inactive segment on the segmented control'],
  ['text-2', 'surface-2', 4.5, 'secondary text on fact tiles and gates'],
  ['text-1', 'brand-soft', 4.5, 'selected option or tile, hero'],
  ['text-2', 'brand-soft', 4.5, 'option description when selected, hero subtitle'],
  ['brand-ink', 'brand-soft', 4.5, 'chip, plan badge, row icon, undo button'],
  ['text-on-brand', 'brand', 4.5, 'primary button, Pro badge, count bubble'],
  ['bg', 'text-1', 7, 'Official badge (inverted)'],
  ['success', 'success-soft', 4.5, 'success chip'], ['warning', 'warning-soft', 4.5, 'warning chip and tile icon'], ['danger', 'danger-soft', 4.5, 'error chip, danger button, tile icon'],
  ['text-1', 'success-soft', 4.5, 'success banner text'], ['text-1', 'warning-soft', 4.5, 'warning banner text'], ['text-1', 'danger-soft', 4.5, 'error banner text'],
  ['info', 'surface-1', 4.5, 'info chip, info icon'], ['success', 'surface-1', 4.5, 'toast icon'], ['danger', 'surface-1', 4.5, 'toast icon'], ['warning', 'surface-1', 4.5, 'toast icon'],
  ['text-3', 'surface-1', 4.5, 'placeholder text'], ['text-3', 'surface-2', 4.5, 'search placeholder'],
  ['text-1', 'surface-1', 7, 'card text'], ['text-1', 'surface-3', 7, 'chip text'],
  ['brand', 'surface-1', 3, 'ring, focus outline, selected tick border'], ['brand', 'surface-3', 3, 'ring track neighbour'],
];
let fails = 0, checks = 0;
for (const [name, t] of Object.entries(themes)) for (const [fg, bg, min, where] of PAIRS) {
  if (!t[fg] || !t[bg]) { console.error(`MISSING ${name}: ${fg} or ${bg}`); fails++; continue; }
  checks++; const c = contrast(t[fg], t[bg]);
  if (c < min) { fails++; console.error(`FAIL ${name}: ${fg} on ${bg} ${c.toFixed(2)}:1 (needs ${min}) [${where}]`); }
}
if (fails) { console.error(`${fails} of ${checks} design-system contrast checks failed`); process.exit(1); }
console.log(`${checks} design-system contrast checks across 18 themes: all passed`);
