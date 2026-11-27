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
  function clean(r){
    var l=r&&r.contexts?r.contexts:r;if(!Array.isArray(l))return null;
    return l.filter(function(c){return c&&(c.plane==="platform"||c.plane==="store")}).map(function(c){
      return{plane:c.plane,role:String(c.role||""),store_id:c.store_id==null?null:String(c.store_id),store_name:c.store_name?String(c.store_name):"",official:!!c.official,
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
    return st.ctx.some(function(c){return(storeId==null||c.store_id===String(storeId))&&has(c,keys)&&(!c.expires_at||Date.parse(c.expires_at)>Date.now())})
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
