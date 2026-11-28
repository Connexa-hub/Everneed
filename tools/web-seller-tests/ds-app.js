// Tests for the app-style seller shell (ds-app.js). Run from the repository root: node tools/web-seller-tests/ds-app.js
const {make,J,vm}=require('./harness');const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const icons=require('fs').readFileSync(require('path').join(__dirname,'../../shared/icons.js'),'utf8');
function shell(o){o=o||{};const x=make({});const store={};
  x.ctx.document={documentElement:{classList:{toggle(c,v){x.cls=x.cls||{};x.cls[c]=v},add(){},remove(){}}},body:null,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
  x.ctx.localStorage={getItem:k=>store[k]===undefined?null:store[k],setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}};
  x.ctx.matchMedia=()=>({matches:o.phone!==false});x.ctx.location={search:o.search||'',pathname:o.path||'/portal'};x.ctx.setTimeout=()=>0;
  x.ctx.history={length:o.hist||3,back(){x.went='back'}};x.ctx.window=x.ctx;if(o.native){x.ctx.EV_NATIVE_SELLER=true;x.ctx.Capacitor={Plugins:{App:{addListener(n,f){x.listen=x.listen||{};x.listen[n]=f}}}}}x.ctx.Core.path=()=>x.ctx.location.pathname;
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

 await t('admin: Platform reaches platform and store links; Everneed Store workspace shows only store links',()=>{
   const x=shell({search:'?shell=app'});const me={role:'admin',name:'Ada'};
   x.ctx.Core.adminCtx=()=>'platform';const p=x.ctx.AX.shell('admin','admin/sellers','<p/>',me);
   assert(p.includes('href="/admin/sellers" class="on"')&&p.includes('href="/admin/review"')&&p.includes('href="/inbox"')&&p.includes('data-act="ds-ctx"'));
   x.ctx.Core.adminCtx=()=>'store';const s=x.ctx.AX.shell('admin','admin/store/orders','<p/>',me);
   assert(s.includes('href="/admin/store/orders" class="on"')&&s.includes('href="/admin/store/messages"')&&!s.includes('href="/admin/sellers"')&&!s.includes('href="/admin/review"')&&!s.includes('href="/inbox"'));
   assert.equal(x.ctx.AX.shell('admin','admin','','' ),'<prev/>');
   assert.equal(x.ctx.AX.shell('admin','admin','',{role:'merchant'}),'<prev/>')});

 await t('packaged app: EV_NATIVE_SELLER turns the shell on and exposes exit and back hooks',()=>{
   const x=shell();x.ctx.window.EV_NATIVE_SELLER=true;
   assert(x.ctx.AX.shell('portal','portal','<p/>',{}).includes('ds-ab'));
   assert(typeof x.ctx.window.EVSeller.exit==='function'&&x.ctx.window.EVSeller.back()===false)});

 // ---- Android Back (X2-04)
 await t('Android Back: registered only in the native bundle; website does nothing',()=>{
   assert.equal(shell({search:'?shell=app'}).listen,undefined);assert.equal(typeof shell({native:true}).listen.backButton,'function')});
 await t('Android Back: one step back on an inner page; leaves to the shopping side from the first screen; overlays close first',()=>{
   let x=shell({native:true,path:'/portal/products'});x.ctx.EVSeller.exit=(to)=>{x.exited=to};x.listen.backButton();assert.equal(x.went,'back');assert.equal(x.exited,undefined);
   x=shell({native:true,path:'/portal'});x.ctx.EVSeller.exit=(to)=>{x.exited=to};x.listen.backButton();assert.equal(x.exited,'');assert.equal(x.went,undefined);
   x=shell({native:true,path:'/portal/products',hist:1});x.ctx.EVSeller.exit=(to)=>{x.exited=to};x.listen.backButton();assert.equal(x.exited,'','no history left: leave rather than close the app');
   x=shell({native:true,path:'/portal/products'});x.ctx.EVSeller.exit=(to)=>{x.exited=to};x.ctx.EVSeller.back=()=>true;x.listen.backButton();assert.equal(x.went,undefined);assert.equal(x.exited,undefined)});
 console.log(`${pass} passed, ${fail} failed`);
})();
