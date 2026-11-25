// WEB-S23 regression tests for the seller photo uploader (web/assets/js/upload.js). Run from the repository root: node tools/web-seller-tests/upload.js
const {J,vm}=require('./harness');const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const bytes=(...a)=>new Uint8Array([...a,...new Array(40).fill(0)]);
const JPG=bytes(0xFF,0xD8,0xFF,0xE0),PNG=bytes(0x89,0x50,0x4E,0x47,0x0D,0x0A),GIF=bytes(0x47,0x49,0x46,0x38),WEBP=bytes(0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50),
  HEIC=bytes(0,0,0,0x18,0x66,0x74,0x79,0x70,0x68,0x65,0x69,0x63),TXT=bytes(0x68,0x65,0x6c,0x6c,0x6f);
function file(u8,size,name,type){const f={name:name||'p.jpg',type:type===undefined?'image/jpeg':type,size:size||u8.length,_u8:u8};return f}
function setup(o){o=o||{};const calls=[];const ctx={console:{warn(){}},navigator:{onLine:o.offline?false:true},
  CFG:{supabase:{url:'https://x.supabase.co',key:'anon'}},Math,Date,JSON,Promise,Blob,Uint8Array,ArrayBuffer,String,Object,Error,Array,
  AbortController,URL:{createObjectURL:()=> 'blob:x',revokeObjectURL(){}},
  setTimeout:(f,ms)=>global.setTimeout(f,ms>=1000?(ms>=20000&&o.realTimeout?1:1):1),clearTimeout:global.clearTimeout,
  FileReader:function(){const r=this;r.readAsArrayBuffer=f=>{if(f.bad){setTimeout(()=>r.onerror&&r.onerror(),0);return}
    setTimeout(()=>{const big=new Uint8Array(f.size||f._u8.length);big.set(f._u8.slice(0,Math.min(f._u8.length,big.length)));r.result=big.buffer;r.onload()},0)}},
  createImageBitmap:async b=>({width:o.w||800,height:o.h||600,close(){}}),
  document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toBlob(cb,type,q){cb(new Blob([new Uint8Array(o.out&&o.out(q)||300000)],{type:'image/jpeg'}))}})},
  Supa:{token:async()=>o.noTok?null:'tok',get:async p=>{calls.push('GET '+p);if(o.refreshFails)throw new Error('x');return[]}},
  fetch:(u,init)=>{calls.push('POST');return o.fetch(u,init,calls.filter(c=>c==='POST').length)}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(J('upload.js'),ctx);ctx.calls=calls;return ctx}
const res=(status,body)=>Promise.resolve({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body||{})});
(async()=>{
 await t('real type comes from the bytes, not the browser type',()=>{const u=setup({}).EVUpload;
   assert.equal(u.sniff(JPG),'image/jpeg');assert.equal(u.sniff(PNG),'image/png');assert.equal(u.sniff(GIF),'image/gif');assert.equal(u.sniff(WEBP),'image/webp');assert.equal(u.sniff(HEIC),'image/heic');assert.equal(u.sniff(TXT),'')});
 await t('prepare: text file and HEIC are refused with a clear, non-retry message',async()=>{const u=setup({}).EVUpload;
   await assert.rejects(()=>u.prepare(file(TXT,5,'a.jpg','image/jpeg')),e=>e.code==='format'&&e.retry===false&&/not a photo/.test(e.message));
   await assert.rejects(()=>u.prepare(file(HEIC,500,'a.heic','image/heic')),e=>e.code==='format'&&/HEIC/.test(e.message))});
 await t('prepare: an unreadable gallery or cloud photo fails early as "read", not inside fetch',async()=>{const u=setup({}).EVUpload;
   const f=file(JPG,100);f.bad=true;await assert.rejects(()=>u.prepare(f),e=>e.code==='read'&&/Choose it again/.test(e.message))});
 await t('prepare: a photo with an empty browser type is accepted when the bytes say JPEG',async()=>{const u=setup({}).EVUpload;
   const b=await u.prepare(file(JPG,200000,'IMG_1.jpg',''));assert.equal(b.type,'image/jpeg')});
 await t('prepare: large photo is shrunk and retried at lower quality until under 4 MB',async()=>{const seen=[];const u=setup({w:4000,h:3000,out:q=>{seen.push(q);return q>0.8?5e6:q>0.6?4.5e6:900000}}).EVUpload;
   const b=await u.prepare(file(JPG,6e6,'big.jpg'));assert.ok(b.size<4e6);assert.deepEqual(seen,[0.85,0.7,0.55])});
 await t('prepare: a photo that stays over 4 MB is refused with a size message',async()=>{const u=setup({w:4000,h:3000,out:()=>5e6}).EVUpload;
   await assert.rejects(()=>u.prepare(file(JPG,6e6)),e=>e.code==='size'&&e.retry===false)});
 await t('put: success returns the public URL',async()=>{const x=setup({fetch:()=>res(200)});const url=await x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'stores/s1');
   assert.match(url,/^https:\/\/x\.supabase\.co\/storage\/v1\/object\/public\/media\/stores\/s1\/\d+-\w+\.jpg$/)});
 await t('put: two network failures then success (the "Failed to fetch" case) uploads without bothering the seller',async()=>{
   const x=setup({fetch:(u,i,n)=>n<3?Promise.reject(new TypeError('Failed to fetch')):res(200)});await x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'stores/s1');assert.equal(x.calls.length,3)});
 await t('put: three network failures end with a plain "net" error that says the form is kept',async()=>{
   const x=setup({fetch:()=>Promise.reject(new TypeError('Failed to fetch'))});await assert.rejects(()=>x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'stores/s1'),e=>e.code==='net'&&e.retry&&/kept/.test(e.message)&&!/Failed to fetch/.test(e.message));
   assert.equal(x.calls.length,3);assert.equal(x.EVUpload.last.code,'net')});
 await t('put: offline is reported once, not retried',async()=>{const x=setup({offline:true,fetch:()=>Promise.reject(new TypeError('Failed to fetch'))});
   await assert.rejects(()=>x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'s'),e=>e.code==='offline');assert.equal(x.calls.length,1)});
 await t('put: a slow upload times out with a clear message',async()=>{
   const x=setup({fetch:(u,i)=>new Promise((ok,no)=>i.signal.addEventListener('abort',()=>no(new DOMException('aborted','AbortError'))))});
   await assert.rejects(()=>x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'s',{tries:1}),e=>e.code==='timeout'&&/too slow/.test(e.message))});
 await t('put: storage policy 403 is "denied", not retried, and keeps the evidence for the backend owner',async()=>{
   const x=setup({fetch:()=>res(403,{message:'new row violates row-level security policy'})});await assert.rejects(()=>x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'s'),e=>e.code==='denied'&&e.retry===false&&e.status===403);
   assert.equal(x.calls.length,1);assert.match(x.EVUpload.last.detail,/row-level security/)});
 await t('put: expired session refreshes once and retries',async()=>{let n=0;const x=setup({fetch:()=>++n===1?res(401,{message:'exp'}):res(200)});await x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'s');assert.ok(x.calls.some(c=>/^GET profiles/.test(c)));assert.equal(x.calls.filter(c=>c==='POST').length,2)});
 await t('put: session that cannot refresh asks to sign in and keeps the form',async()=>{const x=setup({refreshFails:true,fetch:()=>res(401)});await assert.rejects(()=>x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'s'),e=>e.code==='auth'&&/kept/.test(e.message))});
 await t('put: 5xx is retried; 413 and 415 are specific and final',async()=>{let n=0;let x=setup({fetch:()=>++n<3?res(503):res(200)});await x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'s');assert.equal(x.calls.length,3);
   x=setup({fetch:()=>res(413)});await assert.rejects(()=>x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'s'),e=>e.code==='size'&&x.calls.length===1);
   x=setup({fetch:()=>res(400,{message:'mime type image/x is not supported'})});await assert.rejects(()=>x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'s'),e=>e.code==='format')});
 await t('diagnostics never contain the token or the key',async()=>{const x=setup({fetch:()=>res(403,{message:'denied'})});await x.EVUpload.put(new Blob([JPG],{type:'image/jpeg'}),'s').catch(()=>{});
   const d=JSON.stringify(x.EVUpload.last);assert.ok(!/tok|anon/.test(d.replace(/token/g,'')))});
 console.log(pass+' passed, '+fail+' failed')})();
