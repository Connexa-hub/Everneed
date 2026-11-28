// Tests for the router's runtime base and hash route (core.js, X2-03/04). Run from the repository root: node tools/web-seller-tests/core-route.js
const {J,vm}=require('./harness');const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const tick=()=>new Promise(r=>setTimeout(r,40));
function setup(start,env){
  const L={pathname:'/',search:'',hash:'',href:'',assign(u){this.assigned=u}};const stack=[];
  function apply(u){const m=/^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(u);
    if(u.charAt(0)==='#'){L.hash=u;return}
    L.pathname=m[1]||L.pathname;L.search=m[2]||'';L.hash=m[3]||''}
  apply(start);
  const H={pushState(s,t,u){stack.push(L.pathname+L.search+L.hash);apply(u)},replaceState(s,t,u){apply(u)},get length(){return stack.length+1}};
  const links=[],root={innerHTML:'',querySelectorAll:()=>links,querySelector:()=>null};
  const doc={addEventListener(){},querySelector:s=>s==='#root'?root:null,querySelectorAll:s=>s==='a[href]'?links:[],body:{classList:{add(){},remove(){},toggle(){}}},documentElement:{},title:''};
  const win=Object.assign({EV_ENV:undefined},env||{});
  const ctx={window:win,location:L,history:H,document:doc,CFG:{baseCurrency:'NGN'},console,setTimeout,clearTimeout,Math,Date,JSON,Promise,Intl,URLSearchParams,
    Ico:{svg:()=>''},Theme:{apply(){}},Supa:{uid:()=>null,out(){}},addEventListener(){},matchMedia:()=>({matches:false}),
    MutationObserver:function(){this.observe=()=>{};this.disconnect=()=>{}},IntersectionObserver:function(){this.observe=()=>{}},requestAnimationFrame:f=>setTimeout(f,0),getComputedStyle:()=>({}),localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null,setItem(){}},scrollTo(){},thumbs(){}};
  Object.assign(win,ctx);ctx.window=win;ctx.self=win;vm.createContext(ctx);
  try{vm.runInContext(J('core.js'),ctx)}catch(e){throw new Error('core.js did not load: '+e.message)}
  const C=win.Core;const seen=[];C.V.portal=a=>{seen.push(['portal',a.join('/')]);return Promise.resolve({layout:'pub',html:'p',title:'P'})};
  C.V.home=()=>{seen.push(['home']);return Promise.resolve({layout:'pub',html:'h'})};
  return {C,L,H,stack,seen,links,win}}
const mk=(h)=>({getAttribute:k=>k==='href'?h:null,setAttribute(k,v){this.v=v;h=v},get href(){return h}});
(async()=>{
 await t('website unchanged: no base, path routing, #/ writes become real paths',async()=>{
   const x=setup('/portal/products');assert.equal(x.C.path(),'/portal/products');x.C.go('/portal/orders');assert.equal(x.L.pathname,'/portal/orders');
   x.H.replaceState(null,'','#/portal/x');assert.equal(x.L.pathname,'/portal/x');
   const a=mk('#/portal/y'),b=mk('/portal/z');x.links.push(a,b);x.C.reset();});
 await t('website: go(location.pathname) still means "this page"',async()=>{const x=setup('/portal/products');x.C.go(x.L.pathname,true);await tick();assert.equal(x.L.pathname,'/portal/products');assert.deepEqual(x.seen.pop(),['portal','products'])});
 await t('base /seller: reads strip it, writes add it, screens still see /portal',async()=>{
   const x=setup('/seller/portal/products',{EV_BASE:'/seller'});assert.equal(x.C.path(),'/portal/products');
   x.C.go('/portal/orders');assert.equal(x.L.pathname,'/seller/portal/orders');assert.equal(x.C.path(),'/portal/orders');
   x.C.go('/seller/portal/inbox');assert.equal(x.L.pathname,'/seller/portal/inbox','an address that already has the base is not prefixed twice');
   x.C.go(x.L.pathname,true);assert.equal(x.L.pathname,'/seller/portal/inbox');x.H.replaceState(null,'','#/me');assert.equal(x.L.pathname,'/seller/me')});
 await t('base /seller: the bare base is the home page; links inside the markup point inside the app',async()=>{
   const x=setup('/seller',{EV_BASE:'/seller/'});assert.equal(x.C.path(),'/');const a=mk('#/portal/y'),b=mk('/portal/z'),c=mk('/assets/js/x.js'),d=mk('https://e.com/q');
   x.links.push(a,b,c,d);x.C.go('/');x.C.reset&&0;
   // fixLinks runs after each draw; draw once
   x.C.go('/portal');return tick().then(()=>{assert.equal(a.v,'/seller/portal/y');assert.equal(b.v,'/seller/portal/z');assert.equal(c.v,undefined);assert.equal(d.v,undefined)})});
 await t('hash route: the file part of the address never changes, so a reload cannot reach the shopper app',async()=>{
   const x=setup('/seller/index.html',{EV_BASE:'/seller',EV_ROUTE:'hash'});assert.equal(x.C.path(),'/');
   x.C.go('/portal/products/abc');assert.equal(x.L.pathname,'/seller/index.html');assert.equal(x.L.hash,'#/portal/products/abc');assert.equal(x.C.path(),'/portal/products/abc');
   await tick();assert.deepEqual(x.seen.pop(),['portal','products/abc']);assert.equal(x.stack.length,1)});
 await t('hash route: reload on a nested page restores the same page; go(location.pathname) re-renders it',async()=>{
   const x=setup('/seller/index.html#/portal/products/abc',{EV_BASE:'/seller',EV_ROUTE:'hash'});assert.equal(x.C.path(),'/portal/products/abc');
   x.C.go(x.L.pathname,true);await tick();assert.equal(x.L.hash,'#/portal/products/abc');assert.deepEqual(x.seen.pop(),['portal','products/abc']);assert.equal(x.stack.length,0,'re-render does not add a history entry')});
 await t('hash route: query strings stay in the hash and are not part of the path',async()=>{
   const x=setup('/seller/index.html',{EV_ROUTE:'hash'});x.C.go('/portal/products?tab=draft');assert.equal(x.L.hash,'#/portal/products?tab=draft');assert.equal(x.C.path(),'/portal/products');assert.equal(x.L.search,'')});
 await t('hash route: old code that writes location.hash or #/ history urls works unchanged; links become #/ links',async()=>{
   const x=setup('/seller/index.html',{EV_ROUTE:'hash'});x.H.replaceState(null,'','#/me');assert.equal(x.L.hash,'#/me');assert.equal(x.L.pathname,'/seller/index.html');
   const a=mk('#/portal/y'),b=mk('/portal/z');x.links.push(a,b);x.C.go('/portal');return tick().then(()=>{assert.equal(a.v,undefined,'#/ links stay as they are');assert.equal(b.v,'#/portal/z')})});
 await t('hash route: back goes to the previous page through history',async()=>{
   const x=setup('/seller/index.html',{EV_ROUTE:'hash'});x.C.go('/portal');x.C.go('/portal/products');assert.equal(x.stack.length,2);assert.equal(x.stack[1],'/seller/index.html#/portal')});
 console.log(pass+' passed, '+fail+' failed')})();
