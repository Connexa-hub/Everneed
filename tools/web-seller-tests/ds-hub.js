// Tests for the hub board (ds-hub.js, WEB-AD09). Run from the repository root: node tools/web-seller-tests/ds-hub.js
const {make,J,vm}=require('./harness');const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const tick=()=>new Promise(r=>setTimeout(r,5));
const so=(id,status,o)=>Object.assign({id,status,handed_over_at:null,hub_received_at:null,hub_check:null,stores:{name:'Store '+id},order_items:[{id:id+'-i1',name:'Shirt',size:'M',qty:2,variant_options:null},{id:id+'-i2',name:'Cap',size:null,qty:1,variant_options:{colour:'Red'}}]},o);
const ord=(id,status,sellers,o)=>Object.assign({id,status,route:'hub',at:Date.now(),cust:{name:'Ada Obi',phone:'0800',street:'1 Main St',city:'Yaba',state:'Lagos'},seller_orders:sellers,deliveries:null},o);
function setup(opts){opts=opts||{};const x=make({});const c=x.ctx;c.window=c;x.sheets=[];x.confirms=[];x.rpcs=[];x.gets=[];x.toasts=[];
  c.document={getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}},body:{contains:()=>true},querySelector:()=>null,addEventListener(){}};
  c.dispatchEvent=()=>{x.reloaded=(x.reloaded||0)+1};c.Event=function(n){this.type=n};
  c.Core.V.admin=()=>({layout:'admin',html:'BASE'});c.Core.ago=()=>'now';c.Core.toast=(m,e)=>x.toasts.push((e?'E:':'')+m);
  c.Core.me=opts.me||(()=>({role:'admin'}));if(opts.ctx)c.Core.adminCtx=opts.ctx;
  const h=s=>String(s==null?'':s);
  c.DS={icon:()=>'',chip:(l,tn)=>'['+l+(tn?'/'+tn:'')+']',empty:o=>'EMPTY '+o.title+'|'+o.text,banner:(k,ti,tx,a)=>'BANNER '+k+' '+ti+' '+tx+' '+(a&&a.act),
    seg:(items)=>'SEG '+items.map(i=>i.label+':'+i.n+(i.on?'*':'')).join(','),
    sheet:o=>{const L={};const btn={go:{disabled:true},x:{}};const hint={textContent:''};
      const body={addEventListener:(n,f)=>{L[n]=f},querySelector:s=>s==='[data-hb="go"]'?btn.go:s==='#ds-hb-hint'?hint:(s.indexOf('[data-f=')===0?(opts.fields||{})[s.slice(9,-2)]||{value:''}:null)};
      const api={title:o.title,html:o.html,body,closed:false,close(){api.closed=true},btn,hint,L};x.sheets.push(api);return api},
    confirm:o=>{x.confirms.push(o);return Promise.resolve(opts.confirmAnswer===undefined?true:opts.confirmAnswer)}};
  c.Supa.uid=()=> 'u1';c.Supa.get=p=>{x.gets.push(p);return opts.getFn?opts.getFn(p):Promise.resolve(opts.rows||[])};
  c.Supa.rpc=(f,a)=>{x.rpcs.push([f,a]);return opts.rpcFn?opts.rpcFn(f,a):Promise.resolve(null)};
  vm.runInContext(J('ds-hub.js'),c);return x}
const radio=(i,v)=>({type:'radio',value:v,getAttribute:k=>k==='data-i'?i:null});
const click=(k)=>({target:{closest:()=>({getAttribute:()=>k})}});
const btn=(id)=>({getAttribute:k=>k==='data-id'?id:null});

(async()=>{
 await t('groups: handover_pending -> check; at_hub -> hub; ready_for_delivery -> dispatch; out -> out; issue -> issue',async()=>{const H=setup().ctx.EVHub;
   assert.deepEqual([...H.groups(ord('o1','confirmed',[so('a','handover_pending')]))],['check']);
   assert.deepEqual([...H.groups(ord('o2','preparing',[so('a','at_hub'),so('b','ready')]))],['hub']);
   assert.deepEqual([...H.groups(ord('o3','ready_for_delivery',[so('a','consolidated')]))],['dispatch']);
   assert.deepEqual([...H.groups(ord('o4','out_for_delivery',[so('a','out_for_delivery')]))],['out']);
   assert.deepEqual([...H.groups(ord('o5','preparing',[so('a','issue'),so('b','handover_pending')]))],['issue','check'])});
 await t('groups ignore cancelled and rejected seller orders',async()=>{const H=setup().ctx.EVHub;
   assert.deepEqual([...H.groups(ord('o1','preparing',[so('a','cancelled'),so('b','at_hub')]))],['hub']);assert.equal(H.canConsolidate(ord('o1','preparing',[so('a','rejected'),so('b','at_hub')])),true)});
 await t('canConsolidate needs every active seller order at the hub (same rule as the server)',async()=>{const H=setup().ctx.EVHub;
   assert.equal(H.canConsolidate(ord('o','preparing',[so('a','at_hub'),so('b','handover_pending')])),false);assert.equal(H.canConsolidate(ord('o','preparing',[so('a','at_hub'),so('b','at_hub')])),true);
   assert.equal(H.canConsolidate(ord('o','preparing',[])),false);assert.equal(H.canConsolidate(ord('o','preparing',[so('a','cancelled')])),false);assert.equal(H.waiting(ord('o','preparing',[so('a','at_hub'),so('b','ready'),so('c','pending')])),2)});
 await t('buildCheck: null until every item answered; exact payload; unknown status rejected',async()=>{const H=setup().ctx.EVHub,items=[{id:'i1'},{id:'i2'}];
   assert.equal(H.buildCheck(items,{}),null);assert.equal(H.buildCheck(items,{i1:'received'}),null);assert.equal(H.buildCheck(items,{i1:'received',i2:'lost'}),null);assert.equal(H.buildCheck([],{}),null);
   assert.equal(JSON.stringify(H.buildCheck(items,{i1:'received',i2:'damaged',zz:'received'})),JSON.stringify([{item_id:'i1',status:'received'},{item_id:'i2',status:'damaged'}]))});
 await t('label matches the server parcel label (EN- plus first six characters, upper case)',async()=>{const H=setup().ctx.EVHub;assert.equal(H.label('ab12cd34-0000'),'EN-AB12CD')});
 await t('route: not admin, other pages and signed-out all fall through to the base router',async()=>{
   for(const [o,p] of [[{me:()=>({role:'customer'})},['hub']],[{},['sellers']],[{},[]]]){const x=setup(o);const r=await x.ctx.Core.V.admin(p);assert.equal(r.html,'BASE');assert.equal(x.gets.length,0)}});
 await t('route: Everneed Store workspace is sent back to its own area',async()=>{const x=setup({ctx:()=>'store'});const r=await x.ctx.Core.V.admin(['hub']);assert.equal(r.redirect,'/admin/store');assert.equal(x.gets.length,0)});
 await t('route: admin hub reads hub-route orders only, caps the list and renders the tab counts',async()=>{
   const x=setup({rows:[ord('o1','confirmed',[so('a','handover_pending')]),ord('o2','ready_for_delivery',[so('b','consolidated')],{deliveries:{status:'pending',parcel_label:'EN-O2',courier_name:null}})]});
   const r=await x.ctx.Core.V.admin(['hub']);assert.equal(r.layout,'admin');assert.equal(r.active,'admin/hub');
   assert(x.gets[0].includes('route=eq.hub')&&x.gets[0].includes('limit=200')&&!x.gets[0].includes('delivered'));
   assert(r.html.includes('To check:1*')&&r.html.includes('To dispatch:1')&&r.html.includes('At hub:0')&&r.html.includes('Needs attention:0'));assert(r.html.includes('Check items'))});
 await t('empty and error states are honest; error offers a retry',async()=>{
   let x=setup({rows:[]});let r=await x.ctx.Core.V.admin(['hub']);assert(r.html.includes('EMPTY No drop-offs to check'));
   x=setup({getFn:()=>Promise.reject(new Error('permission denied'))});r=await x.ctx.Core.V.admin(['hub']);assert(r.html.includes('BANNER error')&&r.html.includes('permission denied')&&r.html.includes('ds-hb-ref'))});
 await t('hub tab: consolidate disabled with a reason until every seller is at the hub; no fake enabled button',async()=>{const x=setup();const H=x.ctx.EVHub;
   let h=H.card(ord('o1','preparing',[so('a','at_hub'),so('b','handover_pending')]),'hub');assert(h.includes('disabled')&&h.includes('Waiting for 1 seller to drop off'));
   h=H.card(ord('o1','preparing',[so('a','at_hub'),so('b','at_hub')]),'hub');assert(!h.includes('disabled')&&h.includes('ds-hb-con'))});
 await t('hub tab: a seller order that failed the check blocks consolidation and the reason says so (real staging case CX01-10)',async()=>{const H=setup().ctx.EVHub;
   const h=H.card(ord('o1','preparing',[so('a','issue'),so('b','at_hub')]),'hub');assert(h.includes('disabled')&&h.includes('failed the hub check')&&!h.includes('Waiting for'))});
 await t('dispatch tab: no parcel -> disabled with reason; with parcel -> enabled',async()=>{const H=setup().ctx.EVHub;
   assert(H.card(ord('o','ready_for_delivery',[so('a','consolidated')]),'dispatch').includes('Consolidate the order first'));
   assert(!H.card(ord('o','ready_for_delivery',[so('a','consolidated')],{deliveries:{parcel_label:'EN-X',status:'pending'}}),'dispatch').includes('disabled'))});
 await t('user text is escaped in cards',async()=>{const H=setup().ctx.EVHub;const h=H.card(ord('o','confirmed',[so('a','handover_pending',{stores:{name:'<img onerror=x>'}})]),'check');assert(!h.includes('<img onerror')&&h.includes('&lt;img onerror=x&gt;'))});
 await t('out tab shows the courier details recorded; issue tab lists only missing or damaged items by name',async()=>{const H=setup().ctx.EVHub;
   const o=ord('o','out_for_delivery',[so('a','out_for_delivery')],{deliveries:{courier_name:'Musa',courier_phone:'0801',dispatched_at:'x',status:'dispatched'}});assert(H.card(o,'out').includes('Courier: Musa · 0801'));
   const i=ord('o','preparing',[so('a','issue',{hub_check:[{item_id:'a-i1',status:'missing'},{item_id:'a-i2',status:'received'}]})]);const h=H.card(i,'issue');assert(h.includes('Shirt · M × 2 — Missing')&&!h.includes('Cap')&&!h.includes('ds-hb-chk'))});
 await t('check items: confirm stays disabled until every item has an answer, then sends exactly one result per item',async()=>{
   const x=setup({rows:[ord('o1','confirmed',[so('a','handover_pending')])]});await x.ctx.Core.V.admin(['hub']);x.ctx.Core.A['ds-hb-chk'](btn('a'));
   const s=x.sheets[0];assert.equal(s.btn.go.disabled,true);assert(s.hint.textContent.startsWith('0 of 2'));
   s.L.change({target:radio('a-i1','received')});assert.equal(s.btn.go.disabled,true);assert(s.hint.textContent.startsWith('1 of 2'));
   s.L.change({target:radio('a-i2','received')});assert.equal(s.btn.go.disabled,false);s.L.click(click('go'));await tick();
   assert.equal(x.rpcs.length,1);assert.equal(x.rpcs[0][0],'hub_receive');assert.equal(JSON.stringify(x.rpcs[0][1]),JSON.stringify({p_so:'a',p_check:[{item_id:'a-i1',status:'received'},{item_id:'a-i2',status:'received'}]}));
   assert.equal(x.confirms.length,0);assert(s.closed);assert(x.toasts.includes('Items received at the hub.'));assert.equal(x.reloaded,1)});
 await t('check items: a missing or damaged item asks first and is not sent if the admin backs out',async()=>{
   let x=setup({rows:[ord('o1','confirmed',[so('a','handover_pending')])],confirmAnswer:null});await x.ctx.Core.V.admin(['hub']);x.ctx.Core.A['ds-hb-chk'](btn('a'));let s=x.sheets[0];
   s.L.change({target:radio('a-i1','received')});s.L.change({target:radio('a-i2','damaged')});assert(s.hint.textContent.includes('Needs attention'));s.L.click(click('go'));await tick();
   assert.equal(x.confirms.length,1);assert.equal(x.rpcs.length,0);assert(!s.closed);
   x=setup({rows:[ord('o1','confirmed',[so('a','handover_pending')])]});await x.ctx.Core.V.admin(['hub']);x.ctx.Core.A['ds-hb-chk'](btn('a'));s=x.sheets[0];
   s.L.change({target:radio('a-i1','missing')});s.L.change({target:radio('a-i2','received')});s.L.click(click('go'));await tick();assert.equal(x.rpcs.length,1);assert(x.toasts.includes('Check recorded. Flagged for attention.'))});
 await t('check items: a server refusal shows its message, keeps the sheet open and re-enables the button',async()=>{
   const x=setup({rows:[ord('o1','confirmed',[so('a','handover_pending')])],rpcFn:()=>Promise.reject(new Error('This seller order is not waiting at the hub.'))});await x.ctx.Core.V.admin(['hub']);x.ctx.Core.A['ds-hb-chk'](btn('a'));const s=x.sheets[0];
   s.L.change({target:radio('a-i1','received')});s.L.change({target:radio('a-i2','received')});s.L.click(click('go'));await tick();
   assert(x.toasts.includes('E:This seller order is not waiting at the hub.'));assert(!s.closed);assert.equal(s.btn.go.disabled,false);assert(!x.reloaded)});
 await t('consolidate: confirms, then calls hub_consolidate with the order id; refuses locally when sellers are still missing',async()=>{
   let x=setup({rows:[ord('o1','preparing',[so('a','at_hub'),so('b','at_hub')])]});await x.ctx.Core.V.admin(['hub']);x.ctx.Core.A['ds-hb-con'](btn('o1'));await tick();
   assert.equal(x.confirms.length,1);assert.equal(JSON.stringify(x.rpcs),JSON.stringify([['hub_consolidate',{p_order:'o1'}]]));
   x=setup({rows:[ord('o1','preparing',[so('a','at_hub'),so('b','handover_pending')])]});await x.ctx.Core.V.admin(['hub']);x.ctx.Core.A['ds-hb-con'](btn('o1'));await tick();assert.equal(x.rpcs.length,0);assert.equal(x.confirms.length,0);
   x=setup({rows:[ord('o1','preparing',[so('a','at_hub')])],confirmAnswer:null});await x.ctx.Core.V.admin(['hub']);x.ctx.Core.A['ds-hb-con'](btn('o1'));await tick();assert.equal(x.rpcs.length,0)});
 await t('dispatch: needs a courier name; sends name, and phone or note only when filled; no parcel -> nothing opens',async()=>{
   const rows=[ord('o1','ready_for_delivery',[so('a','consolidated')],{deliveries:{parcel_label:'EN-O1',status:'pending'}})];
   const f={name:{value:''},phone:{value:''},note:{value:''}};let x=setup({rows,fields:f});await x.ctx.Core.V.admin(['hub']);x.ctx.Core.A['ds-hb-dis'](btn('o1'));let s=x.sheets[0];
   assert(s.html.includes('1 Main St, Yaba, Lagos')&&s.html.includes('Ada Obi'));assert.equal(s.btn.go.disabled,true);
   s.L.click(click('go'));await tick();assert.equal(x.rpcs.length,0,'empty name never sends');
   f.name.value='Musa';s.L.input({});assert.equal(s.btn.go.disabled,false);s.L.click(click('go'));await tick();
   assert.equal(JSON.stringify(x.rpcs),JSON.stringify([['dispatch',{p_order:'o1',p_courier:{name:'Musa'}}]]));assert(s.closed);
   f.phone.value='0801';f.note.value='Gate B';x=setup({rows,fields:f});await x.ctx.Core.V.admin(['hub']);x.ctx.Core.A['ds-hb-dis'](btn('o1'));s=x.sheets[0];s.L.input({});s.L.click(click('go'));await tick();
   assert.equal(JSON.stringify(x.rpcs[0][1].p_courier),JSON.stringify({name:'Musa',phone:'0801',note:'Gate B'}));
   x=setup({rows:[ord('o1','ready_for_delivery',[so('a','consolidated')])]});await x.ctx.Core.V.admin(['hub']);x.ctx.Core.A['ds-hb-dis'](btn('o1'));assert.equal(x.sheets.length,0)});
 console.log(pass+' passed, '+fail+' failed');
})();
