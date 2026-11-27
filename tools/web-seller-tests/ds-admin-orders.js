// WEB-AD08 tests: admin section seam (ds-admin-sections.js) and orders monitor (ds-admin-orders.js).
// Run from the repository root: node tools/web-seller-tests/ds-admin-orders.js   (set WEB_JS to test another scripts folder)
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const JS=process.env.WEB_JS||path.join(__dirname,'../../web/assets/js');
const read=f=>fs.readFileSync(path.join(JS,f),'utf8');
let pass=0;const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const tick=()=>new Promise(r=>setTimeout(r,5));
const DS={icon:n=>'<i:'+n+'>',chip:(l,t,i)=>'<chip '+(t||'')+'>'+l+'</chip>',empty:o=>'<empty>'+o.title+'</empty>',banner:(k,t,x,a)=>'<banner '+k+'>'+t+' | '+x+(a?' | '+a.act:'')+'</banner>'};
function btn(id){const at={'data-id':id};return{innerHTML:'LABEL',disabled:false,getAttribute:k=>k in at?at[k]:null,setAttribute:(k,v)=>{at[k]=String(v)},removeAttribute:k=>{delete at[k]}}}
function boot(o){
  o=o||{};const calls=[],loads=[];
  const V={admin:p=>Promise.resolve({layout:'admin',active:'prev',html:'PREV '+JSON.stringify(p),title:'Prev'})},A={};
  const Core={V,A,F:{},adminNav:{platform:[['admin','Overview','chart','/admin'],['inbox','Inbox','chat','/inbox',1]],store:[]},
    esc:s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    money:n=>'N'+Number(n||0),when:x=>'W('+String(x).slice(0,10)+')',ago:()=>'ago',toast:(m,e)=>calls.push('TOAST '+(e?'E ':'')+m),
    ask:(ti)=>{calls.push('ASK '+ti);return Promise.resolve(o.ask===undefined?'because':o.ask)},
    me:()=>o.me===undefined?{role:'admin'}:o.me,adminCtx:()=>o.ctx||'platform'};
  const Supa={uid:()=>o.uid===undefined?'u1':o.uid,
    get(p){calls.push('GET '+p);const r=o.get?o.get(p):undefined;return r instanceof Error?Promise.reject(r):Promise.resolve(r===undefined?[]:r)},
    rpc(f,a){calls.push('RPC '+f+' '+JSON.stringify(a));return o.rpc?o.rpc(f,a):Promise.resolve(null)}};
  const ctx={Core,Supa,DS,Event:class{constructor(t){this.type=t}},dispatchEvent(e){calls.push('EVENT '+e.type)},console,Promise,Date,Number,String,Object,Array,JSON,Error,Intl,RegExp,
    setTimeout:(f,ms)=>{const h=setTimeout(f,ms);h.unref&&h.unref();return h},clearTimeout,
    document:{currentScript:null,addEventListener(){},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({}),
      head:{appendChild(s){loads.push(s.src);Promise.resolve().then(()=>{if(o.loadFail)return s.onerror();vm.runInContext(read(s.src.split('/').pop()),ctx);s.onload()})}}}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('ds-admin-sections.js'),ctx);
  return{ctx,calls,loads,V,A,Core};
}
const bootOrders=async o=>{const x=boot(o);await x.V.admin(['orders']);return x};
const ORD=(x)=>Object.assign({id:'EN-1',user_id:'u1',total:5000,currency:'NGN',pm:'bank_transfer',status:'payment_reported',payment_status:'payment_reported',at:1795000000000,ref:'REF1',payment_note:null,route:'hub',delivery_fee:0,discount:0},x||{});
const dget=(order,extra)=>p=>p.startsWith('orders?select=id,user_id,total,currency,pm')?[order]:p.startsWith('profiles')?[{id:'u1',name:'Ife',email:'i@x.ng'}]:(extra&&extra(p));

(async()=>{
 // ---------- seam ----------
 await t('seam: Orders is declared and its tab sits before Inbox',async()=>{const x=boot();assert.deepEqual(x.Core.adminNav.platform.map(n=>n[0]),['admin','admin/orders','inbox']);assert.deepEqual(x.ctx.AdminSections.list(),['orders'])});
 await t('seam: signed-out, non-admin, Everneed Store workspace and unknown routes use the existing admin pages',async()=>{
   for(const o of [{uid:null},{me:{role:'seller'}},{ctx:'store'}]){const x=boot(o);assert((await x.V.admin(['orders'])).html.startsWith('PREV'))}
   const x=boot();assert((await x.V.admin(['nothing'])).html.startsWith('PREV'));assert((await x.V.admin([])).html.startsWith('PREV'))});
 await t('seam: routes owned by admin.js or ds-admin.js and bad keys cannot be registered',async()=>{const x=boot(),R=x.ctx.AdminSections.register;
   for(const k of ['sellers','review','store','waitlist','Bad Key','','9x'])assert.strictEqual(R({key:k,render:()=>1}),false,k);
   assert.strictEqual(R({key:'hub-board',render:()=>({layout:'admin',html:'HUB'}),nav:false}),true);assert.equal((await x.V.admin(['hub-board'])).html,'HUB');assert.equal(x.Core.adminNav.platform.length,3)});
 await t('seam: the page file loads once, on first visit',async()=>{const x=boot({get:()=>[]});assert.equal(x.loads.length,0);await x.V.admin(['orders']);await x.V.admin(['orders']);assert.deepEqual(x.loads,['/assets/js/ds-admin-orders.js'])});
 await t('seam: a file that will not load shows Try again for that section, not another page',async()=>{const x=boot({loadFail:true});const r=await x.V.admin(['orders']);
   assert.equal(r.active,'admin/orders');assert(r.html.includes('This page could not load')&&r.html.includes('ds-sec-reload')&&!r.html.startsWith('PREV'));x.A['ds-sec-reload']();assert(x.calls.includes('EVENT hashchange'))});
 await t('seam: a render that throws shows Try again with the message',async()=>{const x=boot();x.ctx.AdminSections.register({key:'boom',title:'Boom',render:()=>{throw new Error('kaput')}});const r=await x.V.admin(['boom']);assert(r.html.includes('kaput')&&r.html.includes('ds-sec-reload'))});

 // ---------- list ----------
 const rows=[ORD(),ORD({id:'EN-2',payment_status:'awaiting_payment',status:'awaiting_payment',user_id:'u2'}),ORD({id:'EN-3',payment_status:'paid',status:'paid'}),ORD({id:'EN-4',status:'cancelled',payment_status:'awaiting_transfer'}),ORD({id:'EN-5',status:'disputed',payment_status:'paid'})];
 await t('list: rows link to the order, show buyer and state, and filters are counted from the loaded rows only',async()=>{
   const x=boot({get:p=>p.startsWith('orders?')?rows:p.startsWith('profiles')?[{id:'u1',name:'Ife <img src=x onerror=1>',email:'i@x.ng'}]:[]});const r=await x.V.admin(['orders']);const h=r.html;
   assert.equal(r.layout,'admin');assert.equal(r.active,'admin/orders');
   assert(h.includes('href="/admin/orders/EN-1"')&&h.includes('Transfer reported')&&h.includes('Awaiting payment')&&h.includes('N5000'));
   assert(!h.includes('<img src=x')&&h.includes('&lt;img'),'buyer text is escaped');
   assert(/data-id="action"[^>]*>Needs action <span class="n">1<\/span>/.test(h),'only the live transfer needs action (cancelled one excluded)');
   assert(/data-id="paid"[^>]*>Paid <span class="n">2<\/span>/.test(h)&&/data-id="cancelled"[^>]*>Cancelled <span class="n">1<\/span>/.test(h)&&/data-id="issues"[^>]*>Disputed <span class="n">1<\/span>/.test(h));
   assert(!/order=at\.desc&limit=100/.test('')&&x.calls.some(c=>c.includes('limit=100')))});
 await t('list: says when only the latest 100 are shown; empty and failure states are honest',async()=>{
   const many=Array.from({length:100},(_,i)=>ORD({id:'E'+i}));let x=boot({get:p=>p.startsWith('orders?')?many:[]});let h=(await x.V.admin(['orders'])).html;assert(h.includes('The latest 100 orders')&&h.includes('backend request (B3)'));
   x=boot({get:p=>p.startsWith('orders?')?[]:[]});h=(await x.V.admin(['orders'])).html;assert(h.includes('No orders yet')&&!h.includes('ds-ordfilt'));
   x=boot({get:p=>new Error('permission denied')});const r=await x.V.admin(['orders']);assert(r.html.includes('permission denied')&&r.html.includes('ds-sec-reload'))});

 // ---------- detail: which actions exist ----------
 const page=async(order,extra)=>{const x=boot({get:dget(order,extra)});const r=await x.V.admin(['orders',order.id]);return{x,h:r.html}};
 await t('detail: a reported bank transfer can be confirmed and cancelled',async()=>{const {h}=await page(ORD());assert(h.includes('data-act="ds-ord-confirm"')&&h.includes('data-act="ds-ord-cancel"')&&h.includes('Only confirm once the money is in'))});
 await t('detail: a card order awaiting payment cannot be confirmed by staff (the provider confirms it)',async()=>{const {h}=await page(ORD({status:'awaiting_payment',payment_status:'awaiting_payment',pm:'card'}));
   assert(!h.includes('ds-ord-confirm')&&h.includes('Card payments are confirmed by the payment provider')&&h.includes('data-act="ds-ord-cancel"'))});
 await t('detail: a paid order cannot be confirmed or cancelled here, and says why',async()=>{const {h}=await page(ORD({status:'paid',payment_status:'paid'}));
   assert(!h.includes('data-act="ds-ord-')&&h.includes('already paid')&&h.includes('refunded first')&&(h.match(/disabled aria-disabled="true"/g)||[]).length===2)});
 await t('detail: delivered, cancelled, partly refunded and unknown states offer no action',async()=>{
   for(const o of [{status:'delivered',payment_status:'paid'},{status:'cancelled',payment_status:'awaiting_transfer'},{status:'paid',payment_status:'partially_refunded'},{status:'sent',payment_status:'awaiting_delivery'}]){const {h}=await page(ORD(o));assert(!h.includes('data-act="ds-ord-'),JSON.stringify(o))}});
 await t('detail: buyer words are escaped and labelled unverified; other currencies are not shown as naira; seller packages and delivery are listed',async()=>{
   const {h}=await page(ORD({ref:'<b>x</b>',payment_note:'"hi"',currency:'USD',total:12.5,delivery_fee:2,discount:1,coupon:'C1'}),p=>p.startsWith('seller_orders')?[{id:'s1',store_id:'st1',status:'pending',subtotal:3,released:true,accept_by:'2026-11-26T00:00:00Z'}]:p.startsWith('stores')?[{id:'st1',name:'Ada <Store>'}]:p.startsWith('deliveries')?[{id:'d1',mode:'hub',status:'pending'}]:[]);
   assert(!h.includes('<b>x</b>')&&h.includes('&lt;b&gt;x&lt;/b&gt;')&&h.includes('Not verified')&&h.includes('USD 12.5')&&!h.includes('N12.5')&&h.includes('Ada &lt;Store&gt;')&&h.includes('accept by W(2026-11-26)')&&h.includes('hub delivery'))});
 await t('detail: order not found; ids are encoded in every query',async()=>{let x=boot({get:()=>[]});assert((await x.V.admin(['orders','nope'])).html.includes('Order not found'));
   x=boot({get:dget(ORD({id:'a b&c'}))});await x.V.admin(['orders','a%20b%26c']);assert(x.calls.some(c=>c.includes('id=eq.a%20b%26c'))&&x.calls.some(c=>c.includes('order_id=eq.a%20b%26c')))});

 // ---------- actions ----------
 await t('confirm: first tap only arms; second tap calls admin_confirm_payment once; a repeat tap while busy is ignored',async()=>{
   const x=boot({rpc:()=>new Promise(()=>{})});await x.V.admin(['orders','EN-1']);const b=btn('EN-1');
   x.A['ds-ord-confirm'](b);assert(!x.calls.some(c=>c.startsWith('RPC')),'no RPC on the first tap');assert.equal(b.innerHTML,'Tap again to confirm');
   x.A['ds-ord-confirm'](b);x.A['ds-ord-confirm'](b);assert.deepEqual(x.calls.filter(c=>c.startsWith('RPC')),['RPC admin_confirm_payment {"p_order":"EN-1"}']);assert(b.disabled)});
 await t('confirm: success refreshes the page; "already" is reported honestly; failure re-enables and shows the server message',async()=>{
   let x=await bootOrders({rpc:()=>Promise.resolve('paid')});let b=btn('EN-1');x.A['ds-ord-confirm'](b);await x.A['ds-ord-confirm'](b);await tick();assert(x.calls.includes('TOAST Payment confirmed')&&x.calls.includes('EVENT hashchange'));
   x=await bootOrders({rpc:()=>Promise.resolve('already')});b=btn('EN-1');x.A['ds-ord-confirm'](b);await x.A['ds-ord-confirm'](b);await tick();assert(x.calls.includes('TOAST This order was already paid.'));
   x=await bootOrders({rpc:()=>Promise.reject(new Error('Order not found.'))});b=btn('EN-1');x.A['ds-ord-confirm'](b);await x.A['ds-ord-confirm'](b);await tick();
   assert(x.calls.includes('TOAST E Order not found.')&&!x.calls.includes('EVENT hashchange')&&!b.disabled&&b.innerHTML==='LABEL')});
 await t('cancel: needs a reason; dismissing the prompt does nothing; otherwise calls cancel_order with the reason',async()=>{
   let x=await bootOrders({ask:null});await x.A['ds-ord-cancel'](btn('EN-2'));await tick();assert(!x.calls.some(c=>c.startsWith('RPC')));
   x=await bootOrders({ask:''});await x.A['ds-ord-cancel'](btn('EN-2'));await tick();assert(!x.calls.some(c=>c.startsWith('RPC')));
   x=await bootOrders({ask:'Customer asked'});await x.A['ds-ord-cancel'](btn('EN-2'));await tick();assert(x.calls.includes('RPC cancel_order {"p_order":"EN-2","p_reason":"Customer asked"}')&&x.calls.includes('TOAST Order cancelled'))});
 console.log(pass+' passed');
})();
