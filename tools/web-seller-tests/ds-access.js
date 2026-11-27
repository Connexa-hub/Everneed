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
 // ---- my_access() shape from PR #49 (scope_id / scope_name), Claude 2 X2 follow-up
 const SHAPE=[
  {plane:'platform',scope_type:'platform',scope_id:null,scope_name:null,role:'platform_dispatcher',display_name:'Dispatcher',permissions:['logistics.dispatch.assign','logistics.dispatch.read','logistics.route.plan'],source:'assignment',compatibility:false,official:false},
  {plane:'store',scope_type:'store',scope_id:'s1',scope_name:'Ada Store',role:'store_owner',display_name:'Store Owner',permissions:['store.orders.read','store.orders.transition','store.team.manage'],source:'legacy_owner',compatibility:false,official:false},
  {plane:'partner',scope_type:'hub',scope_id:'hub-1',scope_name:null,role:'partner_hub_staff',display_name:'Hub Staff',permissions:['logistics.hub.read','logistics.custody.scan'],source:'assignment',compatibility:false,official:false}];
 await t('generic scope_id / scope_name fill store_id / store_name for store contexts; partner contexts are kept, never given a store id',async()=>{
   const x=setup(()=>Promise.resolve(SHAPE));const a=x.ctx.EVAccess;await a.load();const c=a.contexts();assert.equal(c.length,3);
   const st=c.find(k=>k.plane==='store'),pa=c.find(k=>k.plane==='partner'),pl=c.find(k=>k.plane==='platform');
   assert.equal(st.store_id,'s1');assert.equal(st.store_name,'Ada Store');assert.equal(st.scope_id,'s1');assert.equal(st.source,'legacy_owner');
   assert.equal(pa.store_id,null);assert.equal(pa.scope_type,'hub');assert.equal(pa.scope_id,'hub-1');assert.equal(pl.store_id,null);assert.equal(pl.scope_type,'platform')});
 await t('gates work on the new shape: store scope, dispatch, and no cross-plane leakage',async()=>{
   const x=setup(()=>Promise.resolve(SHAPE));const a=x.ctx.EVAccess;await a.load();
   assert.equal(a.can('orders.act','s1'),true);assert.equal(a.can('orders.act','s2'),false);assert.equal(a.can('team.manage','s1'),true);assert.equal(a.can('catalogue.edit','s1'),false);
   assert.equal(a.can('dispatch.assign'),true);assert.equal(a.can('sellers.review'),false)});
 await t('a branch or terminal scope id is not mistaken for a store id',async()=>{
   const x=setup(()=>Promise.resolve([{plane:'store',scope_type:'terminal',scope_id:'t9',role:'store_pos_cashier',permissions:['pos.sales.create']}]));const a=x.ctx.EVAccess;await a.load();
   assert.equal(a.contexts()[0].store_id,null);assert.equal(a.can('orders.act','t9'),false)});
 await t('legacy admin compatibility context: platform gates keep today\'s behaviour (null), store gates stay denied, nothing is promoted',async()=>{
   const x=setup(()=>Promise.resolve([{plane:'platform',scope_type:'platform',scope_id:null,role:'legacy_admin',display_name:'Legacy Admin (compatibility)',permissions:[],source:'legacy_profile',compatibility:true,official:false}]));
   const a=x.ctx.EVAccess;await a.load();assert.equal(a.available(),true);assert.equal(a.can('sellers.review'),null);assert.equal(a.gate('sellers.review',true),true);
   assert.equal(a.can('orders.act'),false);assert.equal(a.contexts()[0].compatibility,true)});
 await t('a real platform role beats the compatibility context',async()=>{
   const x=setup(()=>Promise.resolve([{plane:'platform',role:'legacy_admin',permissions:[],compatibility:true},{plane:'platform',scope_type:'platform',role:'platform_reviewer',permissions:['platform.sellers.review']}]));
   const a=x.ctx.EVAccess;await a.load();assert.equal(a.can('sellers.review'),true);assert.equal(a.can('staff.manage'),null)});
 console.log(pass+' passed, '+fail+' failed')})();
