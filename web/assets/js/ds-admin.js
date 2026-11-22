/* Admin console, redesigned on the design system (ds.js). Wraps V.admin so admin.js is untouched:
   overview, Seller operations (applications, stores), product review and the Everneed Store workspace are drawn here;
   every other admin page (plan limits, verification cases, waitlist, appearance) is still served by admin.js and is only restyled.
   All numbers come from the database. Where a backend contract does not exist yet (staff and roles, per-store product and order counts,
   uploads) the page says so; nothing is invented. Backend requests: docs/WORKFLOW/SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md (R1 to R9).
   Action names are prefixed ds- so they cannot collide with other files. */
(function(){
  var C=window.Core,D=window.DS,esc=C.esc,V=C.V,A=C.A,old=V.admin,OFFICIAL="everneed-official";
  if(!D||!old)return;
  var enc=encodeURIComponent,q=cached,soft=function(){return[]};
  /* Short-lived read cache so hopping between tabs is instant. Any action or form submit, and the Try again button, clears it, so a change is never hidden. */
  var MEMO={},TTL=20000;
  function cached(p){var m=MEMO[p];if(m&&Date.now()-m.t<TTL)return m.p;var pr=Supa.get(p);MEMO[p]={t:Date.now(),p:pr};pr.catch(function(){if(MEMO[p]&&MEMO[p].p===pr)delete MEMO[p]});return pr}
  function drop(){MEMO={}}
  document.addEventListener("click",function(e){if(e.target.closest&&e.target.closest("[data-act]"))drop()},true);
  document.addEventListener("submit",drop,true);
  function one(x){return Array.isArray(x)?x[0]||null:x||null}
  function num(n,capped){try{return new Intl.NumberFormat().format(n||0)+(capped?"+":"")}catch(e){return String(n||0)+(capped?"+":"")}}
  function snip(s,n){s=String(s||"").trim();return s.length>n?s.slice(0,n-1).trim()+"…":s}
  function place(s){return[s.city,s.state].filter(Boolean).join(", ")}
  function out(h,t,active){return{layout:"admin",active:active||"admin",html:h,title:t||"Admin"}}
  function fail(e){return D.banner("error","This page could not load",e&&e.message||"Please try again in a moment.",{label:"Try again",act:"ds-reload"})}
  A["ds-reload"]=function(){drop();window.dispatchEvent(new Event("hashchange"))};

  /* ---------- context switcher: Platform or the Everneed Store workspace ---------- */
  function ctxBar(cur){cur=CTX==="store"?"store":cur;
    return'<div class="ds-ctxbar"><button type="button" class="ds-ctx" data-act="ds-ctx" aria-haspopup="dialog">'+D.icon(cur==="store"?"store":"globe",18)+"<span>"+(CTX==="store"?"Everneed Store only":(cur==="store"?"Everneed Store":"Platform"))+"</span>"+D.icon("chevd",16)+"</button></div>";
  }
  /* The chosen workspace is remembered. Platform can reach everything, including the Everneed Store. Everneed Store reaches only the store:
     its tabs, its pages and its messages. Platform pages redirect to the store, and the tab bar shows no platform tab. */
  var KEY="ev-admin-ctx";
  function getCtx(){var v="";try{v=localStorage.getItem(KEY)||""}catch(e){}return v==="store"?"store":"platform"}
  function setCtx(v){try{localStorage.setItem(KEY,v)}catch(e){}CTX=v}
  var CTX=getCtx();
  C.adminCtx=function(){return CTX};
  A["ds-ctx"]=function(){
    D.actions({title:"Switch workspace",items:[
      {label:"Platform",sub:"Marketplace-wide admin and the Everneed Store",icon:CTX==="platform"?"check":"globe",run:function(){setCtx("platform");C.go("/admin")}},
      {label:"Everneed Store only",sub:"Only the official store: products, orders, messages, staff",icon:CTX==="store"?"check":"store",run:function(){setCtx("store");C.go("/admin/store")}}]});
  };
  var NAVT={
    platform:[["admin","Overview","chart","/admin"],["admin/sellers","Sellers","store","/admin/sellers"],["admin/review","Review","clip","/admin/review"],["admin/store","Store","box","/admin/store"],["inbox","Inbox","chat","/inbox",1]],
    store:[["admin/store","Overview","chart","/admin/store"],["admin/store/products","Products","box","/admin/store/products"],["admin/store/orders","Orders","receipt","/admin/store/orders"],["admin/store/messages","Messages","chat","/admin/store/messages"],["admin/store/staff","Staff","users","/admin/store/staff"]]};
  function tabKey(active){var a=String(active||"");if(CTX==="store")return a.indexOf("admin/store")===0?a:"";
    if(a.indexOf("admin/store")===0)return"admin/store";if(a==="admin"||a==="inbox"||a==="admin/review"||a.indexOf("admin/sellers")===0)return a.indexOf("admin/sellers")===0?"admin/sellers":a;return""}
  var baseShell=window.AX&&AX.shell;
  if(baseShell)AX.shell=function(kind,active,inner,me){
    if(kind!=="admin"||!me||me.role!=="admin")return baseShell.apply(this,arguments);
    var items=NAVT[CTX],cur=tabKey(active),initial=(String(me.name||me.email||"E").trim().charAt(0)||"E").toUpperCase();
    function link(n,sz){return'<a href="'+n[3]+'"'+(n[0]===cur?' class="on" aria-current="page"':"")+">"+D.icon(n[2],sz)+"<span>"+n[1]+"</span>"+(n[4]?'<span class="nbd" hidden>0</span>':"")+"</a>"}
    return'<div class="ax" data-kind="admin" data-ctx="'+CTX+'"><header class="ax-top">'+'<a class="ax-brand" href="'+(CTX==="store"?"/admin/store":"/admin")+'"><img src="/favicon.svg" alt="" width="28" height="28"><span>Everneed</span></a>'+'<span class="ax-ctx">'+(CTX==="store"?"Everneed Store":"Platform")+'</span><span class="ax-sp"></span>'+AX.bell()
      +'<a class="ax-me" href="/me" aria-label="Me">'+esc(initial)+"</a></header>"
      +'<aside class="ax-rail"><nav aria-label="Sections">'+items.map(function(n){return link(n,22)}).join("")+"</nav></aside>"
      +'<section class="main" id="main">'+inner+"</section>"
      +'<nav class="ax-tabs" style="--n:'+items.length+'" aria-label="Sections">'+items.map(function(n){return link(n,24)}).join("")+"</nav></div>";
  };
  var oldInbox=V.inbox;
  if(oldInbox)V.inbox=function(p){var me=C.me();if(me&&me.role==="admin"&&CTX==="store")return{redirect:"/admin/store/messages"};return oldInbox(p)};

  /* ---------- store state helpers ---------- */
  function state(s){
    if(s.is_official)return{label:"Official",tone:"brand",icon:"shield",key:"official"};
    if(s.status==="approved")return s.activation_status==="live"?{label:"Live",tone:"ok",icon:"okc",key:"live"}:{label:"Approved, not live",tone:"info",icon:"clock",key:"notlive"};
    var m={pending:"In review",draft:"Draft",rejected:"Rejected",suspended:"Suspended"};
    return{label:m[s.status]||s.status,tone:s.status==="suspended"||s.status==="rejected"?"bad":"info",icon:s.status==="suspended"||s.status==="rejected"?"errc":"clock",key:s.status==="pending"?"pending":(s.status==="suspended"||s.status==="rejected"?"suspended":"other")};
  }
  function planMap(){return q("store_plans?select=id,name,price,product_limit&order=price.asc").then(function(r){var m={};(r||[]).forEach(function(p){m[p.id]=p});return m})}
  function logo(s,size){return'<span class="ds-logo"'+(size?' style="width:'+size+"px;height:"+size+'px"':"")+(s.id?' data-vt="s-'+esc(s.id)+'"':"")+">"+(s.logo_url?'<img alt="" loading="lazy" src="'+esc(s.logo_url)+'">':esc((String(s.name||"?").trim().charAt(0)||"?").toUpperCase()))+"</span>"}
  function cover(s){var st=s.cover_url?' style="background-image:url('+"'"+esc(s.cover_url).replace(/'/g,"%27")+"'"+')"':(s.accent&&/^#[0-9a-f]{3,8}$/i.test(s.accent)?' style="--ds-accent:'+esc(s.accent)+'"':"");return'<div class="ds-cover'+(s.cover_url?"":" tint")+'"'+st+"></div>"}
  function head(title,sub,ctx){return(ctx||ctxBar("platform"))+'<h1 class="ds-title">'+esc(title)+"</h1>"+(sub?'<p class="ds-sub">'+esc(sub)+"</p>":"")}

  /* ---------- overview ---------- */
  var CAP=1000;
  function overview(){
    var failed=0,qf=function(p){return q(p).catch(function(){failed++;return[]})};
    return Promise.all([
      qf("stores?select=id,status,activation_status,is_official"),
      qf("products?select=id&status=eq.pending_review"),
      qf("orders?select=total,payment_status&limit="+CAP),
      qf("seller_orders?select=commission,status&limit="+CAP),
      qf("disputes?select=id&status=in.(open,investigating)"),
      qf("deliveries?select=id&status=eq.failed"),
      qf("support_queue?select=id&status=eq.waiting")
    ]).then(function(a){
      var stores=(a[0]||[]).filter(function(s){return!s.is_official}),live=stores.filter(function(s){return s.status==="approved"&&s.activation_status==="live"}).length,
        waiting=stores.filter(function(s){return s.status==="pending"}).length,notLive=stores.filter(function(s){return s.status==="approved"&&s.activation_status!=="live"}).length,
        orders=a[2]||[],paid=orders.filter(function(o){return o.payment_status==="paid"||o.payment_status==="partially_refunded"}),
        gmv=paid.reduce(function(n,o){return n+Number(o.total||0)},0),so=a[3]||[],
        revenue=so.filter(function(o){return o.status==="delivered"}).reduce(function(n,o){return n+Number(o.commission||0)},0),
        issues=so.filter(function(o){return o.status==="issue"}).length+(a[5]||[]).length,
        review=(a[1]||[]).length,disputes=(a[4]||[]).length,support=(a[6]||[]).length,capO=orders.length>=CAP,
        who=String((C.me()&&C.me().name)||"").trim().split(/\s+/)[0];
      var todo=[
        waiting?{icon:"store",title:"Applications waiting",sub:"Sellers are waiting for a decision",href:"/admin/sellers",end:D.chip(num(waiting),"warn"),tone:"warn"}:null,
        review?{icon:"clip",title:"Products to review",sub:"Submitted by sellers",href:"/admin/review",end:D.chip(num(review),"warn"),tone:"warn"}:null,
        disputes?{icon:"alert",title:"Open disputes",sub:"Need a resolution",end:D.chip(num(disputes),"bad"),tone:"bad"}:null,
        issues?{icon:"truck",title:"Delivery exceptions",sub:"Orders with an issue or a failed delivery",end:D.chip(num(issues),"bad"),tone:"bad"}:null,
        support?{icon:"headset",title:"Customers waiting for support",sub:"Live support queue",href:"/inbox",end:D.chip(num(support),"warn"),tone:"warn"}:null
      ].filter(Boolean);
      var ringPct=stores.length?Math.round(live/stores.length*100):0;
      return head("Overview")
        +'<section class="ds-hero"><div class="g"><h2 class="ds-title">'+(who?"Hello, "+esc(who):"Hello")+'</h2><p class="ds-sub">'+(todo.length?"Here is what needs you today.":(failed?"Some figures could not load.":"Nothing is waiting for you right now."))+"</p></div>"+D.art("bags",72)+"</section>"
        +(failed?D.banner("warning","Some figures could not load",failed+" of 7 queries failed, so the numbers below may be incomplete.",{label:"Try again",act:"ds-reload"}):"")
        +(todo.length?'<div class="ds-h"><h2>Needs attention</h2></div><div class="ds-rows">'+todo.map(D.row).join("")+"</div>":(failed?"":D.banner("success","All clear","No applications, reviews or disputes are waiting.",null)))
        +'<div class="ds-h"><h2>Stores and catalogue</h2></div><div class="ds-stats">'
        +D.stat({icon:"store",value:live,label:"Live stores",href:"/admin/sellers/stores"})+D.stat({icon:"clock",value:waiting,label:"Applications waiting",href:"/admin/sellers",tone:waiting?"hot":""})
        +D.stat({icon:"shield",value:notLive,label:"Approved, not yet live",href:"/admin/sellers/stores"})+D.stat({icon:"clip",value:review,label:"Products to review",href:"/admin/review",tone:review?"hot":""})+"</div>"
        +(stores.length?'<div class="ds-card ds-ringcard">'+D.ring(ringPct,"",live+" of "+stores.length+" stores live")+'<div><b>'+num(live)+" of "+num(stores.length)+' stores are live</b><small class="ds-muted">Official store not counted</small></div></div>':"")
        +'<div class="ds-h"><h2>Sales and operations</h2></div><div class="ds-stats">'
        +D.stat({icon:"receipt",value:paid.length,label:"Paid orders"})+D.stat({icon:"wallet",value:gmv,money:true,label:"Sales (GMV)"})+D.stat({icon:"chart",value:revenue,money:true,label:"Platform revenue, delivered"})+D.stat({icon:"alert",value:disputes,label:"Open disputes",tone:disputes?"bad":""})+"</div>"
        +(capO?'<p class="ds-faint" style="margin-top:12px;font-size:var(--ds-t-s)">Order totals cover the latest '+num(CAP)+" orders. Exact totals arrive with the admin_overview_stats() backend request.</p>":"")
        +'<div class="ds-h"><h2>Workspaces</h2></div><div class="ds-rows">'+D.row({icon:"store",title:"Everneed Store",sub:"Manage the official store: products, orders, messages, staff",href:"/admin/store"})+D.row({icon:"users",title:"Waitlist",sub:"Early-access signups",href:"/admin/waitlist"})+"</div>";
    }).catch(function(e){return head("Overview")+fail(e)});
  }

  /* ---------- Seller operations: applications and stores (plan limits and verification cases come from admin.js) ---------- */
  var TABS=[["","Applications"],["stores","Stores and plans"],["plans","Plan limits"],["verification","Verification cases"]];
  function sellerTabs(cur,counts){return D.seg(TABS.map(function(t){return{href:"/admin/sellers"+(t[0]?"/"+t[0]:""),label:t[1],on:t[0]===cur,n:counts&&counts[t[0]]!=null?counts[t[0]]:null}}),"Seller operations")}
  function applications(){
    return Promise.all([q("stores?select=*,store_applications(*),store_private(*)&status=eq.pending&order=created_at.asc"),planMap()]).then(function(a){
      var rows=a[0]||[],by=a[1],ids=rows.map(function(r){return r.owner_id}).filter(Boolean);
      var owners=ids.length?q("profiles?select=id,name,email,phone,photo&id=in.("+ids.map(enc).join(",")+")").catch(soft):Promise.resolve([]);
      return owners.then(function(ps){
        var o={};(ps||[]).forEach(function(p){o[p.id]=p});
        return head("Seller operations")+sellerTabs("",{"":rows.length})
          +(rows.length?'<div class="ds-grid c2">'+rows.map(function(s){
            var ap=one(s.store_applications)||{},pr=one(s.store_private)||{},ow=o[s.owner_id]||{},pl=by[ap.plan_id],cats=(s.categories||[]).slice(0,3),more=(s.categories||[]).length-cats.length;
            return'<article class="ds-card pad0" data-lp="'+esc(s.name)+'">'+cover(s)+'<div class="ds-body"><div class="ds-top">'+logo(s)+D.chip("In review","info","clock")+"</div>"
              +'<h3 class="ds-name">'+esc(s.name)+'</h3><p class="ds-meta">'+esc(place(s)||"Location not given")+(ap.submitted_at?" · sent "+esc(C.ago(ap.submitted_at)):"")+"</p>"
              +'<div class="ds-chips" style="margin-top:8px">'+(pl?D.plan(pl.name):D.chip("No plan chosen","","tag"))+cats.map(function(c){return D.chip(c)}).join("")+(more>0?D.chip("+"+more):"")+"</div>"
              +'<div class="ds-owner">'+D.avatar(ow.name||ow.email,ow.photo)+'<span><b>'+esc(ow.name||"Owner")+"</b><small>"+esc([ow.email,ow.phone||pr.phone].filter(Boolean).join(" · "))+"</small></span></div>"
              +(s.about?'<p class="ds-about">'+esc(snip(s.about,150))+"</p>":"")
              +'<div class="ds-acts"><button type="button" class="ds-btn s" data-act="aappr" data-id="'+esc(s.id)+'" data-ico="check">'+D.icon("check",16)+'Approve</button><button type="button" class="ds-btn s o d" data-act="arej" data-id="'+esc(s.id)+'" data-ico="close">Reject</button></div></div></article>'}).join("")+"</div>"
            :D.empty({icon:"store",title:"No applications waiting",text:"New seller applications appear here as soon as they are sent."}));
      });
    }).catch(function(e){return head("Seller operations")+sellerTabs("")+fail(e)});
  }
  function stores(){
    return Promise.all([q("stores?select=*,store_subscriptions(status,current_period_end,plan_id)&order=created_at.desc"),planMap()]).then(function(a){
      var l=a[0]||[],by=a[1],keys={},chips=[["all","All"],["live","Live"],["notlive","Not live"],["pending","In review"],["suspended","Suspended"],["official","Official"]];
      l.forEach(function(s){var k=state(s).key;keys[k]=(keys[k]||0)+1});
      return head("Seller operations")+sellerTabs("stores",{stores:l.length})
        +'<div class="ds-search">'+D.icon("search",20)+'<input type="search" data-dsq placeholder="Search stores" aria-label="Search stores" autocomplete="off"></div>'
        +'<div class="ds-chips ds-filt" role="group" aria-label="Filter stores">'+chips.map(function(c,i){return'<button type="button" class="ds-chip'+(i===0?" on":"")+'" data-act="ds-sf" data-id="'+c[0]+'" aria-pressed="'+(i===0?"true":"false")+'">'+c[1]+(c[0]!=="all"&&keys[c[0]]?' <span class="n">'+keys[c[0]]+"</span>":"")+"</button>"}).join("")+"</div>"
        +(l.length?'<div class="ds-grid c2" id="ds-stores" style="margin-top:12px">'+l.map(function(s){
          var sub=one(s.store_subscriptions)||{},st=state(s),pl=by[sub.plan_id],ended=sub.current_period_end&&!s.is_official?C.when(sub.current_period_end):"";
          var act=s.is_official?"":s.status==="approved"?'<button type="button" class="ds-btn s o d" data-act="ssus" data-id="'+esc(s.id)+'">Suspend</button>':s.status==="suspended"?'<button type="button" class="ds-btn s" data-act="sback" data-id="'+esc(s.id)+'">Reinstate</button>':"";
          return'<article class="ds-card pad0" data-lp="'+esc(s.name)+'" data-k="'+st.key+'" data-n="'+esc((s.name+" "+place(s)+" "+s.slug).toLowerCase())+'">'+cover(s)+'<div class="ds-body"><div class="ds-top">'+logo(s)+D.chip(st.label,st.tone,st.icon)+"</div>"
            +'<h3 class="ds-name">'+esc(s.name)+'</h3><p class="ds-meta">'+esc(place(s)||"Location not given")+"</p>"
            +'<div class="ds-chips" style="margin-top:8px">'+(s.is_official?D.plan("",true):pl?D.plan(pl.name):D.chip("No plan chosen","","tag"))+"</div>"
            +'<div class="ds-facts"><div class="ds-fact"><b>'+esc(sub.status||(s.is_official?"Not needed":"None"))+"</b><small>Subscription</small></div>"+(ended?'<div class="ds-fact"><b>'+esc(ended)+"</b><small>Renews or ends</small></div>":"")+"</div>"
            +'<div class="ds-acts">'+(s.status==="approved"&&s.slug?'<a class="ds-btn s o" href="/store/'+esc(s.slug)+'">View store</a>':"")+(s.is_official?'<a class="ds-btn s" href="/admin/store">Manage</a>':"")+act+"</div></div></article>"}).join("")+"</div>"
          +'<p class="ds-faint" id="ds-snone" hidden role="status">No stores match.</p>'
          +'<p class="ds-faint" style="margin-top:12px;font-size:var(--ds-t-s)">Product and order counts per store arrive with the admin_store_directory() backend request.</p>'
          :D.empty({icon:"store",title:"No stores yet",text:"Stores appear here after a seller creates one."}));
    }).catch(function(e){return head("Seller operations")+sellerTabs("stores")+fail(e)});
  }
  /* client-side filter over the loaded stores (the list is small; a server directory is requested in R1) */
  function filterStores(){
    var box=document.getElementById("ds-stores");if(!box)return;
    var qv=((document.querySelector("[data-dsq]")||{}).value||"").trim().toLowerCase(),on=document.querySelector(".ds-filt .on"),k=on?on.getAttribute("data-id"):"all",shown=0;
    Array.prototype.forEach.call(box.children,function(c){var ok=(k==="all"||c.getAttribute("data-k")===k)&&(!qv||c.getAttribute("data-n").indexOf(qv)>-1);c.hidden=!ok;if(ok)shown++});
    var none=document.getElementById("ds-snone");if(none)none.hidden=shown>0;
  }
  A["ds-sf"]=function(b){Array.prototype.forEach.call(document.querySelectorAll(".ds-filt .ds-chip"),function(c){var on=c===b;c.classList.toggle("on",on);c.setAttribute("aria-pressed",on?"true":"false")});filterStores()};
  document.addEventListener("input",function(e){if(e.target&&e.target.hasAttribute&&e.target.hasAttribute("data-dsq"))filterStores()});

  /* ---------- product review queue ---------- */
  function review(){
    return q("products?select=*,stores(name,slug,logo_url),product_private(compliance_ref)&status=eq.pending_review&order=at.asc").then(function(l){
      l=l||[];
      return head("Product review",l.length?l.length+" waiting for a decision":"")
        +(l.length?'<div class="ds-grid c2">'+l.map(function(x){
          var st=one(x.stores)||{},pp=one(x.product_private)||{};
          return'<article class="ds-card" data-lp="'+esc(x.name)+'"><div class="ds-pr"><span class="ds-thumb">'+(x.img?'<img alt="" loading="lazy" src="'+esc(x.img)+'">':D.art(D.artFor(x.col),44))+'</span><div class="ds-grow"><h3 class="ds-name">'+esc(x.name)+'</h3><p class="ds-meta">'+esc(st.name||"")+"</p>"
            +'<div class="ds-chips" style="margin-top:6px">'+D.chip(x.col||"No category")+"</div></div></div>"
            +'<div class="ds-facts"><div class="ds-fact"><b>'+esc(C.money(x.price))+"</b><small>"+(x.old?"was "+esc(C.money(x.old)):"Price")+'</small></div><div class="ds-fact"><b>'+(x.stock==null?"No limit":num(x.stock))+"</b><small>Stock</small></div>"+(pp.compliance_ref?'<div class="ds-fact"><b>'+esc(pp.compliance_ref)+"</b><small>Registration no.</small></div>":"")+"</div>"
            +(x.descr?'<p class="ds-about">'+esc(snip(x.descr,220))+"</p>":"")
            +'<div class="ds-acts"><button type="button" class="ds-btn s" data-act="rpub" data-id="'+esc(x.id)+'" data-ico="check">'+D.icon("check",16)+'Publish</button><button type="button" class="ds-btn s o" data-act="rchg" data-id="'+esc(x.id)+'" data-ico="edit">Ask for changes</button></div></article>'}).join("")+"</div>"
          :D.empty({icon:"clip",title:"Nothing to review",text:"Products sellers submit for review appear here."}));
    }).catch(function(e){return head("Product review")+fail(e)});
  }

  /* ---------- Everneed Store workspace (official store) ---------- */
  var STAB=[["","Overview"],["products","Products"],["orders","Orders"],["messages","Messages"],["staff","Staff and roles"]];
  function storeTabs(cur){return D.seg(STAB.map(function(t){return{href:"/admin/store"+(t[0]?"/"+t[0]:""),label:t[1],on:t[0]===cur}}),"Everneed Store")}
  var MOD={catalogue:"Catalogue",category_attributes:"Category specs",variants:"Variants",media_metadata:"Media details",media_uploads:"Image uploads",inventory_adjustment_audit:"Stock history",multi_location_inventory:"Multi-location stock",quantity_price_tiers:"Quantity pricing",variant_checkout:"Variant checkout",bulk_edit:"Bulk edit",csv_import:"CSV import",csv_export:"CSV export",promotions:"Promotions",sales_analytics:"Sales analytics",team_management:"Team and roles",orders:"Orders",messaging:"Messaging",payments:"Payments",finance_and_settlement:"Finance and settlement"};
  var RDY={ready:["Ready","ok"],existing_contract:["Ready","ok"],ready_for_catalogue_only:["Catalogue only","warn"],stored_not_checkout_integrated:["Stored, not in checkout","warn"],existing_contract_with_pending_payout_work:["Payouts pending","warn"],pending:["Not available yet",""],pending_storage_contract:["Not available yet",""]};
  function storeHead(tab,cx,st){
    var s=Object.assign({},st||{},cx&&cx.store||{});
    return ctxBar("store")+'<article class="ds-card pad0 ds-storehead">'+cover(s)+'<div class="ds-body"><div class="ds-top">'+logo(s,60)+'<div class="ds-chips">'+D.plan("",true)+D.chip(state(s).label==="Official"?"Open":state(s).label,state(s).tone==="brand"?"ok":state(s).tone)+"</div></div>"
      +'<h1 class="ds-name" style="font-size:var(--ds-t-xl)" data-vt-t>'+esc(s.name||"Everneed Store")+'</h1><p class="ds-meta">Platform-owned store. No seller plan, verification or payout setup is needed.</p></div></article>'+storeTabs(tab);
  }
  function loadStore(){
    return Promise.all([Supa.rpc("admin_store_workspace_context",{p_store:OFFICIAL}).then(function(r){return one(r)}),q("stores?select=id,name,logo_url,cover_url,accent,status,activation_status,is_official&id=eq."+OFFICIAL).then(one).catch(function(){return null})]);
  }
  function storePage(tab){
    return loadStore().then(function(a){
      var cx=a[0],st=a[1],h=storeHead(tab,cx,st);
      if(!cx)return h+D.empty({icon:"alert",title:"The workspace could not load",text:"The store context is not available for this account."});
      var cn=cx.counts||{},cap=cx.capabilities||{};
      if(tab==="products")return storeProducts(h,cn);
      if(tab==="orders")return storeOrders(h,cn);
      if(tab==="messages")return storeMessages(h);
      if(tab==="staff")return storeStaff(h);
      var mods=cx.module_readiness||{};
      return h+'<div class="ds-h"><h2>Catalogue</h2></div><div class="ds-stats">'
        +D.stat({icon:"box",value:Number(cn.products||0),label:"Products",href:"/admin/store/products"})+D.stat({icon:"okc",value:Number(cn.published_products||0),label:"Published"})
        +D.stat({icon:"clip",value:Number(cn.pending_review_products||0),label:"Pending review",tone:Number(cn.pending_review_products)?"hot":"",href:CTX==="store"?"":"/admin/review"})+D.stat({icon:"edit",value:Number(cn.draft_products||0),label:"Drafts"})+"</div>"
        +'<div class="ds-h"><h2>Stock and orders</h2></div><div class="ds-stats">'
        +D.stat({icon:"layers",value:Number(cn.variants||0),label:"Variants"})+D.stat({icon:"alert",value:Number(cn.low_stock_variants||0),label:"Low stock variants",tone:Number(cn.low_stock_variants)?"bad":""})
        +D.stat({icon:"receipt",value:Number(cn.seller_orders||0),label:"Orders",href:"/admin/store/orders"})+D.stat({icon:"chat",value:"Open",label:"Messages",href:"/admin/store/messages"})+"</div>"
        +'<div class="ds-h"><h2>What is ready</h2><small>Straight from the backend. Nothing here is switched on by a plan flag alone.</small></div>'
        +'<div class="ds-rows">'+Object.keys(mods).map(function(k){var r=RDY[mods[k]]||[String(mods[k]).replace(/_/g," "),""];return'<div class="ds-row"><span class="ds-grow"><b>'+esc(MOD[k]||k.replace(/_/g," "))+"</b></span>"+D.chip(r[0],r[1])+"</div>"}).join("")+"</div>"
        +(cap&&Object.keys(cap).length?'<p class="ds-faint" style="margin-top:12px;font-size:var(--ds-t-s)">Capability override for the official store is applied on the server.</p>':"");
    }).catch(function(e){return ctxBar("store")+'<h1 class="ds-title">Everneed Store</h1>'+fail(e)});
  }
  function statusChip(s){var m={published:["Published","ok"],pending_review:["In review","warn"],draft:["Draft",""],rejected:["Changes requested","bad"],archived:["Archived",""]}[s]||[s||"",""];return D.chip(m[0],m[1])}
  function storeProducts(h){
    return q("products?select=id,name,col,price,stock,status,img&store_id=eq."+OFFICIAL+"&order=at.desc&limit=60").then(function(l){
      l=l||[];
      return h+'<div class="ds-h"><h2>Products</h2><button type="button" class="ds-btn s" disabled aria-disabled="true" aria-describedby="ds-addwhy">'+D.icon("plus",16)+'Add product</button></div>'
        +'<p class="ds-faint" id="ds-addwhy" style="margin:-4px 0 12px;font-size:var(--ds-t-s)">Creating and editing official-store products needs staff access and product workflow functions (backend requests R2 and R5). Until then, products can be reviewed from Product review.</p>'
        +(l.length?'<div class="ds-rows">'+l.map(function(x){return'<div class="ds-row"><span class="ds-thumb sm">'+(x.img?'<img alt="" loading="lazy" src="'+esc(x.img)+'">':D.art(D.artFor(x.col),32))+'</span><span class="ds-grow"><b>'+esc(x.name)+"</b><small>"+esc(x.col||"")+" · "+esc(C.money(x.price))+" · "+(x.stock==null?"no stock limit":num(x.stock)+" in stock")+'</small></span><span class="ds-end">'+statusChip(x.status)+"</span></div>"}).join("")+"</div>"
          :D.empty({icon:"box",title:"No official products yet",text:"Products of the Everneed Store will be listed here."}));
    });
  }
  function storeOrders(h){
    return q("seller_orders?select=id,order_id,status,subtotal,created_at&store_id=eq."+OFFICIAL+"&order=created_at.desc&limit=30").then(function(l){
      l=l||[];
      return h+'<div class="ds-h"><h2>Orders</h2></div>'+(l.length?'<div class="ds-rows">'+l.map(function(o){return D.row({icon:"receipt",title:"Order "+String(o.order_id||o.id).slice(0,10),sub:String(o.status||"").replace(/_/g," ")+" · "+C.when(o.created_at),end:'<b>'+esc(C.money(o.subtotal))+"</b>"})}).join("")+"</div>"
        :D.empty({icon:"receipt",title:"No orders yet",text:"Orders for the Everneed Store appear here. Accept and hand-over actions need the order transition contract (request R6)."}));
    });
  }
  function storeMessages(h){
    return q("conversations?select=id,subject,status,last_preview,last_message_at,admin_unread&store_id=eq."+OFFICIAL+"&order=last_message_at.desc.nullslast&limit=30").then(function(l){
      l=l||[];
      return h+'<div class="ds-h"><h2>Messages</h2></div>'+(l.length?'<div class="ds-rows">'+l.map(function(c){return D.row({icon:"chat",title:c.subject||"Conversation",sub:snip(c.last_preview||"",90),href:"/inbox/"+c.id,end:(c.admin_unread?D.chip("New","warn"):"")+'<small>'+esc(c.last_message_at?C.ago(c.last_message_at):"")+"</small>"})}).join("")+"</div>"
        :D.empty({icon:"chat",title:"No conversations yet",text:"Customer messages for the Everneed Store appear here."}));
    });
  }
  var ROLES=[["owner","Owner","Everything, including staff and roles","key"],["operations","Operations","Orders, fulfilment and delivery exceptions","truck"],["support","Support","Replies to customers and cases","headset"],["catalogue","Catalogue","Products, categories and media","box"],["finance","Finance","Payments, settlements and reports","wallet"]];
  function storeStaff(h){
    return q("staff_members?select=*&limit=50").then(function(l){return{ok:true,l:l||[]}},function(){return{ok:false}}).then(function(r){
      if(!r.ok)return h+'<div class="ds-h"><h2>Staff and roles</h2></div>'+D.banner("info","Not available yet","Staff accounts and roles need the staff_members backend (request R2). Nothing below is active.",null)
        +'<div class="ds-h"><h2>Planned roles</h2><small>For reference only</small></div><div class="ds-rows">'+ROLES.map(function(x){return'<div class="ds-row" aria-disabled="true"><span class="ds-ico">'+D.icon(x[3],20)+'</span><span class="ds-grow"><b>'+x[1]+"</b><small>"+x[2]+"</small></span>"+D.chip("Not active","")+"</div>"}).join("")+"</div>";
      return h+'<div class="ds-h"><h2>Staff and roles</h2></div>'+(r.l.length?'<div class="ds-rows">'+r.l.map(function(m){return D.row({icon:"user",title:String(m.user_id||"").slice(0,8),sub:"Role: "+(m.role||"none"),end:D.chip(m.active===false?"Revoked":"Active",m.active===false?"bad":"ok")})}).join("")+"</div>"
        :D.empty({icon:"users",title:"No staff yet",text:"Invite staff once the invite function is available."}));
    });
  }

  /* ---------- router: new pages here, everything else by admin.js ---------- */
  V.admin=function(p){
    var sub=p[0]||"",tab=p[1]||"";
    var me=C.me();
    if(!Supa.uid()||!me||me.role!=="admin")return old(p);
    if(CTX==="store"&&sub!=="store")return{redirect:"/admin/store"};
    if(sub==="")return overview().then(function(h){return out(h,"Overview","admin")});
    if(sub==="sellers"&&tab==="")return applications().then(function(h){return out(h,"Seller operations","admin/sellers")});
    if(sub==="sellers"&&tab==="stores")return stores().then(function(h){return out(h,"Seller operations","admin/sellers")});
    if(sub==="review")return review().then(function(h){return out(h,"Product review","admin/review")});
    if(sub==="store"){var t=STAB.some(function(x){return x[0]===tab})?tab:"";return storePage(t).then(function(h){return out(h,"Everneed Store","admin/store"+(t?"/"+t:""))})}
    return old(p);
  };
})();
