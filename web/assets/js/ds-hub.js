/* Hub board (WEB-AD09): receive, consolidate and dispatch hub-route orders. LIVE data, route /admin/hub, admin only.
   Loaded on demand by ds-lazy.js. Own page file until the admin section seam (WEB-AD08) lands; no menu entry yet.
   Uses ONLY existing backend: reads orders, seller_orders, order_items, deliveries (admin RLS) and calls
   hub_receive(p_so, p_check), hub_consolidate(p_order), dispatch(p_order, p_courier). Every call re-checks admin, state and throttle on the server.
   Not here (no backend yet, see the handoff BACKEND REQUESTs): dispatcher assignment, courier acceptance, custody events, resolving a hub issue.
   ds-dispatch.js stays the labelled MOCK preview. Action names are prefixed ds-hb-. */
(function(){
  var C=window.Core,D=window.DS;if(!C||!D||!C.V||!C.V.admin)return;
  var esc=C.esc,V=C.V,A=C.A,CAP=200;
  var TABS=[["check","To check"],["hub","At hub"],["dispatch","To dispatch"],["out","On the way"],["issue","Needs attention"]];
  var SO={pending:"Waiting to accept",accepted:"Accepted",preparing:"Preparing",ready:"Ready",handover_pending:"Bringing to hub",at_hub:"At hub",consolidated:"Consolidated",issue:"Issue",out_for_delivery:"Out for delivery",delivered:"Delivered"};
  var TONE={handover_pending:"warn",at_hub:"ok",consolidated:"ok",issue:"bad",out_for_delivery:"info"};
  var CK={received:"Received",missing:"Missing",damaged:"Damaged"};
  var EMPTY={check:["No drop-offs to check","Seller orders appear here when a seller marks them as on the way to the hub."],
    hub:["Nothing at the hub","Orders appear here once their items pass the check."],
    dispatch:["Nothing ready to dispatch","A parcel appears here after every seller on the order has been consolidated."],
    out:["Nothing on the way","Orders you dispatch from the hub appear here."],
    issue:["No problems recorded","Orders with missing or damaged items appear here."]};
  var Q="orders?select=id,status,route,at,cust,seller_orders(id,status,handed_over_at,hub_received_at,hub_check,stores(name),order_items(id,name,size,qty,variant_options)),deliveries(status,courier_name,courier_phone,parcel_label,dispatched_at)&route=eq.hub&status=in.(paid,confirmed,preparing,ready_for_delivery,out_for_delivery)&order=at.desc&limit="+CAP;
  var F={g:"check"},ROWS=[];

  function one(x){return Array.isArray(x)?x[0]||null:x||null}
  function live(o){return(o.seller_orders||[]).filter(function(s){return s.status!=="cancelled"&&s.status!=="rejected"})}
  function label(id){return"EN-"+String(id||"").replace(/-/g,"").slice(0,6).toUpperCase()}
  function has(o,st){return live(o).some(function(s){return s.status===st})}
  /* An order can sit in two tabs, for example one seller has a problem while another is still waiting to be checked. */
  function groups(o){var g=[];
    if(has(o,"issue"))g.push("issue");
    if(o.status==="out_for_delivery")g.push("out");
    else if(o.status==="ready_for_delivery")g.push("dispatch");
    else{if(has(o,"handover_pending"))g.push("check");if(has(o,"at_hub")||has(o,"consolidated"))g.push("hub")}
    return g}
  /* Same rule as the server: every active seller order must be at the hub. The server re-checks. */
  function canConsolidate(o){var s=live(o);return s.length>0&&s.every(function(x){return x.status==="at_hub"})}
  function waiting(o){return live(o).filter(function(x){return x.status!=="at_hub"}).length}
  /* One result per item, exactly like hub_receive expects. Returns null until every item has an answer. */
  function buildCheck(items,picks){var out=[];for(var i=0;i<items.length;i++){var v=picks[items[i].id];if(!CK[v])return null;out.push({item_id:items[i].id,status:v})}return out.length?out:null}
  function itemName(i){var opt=i.variant_options&&typeof i.variant_options==="object"?Object.keys(i.variant_options).map(function(k){return i.variant_options[k]}).filter(Boolean).join(", "):"";
    return String(i.name||"Item")+(i.size?" · "+i.size:"")+(opt?" · "+opt:"")+" × "+(i.qty||1)}
  function fail(e){C.toast(e&&e.message||"That did not work",true)}
  function again(){window.dispatchEvent(new Event("hashchange"))}
  function find(soId){for(var i=0;i<ROWS.length;i++){var s=(ROWS[i].seller_orders||[]).filter(function(x){return x.id===soId})[0];if(s)return{o:ROWS[i],so:s}}return null}
  function byId(id){return ROWS.filter(function(o){return o.id===id})[0]||null}

  function css(){if(document.getElementById("ds-hb-css"))return;var s=document.createElement("style");s.id="ds-hb-css";
    s.textContent=".ds-hb-card{padding:14px;border:1px solid var(--border);border-radius:var(--r-card,16px);background:var(--surface-1);color:var(--text-1)}.ds-hb-card+.ds-hb-card{margin-top:12px}"
    +".ds-hb-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.ds-hb-top b{font:700 16px var(--font-body)}.ds-hb-sub{margin:4px 0 0;color:var(--text-2);font:500 13px/1.4 var(--font-body)}"
    +".ds-hb-so{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 0;border-top:1px solid var(--border);margin-top:10px}.ds-hb-so:first-of-type{margin-top:12px}.ds-hb-so small{display:block;color:var(--text-2)}"
    +".ds-hb-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ds-hb-acts .ds-btn{min-height:44px}.ds-hb-why{margin:8px 0 0;color:var(--text-2);font:500 13px/1.4 var(--font-body)}"
    +".ds-hb-fs{border:0;margin:0 0 16px;padding:0}.ds-hb-fs legend{padding:0;margin:0 0 8px;font:600 15px/1.35 var(--font-body);color:var(--text-1)}.ds-hb-ops{display:flex;gap:8px;flex-wrap:wrap}"
    +".ds-hb-ops label{position:relative;flex:1 1 0;min-width:96px}.ds-hb-ops input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}"
    +".ds-hb-ops span{display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 12px;border:1.5px solid var(--border);border-radius:99px;background:var(--surface-1);color:var(--text-1);font:600 14px var(--font-body)}"
    +".ds-hb-ops input:checked+span{background:var(--brand);border-color:var(--brand);color:var(--text-on-brand)}.ds-hb-ops input.bad:checked+span{background:var(--danger);border-color:var(--danger)}.ds-hb-ops input:focus-visible+span{outline:3px solid var(--brand);outline-offset:2px}"
    +".ds-hb-hint{margin:0 0 12px;color:var(--text-2);font:500 13px/1.4 var(--font-body)}.ds-hb-dl{margin:0 0 14px;color:var(--text-1);font:500 14px/1.5 var(--font-body)}.ds-hb-dl b{display:block;font:600 13px var(--font-body);color:var(--text-2)}";
    document.head.appendChild(s)}

  function sellerRow(o,s,tab){var n=(s.order_items||[]).length,t=s.status==="handover_pending"?s.handed_over_at:s.hub_received_at;
    return'<div class="ds-hb-so"><div><b>'+esc((one(s.stores)||{}).name||"Seller")+"</b><small>"+n+(n===1?" item":" items")+(t?" · "+esc(C.ago(t)):"")+"</small></div>"
      +'<div class="ds-chips">'+D.chip(SO[s.status]||s.status,TONE[s.status])+(tab==="check"&&s.status==="handover_pending"?'<button type="button" class="ds-btn s" data-act="ds-hb-chk" data-id="'+esc(s.id)+'">Check items</button>':"")+"</div></div>"}
  function issueRows(s){var items=s.order_items||[],by={};items.forEach(function(i){by[i.id]=i});var ck=Array.isArray(s.hub_check)?s.hub_check:[];
    var bad=ck.filter(function(c){return c&&c.status&&c.status!=="received"});
    return bad.length?'<ul class="ds-hb-dl">'+bad.map(function(c){var it=by[c.item_id];return"<li>"+esc(it?itemName(it):"Item")+" — "+esc(CK[c.status]||c.status)+"</li>"}).join("")+"</ul>":'<p class="ds-hb-why">No item details were recorded for this check.</p>'}
  function card(o,tab){var d=one(o.deliveries),sellers=live(o),acts="",why="";
    if(tab==="hub"){var ok=canConsolidate(o);
      acts='<button type="button" class="ds-btn" data-act="ds-hb-con" data-id="'+esc(o.id)+'"'+(ok?"":" disabled")+(ok?"":' aria-describedby="hbw-'+esc(o.id)+'"')+">Consolidate</button>";
      if(!ok)why="Waiting for "+waiting(o)+(waiting(o)===1?" seller":" sellers")+" to drop off and pass the check."}
    if(tab==="dispatch"){var rd=!!d;
      acts='<button type="button" class="ds-btn" data-act="ds-hb-dis" data-id="'+esc(o.id)+'"'+(rd?"":" disabled")+(rd?"":' aria-describedby="hbw-'+esc(o.id)+'"')+">Dispatch</button>";
      if(!rd)why="No parcel exists yet. Consolidate the order first."}
    var sub=[];if(d&&d.parcel_label)sub.push("Parcel "+d.parcel_label);if(o.cust&&(o.cust.city||o.cust.state))sub.push("To "+[o.cust.city,o.cust.state].filter(Boolean).join(", "));if(o.at)sub.push(C.ago(Number(o.at)));
    var body=sellers.map(function(s){return sellerRow(o,s,tab)+(tab==="issue"&&s.status==="issue"?issueRows(s):"")}).join("");
    if(tab==="out"&&d)body+='<p class="ds-hb-sub">'+(d.courier_name?"Courier: "+esc(d.courier_name)+(d.courier_phone?" · "+esc(d.courier_phone):""):"No courier name was recorded.")+(d.dispatched_at?" · dispatched "+esc(C.ago(d.dispatched_at)):"")+"</p>";
    return'<article class="ds-hb-card" aria-label="'+esc(label(o.id))+'"><div class="ds-hb-top"><b>'+esc(label(o.id))+"</b>"+D.chip("Via hub","info","store")+'</div><p class="ds-hb-sub">'+esc(sub.join(" · "))+"</p>"+body
      +(acts?'<div class="ds-hb-acts">'+acts+"</div>":"")+(why?'<p class="ds-hb-why" id="hbw-'+esc(o.id)+'">'+esc(why)+"</p>":"")+"</article>"}

  function list(tab){return ROWS.filter(function(o){return groups(o).indexOf(tab)>-1})}
  function seg(){return D.seg(TABS.map(function(t){return{label:t[1],n:list(t[0]).length,act:"ds-hb-g",id:t[0],on:F.g===t[0]}}),"Hub stages")}
  function body(){var l=list(F.g),e=EMPTY[F.g];
    return l.length?l.map(function(o){return card(o,F.g)}).join(""):D.empty({icon:"box",title:e[0],text:e[1]})}
  function view(){return seg()+'<div id="ds-hb-body" aria-live="polite">'+body()+"</div>"+(ROWS.length>=CAP?'<p class="ds-hb-sub">Showing the latest '+CAP+" hub orders.</p>":"")}
  function page(){css();
    return'<div class="ds-headrow"><h1 class="ds-title">Hub</h1><button type="button" class="ds-btn s o" data-act="ds-hb-ref">Refresh</button></div>'
      +'<p class="ds-hb-sub" style="margin:0 0 14px">Check what sellers drop off, build one parcel per order, then hand it to a courier. Live data. Courier assignment and delivery tracking are not built yet.</p>'
      +'<div id="ds-hb-root">'+view()+"</div>"}
  function redraw(focusId){var r=document.getElementById("ds-hb-root");if(!r)return;r.innerHTML=view();
    if(focusId){var b=r.querySelector('[data-act="ds-hb-g"][data-id="'+focusId+'"]');if(b)try{b.focus({preventScroll:true})}catch(e){}}}
  A["ds-hb-g"]=function(b){F.g=b.getAttribute("data-id");redraw(F.g)};
  A["ds-hb-ref"]=function(){again()};

  /* receive: one answer per item, then hub_receive */
  A["ds-hb-chk"]=function(b){var f=find(b.getAttribute("data-id"));if(!f)return;var items=f.so.order_items||[];
    if(!items.length){C.toast("This seller order has no items to check.",true);return}
    var html='<p class="lead">'+esc((one(f.so.stores)||{}).name||"Seller")+" · "+esc(label(f.o.id))+". Answer for every item.</p>"
      +items.map(function(i,n){return'<fieldset class="ds-hb-fs"><legend>'+esc(itemName(i))+'</legend><div class="ds-hb-ops">'
        +["received","missing","damaged"].map(function(k){return'<label><input type="radio" name="hb'+n+'" value="'+k+'" data-i="'+esc(i.id)+'"'+(k==="received"?"":' class="bad"')+"><span>"+CK[k]+"</span></label>"}).join("")+"</div></fieldset>"}).join("")
      +'<p class="ds-hb-hint" id="ds-hb-hint" role="status"></p><div class="ds-foot"><button type="button" class="ds-btn o" data-hb="x">Cancel</button><button type="button" class="ds-btn" data-hb="go" disabled>Confirm check</button></div>';
    var sh=D.sheet({title:"Check items",html:html}),picks={},go=sh.body.querySelector('[data-hb="go"]'),hint=sh.body.querySelector("#ds-hb-hint");
    function sync(){var done=Object.keys(picks).length,all=buildCheck(items,picks),bad=all&&all.some(function(c){return c.status!=="received"});go.disabled=!all;
      hint.textContent=all?(bad?"Items marked missing or damaged will move this seller order to Needs attention.":"Every item is accounted for."):done+" of "+items.length+" checked."}
    sync();
    sh.body.addEventListener("change",function(e){var t=e.target;if(t&&t.type==="radio"){picks[t.getAttribute("data-i")]=t.value;sync()}});
    sh.body.addEventListener("click",function(e){var x=e.target.closest("[data-hb]");if(!x)return;
      if(x.getAttribute("data-hb")==="x")return sh.close();
      var payload=buildCheck(items,picks);if(!payload)return;var bad=payload.some(function(c){return c.status!=="received"});
      function send(){go.disabled=true;Supa.rpc("hub_receive",{p_so:f.so.id,p_check:payload}).then(function(){sh.close();C.toast(bad?"Check recorded. Flagged for attention.":"Items received at the hub.");again()}).catch(function(er){go.disabled=false;fail(er)})}
      if(!bad)return send();
      D.confirm({title:"Report a problem?",text:"This seller order will move to Needs attention.",ok:"Report",danger:true}).then(function(v){if(v)send()})})};

  A["ds-hb-con"]=function(b){var o=byId(b.getAttribute("data-id"));if(!o||!canConsolidate(o))return;
    D.confirm({title:"Consolidate "+label(o.id)+"?",text:"Every seller has dropped off and passed the check. This builds one parcel for delivery.",ok:"Consolidate"}).then(function(v){
      if(!v)return;Supa.rpc("hub_consolidate",{p_order:o.id}).then(function(){C.toast("Parcel built. Ready to dispatch.");again()}).catch(fail)})};

  /* dispatch: courier details are free text today; the server stores name, phone and note on the delivery */
  A["ds-hb-dis"]=function(b){var o=byId(b.getAttribute("data-id")),d=o&&one(o.deliveries);if(!o||!d)return;var c=o.cust||{};
    var addr=[c.street,c.city,c.state].filter(Boolean).join(", ");
    var html='<div class="ds-hb-dl"><b>Deliver to</b>'+esc(c.name||"Customer")+(c.phone?" · "+esc(c.phone):"")+"<br>"+esc(addr||"No address recorded")+"</div>"
      +'<label class="ds-field"><span>Courier name</span><input type="text" maxlength="80" autocomplete="off" data-f="name"></label>'
      +'<label class="ds-field"><span>Courier phone (optional)</span><input type="tel" maxlength="30" autocomplete="off" data-f="phone"></label>'
      +'<label class="ds-field"><span>Note (optional)</span><textarea maxlength="300" data-f="note"></textarea></label>'
      +'<div class="ds-foot"><button type="button" class="ds-btn o" data-hb="x">Cancel</button><button type="button" class="ds-btn" data-hb="go" disabled>Dispatch</button></div>';
    var sh=D.sheet({title:"Dispatch "+label(o.id),html:html}),go=sh.body.querySelector('[data-hb="go"]');
    function val(k){var el=sh.body.querySelector('[data-f="'+k+'"]');return el?el.value.trim():""}
    sh.body.addEventListener("input",function(){go.disabled=val("name").length<2});
    sh.body.addEventListener("click",function(e){var x=e.target.closest("[data-hb]");if(!x)return;
      if(x.getAttribute("data-hb")==="x")return sh.close();
      var name=val("name");if(name.length<2)return;var cr={name:name};if(val("phone"))cr.phone=val("phone");if(val("note"))cr.note=val("note");
      go.disabled=true;Supa.rpc("dispatch",{p_order:o.id,p_courier:cr}).then(function(){sh.close();C.toast("Dispatched. The customer has been told.");again()}).catch(function(er){go.disabled=false;fail(er)})})};

  function out(h){return{layout:"admin",active:"admin/hub",title:"Hub",html:h}}
  var oa=V.admin;
  V.admin=function(p){var me=C.me&&C.me();
    if(!p||p[0]!=="hub"||!me||me.role!=="admin"||!(window.Supa&&Supa.uid()))return oa(p);
    if(C.adminCtx&&C.adminCtx()==="store")return{redirect:"/admin/store"};
    return Supa.get(Q).then(function(r){ROWS=Array.isArray(r)?r:[];return out(page())},function(e){ROWS=[];css();
      return out('<div class="ds-headrow"><h1 class="ds-title">Hub</h1></div>'+D.banner("error","The hub board could not load",e&&e.message||"Please try again in a moment.",{label:"Try again",act:"ds-hb-ref"}))})};
  window.EVHub={groups:groups,canConsolidate:canConsolidate,waiting:waiting,buildCheck:buildCheck,label:label,itemName:itemName,card:card,view:view,rows:function(r){if(r)ROWS=r;return ROWS},tab:function(t){if(t)F.g=t;return F.g}};
})();
