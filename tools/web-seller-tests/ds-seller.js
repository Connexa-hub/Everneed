// Page-builder tests for the redesigned seller home and products list (ds-seller.js).
// Run from the repository root: node tools/web-seller-tests/ds-seller.js
const {make,J,vm}=require('./harness');
const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const icons=require('fs').readFileSync(require('path').join(__dirname,'../../shared/icons.js'),'utf8');
const STORE={id:'s1',name:'Ada <b>Fabrics</b>',slug:'ada',status:'approved',activation_status:'live',owner_id:'u1'};
const PRODS=[
 {id:'p1',name:'Ankara tote',col:'Bags',price:18500,old:22000,stock:3,status:'published',sku:'AT-1'},
 {id:'p2',name:'Draft shoe',col:'Shoes',price:9000,stock:20,status:'draft'},
 {id:'p3',name:'Bad <img src=x onerror=alert(1)>',col:'Skincare',price:500,stock:1,status:'rejected'},
 {id:'p4',name:'Old hat',col:'Accessories',price:100,stock:5,status:'archived'}];
const ENT={configured:true,plan_id:'growth',plan_name:'Growth',active_products:3,active_product_limit:10,active_products_unlimited:false,daily_new_products_used:1,daily_new_product_limit:5,daily_new_products_unlimited:false};
function seller(o){
  o=o||{};
  const x=make({});
  x.ctx.document={documentElement:{classList:{toggle(){},add(){},remove(){}}},body:null,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
  x.ctx.Core.path=()=>'/portal';x.ctx.Core.go=(p)=>x.calls.push('GO '+p);
  const C=x.ctx.Core;C.money=C.money||((n)=>'₦'+Number(n||0).toLocaleString());C.when=C.when||((d)=>String(d));C.ago=C.ago||(()=> 'just now');
  vm.runInContext(icons,x.ctx);vm.runInContext(J('ds.js'),x.ctx);
  x.ctx.Supa.uid=()=>o.anon?null:'u1';
  x.ctx.Supa.get=(p)=>{x.calls.push('GET '+p);
    if(o.fail&&o.fail(p))return Promise.reject(new Error('boom'));
    if(p.startsWith('stores?'))return Promise.resolve([o.store||STORE]);
    if(p.startsWith('products?'))return Promise.resolve(o.prods||PRODS);
    return Promise.resolve([])};
  x.ctx.Supa.rpc=(f)=>{x.calls.push('RPC '+f);
    if(f==='my_store_entitlements')return Promise.resolve(o.noent?null:ENT);
    if(f==='my_seller_orders')return o.failorders?Promise.reject(new Error('x')):Promise.resolve(o.orders||[{status:'pending',subtotal:5000,earning:4500,accept_by:'2026-11-23T10:00:00Z',customer_name:'Musa',created_at:'2026-11-22'},{status:'preparing',subtotal:2000,earning:1800}]);
    return Promise.resolve(null)};
  x.V.portal=(p)=>Promise.resolve(o.orig||{layout:'portal',active:p[0]?'portal/'+p[0]:'portal',title:p[0]==='products'?'Products':'Dashboard',html:'OLD '+p.join('/')});
  vm.runInContext(J('ds-seller.js'),x.ctx);
  return x;
}
(async()=>{
 await t('home: live store gets cards, real counts, escaped name',async()=>{
   const r=(await seller().V.portal([]));
   assert.equal(r.layout,'portal');assert(r.html.includes('ds-hero')&&r.html.includes('ds-stats'));
   assert(r.html.includes('Ada &lt;b&gt;Fabrics')&&!r.html.includes('<b>Fabrics'));
   assert(r.html.includes('data-count="1"'),'1 new order');assert(r.html.includes('1 new order waiting'))});
 await t('home: plan card shows real usage; gated modules say not available yet and invent no number',async()=>{
   const r=await seller().V.portal([]);
   assert(r.html.includes('3 of 10 products')&&r.html.includes('Today: 1 of 5'));
   assert((r.html.match(/Not available yet/g)||[]).length>=3&&r.html.includes('Analytics')&&r.html.includes('Promotions')&&!/upgrade/i.test(r.html))});
 await t('home: no entitlements means no plan card, not a made-up plan',async()=>{
   const r=await seller({noent:true}).V.portal([]);assert(!r.html.includes('ds-ringcard'))});
 await t('home: rejected and low-stock products become to-do rows with links',async()=>{
   const r=await seller().V.portal([]);assert(r.html.includes('/portal/product/p3')&&r.html.includes('Running low')&&r.html.includes('1 draft not sent yet'))});
 await t('home: zero state tells the truth (add first product, no orders)',async()=>{
   const r=await seller({prods:[],orders:[]}).V.portal([]);
   assert(r.html.includes('Add your first product')&&r.html.includes('No orders yet')&&r.html.includes('data-count="0"'))});
 await t('home: a failed query shows a warning, never a clean "all caught up"',async()=>{
   const r=await seller({failorders:true}).V.portal([]);assert(r.html.includes('Some numbers could not load')&&r.html.includes('data-act="ds-reload"'))});
 await t('home: not live, anonymous and other routes fall through to the existing pages',async()=>{
   assert.equal((await seller({store:Object.assign({},STORE,{activation_status:'verification_required'})}).V.portal([])).html,'OLD ');
   assert.equal((await seller({anon:true}).V.portal([])).html,'OLD ');
   assert.equal((await seller().V.portal(['product','p1'])).html,'OLD product/p1');
   assert.equal((await seller({orig:{layout:'setup',html:'S'}}).V.portal([])).html,'S')});
 await t('products: cards for every product with art fallback, status chips and real actions',async()=>{
   const r=await seller().V.portal(['products']);
   assert.equal((r.html.match(/<article class="ds-card ds-pr"/g)||[]).length,4);
   assert(r.html.includes('data-act="wsub" data-id="p2"')&&r.html.includes('data-act="wdup"')&&r.html.includes('data-act="ds-arch" data-id="p1"')&&r.html.includes('data-act="wrest" data-id="p4"'));
   assert(r.html.includes('class="ds-art')||r.html.includes('viewBox="0 0 64 64"'));
   assert(!r.html.includes('onerror=alert(1)>')&&r.html.includes('&lt;img'))});
 await t('products: filter chips carry real counts (archived excluded from All)',async()=>{
   const r=await seller().V.portal(['products']);
   assert(/data-id="all"[^>]*>All <span class="n">3<\/span>/.test(r.html)&&/data-id="archived"[^>]*>Archived <span class="n">1<\/span>/.test(r.html))});
 await t('products: empty store gets an empty state and no filters; failure is an error with retry',async()=>{
   const e=await seller({prods:[]}).V.portal(['products']);assert(e.html.includes('No products yet')&&!e.html.includes('ds-pf'));
   const f=await seller({fail:p=>p.startsWith('products?')}).V.portal(['products']);assert(f.html.includes('could not load')&&f.html.includes('data-act="ds-reload"'))});
 await t('products: bulk tools are a gate, not a button that does nothing',async()=>{
   const r=await seller().V.portal(['products']);assert(r.html.includes('ds-gate')&&r.html.includes('Not available yet'))});
 await t('actions added are prefixed ds-',async()=>{
   const x=seller();const base=make({}).A;Object.keys(x.A).filter(k=>!(k in base)).forEach(k=>assert(k.startsWith('ds-'),k))});
 console.log(`${pass} passed, ${fail} failed`);
})();
