// Tests for the lazy editor loader (ds-lazy.js). Run from the repository root: node tools/web-seller-tests/ds-lazy.js
const {make,J,vm}=require('./harness');const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
function setup(mode){const x=make({});const calls=[];const base=p=>Promise.resolve({html:'plain:'+p[0]});
  x.ctx.Core.V.portal=base;x.ctx.Core.V.admin=base;x.ctx.window=x.ctx;const added=[];
  x.ctx.document={currentScript:{src:'/seller/assets/js/ds-lazy.js'},head:{appendChild(s){added.push(s);
    setTimeout(()=>{if(mode==='fail'){s.onerror()}else{const prev=x.ctx.Core.V.portal;x.ctx.Core.V.portal=p=>Promise.resolve(prev(p)).then(r=>({html:'editor:'+r.html}));s.onload()}},0)}},createElement:()=>({})};x.ctx.location={search:(global.__q||'')};x.ctx.sessionStorage={getItem:k=>(global.__s||{})[k]||null,setItem:(k,v)=>{(global.__s=global.__s||{})[k]=v},removeItem:k=>{if(global.__s)delete global.__s[k]}};
  x.ctx.setTimeout=setTimeout;vm.runInContext(J('ds-lazy.js'),x.ctx);x.added=added;return x}
(async()=>{
 await t('other portal pages never load the editor',async()=>{const x=setup();const r=await x.ctx.Core.V.portal(['orders']);assert.equal(r.html,'plain:orders');assert.equal(x.added.length,0)});
 await t('product page loads the editor once from the same folder, then uses it',async()=>{
   const x=setup();const r=await x.ctx.Core.V.portal(['product']);assert.equal(r.html,'editor:plain:product');assert.equal(x.added.length,1);assert.equal(x.added[0].src,'/seller/assets/js/ds-editor.js');
   const r2=await x.ctx.Core.V.portal(['product']);assert.equal(x.added.length,1);assert(r2.html.startsWith('editor:'))});
 await t('if the file cannot load, the plain editor page still opens',async()=>{const x=setup('fail');const r=await x.ctx.Core.V.portal(['product']);assert.equal(r.html,'plain:product')});
 await t('team preview loads only with the flag, and only for the team and staff routes',async()=>{
   global.__q='';global.__s={};let x=setup();await x.ctx.Core.V.portal(['team']);await x.ctx.Core.V.admin(['staff']);assert.equal(x.added.length,0);
   global.__q='?proto=roles';x=setup();const r=await x.ctx.Core.V.portal(['team']);assert.equal(x.added.length,1);assert.equal(x.added[0].src,'/seller/assets/js/ds-team.js');
   await x.ctx.Core.V.portal(['orders']);assert.equal(x.added.length,1);global.__q='?proto=off';x=setup();await x.ctx.Core.V.portal(['team']);assert.equal(x.added.length,0);global.__q='';global.__s={}})
 await t('dispatcher preview: admin route only, only with the flag',async()=>{
   global.__q='?proto=1';global.__s={};let x=setup();await x.ctx.Core.V.portal(['dispatch']);assert.equal(x.added.length,0);await x.ctx.Core.V.admin(['dispatch']);assert.equal(x.added.length,1);assert.equal(x.added[0].src,'/seller/assets/js/ds-dispatch.js');
   global.__q='';global.__s={};x=setup();await x.ctx.Core.V.admin(['dispatch']);assert.equal(x.added.length,0);global.__q='';global.__s={}})
 await t('hub board: admin route loads ds-hub.js without any flag, once; not for the portal or other admin pages; falls back if it cannot load',async()=>{
   global.__q='';global.__s={};let x=setup();await x.ctx.Core.V.portal(['hub']);assert.equal(x.added.length,0);await x.ctx.Core.V.admin(['review']);assert.equal(x.added.length,0);
   await x.ctx.Core.V.admin(['hub']);assert.equal(x.added.length,1);assert.equal(x.added[0].src,'/seller/assets/js/ds-hub.js');await x.ctx.Core.V.admin(['hub']);assert.equal(x.added.length,1);
   x=setup('fail');const r=await x.ctx.Core.V.admin(['hub']);assert.equal(r.html,'plain:hub')})
 console.log(pass+' passed, '+fail+' failed')})();
