// Tests for the read-only seller earnings page (ds-earnings.js, WEB-S08) and its lazy loading.
// Run from the repository root: node tools/web-seller-tests/ds-earnings.js
const {make,J,vm}=require('./harness');
const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const fs=require('fs'),path=require('path');
const icons=fs.readFileSync(path.join(__dirname,'../../shared/icons.js'),'utf8');
const SRC=J('ds-earnings.js');
const STORE={id:'s1',name:'Ada Fabrics',status:'approved'};
const row=(o)=>Object.assign({id:1,created_at:'2026-11-20T10:00:00Z',kind:'sale',status:'available',amount:5000,currency:'NGN',order_id:'o1',seller_order_id:'so1',note:null},o);
const tick=()=>new Promise(r=>setTimeout(r,15));
function page(o){
  o=o||{};
  const x=make({});
  const anchors=[];
  x.ctx.document={documentElement:{classList:{toggle(){},add(){},remove(){}}},body:{appendChild(a){a.parentNode=this},removeChild(a){a.parentNode=null},insertAdjacentHTML(){},contains:()=>true,classList:{toggle(){},add(){},remove(){}}},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},
    createElement:()=>{const a={click(){anchors.push(a)},parentNode:null};return a}};
  x.anchors=anchors;
  const C=x.ctx.Core;C.path=()=>'/portal/earnings';C.go=(p)=>x.calls.push('GO '+p);C.when=(d)=>d?String(d).slice(0,10):'';C.ago=()=> 'now';
  x.ctx.CFG={baseCurrency:'NGN'};x.ctx.location={pathname:'/portal/earnings'};x.ctx.Blob=Blob;x.ctx.File=File;
  x.ctx.URL={createObjectURL:()=> 'blob:x',revokeObjectURL(){}};x.ctx.navigator=o.navigator||{};
  if(o.native)x.ctx.EV_NATIVE_SELLER=true;
  vm.runInContext(icons,x.ctx);vm.runInContext(J('ds.js'),x.ctx);
  C.toast=(m,e)=>{x.calls.push('TOAST '+(e?'E ':'')+m)}; /* ds.js swaps in a DOM toast; record it instead */
  x.ctx.Supa.uid=()=>o.anon?null:'u1';
  const rows=o.rows===undefined?[row()]:o.rows;
  x.ctx.Supa.get=(p)=>{x.calls.push('GET '+p);
    if(o.failGet&&o.failGet(p))return Promise.reject(o.err||new Error('boom secret detail'));
    if(p.startsWith('stores?'))return Promise.resolve(o.noStore?[]:[o.store||STORE]);
    if(p.startsWith('ledger_entries?select=id&'))return o.otherFail?Promise.reject(new Error('x')):Promise.resolve(o.other?[{id:9}]:[]);
    if(p.startsWith('ledger_entries?'))return o.getRows?o.getRows(p):Promise.resolve(rows);
    return Promise.resolve([])};
  x.ctx.Supa.rpc=(f,a)=>{x.calls.push('RPC '+f+' '+JSON.stringify(a));
    if(f==='store_balance')return o.balFail?Promise.reject(new Error('x')):Promise.resolve(o.bal===undefined?12345.5:o.bal);
    return Promise.resolve(null)};
  x.ctx.Supa.insert=x.ctx.Supa.patch=x.ctx.Supa.patchBy=x.ctx.Supa.fn=()=>{x.calls.push('WRITE');return Promise.resolve(null)};
  const els={};x.els=els;
  x.ctx.document.getElementById=(id)=>els[id]||(els[id]={innerHTML:''});
  vm.runInContext(SRC,x.ctx);
  return x;
}
(async()=>{
 await t('other portal routes and signed-out visitors fall through to the existing page',async()=>{
   let x=page();assert.equal((await x.V.portal(['orders'])).html,'BASE');
   x=page({anon:true});assert.equal((await x.V.portal(['earnings'])).html,'BASE')});
 await t('no store, or a store that is not approved, goes back to /portal',async()=>{
   assert.equal((await page({noStore:true}).V.portal(['earnings'])).redirect,'/portal');
   assert.equal((await page({store:{id:'s1',status:'pending'}}).V.portal(['earnings'])).redirect,'/portal')});
 await t('read-only: only GETs and the store_balance RPC, scoped to the owner\'s own store, never a write',async()=>{
   const x=page();await x.V.portal(['earnings']);
   assert(x.calls.every(c=>c.startsWith('GET ')||c.startsWith('RPC store_balance')),x.calls.join('|'));
   assert(!x.calls.includes('WRITE'));
   assert(x.calls.some(c=>c==='RPC store_balance {"p_store":"s1"}'));
   assert(x.calls.filter(c=>c.startsWith('GET ledger_entries')).every(c=>c.includes('store_id=eq.s1')));
   assert(x.calls.some(c=>c.startsWith('GET stores?select=id,name,status&owner_id=eq.u1')))});
 await t('source contains no write call and calls no RPC except store_balance',()=>{
   assert(!/Supa\.(insert|patch|patchBy|fn|rpcAnon)\b/.test(SRC));
   const rpcs=[...SRC.matchAll(/Supa\.rpc\("([a-z_]+)"/g)].map(m=>m[1]);assert.deepEqual(rpcs,['store_balance'])});
 await t('page: legacy ledger notice, honest wording, exact server balance, export button, no withdraw action',async()=>{
   const r=await page().V.portal(['earnings']);
   assert.equal(r.layout,'portal');assert.equal(r.active,'portal/earnings');
   assert(r.html.includes('Seller ledger (legacy)')&&r.html.includes('This is not a bank balance')&&r.html.includes('Withdrawals are not available yet'));
   assert(r.html.includes('₦12,345.50')&&r.html.includes('Available balance')&&r.html.includes('data-act="ds-ern-csv"'));
   assert(!/data-act="[^"]*(withdraw|payout)/i.test(r.html)&&!/<button[^>]*>\s*Withdraw/i.test(r.html))});
 await t('a missing balance is "Not available", never 0 (null, failed call)',async()=>{
   for(const o of [{bal:null},{balFail:true}]){const r=await page(o).V.portal(['earnings']);assert(r.html.includes('Not available')&&!r.html.includes('₦0'),JSON.stringify(o))}});
 await t('a real balance of 0 from the server is shown as 0',async()=>{
   const r=await page({bal:0}).V.portal(['earnings']);assert(r.html.includes('₦0')&&!r.html.includes('Not available'))});
 await t('other-currency entries (or an unconfirmable check) hide the combined balance and warn',async()=>{
   let r=await page({other:true}).V.portal(['earnings']);assert(r.html.includes('More than one currency')&&r.html.includes('Not available')&&!r.html.includes('₦12,345.50'));
   r=await page({otherFail:true}).V.portal(['earnings']);assert(r.html.includes('Not available')&&!r.html.includes('₦12,345.50')&&!r.html.includes('More than one currency'))});
 await t('rows: kind and status labels, signed amounts in their own currency, short order ref, notes escaped',async()=>{
   const rows=[row({id:1,kind:'payout',status:'paid',amount:-20000,note:'Payout <img src=x onerror=alert(1)>'}),row({id:2,kind:'commission',status:'pending',amount:-250.5}),
     row({id:3,kind:'refund',status:'reversed',amount:-100,seller_order_id:'a-very-long-order-identifier-123456'}),row({id:4,currency:'USD',amount:25,status:'available'})];
   const r=await page({rows}).V.portal(['earnings']);
   assert(r.html.includes('Payout')&&r.html.includes('Paid out')&&r.html.includes('-₦20,000')&&r.html.includes('-₦250.50')&&r.html.includes('Reversed')&&r.html.includes('Pending')&&r.html.includes('Commission')&&r.html.includes('Refund'));
   assert(r.html.includes('+US$25'),'USD stays USD');assert(!r.html.includes('<img src=x'),'note escaped');assert(r.html.includes('&lt;img'));
   assert(r.html.includes('Order a-very…3456')&&!r.html.includes('a-very-long-order-identifier-123456'))});
 await t('a note that only repeats the kind is left out; other notes are kept',async()=>{
   const r=await page({rows:[row({id:1,kind:'sale',note:'Sale'}),row({id:2,kind:'commission',note:'  commission '}),row({id:3,kind:'refund',note:'Refund 56683d97 for order'})]}).V.portal(['earnings']);
   assert(!/· Sale/.test(r.html)&&!/· commission/i.test(r.html),'repeated notes dropped');assert(r.html.includes('Refund 56683d97 for order'),'real note kept')});
 await t('balance caption says pending entries are not included',async()=>{
   const r=await page().V.portal(['earnings']);assert(r.html.includes('Pending entries are not included in the balance until they become Available.'))});
 await t('unknown kind or status is shown as given, not hidden or invented',async()=>{
   const r=await page({rows:[row({kind:'mystery',status:'weird'})]}).V.portal(['earnings']);assert(r.html.includes('mystery')&&r.html.includes('weird'))});
 await t('empty ledger: calm empty state, no invented entries',async()=>{
   const r=await page({rows:[]}).V.portal(['earnings']);assert(r.html.includes('No earnings yet')&&!r.html.includes('ds-rows'))});
 await t('load failure: retryable error, no raw error text; 403 explains access',async()=>{
   let r=await page({failGet:p=>p.startsWith('ledger_entries?select=id,created')}).V.portal(['earnings']);
   assert(r.html.includes('Earnings could not load')&&r.html.includes('ds-reload')&&!r.html.includes('secret'));
   assert.equal((r.html.match(/Earnings could not load/g)||[]).length,1,'headline not repeated in the body');assert(r.html.includes('Check your connection and try again.'));
   const e=new Error('forbidden');e.status=403;r=await page({failGet:p=>p.startsWith('stores?'),err:e}).V.portal(['earnings']);assert(r.html.includes('do not have access'))});
 await t('paging: fetches 51 to know there is more, "Show more" appends the next page by offset',async()=>{
   const mk=(a,n)=>Array.from({length:n},(_,i)=>row({id:a+i}));
   const x=page({getRows:p=>Promise.resolve(p.includes('offset=0')?mk(1,51):mk(51,10))});
   const r=await x.V.portal(['earnings']);assert(r.html.includes('data-act="ds-ern-more"'));assert(x.calls.some(c=>c.includes('limit=51&offset=0')));
   x.A['ds-ern-more']({disabled:false});await tick();assert(x.calls.some(c=>c.includes('limit=51&offset=50')));
   const list=x.els['ds-ern-list'].innerHTML;assert.equal((list.match(/class="ds-row[ "]/g)||[]).length,60);assert(!list.includes('ds-ern-more'))});
 await t('filter: server-side status filter; an invalid value is ignored and makes no request',async()=>{
   const x=page();await x.V.portal(['earnings']);const before=x.calls.length;
   x.A['ds-ern-f']({getAttribute:()=>'paid',classList:{toggle(){}},setAttribute(){}});await tick();assert(x.calls.slice(before).some(c=>c.includes('&status=eq.paid&order=')));
   const n=x.calls.length;x.A['ds-ern-f']({getAttribute:()=>'x&store_id=eq.other',classList:{toggle(){}},setAttribute(){}});await tick();assert.equal(x.calls.length,n)});
 await t('a slow answer for an old filter never overwrites the newer one',async()=>{
   let release;const slow=new Promise(r=>{release=r});
   const x=page({getRows:p=>p.includes('status=eq.pending')?slow:p.includes('status=eq.paid')?Promise.resolve([row({id:7,kind:'payout',status:'paid',amount:-1})]):Promise.resolve([row()])});
   await x.V.portal(['earnings']);const b=(v)=>({getAttribute:()=>v,classList:{toggle(){}},setAttribute(){}});
   x.A['ds-ern-f'](b('pending'));x.A['ds-ern-f'](b('paid'));await tick();release([row({id:8,kind:'sale',status:'pending',amount:999})]);await tick();
   const html=x.els['ds-ern-list'].innerHTML;assert(html.includes('Payout')&&!html.includes('₦999')&&!html.includes('+₦999'))});
 await t('filter failure shows a retryable error and keeps no stale rows',async()=>{
   const x=page({getRows:p=>p.includes('status=eq.paid')?Promise.reject(new Error('secret')):Promise.resolve([row()])});
   await x.V.portal(['earnings']);x.A['ds-ern-f']({getAttribute:()=>'paid',classList:{toggle(){}},setAttribute(){}});await tick();
   const html=x.els['ds-ern-list'].innerHTML;assert(html.includes('Could not load entries')&&html.includes('ds-ern-retry')&&!html.includes('secret'))});
 await t('CSV: header, BOM, quotes and newlines escaped, formulas neutralised in text, numbers left numeric',()=>{
   const x=page();const csv=x.ctx.EVEarnings.csv([row({id:5,amount:-20000,note:'Payout "ref"\nline2'}),row({id:6,note:'=HYPERLINK("http://x")'}),row({id:7,note:'+1',kind:'sale'})]);
   assert(csv.startsWith('\ufeffentry_id,created_at,kind,status,amount,currency,order_id,seller_order_id,note\r\n'));
   assert(csv.includes(',-20000,NGN,')&&!csv.includes("'-20000"));
   assert(csv.includes('"Payout ""ref""\nline2"'));
   assert(csv.includes(`"'=HYPERLINK(""http://x"")"`),csv);assert(csv.includes(",'+1\r\n"));
   assert(csv.endsWith('\r\n'))});
 await t('CSV export: pages of 500 for the current filter, capped at 5000 with an honest message, then downloads',async()=>{
   const x=page({getRows:p=>Promise.resolve(Array.from({length:500},(_,i)=>row({id:i})))});await x.V.portal(['earnings']);
   x.A['ds-ern-csv']({disabled:false});await new Promise(r=>setTimeout(r,60));
   const pages=x.calls.filter(c=>c.includes('limit=500'));assert.equal(pages.length,10);assert(pages[9].includes('offset=4500'));
   assert(x.calls.some(c=>c==='TOAST Exported the latest 5000 entries.'),x.calls.join('|'));assert.equal(x.anchors.length,1);
   assert(/^everneed-earnings-s1-all-\d{4}-\d{2}-\d{2}\.csv$/.test(x.anchors[0].download),x.anchors[0].download)});
 await t('CSV export with nothing to export, or a failing request, says so and downloads nothing',async()=>{
   let x=page({getRows:()=>Promise.resolve([])});await x.V.portal(['earnings']);x.A['ds-ern-csv']({});await tick();
   assert(x.calls.some(c=>c.startsWith('TOAST E There are no entries')));assert.equal(x.anchors.length,0);
   x=page();await x.V.portal(['earnings']);x.ctx.Supa.get=()=>Promise.reject(new Error('secret'));x.A['ds-ern-csv']({});await tick();
   assert(x.calls.some(c=>c.startsWith('TOAST E Earnings could not load'))&&!x.calls.some(c=>c.includes('secret'))&&x.anchors.length===0)});
 await t('inside the packaged app without a share sheet: no fake "exported" message',async()=>{
   const x=page({native:true});await x.V.portal(['earnings']);x.A['ds-ern-csv']({});await tick();
   assert(x.calls.some(c=>c.startsWith('TOAST E Saving files is not available in the app yet')));assert(!x.calls.some(c=>c.startsWith('TOAST Exported')));assert.equal(x.anchors.length,0)});
 // ---- lazy loading (ds-lazy.js)
 function lazy(mode){const x=make({});const base=p=>Promise.resolve({html:'plain:'+p[0]});
   x.ctx.Core.V.portal=base;x.ctx.Core.V.admin=base;x.ctx.window=x.ctx;const added=[];
   x.ctx.document={currentScript:{src:'/seller/assets/js/ds-lazy.js'},head:{appendChild(s){added.push(s);
     setTimeout(()=>{if(mode==='fail')s.onerror();else{const prev=x.ctx.Core.V.portal;x.ctx.Core.V.portal=p=>p[0]==='earnings'?Promise.resolve({html:'earnings'}):prev(p);s.onload()}},0)}},createElement:()=>({})};
   x.ctx.location={search:''};x.ctx.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};x.ctx.setTimeout=setTimeout;
   vm.runInContext(J('ds-lazy.js'),x.ctx);x.added=added;return x}
 await t('lazy: /portal/earnings loads ds-earnings.js once from the same folder; other pages never do',async()=>{
   const x=lazy();assert.equal((await x.ctx.Core.V.portal(['orders'])).html,'plain:orders');assert.equal(x.added.length,0);
   assert.equal((await x.ctx.Core.V.portal(['earnings'])).html,'earnings');assert.equal(x.added.length,1);assert.equal(x.added[0].src,'/seller/assets/js/ds-earnings.js');
   await x.ctx.Core.V.portal(['earnings']);assert.equal(x.added.length,1);assert.equal(typeof x.ctx.EVLazy.earnings,'function')});
 await t('lazy: if ds-earnings.js cannot load, the normal portal page opens instead of an error',async()=>{
   const x=lazy('fail');assert.equal((await x.ctx.Core.V.portal(['earnings'])).html,'plain:earnings')});
 console.log(pass+' passed, '+fail+' failed');
})();
