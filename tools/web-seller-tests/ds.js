// Page-builder tests for the design system (ds.js) and the redesigned admin screens (ds-admin.js).
// Run from the repository root: node tools/web-seller-tests/ds.js
const {make,J,vm,PLANS}=require('./harness');
const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const icons=require('fs').readFileSync(require('path').join(__dirname,'../../shared/icons.js'),'utf8');

// Browser stand-ins that ds.js needs at load time (it only touches the DOM when body exists, which it does not in Node).
function load(over,extra){
  const x=make(over||{});
  x.ctx.document={documentElement:{classList:{toggle(){},add(){},remove(){}}},body:null,getElementById:()=>null,querySelector:()=>null,addEventListener(){}};
  x.ctx.Core.path=()=> '/admin';x.ctx.Core.go=(p)=>x.calls.push('GO '+p);
  vm.runInContext(icons,x.ctx);
  vm.runInContext(J('ds.js'),x.ctx);
  const old=x.V.admin=x.V.admin||((p)=>Promise.resolve({layout:'admin',html:'OLD '+p.join('/')}));
  if(extra)extra(x);
  return x;
}
const stores=[
  {id:'everneed-official',name:'EverNeed',slug:'everneed',status:'approved',activation_status:'live',is_official:true,store_subscriptions:[]},
  {id:'s1',name:'Ada Fabrics',slug:'ada',status:'approved',activation_status:'live',is_official:false,city:'Ikeja',state:'Lagos',store_subscriptions:[{status:'active',current_period_end:'2026-12-01',plan_id:'plan-growth'}]},
  {id:'s3',name:'Zuri Beauty',slug:'zuri',status:'suspended',activation_status:'live',is_official:false,store_subscriptions:[]},
  {id:'s4',name:'Bola Shoes',slug:'bola',status:'approved',activation_status:'verification_required',is_official:false,store_subscriptions:[]},
  {id:'s2',name:'<img src=x onerror=alert(1)>',slug:'kano',status:'pending',is_official:false,owner_id:'u2',categories:['Bags','Shoes','Fashion and Clothing','Accessories'],city:'Kano',state:'Kano',about:'Hand-made bags',store_applications:[{plan_id:'plan-pro',submitted_at:'2026-11-18'}],store_private:[{phone:'0803'}]}];
const CTX={store:{id:'everneed-official',name:'EverNeed',is_official:true,status:'approved',activation_status:'live'},counts:{products:3,draft_products:1,pending_review_products:1,published_products:1,archived_products:0,variants:2,low_stock_variants:1,seller_orders:4},capabilities:{bulk_tools_enabled:true},
  module_readiness:{catalogue:'ready',variants:'ready_for_catalogue_only',media_uploads:'pending_storage_contract',bulk_edit:'pending',orders:'existing_contract',finance_and_settlement:'existing_contract_with_pending_payout_work',quantity_price_tiers:'stored_not_checkout_integrated'}};
function admin(opts){
  opts=opts||{};
  return load(opts.over,(x)=>{
    x.ctx.Core.me=()=>opts.me||({role:'admin',name:'Ada Admin'});
    x.ctx.Supa.get=(p)=>{x.calls.push('GET '+p);
      if(opts.fail&&opts.fail(p))return Promise.reject(new Error('boom'));
      const o=opts.data||{};
      if(p.startsWith('stores?id=eq')||p.startsWith('stores?select=id,name,logo_url'))return Promise.resolve([stores[0]]);
      if(p.startsWith('stores?')){if(p.includes('status=eq.pending'))return Promise.resolve(o.pending||[stores[4]]);return Promise.resolve(o.stores||stores)}
      if(p.startsWith('store_plans'))return Promise.resolve(PLANS);
      if(p.startsWith('profiles'))return Promise.resolve([{id:'u2',name:'Musa Bello',email:'musa@kano.ng',phone:'0803'}]);
      if(p.startsWith('products?select=*,stores'))return Promise.resolve(o.review||[{id:'p1',name:'Leather tote',col:'Bags',price:18500,old:22000,stock:12,descr:'Zip tote',stores:{name:'Kano Leather'},product_private:{compliance_ref:'REG-1'}}]);
      if(p.startsWith('products?select=id&'))return Promise.resolve(o.review||[{id:'p1'}]);
      if(p.startsWith('products?'))return Promise.resolve(o.products||[]);
      if(p.startsWith('orders?'))return Promise.resolve(o.orders||[{total:25000,payment_status:'paid'},{total:1500000,payment_status:'paid'},{total:900,payment_status:'pending'}]);
      if(p.startsWith('seller_orders?select=commission'))return Promise.resolve(o.so||[{commission:2500,status:'delivered'},{commission:0,status:'issue'}]);
      if(p.startsWith('seller_orders?'))return Promise.resolve(o.sorders||[]);
      if(p.startsWith('disputes'))return Promise.resolve(o.disputes||[{id:'d'}]);
      if(p.startsWith('deliveries'))return Promise.resolve([]);
      if(p.startsWith('support_queue'))return Promise.resolve(o.support||[]);
      if(p.startsWith('conversations'))return Promise.resolve(o.convs||[]);
      if(p.startsWith('staff_members'))return o.staff?Promise.resolve(o.staff):Promise.reject(new Error('relation "public.staff_members" does not exist'));
      return Promise.resolve([])};
    x.ctx.Supa.rpc=(f,a)=>{x.calls.push('RPC '+f+' '+JSON.stringify(a));if(f==='admin_store_workspace_context')return opts.noctx?Promise.reject(new Error('nope')):Promise.resolve(opts.ctxv||CTX);return Promise.resolve(null)};
    vm.runInContext(J('ds-admin.js'),x.ctx);
  });
}

(async()=>{
 // ---------------- design system builders ----------------
 const ds=load().ctx.DS;
 await t('every one of the 22 real categories maps to its own art (and Skincare is not a car)',()=>{
   const M={"Accessories":"jewellery","Automotive":"auto","Baby and Kids":"baby","Bags":"bags","Beauty and Personal Care":"beauty","Books and Stationery":"books","Building and Tools":"tools","Computers":"computers","Electronics":"audio","Fashion and Clothing":"apparel","Food and Drinks":"food","Furniture":"home","Groceries":"grocery","Hair and Wigs":"hair","Home and Kitchen":"kitchen","Office Supplies":"office","Pet Supplies":"pets","Phones and Tablets":"phones","Shoes":"shoes","Skincare":"beauty","Sports and Fitness":"sports","Toys and Games":"toys"};
   for(const n in M)assert.equal(ds.artFor(n),M[n],n);assert.equal(Object.keys(M).length,22);assert.equal(ds.artFor('Something else'),'other')});
 await t('every art key draws, and no drawing leaves an unclassed shape (would fill black)',()=>{
   const keys=Object.keys(ds.ART);assert(keys.length>=25);keys.forEach(k=>{const s=ds.art(k,40);assert(s.includes('viewBox="0 0 64 64"'));assert(!/<(path|circle|rect|ellipse)(?![^>]*class=)/.test(s),k+' has an unclassed shape')})});
 await t('icons: unknown name falls back, no emoji anywhere in the icon set',()=>{
   assert(ds.icon('does-not-exist').includes('#dsi-dot'));assert(ds.icon('plus',24).includes('width="24"'));
   Object.keys(ds.IC).forEach(k=>assert(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(ds.IC[k]),k))});
 await t('big money is compact so it cannot clip on a 360px phone; small money is exact',()=>{
   const a=ds.stat({icon:'wallet',value:2450000,money:true,label:'GMV'}),b=ds.stat({icon:'wallet',value:5000,money:true,label:'x'});
   assert(a.includes('₦2.45M')&&a.includes('title="₦2,450,000"'));assert(b.includes('₦5,000')&&!b.includes('M<'))});
 await t('builders escape text (no script or markup injection)',()=>{
   const bad='<img src=x onerror=alert(1)>';
   [ds.empty({title:bad,text:bad}),ds.banner('error',bad,bad,{label:bad,act:'x'}),ds.gate({title:bad,text:bad,action:{href:'/x',label:bad}}),ds.row({title:bad,sub:bad}),ds.stat({label:bad,value:bad}),ds.chip(bad),ds.plan(bad),ds.seg([{label:bad,href:'/a'}])]
     .forEach(h=>assert(!h.includes('<img'),h.slice(0,60)))});
 await t('banner roles: errors are alerts, others are status; segmented control marks the active tab',()=>{
   assert(ds.banner('error','x').includes('role="alert"'));assert(ds.banner('info','x').includes('role="status"'));
   const s=ds.seg([{label:'A',href:'/a',on:true},{label:'B',href:'/b'}]);assert(s.includes('aria-current="page"')&&s.includes('class="ds-seg"'))});
 await t('empty states are illustrated; Core.empty and Core.toast now use the design system',()=>{
   const x=load();const e=x.ctx.Core.empty('No products yet','Add one');assert(e.includes('ds-empty')&&e.includes('ds-duo')&&e.includes('#dsi-box'));
   assert(x.ctx.Core.empty('Nothing in your inbox').includes('#dsi-chat'));assert.equal(typeof x.ctx.Core.ask,'function')});
 await t('status ring clamps and labels; plan badge classes',()=>{
   assert(ds.ring(140).includes('stroke-dashoffset="0.0"'));assert(ds.ring(-5).includes('stroke-dashoffset="113.1"'));assert(ds.ring(50,'','x of y').includes('aria-label="x of y"'));
   assert(ds.plan('Pro').includes('ds-plan pro')&&ds.plan('',true).includes('official')&&ds.plan('Free').includes('ds-plan "'))});

 // ---------------- admin overview ----------------
 await t('overview: live numbers, only non-zero tasks, no all-clear when something waits, no verification wording',async()=>{
   const x=admin();const r=await x.V.admin([]);
   assert.equal(r.layout,'admin');assert(r.html.includes('Hello, Ada'));
   assert(r.html.includes('data-count="1"')&&r.html.includes('Live stores'));
   assert(r.html.includes('Applications waiting')&&r.html.includes('Products to review')&&r.html.includes('Open disputes')&&r.html.includes('Delivery exceptions'));
   assert(!r.html.includes('Customers waiting for support'),'support queue is empty so no row');assert(!r.html.includes('All clear'));
   assert(r.html.includes('data-count="25000"')===false&&r.html.includes('₦1.53M'),'gmv counts paid orders only: 25000+1500000');
   assert(r.html.includes('1 of 4 stores are live')&&r.html.includes('Official store not counted'));assert(!/verif/i.test(r.html))});
 await t('overview: everything zero shows a real all-clear, not a made-up number',async()=>{
   const x=admin({data:{stores:[stores[0]],review:[],orders:[],disputes:[],support:[],so:[]}});const r=await x.V.admin([]);
   assert(r.html.includes('All clear')&&!r.html.includes('Needs attention'))});
 await t('overview: a failed query is shown as a warning, never as all clear',async()=>{
   const x=admin({fail:(p)=>p.startsWith('disputes')||p.startsWith('orders')});const r=await x.V.admin([]);
   assert(r.html.includes('Some figures could not load')&&r.html.includes('2 of 7')&&!r.html.includes('All clear')&&r.html.includes('data-act="ds-reload"'))});
 await t('overview: order totals say when they are capped (until admin_overview_stats exists)',async()=>{
   const many=Array.from({length:1000},()=>({total:1,payment_status:'paid'}));const x=admin({data:{orders:many}});const r=await x.V.admin([]);
   assert(r.html.includes('latest 1,000 orders')&&r.html.includes('admin_overview_stats()'))});

 // ---------------- seller operations ----------------
 await t('applications: rich card with owner, plan badge, categories and real actions; store text escaped',async()=>{
   const x=admin();const r=await x.V.admin(['sellers']);
   assert(r.active==='admin/sellers'&&r.html.includes('ds-seg')&&r.html.includes('Applications <span class="n">1</span>'));
   assert(r.html.includes('data-act="aappr" data-id="s2"')&&r.html.includes('data-act="arej" data-id="s2"')&&r.html.includes('data-lp='));
   assert(r.html.includes('ds-plan pro')&&r.html.includes('Fashion and Clothing')&&r.html.includes('+1')&&r.html.includes('Musa Bello')&&r.html.includes('musa@kano.ng'));
   assert(!r.html.includes('<img src=x'),'application name must be escaped')});
 await t('applications: empty state when nothing is waiting',async()=>{
   const x=admin({data:{pending:[]}});const r=await x.V.admin(['sellers']);assert(r.html.includes('No applications waiting')&&!r.html.includes('data-act="aappr"'))});
 await t('stores: filter chips with real counts, state per card, right action per state, official is never suspendable',async()=>{
   const x=admin();const r=await x.V.admin(['sellers','stores']);
   ['live','notlive','pending','suspended','official'].forEach(k=>assert(r.html.includes('data-k="'+k+'"'),k));
   assert(r.html.includes('data-act="ds-sf" data-id="suspended"'));assert(r.html.includes('data-act="ssus" data-id="s1"')&&r.html.includes('data-act="sback" data-id="s3"'));
   assert(!r.html.includes('data-act="ssus" data-id="everneed-official"')&&r.html.includes('href="/admin/store"'));
   assert(r.html.includes('Approved, not live')&&r.html.includes('ds-plan growth')&&r.html.includes('admin_store_directory()'),'points to the backend request instead of faking counts');
   assert(!/data-count/.test(r.html.split('ds-grid c2')[1]),'no per-store product or order numbers are invented')});
 await t('stores: a failed plan lookup is an error page, not a page with missing plans',async()=>{
   const x=admin({fail:(p)=>p.startsWith('store_plans')});const r=await x.V.admin(['sellers','stores']);assert(r.html.includes('could not load')&&r.html.includes('data-act="ds-reload"'))});
 await t('plan limits and verification cases are still served by admin.js',async()=>{
   const x=admin();const r=await x.V.admin(['sellers','plans']);assert.equal(r.html,'OLD sellers/plans');const v=await x.V.admin(['waitlist']);assert.equal(v.html,'OLD waitlist')});
 await t('non-admins fall through to the existing guard',async()=>{
   const x=admin({me:{role:'seller'}});const r=await x.V.admin([]);assert.equal(r.html,'OLD ')});

 // ---------------- product review ----------------
 await t('review: card with seller, price, stock, registration number and the existing Publish and Ask-for-changes actions',async()=>{
   const x=admin();const r=await x.V.admin(['review']);assert(r.active==='admin/review');
   assert(r.html.includes('Leather tote')&&r.html.includes('₦18,500')&&r.html.includes('was ₦22,000')&&r.html.includes('REG-1')&&r.html.includes('data-act="rpub" data-id="p1"')&&r.html.includes('data-act="rchg" data-id="p1"')&&r.html.includes('#dsi-')===false||r.html.includes('ds-art'))});
 await t('review: empty state',async()=>{const x=admin({data:{review:[]}});const r=await x.V.admin(['review']);assert(r.html.includes('Nothing to review'))});

 // ---------------- Everneed Store workspace ----------------
 await t('store workspace: asks the backend for the official store context and shows its real counts and module readiness',async()=>{
   const x=admin();const r=await x.V.admin(['store']);
   assert(x.calls.some(c=>c==='RPC admin_store_workspace_context {"p_store":"everneed-official"}'));
   assert(r.html.includes('data-count="3"')&&r.html.includes('Low stock variants')&&r.html.includes('data-count="4"'));
   assert(r.html.includes('Ready')&&r.html.includes('Catalogue only')&&r.html.includes('Not available yet')&&r.html.includes('Stored, not in checkout')&&r.html.includes('Payouts pending'));
   assert(r.html.includes('No seller plan, verification or payout setup is needed')&&r.html.includes('ds-plan official'));
   assert(r.html.includes('ds-segall')===false,'the switcher button is added by ds.js in the browser');
   ['Overview','Products','Orders','Messages','Staff and roles'].forEach(l=>assert(r.html.includes(l),l));
   assert(!/data-count="0"[^>]*>0<\/b><small>(Open )?[Mm]essages/.test(r.html),'no invented message count')});
 await t('store workspace: products list is real and Add product is disabled with a reason',async()=>{
   const x=admin({data:{products:[{id:'p9',name:'Everneed Tee',col:'Fashion and Clothing',price:8000,stock:null,status:'published'}]}});const r=await x.V.admin(['store','products']);
   assert(r.html.includes('Everneed Tee')&&r.html.includes('no stock limit')&&r.html.includes('Published'));
   assert(/<button[^>]*disabled[^>]*aria-disabled="true"[^>]*aria-describedby="ds-addwhy"/.test(r.html)&&r.html.includes('id="ds-addwhy"')&&r.html.includes('R2 and R5'))});
 await t('store workspace: orders and messages show real rows or true empty states',async()=>{
   const x=admin({data:{sorders:[{id:'so1',order_id:'ORD-100200300',status:'accepted',subtotal:12000,created_at:'2026-11-18'}],convs:[]}});
   const o=await x.V.admin(['store','orders']);assert(o.html.includes('ORD-100200')&&o.html.includes('accepted')&&o.html.includes('₦12,000'));
   const m=await x.V.admin(['store','messages']);assert(m.html.includes('No conversations yet'))});
 await t('store workspace: staff and roles is honest when the backend does not exist (no active controls, roles marked not active)',async()=>{
   const x=admin();const r=await x.V.admin(['store','staff']);
   assert(r.html.includes('Not available yet')&&r.html.includes('staff_members')&&r.html.includes('Planned roles'));
   ['Owner','Operations','Support','Catalogue','Finance'].forEach(l=>assert(r.html.includes('<b>'+l+'</b>'),l));
   assert((r.html.match(/Not active/g)||[]).length===5&&!/data-act=/.test(r.html.split('Planned roles')[1]),'planned roles are not interactive')});
 await t('store workspace: when staff_members exists it lists real rows',async()=>{
   const x=admin({data:{staff:[{user_id:'abcdef12-0000',role:'finance',active:true},{user_id:'99999999-0000',role:'support',active:false}]}});const r=await x.V.admin(['store','staff']);
   assert(r.html.includes('abcdef12')&&r.html.includes('Role: finance')&&r.html.includes('Revoked')&&!r.html.includes('Planned roles'))});
 await t('store workspace: context failure is an error with retry, not an empty workspace',async()=>{
   const x=admin({noctx:true});const r=await x.V.admin(['store']);assert(r.html.includes('could not load')&&r.html.includes('data-act="ds-reload"'))});
 await t('context switcher: Platform and Everneed Store, with the current one ticked',async()=>{
   const x=admin();assert.equal(typeof x.A['ds-ctx'],'function');const r=await x.V.admin([]);assert(r.html.includes('data-act="ds-ctx"')&&r.html.includes('<span>Platform</span>'));
   const s=await x.V.admin(['store']);assert(s.html.includes('<span>Everneed Store</span>'))});
 await t('action names added by this work are all prefixed ds- (no collisions)',async()=>{
   const x=admin();await x.V.admin([]);const base=make({}).A;Object.keys(x.A).forEach(k=>assert(k.startsWith('ds-'),k))});
 console.log(`${pass} passed, ${fail} failed`);
})();
