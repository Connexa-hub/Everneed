// Tests for the seller notifications centre (ds-notifications.js, WEB-S12). Run from the repository root: node tools/web-seller-tests/ds-notifications.js
const {make,J,vm}=require('./harness');const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
function setup(rows,failGet){
  const x=make({});const els={};const D={
    row:o=>'ROW['+o.title+'|'+(o.href||'-')+'|'+(o.end||'')+']',chip:l=>'CHIP '+l,empty:o=>'EMPTY '+o.title,banner:(k,t,tx,a)=>'BANNER '+t+' '+(a&&a.act),
    seg:i=>'SEG '+i.map(z=>z.label+(z.on?'*':'')).join(','),skel:()=>'SKEL'};
  x.ctx.window=x.ctx;x.ctx.DS=D;x.ctx.Core.V.portal=p=>Promise.resolve({html:'plain:'+p[0]});x.ctx.Core.ago=()=>'now';
  x.ctx.document={getElementById:id=>els[id]||(els[id]={innerHTML:'',hidden:false}),addEventListener(){},querySelector:()=>null};
  const gets=[];x.ctx.Supa.get=q=>{gets.push(q);if(failGet)return Promise.reject(new Error('x'));return Promise.resolve(rows)};
  const patches=[];x.ctx.Supa.patch=(tb,id,b)=>{patches.push([tb,id,Object.keys(b).join(',')]);return Promise.resolve([])};
  vm.runInContext(J('ds-notifications.js'),x.ctx);return Object.assign(x,{els,gets,patches});
}
const tick=()=>new Promise(r=>setTimeout(r,10));const now=Date.now();const N=(i,k,d,r)=>({id:'n'+i,kind:k,title:'T'+i,body:null,read_at:r?'2026-11-01T00:00:00Z':null,created_at:new Date(now-i*36e5).toISOString(),data:d||{}});
(async()=>{
 await t('other portal pages are untouched',async()=>{const x=setup([]);const r=await x.ctx.Core.V.portal(['orders']);assert.equal(r.html,'plain:orders')});
 await t('loads only the signed-in person\'s rows, newest first, one extra row to detect more',async()=>{
   const x=setup([N(0,'new_order',{seller_order_id:'s'})]);const r=await x.ctx.Core.V.portal(['notifications']);await r.after();await tick();
   assert.equal(x.gets.length,1);assert(/user_id=eq\.u1/.test(x.gets[0]));assert(/order=created_at\.desc/.test(x.gets[0]));assert(/limit=26/.test(x.gets[0]));assert(!/read_at/.test(x.gets[0]))});
 await t('destinations: orders, products, own url; unknown kinds are plain rows; unsafe urls are ignored',async()=>{
   const x=setup([N(0,'new_order',{seller_order_id:'s'}),N(1,'product_publish',{product_id:'p'}),N(2,'message_customer',{url:'/inbox/c'}),N(3,'order_update',{order_id:'o'}),N(4,'message',{url:'//evil.example'}),N(5,'store_approved',{})]);
   const r=await x.ctx.Core.V.portal(['notifications']);await r.after();await tick();const h=x.els.ncl.innerHTML;
   assert(h.includes('T0|/portal/orders'));assert(h.includes('T1|/portal/products'));assert(h.includes('T2|/inbox/c'));assert(h.includes('T3|-'));assert(h.includes('T4|-'));assert(h.includes('T5|/portal'))});
 await t('unread rows get a New chip; read rows do not',async()=>{
   const x=setup([N(0,'new_order',{},false),N(1,'new_order',{},true)]);const r=await x.ctx.Core.V.portal(['notifications']);await r.after();await tick();const h=x.els.ncl.innerHTML;
   assert(/T0\|[^|]*\|CHIP New/.test(h));assert(/T1\|[^|]*\|\]/.test(h))});
 await t('26 rows shows Load more and keeps 25',async()=>{
   const rows=[];for(let i=0;i<26;i++)rows.push(N(i,'new_order'));const x=setup(rows);const r=await x.ctx.Core.V.portal(['notifications']);await r.after();await tick();
   assert((x.els.ncl.innerHTML.match(/ROW\[/g)||[]).length===25);assert(/data-act="nc-more"/.test(x.els.ncl.innerHTML))});
 await t('empty and error states are honest',async()=>{
   let x=setup([]);let r=await x.ctx.Core.V.portal(['notifications']);await r.after();await tick();assert(/EMPTY No notifications yet/.test(x.els.ncl.innerHTML));
   x=setup([],true);r=await x.ctx.Core.V.portal(['notifications']);await r.after();await tick();assert(/BANNER Could not load notifications nc-retry/.test(x.els.ncl.innerHTML));assert(!/EMPTY/.test(x.els.ncl.innerHTML))});
 await t('Mark all as read only patches this person\'s loaded unread rows, read_at only',async()=>{
   const x=setup([N(0,'new_order',{},false),N(1,'new_order',{},true),N(2,'order_update',{},false)]);const r=await x.ctx.Core.V.portal(['notifications']);await r.after();await tick();
   x.ctx.Core.A['nc-all']();await new Promise(r=>setTimeout(r,10));
   assert.deepEqual(x.patches.map(p=>p.join(':')).sort(),['notifications:n0:read_at','notifications:n2:read_at'])});
 console.log(pass+' passed, '+fail+' failed')})();
