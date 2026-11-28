// Guard: every script in web/assets/js is either loaded by web/index.html or loaded on demand by ds-lazy.js.
// The on-demand list is read from ds-lazy.js itself (the file names inside need() and EVLazy), so it cannot drift.
// WEB-S11 found settings.js had been written but never loaded, so every /portal/settings link showed the dashboard.
const fs=require('fs');
const html=fs.readFileSync('web/index.html','utf8'),lazy=fs.readFileSync('web/assets/js/ds-lazy.js','utf8');
const body=lazy.slice(lazy.indexOf('function need('));
const ON_DEMAND=[...new Set([...body.matchAll(/"([\w-]+\.js)"/g)].map(m=>m[1]))];let bad=0;
if(!ON_DEMAND.length){console.log('FAIL no on-demand scripts found in ds-lazy.js');bad++}
for(const f of fs.readdirSync('web/assets/js').filter(x=>x.endsWith('.js'))){
  const loaded=html.includes('/assets/js/'+f),lz=ON_DEMAND.includes(f);
  if(!loaded&&!lz){console.log('FAIL '+f+' is not loaded by index.html and not on demand');bad++}
  if(loaded&&lz){console.log('FAIL '+f+' is on demand but also in index.html');bad++}
}
for(const f of ON_DEMAND)if(!fs.existsSync('web/assets/js/'+f)){console.log('FAIL ds-lazy.js names missing file '+f);bad++}
console.log(bad?bad+' problem(s)':'PASS every script is wired ('+ON_DEMAND.join(', ')+' on demand)');process.exitCode=bad?1:0;
