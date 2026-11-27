// Tests for the read-only admin disputes page (ds-disputes.js) and its loader hook. Run from the repository root: node tools/web-seller-tests/ds-disputes.js
const {make,J,vm}=require('./harness');const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const ID='11111111-1111-4111-8111-111111111111';
// Faithful stand-ins for the design-system builders: they escape their text like the real ones, so double escaping or missing escaping shows up.
function ds(C){const e=C.esc;return{icon:n=>'<i:'+n+'>',
  chip:(l,tone)=>'[chip:'+e(l)+'|'+(tone||'')+']',
  row:o=>'[row:'+e(o.title)+'|'+e(o.sub||'')+'|'+(o.href||'')+']',
  banner:(k,ti,tx,a)=>'[banner:'+k+'|'+e(ti)+'|'+e(tx||'')+'|'+(a?a.act||a.href:'')+']',
  empty:o=>'[empty:'+e(o.title)+']',
  seg:items=>'[seg:'+items.map(i=>e(i.label)+(i.n!=null?'='+i.n:'')+(i.on?'*':'')).join(',')+']'}}
function setup(o){o=o||{};const x=make({});const C=x.ctx.Core;C.ago=()=>'2d ago';C.when=t=>t?'on '+t:'';
  const reads=[];const rows=o.rows||{};
  x.ctx.Supa.get=p=>{x.calls.push('GET '+p);reads.push(p);
    if(o.failAll)return Promise.reject(new Error('boom'));
    const k=Object.keys(rows).find(k=>p.startsWith(k));if(o.fail&&o.fail.some(f=>p.startsWith(f)))return Promise.reject(new Error('denied'));
    return Promise.resolve(k?rows[k]:[])};
  C.me=()=>o.me||({role:'admin'});if(o.store)C.adminCtx=()=> 'store';
  x.ctx.DS=ds(C);x.ctx.window=x.ctx;const base=p=>Promise.resolve({html:'OLD:'+p[0]});C.V.admin=base;
  vm.runInContext(J('ds-disputes.js'),x.ctx);x.reads=reads;return x}
const DISP=[{id:ID,order_id:'ord_abcdefghijk',seller_order_id:'so1',opened_by:'u9',reason:'Item never arrived <img src=x onerror=alert(1)>',status:'open',created_at:'2026-11-20T10:00:00Z',resolved_at:null,resolution:null,resolved_by:null},
 {id:'22222222-2222-4222-8222-222222222222',order_id:'ord2',seller_order_id:null,opened_by:'u9',reason:'Wrong size',status:'investigating',created_at:'2026-11-21T10:00:00Z'}];
const ROWS={'disputes?select=status':[{status:'open'},{status:'investigating'},{status:'resolved'},{status:'resolved'}],'disputes?select=id,order_id':DISP,'disputes?select=*':[DISP[0]],
 'seller_orders':[{id:'so1',store_id:'st1',status:'accepted',subtotal:5000}],'stores':[{id:'st1',name:'Ada Shoes'}],'profiles':[{id:'u9',name:'Chi Buyer',email:'c@x.ng'}],
 'orders':[{id:'ord_abcdefghijk',total:12500,status:'awaiting_delivery',payment_status:'paid'}],'refunds':[],'conversations':[{id:'c1',subject:'Order help',status:'open'}],'audit_log':[]};
(async()=>{
 await t('other admin pages, non-admins and Everneed-Store-only mode fall through to the existing router',async()=>{
   let x=setup({rows:ROWS});assert.equal((await x.ctx.Core.V.admin(['review'])).html,'OLD:review');
   x=setup({rows:ROWS,me:{role:'seller'}});assert.equal((await x.ctx.Core.V.admin(['disputes'])).html,'OLD:disputes');
   x=setup({rows:ROWS,store:1});assert.equal((await x.ctx.Core.V.admin(['disputes'])).html,'OLD:disputes');
   assert(!x.reads.some(r=>r.startsWith('disputes')),'no dispute data is read when the page is not shown')});
 await t('queue: oldest open first, filter on status, counts per tab, rows link to the case, names resolved',async()=>{
   const x=setup({rows:ROWS});const r=await x.ctx.Core.V.admin(['disputes']);
   assert.equal(r.layout,'admin');assert.equal(r.active,'admin/disputes');
   assert(x.reads.some(p=>p.includes('status=in.(open,investigating)')&&p.includes('order=created_at.asc')),x.reads.join('\n'));
   assert(r.html.includes('Needs action=2*'),r.html);assert(r.html.includes('Resolved=2'),r.html);assert(r.html.includes('All=4'),r.html);
   assert(r.html.includes('|/admin/disputes/'+ID+']'));assert(r.html.includes('Chi Buyer'));assert(r.html.includes('Ada Shoes'));assert(r.html.includes('Whole order'));
   assert(r.html.includes('2 waiting for a decision, oldest first'))});
 await t('reason text is escaped, never injected as markup',async()=>{
   const x=setup({rows:ROWS});const r=await x.ctx.Core.V.admin(['disputes']);
   assert(!r.html.includes('<img'),'raw tag leaked');assert(r.html.includes('&lt;img'))});
 await t('empty queue and a failed read both give honest states, not a crash',async()=>{
   let x=setup({rows:{}});let r=await x.ctx.Core.V.admin(['disputes']);assert(r.html.includes('[empty:No disputes need action]'),r.html);
   x=setup({failAll:1});r=await x.ctx.Core.V.admin(['disputes']);assert(r.html.includes('[banner:error|This page could not load'),r.html);assert(r.html.includes('dsp-reload'))});
 await t('a failed side lookup keeps the queue and says details are missing',async()=>{
   const x=setup({rows:ROWS,fail:['profiles']});const r=await x.ctx.Core.V.admin(['disputes']);
   assert(r.html.includes('Some details could not be loaded'));assert(r.html.includes('|/admin/disputes/'+ID+']'))});
 await t('case detail: reason, order facts, conversation link; no decision control; read-only',async()=>{
   const x=setup({rows:ROWS});const r=await x.ctx.Core.V.admin(['disputes',ID]);
   assert(r.html.includes('&lt;img'));assert(!r.html.includes('<img'));assert(r.html.includes('Ada Shoes'));assert(r.html.includes('₦12,500'));assert(r.html.includes('|/inbox/c1]'));
   assert(r.html.includes('Decisions are not available yet'));assert(!/data-act="(?!ds-ctx|dsp-reload)/.test(r.html),'a data-act button exists: '+r.html);
   assert(!/\bbutton\b[^>]*>(Resolve|Reject|Investigate|Refund)/i.test(r.html));
   assert(x.calls.every(c=>c.startsWith('GET ')),'a non-GET call was made: '+x.calls.filter(c=>!c.startsWith('GET ')).join(','))});
 await t('case detail for an unknown id says not found; a failed side read is flagged, the dispute still shows',async()=>{
   let x=setup({rows:{}});let r=await x.ctx.Core.V.admin(['disputes',ID]);assert(r.html.includes('[empty:Dispute not found]'));
   x=setup({rows:ROWS,fail:['refunds','audit_log']});r=await x.ctx.Core.V.admin(['disputes',ID]);
   assert(r.html.includes('Some details could not be loaded'));assert(r.html.includes('Refunds could not be read'));assert(r.html.includes('History could not be read'));assert(r.html.includes('Item never arrived'))});
 await t('ids that are not UUIDs are never put into a query path',async()=>{
   const x=setup({rows:ROWS});const r=await x.ctx.Core.V.admin(['disputes',"x' or 1=1"]);
   assert(!x.reads.some(p=>p.includes('or 1=1')),'untrusted id reached a query');assert(r.html.includes('Needs action'))});
 await t('loader: /admin/disputes loads ds-disputes.js with no flag; staff and dispatch previews still need the flag',async()=>{
   function lz(){const x=make({});const base=p=>Promise.resolve({html:'plain:'+p[0]});x.ctx.Core.V.portal=base;x.ctx.Core.V.admin=base;x.ctx.window=x.ctx;const added=[];
     x.ctx.document={currentScript:{src:'/seller/assets/js/ds-lazy.js'},head:{appendChild(s){added.push(s);setTimeout(()=>{const prev=x.ctx.Core.V.admin;x.ctx.Core.V.admin=p=>Promise.resolve(prev(p)).then(r=>({html:'disputes:'+r.html}));s.onload()},0)}},createElement:()=>({})};
     x.ctx.location={search:''};x.ctx.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};x.ctx.setTimeout=setTimeout;vm.runInContext(J('ds-lazy.js'),x.ctx);x.added=added;return x}
   let x=lz();const r=await x.ctx.Core.V.admin(['disputes']);assert.equal(x.added.length,1);assert.equal(x.added[0].src,'/seller/assets/js/ds-disputes.js');assert(r.html.startsWith('disputes:'));
   x=lz();await x.ctx.Core.V.admin(['staff']);await x.ctx.Core.V.admin(['dispatch']);await x.ctx.Core.V.admin(['review']);assert.equal(x.added.length,0)});
 console.log(pass+' passed, '+fail+' failed')})();
