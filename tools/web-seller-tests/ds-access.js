// Tests for the access client (ds-access.js). Run from the repository root: node tools/web-seller-tests/ds-access.js
const {make,J,vm}=require('./harness');const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
function setup(rpc,uid){const x=make({});x.ctx.window=x.ctx;x.calls=0;x.ctx.Supa={uid:()=>uid===undefined?'u1':uid,rpc:(f)=>{x.calls++;return rpc(f)}};
  x.ctx.addEventListener=()=>{};vm.runInContext(J('ds-access.js'),x.ctx);return x}
const STORE={plane:'store',role:'fulfilment',store_id:'s1',store_name:'Ada',permissions:['store.orders.read','store.orders.transition']};
const PLAT={plane:'platform',role:'reviewer',permissions:['platform.sellers.read','platform.sellers.review']};
(async()=>{
 await t('missing function: not available, gate returns the legacy value, nothing inferred',async()=>{
   const x=setup(()=>Promise.reject({status:404}));const a=x.ctx.EVAccess;await a.load();
   assert.equal(a.available(),false);assert.equal(a.can('orders.act'),null);assert.equal(a.gate('orders.act',true),true);assert.equal(a.gate('staff.manage',false),false)});
 await t('network error behaves the same and is not retried for 60 seconds',async()=>{
   const x=setup(()=>Promise.reject({status:0}));const a=x.ctx.EVAccess;await a.load();await a.load();assert.equal(x.calls,1);assert.equal(a.available(),false)});
 await t('server answer drives gates; unknown or missing keys are denied',async()=>{
   const x=setup(()=>Promise.resolve([STORE]));const a=x.ctx.EVAccess;await a.load();
   assert.equal(a.available(),true);assert.equal(a.can('orders.act'),true);assert.equal(a.can('catalogue.edit'),false);assert.equal(a.can('totally.unknown'),false);
   assert.equal(a.gate('catalogue.edit',true),false,'server answer beats legacy')});
 await t('store scope: a key on store s1 does not open store s2',async()=>{
   const x=setup(()=>Promise.resolve([STORE]));const a=x.ctx.EVAccess;await a.load();assert.equal(a.can('orders.act','s1'),true);assert.equal(a.can('orders.act','s2'),false)});
 await t('platform keys never open store gates and the reverse',async()=>{
   const x=setup(()=>Promise.resolve([PLAT]));const a=x.ctx.EVAccess;await a.load();assert.equal(a.can('sellers.review'),true);assert.equal(a.can('orders.act'),false)});
 await t('wildcard grants from the server (platform.*.read) match, but never write keys',async()=>{
   const x=setup(()=>Promise.resolve([{plane:'platform',role:'analyst',permissions:['platform.*.read']}]));const a=x.ctx.EVAccess;await a.load();
   assert.equal(a.can('sellers.view'),true);assert.equal(a.can('sellers.review'),false)});
 await t('accepted alias names from the architecture doc also work',async()=>{
   const x=setup(()=>Promise.resolve([{plane:'store',role:'catalogue',store_id:'s1',permissions:['store.catalog.edit']}]));const a=x.ctx.EVAccess;await a.load();assert.equal(a.can('catalogue.edit'),true)});
 await t('expired assignments do not count; malformed entries are dropped',async()=>{
   const x=setup(()=>Promise.resolve([{plane:'store',store_id:'s1',role:'x',permissions:['store.orders.read'],expires_at:'2000-01-01T00:00:00Z'},{plane:'hacker',permissions:['*']},null]));
   const a=x.ctx.EVAccess;await a.load();assert.equal(a.contexts().length,1);assert.equal(a.can('orders.view'),false)});
 await t('one call per session; reset on sign-out; signed out means unavailable',async()=>{
   const x=setup(()=>Promise.resolve([STORE]));const a=x.ctx.EVAccess;await a.load();await a.load();assert.equal(x.calls,1);a.reset();assert.equal(a.available(),false);
   const y=setup(()=>Promise.resolve([STORE]),null);await y.ctx.EVAccess.load();assert.equal(y.calls,0)});
 console.log(pass+' passed, '+fail+' failed')})();
