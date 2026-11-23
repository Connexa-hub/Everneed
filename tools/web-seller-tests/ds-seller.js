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
const ATTRS=[{collection_id:'c-bags',attribute_key:'brand',label:'Brand',input_type:'text',required:false,options:[]},
 {collection_id:'c-beauty',attribute_key:'skin_type',label:'Skin type',input_type:'multiselect',required:false,options:['Normal','Dry']},
 {collection_id:'c-beauty',attribute_key:'volume',label:'Net content',input_type:'number',required:true,unit:'ml/g',options:[]},
 {collection_id:'c-beauty',attribute_key:'expiry',label:'Expiry',input_type:'date',required:false,options:[]},
 {collection_id:'c-beauty',attribute_key:'type',label:'Type',input_type:'select',required:false,options:['A','B']}];
const EDITOR='<p class="sm">x</p><h1>Edit</h1><form data-form="wsprod" id="wsform"><div class="card"><h3>Product</h3></div><div class="card"><h3>Photos</h3></div><div class="card"><h3>Pricing</h3></div><div class="card"><h3>Inventory</h3></div><div class="card"><h3>Variants</h3></div><div class="card"><h3>Shipping and details</h3></div><div class="card"><h3>Status</h3><p>x</p></div></form>';
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
    if(p.startsWith('collections?'))return Promise.resolve([{id:'c-bags',name:'Bags',parent_id:null},{id:'c-beauty',name:'Beauty and Personal Care',parent_id:null}]);
    if(p.startsWith('category_attributes?'))return o.noattr?Promise.reject(new Error('x')):Promise.resolve(ATTRS);
    if(p.startsWith('products?select=col,attributes'))return Promise.resolve([{col:'Beauty and Personal Care',attributes:{skin_type:['Dry'],volume:50}}]);
    if(p.startsWith('products?'))return Promise.resolve(o.prods||PRODS);
    return Promise.resolve([])};
  x.ctx.Supa.rpc=(f)=>{x.calls.push('RPC '+f);
    if(f==='my_store_entitlements')return Promise.resolve(o.noent?null:ENT);
    if(f==='my_seller_orders')return o.failorders?Promise.reject(new Error('x')):Promise.resolve(o.orders||[{status:'pending',subtotal:5000,earning:4500,accept_by:'2026-11-23T10:00:00Z',customer_name:'Musa',created_at:'2026-11-22'},{status:'preparing',subtotal:2000,earning:1800}]);
    if(f==='seller_product_capabilities')return o.nocap?Promise.reject(new Error('x')):Promise.resolve(o.cap||{analytics_level:'none',promotions_enabled:false,bulk_tools_enabled:false});
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
 await t('home: plan card shows real usage',async()=>{
   const r=await seller().V.portal([]);assert(r.html.includes('3 of 10 products')&&r.html.includes('Today: 1 of 5'))});
 await t('home: modules the plan lacks show an upgrade card; included ones say data is not available yet',async()=>{
   const a=await seller().V.portal([]);assert((a.html.match(/href="\/portal\/plan">See plans/g)||[]).length===3&&a.html.includes('Analytics')&&!a.html.includes('Included in your plan'));
   const b=await seller({cap:{analytics_level:'advanced',promotions_enabled:true,bulk_tools_enabled:true}}).V.portal([]);
   assert((b.html.match(/Included in your plan/g)||[]).length===3&&b.html.includes('Analytics (advanced)')&&!b.html.includes('See plans'));
   const c=await seller({nocap:true}).V.portal([]);assert(!c.html.includes('Growth tools'),'unknown flags show nothing, not a guess')});
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
   assert((r.html.match(/data-act="ds-pmore"/g)||[]).length===4);
   assert(r.html.includes('class="ds-art')||r.html.includes('viewBox="0 0 64 64"'));
   assert(!r.html.includes('onerror=alert(1)>')&&r.html.includes('&lt;img'))});
 await t('products: filter chips carry real counts (archived excluded from All)',async()=>{
   const r=await seller().V.portal(['products']);
   assert(/data-id="all"[^>]*>All <span class="n">3<\/span>/.test(r.html)&&/data-id="archived"[^>]*>Archived <span class="n">1<\/span>/.test(r.html))});
 await t('products: empty store gets an empty state and no filters; a failing query falls back to the original page',async()=>{
   const e=await seller({prods:[]}).V.portal(['products']);assert(e.html.includes('No products yet')&&!e.html.includes('ds-pf'));
   const f=await seller({fail:p=>p.startsWith('products?')}).V.portal(['products']);assert.equal(f.html,'OLD products','a failing redesign falls back to the original page, never an error screen')});
 await t('products: bulk tools are a gate, not a button that does nothing',async()=>{
   const r=await seller().V.portal(['products']);assert(r.html.includes('ds-gate')&&r.html.includes('See plans'));const b=await seller({cap:{bulk_tools_enabled:true}}).V.portal(['products']);assert(b.html.includes('Bulk actions are not available yet')&&!b.html.includes('See plans'))});
 await t('actions added are prefixed ds-',async()=>{
   const x=seller();const base=make({}).A;Object.keys(x.A).filter(k=>!(k in base)).forEach(k=>assert(k.startsWith('ds-'),k))});
 await t('product editor: section nav, ids on every section, specs for the saved category with saved values, checklist',async()=>{
   const r=await seller({orig:{layout:'portal',title:'Product',active:'portal/products',html:EDITOR.replace('</h1>','</h1>')}}).V.portal(['product','p1']);
   ['basics','specs','photos','pricing','stock','variants','shipping','publish'].forEach(k=>{assert(r.html.includes('id="ds-sec-'+k+'"'),k);assert(r.html.includes('data-act="ds-jump" data-id="'+k+'"'),'nav '+k)});
   assert(r.html.includes('name="attr_volume"')&&r.html.includes('value="50"')&&r.html.includes('Net content (ml/g) *')&&r.html.includes('name="attrr_volume" value="Net content"'));
   assert(r.html.includes('name="attrt_skin_type" value="multiselect"')&&r.html.includes('name="attr_skin_type" value="Dry"')&&r.html.includes('aria-pressed="true">Dry'));
   assert(!r.html.includes('name="attr_brand"'),'other categories specs do not leak in');
   assert(r.html.includes('id="ds-check"')&&r.html.includes('Volume pricing')&&r.html.includes('not available yet'))});
 await t('product editor: unsafe spec text is escaped; a failed spec load says so and the rest still works',async()=>{
   const r=await seller({noattr:true,orig:{layout:'portal',title:'Product',active:'portal/products',html:EDITOR}}).V.portal(['product','new']);
   assert(r.html.includes('Specifications could not load')&&r.html.includes('id="wsform"'))});
 await t('product editor: plan without category specs gets an upgrade card instead of fields',async()=>{
   const r=await seller({cap:{category_attributes_enabled:false},orig:{layout:'portal',title:'Product',active:'portal/products',html:EDITOR}}).V.portal(['product','p1']);
   assert(r.html.includes('See plans')&&!r.html.includes('name="attrt_skin_type"')&&!r.html.includes('name="attrt_volume"'));
   assert(r.html.includes('name="attr_ds_rest" value="{&quot;skin_type&quot;:[&quot;Dry&quot;],&quot;volume&quot;:50}"'),'existing values are carried through untouched, never wiped')});
 await t('product editor: other pages and non-editor html fall through untouched',async()=>{
   assert.equal((await seller({orig:{layout:'portal',title:'Product',html:'Not found'}}).V.portal(['product','zz'])).html,'Not found')});

 await t('orders: lists live orders with filters, escapes names, shows true empty and error states',async()=>{
   const O=[{id:'a',order_id:'o1',status:'pending',subtotal:5000,earning:4500,created_at:'2026-11-23T01:00:00Z',customer_name:'<b>Eve</b>'},{id:'b',order_id:'o2',status:'delivered',subtotal:2000,earning:1800,created_at:'2026-11-20T01:00:00Z'}];
   const orig={layout:'portal',title:'Dashboard',active:'portal',html:'x'};
   const r=await seller({orders:O,orig}).V.portal(['orders']);
   assert.equal(r.title,'Orders');assert(r.html.includes('data-act="ds-of"')&&r.html.includes('&lt;b&gt;Eve')&&!r.html.includes('<b>Eve</b>')&&r.html.includes('Customer'));
   const e=await seller({orders:[],orig}).V.portal(['orders']);assert(e.html.includes('No orders yet')&&!e.html.includes('ds-od"'));
   const f=await seller({failorders:true,orig}).V.portal(['orders']);assert(f.html.includes('Orders could not load')&&f.html.includes('ds-reload'))});
 await t('orders: not shown for a store that is not live (falls back to the original page)',async()=>{
   const orig={layout:'portal',title:'Dashboard',html:'orig'};
   assert.equal((await seller({store:Object.assign({},STORE,{activation_status:'pending'}),orig}).V.portal(['orders'])).html,'orig')});

 await t('messages: the chat-link card is replaced by a compact one; other inbox html is untouched; admin layout is left alone',async()=>{
   const note='<div class="note" style="x"><span>y</span><button class="btn s" data-act="copylink" data-l="https://e.ng/#/chat/ada">Copy</button></div>';
   const x=seller({});x.V.inbox=()=>({layout:'portal',html:'<h1>Messages</h1>'+note+'<div class="ibx" id="ibx"></div>'});
   vm.runInContext(J('ds-seller.js'),x.ctx);
   const r=await x.V.inbox([]);assert(r.html.includes('ds-lnk')&&r.html.includes('data-l="https://e.ng/#/chat/ada"')&&!r.html.includes('class="note"')&&r.html.includes('<div class="ibx" id="ibx">'));
   const y=seller({});y.V.inbox=()=>({layout:'admin',html:note+'<div class="ibx"></div>'});vm.runInContext(J('ds-seller.js'),y.ctx);
   assert((await y.V.inbox([])).html.includes('class="note"'))});

 console.log(`${pass} passed, ${fail} failed`);
})();
