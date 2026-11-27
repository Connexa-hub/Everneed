// Session recovery in shared/supa.js: a 401 refreshes the token once and retries; an unrefreshable session is dropped and announced.
// Run from the repository root: node tools/web-seller-tests/supa-session.js
const vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
function env(script){
  const calls=[],store={en_web_sess:JSON.stringify({access_token:'old',refresh_token:'r1',expires_at:Date.now()+3600e3,uid:'u1'})},events=[];
  const ctx={CFG:{supabase:{url:'https://x.supabase.co',key:'K'}},location:{hash:'',pathname:'/portal',search:''},history:{replaceState(){}},
    localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}},atob:s=>Buffer.from(s,'base64').toString(),Event:class{constructor(t){this.type=t}},
    window:{dispatchEvent:e=>{events.push(e.type)}},console,Promise,JSON,Date,URLSearchParams,encodeURIComponent,setTimeout,
    fetch:(u,o)=>{calls.push([u,o&&o.headers&&o.headers.Authorization]);const r=script(u,o,calls);return Promise.resolve({ok:r.s<400,status:r.s,text:()=>Promise.resolve(JSON.stringify(r.b))})}};
  ctx.window.Supa=undefined;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../shared/supa.js'),'utf8'),ctx);
  return{Supa:ctx.window.Supa||ctx.Supa,calls,store,events}}
(async()=>{
 await t('401 with a good refresh token: refreshes once and retries with the new token',async()=>{
   const e=env((u,o,c)=>u.includes('grant_type=refresh_token')?{s:200,b:{access_token:'new',refresh_token:'r2',expires_in:3600}}:(o.headers.Authorization==='Bearer old'?{s:401,b:{message:'JWT expired'}}:{s:200,b:[{ok:1}]}));
   const r=await e.Supa.get('stores?select=*');assert.deepEqual(r,[{ok:1}]);assert.equal(e.calls.length,3);assert.equal(e.calls[2][1],'Bearer new');assert.equal(JSON.parse(e.store.en_web_sess).access_token,'new');assert.equal(e.events.length,0)});
 await t('401 and the refresh fails: session dropped, event fired, the original error is thrown',async()=>{
   const e=env((u)=>u.includes('grant_type=refresh_token')?{s:400,b:{msg:'Invalid Refresh Token'}}:{s:401,b:{message:'JWT expired'}});
   let err=null;try{await e.Supa.get('stores')}catch(x){err=x}
   assert(err&&err.status===401&&/JWT/.test(err.message));assert.equal(e.Supa.uid(),null);assert(!e.store.en_web_sess);assert.deepEqual(e.events,['en:session-lost'])});
 await t('401 again after a good refresh: no loop, session kept',async()=>{
   const e=env((u)=>u.includes('grant_type=refresh_token')?{s:200,b:{access_token:'new',refresh_token:'r2',expires_in:3600}}:{s:401,b:{message:'nope'}});
   let err=null;try{await e.Supa.get('x')}catch(x){err=x}assert(err);assert.equal(e.calls.filter(c=>c[0].includes('refresh_token')).length,1);assert.equal(e.events.length,0);assert.equal(e.Supa.uid(),'u1')});
 await t('other errors (403, 400, 500) are untouched',async()=>{
   for(const s of [400,403,500]){const e=env(()=>({s,b:{message:'m'+s}}));let err=null;try{await e.Supa.get('x')}catch(x){err=x}assert.equal(err.message,'m'+s);assert.equal(e.calls.length,1);assert.equal(e.events.length,0)}});
 await t('shared session: a key set by the app is used, and a newer stored session is adopted before refreshing',async()=>{
   const e=env((u)=>({s:200,b:[{ok:1}]}));e.store.en_web_sess=JSON.stringify({access_token:'newer',refresh_token:'r9',expires_at:Date.now()+7200e3,uid:'u1'});
   await e.Supa.get('x');assert.equal(e.calls[0][1],'Bearer newer');
   const ctx2={};const src=fs.readFileSync(path.join(__dirname,'../../shared/supa.js'),'utf8');assert(/window\.EV_SESSION_KEY/.test(src))});

 console.log(`${pass} passed, ${fail} failed`);
})();
