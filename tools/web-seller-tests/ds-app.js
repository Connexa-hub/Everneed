// Tests for the app-style seller shell (ds-app.js). Run from the repository root: node tools/web-seller-tests/ds-app.js
const {make,J,vm}=require('./harness');const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const icons=require('fs').readFileSync(require('path').join(__dirname,'../../shared/icons.js'),'utf8');
function shell(o){o=o||{};const x=make({});const store={};
  x.ctx.document={documentElement:{classList:{toggle(c,v){x.cls=x.cls||{};x.cls[c]=v},add(){},remove(){}}},body:null,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
  x.ctx.localStorage={getItem:k=>store[k]===undefined?null:store[k],setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}};
  x.ctx.matchMedia=()=>({matches:o.phone!==false});x.ctx.location={search:o.search||'',pathname:o.path||'/portal'};x.ctx.setTimeout=()=>0;
  x.ctx.window=x.ctx;x.ctx.Core.path=()=>'/portal';
  vm.runInContext(icons,x.ctx);vm.runInContext(J('ds.js'),x.ctx);
  x.ctx.AX={shell(){return'<prev/>'},bell:()=>'<bell/>'};x.ctx.window.AX=x.ctx.AX;
  vm.runInContext(J('ds-app.js'),x.ctx);x.store=store;return x}
(async()=>{
 await t('off by default: the normal shell is used and nothing changes',()=>{
   const x=shell();assert.equal(x.ctx.AX.shell('portal','portal','<p>x</p>',{}),'<prev/>');assert.equal(x.cls['ds-appsh'],false)});
 await t('?shell=app on a phone: floating bar with search, home, orders, products, menu and messages; remembered',()=>{
   const x=shell({search:'?shell=app'});const h=x.ctx.AX.shell('portal','portal/orders','<p>x</p>',{name:'Ada'});
   assert(h.includes('ds-ab')&&h.includes('data-act="ds-asearch"')&&h.includes('data-act="ds-amenu"')&&h.includes('href="/portal/orders" class="on"')&&h.includes('href="/inbox"')&&h.includes('href="/portal/products"')&&h.includes('<p>x</p>'));
   assert.equal(x.store['ev-shell'],'app');assert.equal(x.cls['ds-appsh'],true)});
 await t('not on wide screens, not for admin, ?shell=web turns it off',()=>{
   assert.equal(shell({search:'?shell=app',phone:false}).ctx.AX.shell('portal','portal','',{}),'<prev/>');
   assert.equal(shell({search:'?shell=app'}).ctx.AX.shell('admin','admin','',{}),'<prev/>');
   const x=shell({search:'?shell=web'});assert.equal(x.ctx.AX.shell('portal','portal','',{}),'<prev/>');assert.equal(x.store['ev-shell'],'web')});
 await t('product editor hides the floating bar so the action bar owns the bottom',()=>{
   const x=shell({search:'?shell=app',path:'/portal/product/p1'});const h=x.ctx.AX.shell('portal','portal/product','<form/>',{});
   assert(!h.includes('class="ds-ab"')&&h.includes('<form/>'))});
 await t('names are escaped in the header',()=>{
   const x=shell({search:'?shell=app'});const h=x.ctx.AX.shell('portal','portal','',{name:'<img onerror=1>'});assert(!h.includes('<img onerror'))});
 await t('screen titles get a switcher (not Home); menu lists store settings',()=>{
   const x=shell({search:'?shell=app'});const h=x.ctx.AX.shell('portal','portal/products','<div><h1 class="ds-title">Products</h1></div>',{});
   assert(h.includes('data-act="ds-asw"')&&h.includes('>Products<'));
   const hm=x.ctx.AX.shell('portal','portal','<h1 class="ds-title">My shop</h1>',{});assert(!hm.includes('ds-asw'));
   assert(typeof x.ctx.Core.A['ds-amenu']==='function'&&typeof x.ctx.Core.A['ds-asw']==='function')});

 console.log(`${pass} passed, ${fail} failed`);
})();
