/* Access client (see ROLES_AND_ACCESS_PROPOSAL.md and PHASE_A_KICKOFF_CLAUDE_HANDOFF.md). It only REFLECTS what the server says.
   - Asks the server once (rpc my_access). If that function does not exist yet, or the call fails, `available` is false and every
     caller keeps today's behaviour (store owner sees the store, profiles.role = admin sees the platform). Nothing is inferred.
   - The server still checks every action. This is for showing, hiding or disabling controls, never for authorization.
   - GATES is the one table that maps a screen control to permission keys. Renaming a key later means editing this table only.
     Each gate may list several accepted key names (the accepted contract and the universal-architecture examples differ). */
(function(){
  var GATES={
    "orders.view":["store.orders.read","store.orders.manage"],"orders.act":["store.orders.transition","store.orders.manage"],
    "catalogue.edit":["store.catalogue.write","store.catalog.edit"],"catalogue.publish":["store.catalogue.publish"],
    "inventory.edit":["store.inventory.write","store.inventory.adjust"],"inbox.reply":["store.inbox.reply"],
    "finance.view":["store.finance.read"],"payout.request":["store.finance.payout","finance.payout.request"],
    "settings.edit":["store.settings.write"],"discounts.edit":["store.discounts.write"],"team.manage":["store.team.manage"],"analytics.view":["store.analytics.read"],
    "sellers.view":["platform.sellers.read"],"sellers.review":["platform.sellers.review"],"products.review":["platform.products.review"],
    "platform.orders.view":["platform.orders.read"],"platform.orders.intervene":["platform.orders.intervene"],
    "platform.inbox.reply":["platform.inbox.reply"],"platform.finance.view":["platform.finance.read"],
    "payouts.approve":["platform.payouts.approve","finance.payout.approve"],"refunds.approve":["platform.refunds.approve"],
    "staff.manage":["platform.staff.manage"],"audit.view":["platform.audit.read"],
    "dispatch.view":["logistics.dispatch.read"],"dispatch.assign":["logistics.dispatch.assign"]
  };
  var NOPE={403:1,404:1},st={uid:null,p:null,on:false,ctx:[],active:0,at:0};
  function arr(a){return Array.isArray(a)?a:[]}
  /* Context shape from my_access() (PR #49): plane, scope_type, scope_id, scope_name, role, display_name, permissions, source, compatibility, official.
     `store_id` / `store_name` stay as aliases: they are filled from scope_id / scope_name only for store-plane contexts whose scope is a store
     (a branch or terminal scope id is not a store id). Partner contexts (hub, zone, job...) are kept with their own scope; they never get a store_id. */
  var PLANES={platform:1,store:1,partner:1};
  function clean(r){
    var l=r&&r.contexts?r.contexts:r;if(!Array.isArray(l))return null;
    return l.filter(function(c){return c&&PLANES[c.plane]===1}).map(function(c){
      var scoped=c.scope_id!=null?String(c.scope_id):null,isStore=c.plane==="store"&&(c.scope_type==null||c.scope_type==="store"),
        sid=c.store_id!=null?String(c.store_id):(isStore?scoped:null),sname=c.store_name?String(c.store_name):(isStore&&c.scope_name?String(c.scope_name):"");
      return{plane:c.plane,scope_type:c.scope_type?String(c.scope_type):(c.plane==="platform"?"platform":(sid?"store":"")),scope_id:scoped!=null?scoped:sid,scope_name:c.scope_name?String(c.scope_name):sname,
        role:String(c.role||""),display_name:c.display_name?String(c.display_name):"",source:c.source?String(c.source):"",compatibility:c.compatibility===true,
        store_id:c.plane==="store"?sid:null,store_name:c.plane==="store"?sname:"",official:!!c.official,
        permissions:arr(c.permissions).filter(function(k){return typeof k==="string"}),expires_at:c.expires_at||null}})
  }
  function has(c,keys){
    return keys.some(function(k){return c.permissions.some(function(g){
      if(g===k)return true;
      if(g.indexOf("*")<0)return false;
      return new RegExp("^"+g.split(".").map(function(s){return s==="*"?"[^.]+":s.replace(/[^\w-]/g,"")}).join("\\.")+"$").test(k)})})
  }
  function load(force){
    var uid=window.Supa&&Supa.uid&&Supa.uid();
    if(!uid){reset();return Promise.resolve(api)}
    if(st.uid===uid&&st.p&&!force&&(st.on||Date.now()-st.at<60000))return st.p;
    st.uid=uid;st.at=Date.now();
    st.p=Supa.rpc("my_access",{}).then(function(r){var c=clean(r);st.on=!!c;st.ctx=c||[];if(st.active>=st.ctx.length)st.active=0;return api},
      function(e){st.on=false;st.ctx=[];if(e&&!NOPE[e.status]&&window.console)console.warn("my_access failed",e.status);return api});
    return st.p;
  }
  function reset(){st.uid=null;st.p=null;st.on=false;st.ctx=[];st.active=0}
  /* can(gate[, storeId]): true / false when the server told us; null when it did not (caller keeps its current behaviour). */
  function can(g,storeId){
    if(!st.on)return null;var keys=GATES[g]||[g];
    var ok=st.ctx.some(function(c){return!c.compatibility&&(storeId==null||c.store_id===String(storeId))&&has(c,keys)&&(!c.expires_at||Date.parse(c.expires_at)>Date.now())});
    if(ok)return true;
    /* A compatibility context (legacy profiles.role = admin) carries no permissions and is never promoted. For a platform gate it means the server
       has no answer yet, so the caller keeps today's behaviour instead of locking the admin out. Store gates and every other case stay denied. */
    if(storeId==null&&String(keys[0]).indexOf("store.")!==0&&st.ctx.some(function(c){return c.compatibility&&c.plane==="platform"}))return null;
    return false
  }
  function why(){return"Your role cannot do this. Ask the store owner or an Everneed admin."}
  var api={
    load:load,reset:reset,gates:GATES,can:can,why:why,
    available:function(){return st.on},contexts:function(){return st.ctx.slice()},
    active:function(){return st.ctx[st.active]||null},
    setActive:function(i){if(i>=0&&i<st.ctx.length){st.active=i;return true}return false},
    /* gate(name, legacy): the server's answer when there is one, otherwise the value today's code already computed. */
    gate:function(g,legacy,storeId){var v=can(g,storeId);return v===null?legacy:v}
  };
  window.EVAccess=api;
  window.addEventListener&&window.addEventListener("en:session-lost",reset);
})();
