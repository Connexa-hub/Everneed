// Guard: every script in web/assets/js is either loaded by web/index.html or deliberately loaded on demand by ds-lazy.js.
// WEB-S11 found settings.js had been written but never loaded, so every /portal/settings link showed the dashboard.
const fs=require('fs'),path=require('path');
const html=fs.readFileSync('web/index.html','utf8'),lazy=fs.readFileSync('web/assets/js/ds-lazy.js','utf8');
const ON_DEMAND=['ds-editor.js','ds-team.js','ds-dispatch.js'];let bad=0;
for(const f of fs.readdirSync('web/assets/js').filter(x=>x.endsWith('.js'))){
  const loaded=html.includes('/assets/js/'+f),lz=ON_DEMAND.includes(f)&&lazy.includes(f);
  if(!loaded&&!lz){console.log('FAIL '+f+' is not loaded by index.html and not on demand');bad++}
}
for(const f of ON_DEMAND)if(html.includes('/assets/js/'+f)){console.log('FAIL '+f+' is on demand but also in index.html');bad++}
const order=html.indexOf('/assets/js/settings.js'),seller=html.indexOf('/assets/js/ds-seller.js');
if(order<0||order>seller){console.log('FAIL settings.js must load before ds-seller.js');bad++}
console.log(bad?bad+' problem(s)':'PASS every script is wired');process.exitCode=bad?1:0;
