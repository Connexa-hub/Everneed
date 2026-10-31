// Writes MANIFEST.txt: every file that belongs to this release. Run before zipping a release.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
export const SKIP = new Set(['.git', 'node_modules', 'android', 'www', 'package-lock.json', 'MANIFEST.txt']);
export function listFiles(dir = '.', out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = dir === '.' ? n : dir + '/' + n;
    if (statSync(p).isDirectory()) listFiles(p, out); else out.push(p);
  }
  return out.sort();
}
if (process.argv[1] && process.argv[1].endsWith('make-manifest.mjs')) {
  const files = listFiles();
  writeFileSync('MANIFEST.txt', files.join('\n') + '\n');
  console.log('MANIFEST.txt written with', files.length, 'files');
}
