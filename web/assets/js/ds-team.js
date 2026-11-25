/* Team and staff screens: PREVIEW WITH SAMPLE DATA (loaded on demand by ds-lazy.js, only when the preview flag is on).
   Contract: ROLES_AND_ACCESS_PROPOSAL.md (accepted 25 Nov 2026) and PHASE_A_KICKOFF_CLAUDE_HANDOFF.md.
   Everything here is MOCK. No request is sent, nothing is saved, and the page says so. Every action that needs the backend is shown
   disabled with its reason. Role UI is not offered in the real menu until backend enforcement exists (owner decision 8.6g).
   Routes: /portal/team (store team) and /admin/staff (platform staff), reachable only with ?proto=1 (turn off with ?proto=off). */
(function(){
  var C=window.Core,D=window.DS,esc=C.esc,V=C.V,A=C.A;if(!C||!D)return;
  var STORE={
    owner:["Owner","The merchant. One per store and cannot be removed.","*"],
    manager:["Manager","Runs the store day to day. No money or team control.",["store.catalogue.write","store.catalogue.publish","store.inventory.write","store.orders.read","store.orders.transition","store.inbox.reply","store.settings.write","store.discounts.write","store.analytics.read"]],
    catalogue:["Catalogue","Products and stock only.",["store.catalogue.write","store.catalogue.publish","store.inventory.write"]],
    fulfilment:["Fulfilment","Orders and handover.",["store.orders.read","store.orders.transition"]],
    support:["Support","Customer messages and order look-ups.",["store.inbox.reply","store.orders.read"]],
    finance:["Finance","Sees balance and payouts. Cannot move money.",["store.finance.read"]],
    viewer:["Viewer","Read-only, for an accountant or adviser.","read"]
  };
  var PLAT={
    owner:["Owner","Full control. The only role that manages staff.","*"],
    operations:["Operations","Runs the platform day to day.",["platform.sellers.read","platform.orders.read","platform.orders.intervene","platform.disputes.manage"]],
    reviewer:["Reviewer","Seller verification and product review.",["platform.sellers.read","platform.sellers.review","platform.products.review"]],
    support:["Support","Helps sellers and shoppers.",["platform.inbox.reply","platform.sellers.read","platform.orders.read"]],
    finance:["Finance","Money. Approves payouts and refunds.",["platform.finance.read","platform.payouts.approve","platform.refunds.approve"]],
    analyst:["Analyst","Read-only.","read"]
  };
  var LABEL={"store.catalogue.write":"Add and edit products","store.catalogue.publish":"Publish products","store.inventory.write":"Change stock","store.orders.read":"See orders","store.orders.transition":"Move orders forward","store.inbox.reply":"Reply to customers","store.finance.read":"See balance and payouts","store.finance.payout":"Request payouts","store.settings.write":"Change store settings","store.discounts.write":"Manage discounts","store.team.manage":"Manage the team","store.analytics.read":"See analytics",
    "platform.sellers.read":"See sellers","platform.sellers.review":"Approve or reject sellers","platform.products.review":"Review products","platform.orders.read":"See all orders","platform.orders.intervene":"Step in on orders","platform.disputes.manage":"Handle disputes","platform.inbox.reply":"Reply in the support inbox","platform.finance.read":"See finance","platform.payouts.approve":"Approve payouts","platform.refunds.approve":"Approve refunds","platform.staff.manage":"Manage staff","platform.audit.read":"See the activity log"};
  function keysOf(plane,r){var set=plane==="store"?STORE:PLAT,x=set[r][2],all=Object.keys(LABEL).filter(function(k){return k.indexOf(plane+".")===0});
    return x==="*"?all:x==="read"?all.filter(function(k){return/\.read$/.test(k)}):x}
  var PEOPLE={
    store:[{id:"m1",name:"Ada Okafor",email:"ada@example.com",role:"owner",st:"active"},{id:"m2",name:"Tunde Bello",email:"tunde@example.com",role:"fulfilment",st:"active"},{id:"m3",name:"Ngozi Eze",email:"ngozi@example.com",role:"catalogue",st:"invited",ends:"31 Dec 2026"}],
    plat:[{id:"p1",name:"Everneed owner",email:"owner@example.com",role:"owner",st:"active"},{id:"p2",name:"Sample Reviewer",email:"reviewer@example.com",role:"reviewer",st:"active"},{id:"p3",name:"Sample Finance",email:"finance@example.com",role:"finance",st:"approval"}]
  };
  var SEATS={used:3,total:5},WHY="Not available yet. It needs the team backend, which is still being built.";
  function style(){if(document.getElementById("ds-tm-css"))return;var s=document.createElement("style");s.id="ds-tm-css";
    s.textContent=".ds-mock{display:flex;gap:10px;align-items:flex-start;margin:0 0 var(--ds-s4,16px);padding:12px 14px;border-radius:var(--r-card,16px);background:var(--warning-soft);color:var(--text-1);font:600 14px/1.4 var(--font-body)}.ds-mock svg{flex:none;margin-top:1px;color:var(--warning)}"
    +".ds-tmp{display:grid;gap:10px;margin:0 0 var(--ds-s4,16px)}.ds-rc{display:flex;gap:12px;align-items:flex-start;width:100%;min-height:56px;padding:14px;border:1.5px solid var(--border);border-radius:var(--r-card,16px);background:var(--surface-1);color:var(--text-1);text-align:left;font:inherit;cursor:pointer}"
    +".ds-rc[aria-pressed=true]{border-color:var(--brand);background:var(--brand-soft)}.ds-rc b{display:block}.ds-rc small{display:block;color:var(--text-2);margin-top:2px}.ds-why{margin:8px 2px 0;color:var(--text-2);font:500 13px/1.4 var(--font-body)}"
    +".ds-perm{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:8px}.ds-perm li{display:flex;gap:10px;align-items:center;min-height:32px}.ds-perm .no{color:var(--text-3)}.ds-perm svg{flex:none;color:var(--success)}.ds-perm .no svg{color:var(--text-3)}"
    +".ds-tm-seats{display:flex;align-items:center;gap:14px;margin:0 0 var(--ds-s4,16px);padding:14px;border:1px solid var(--border);border-radius:var(--r-card,16px);background:var(--surface-1)}.ds-tm-seats small{display:block;color:var(--text-2)}"
    +".ds-tm .ds-stack>*,.ds-tm-seats{animation:tmr .5s var(--ease,ease) both}.ds-tm .ds-stack>*:nth-child(2){animation-delay:.05s}.ds-tm .ds-stack>*:nth-child(3){animation-delay:.1s}.ds-tm .ds-stack>*:nth-child(4){animation-delay:.15s}.ds-tm .ds-stack>*:nth-child(n+5){animation-delay:.2s}"
    +".ds-rc{transition:transform .15s,background-color .2s,border-color .2s}.ds-rc:active{transform:scale(.98)}.ds-rc[aria-pressed=true]{animation:tmp .3s var(--ease,ease)}.ds-perm li{animation:tmr .35s both}"
    +"@keyframes tmr{from{opacity:0;transform:translateY(12px)}}@keyframes tmp{50%{transform:scale(1.02)}}@media(prefers-reduced-motion:reduce){.ds-tm .ds-stack>*,.ds-tm-seats,.ds-rc,.ds-perm li{animation:none!important;transition:none!important}}"
    +".ds-tmh{margin:var(--ds-s5,24px) 0 var(--ds-s3,12px);font:700 15px var(--font-body);color:var(--text-2)}";document.head.appendChild(s)}
  function stChip(p){return p.st==="active"?D.chip("Active","ok","okc"):p.st==="invited"?D.chip("Invited","","clock"):D.chip("Waiting for approval","warn","clock")}
  function page(plane){
    style();var set=plane==="store"?STORE:PLAT,list=PEOPLE[plane==="store"?"store":"plat"],t=plane==="store"?"Team":"Staff";
    var h='<div class="ds-tm"><div class="ds-mock" role="note">'+D.icon("alert",18)+"<span>Preview with sample people. Nothing is sent or saved.</span></div>"
      +'<div class="ds-headrow"><h1 class="ds-title">'+t+'</h1><button type="button" class="ds-btn s" data-act="ds-tm-invite" data-id="'+plane+'">'+D.icon("plus",16)+" Invite</button></div>"
      +(plane==="store"?'<div class="ds-tm-seats">'+D.ring(SEATS.used/SEATS.total*100,"ok",SEATS.used+"/"+SEATS.total)+'<div><b>'+SEATS.used+" of "+SEATS.total+" seats used</b><small>"+(SEATS.total-SEATS.used)+" left on your plan</small></div></div>":"")
      +'<h2 class="ds-tmh">People</h2><div class="ds-stack">'+list.map(function(p){return D.row({icon:"users",title:p.name,sub:set[p.role][0]+(p.ends?" · until "+p.ends:""),end:stChip(p),act:"ds-tm-person",id:plane+":"+p.id})}).join("")+"</div>"
      +'<h2 class="ds-tmh">Roles</h2><div class="ds-stack">'+Object.keys(set).map(function(r){return D.row({icon:"crown",title:set[r][0],sub:set[r][1],act:"ds-tm-role",id:plane+":"+r})}).join("")+"</div>"
      +(plane==="plat"?'<h2 class="ds-tmh">Waiting for approval</h2><div class="ds-stack">'+D.row({icon:"clock",title:"Finance role for Sample Finance",sub:"Sensitive roles need a second person to approve."})+"</div>":"")+"</div>";
    return h}
  function perms(plane,r){var set=plane==="store"?STORE:PLAT,have=keysOf(plane,r),all=Object.keys(LABEL).filter(function(k){return k.indexOf(plane+".")===0});
    return'<ul class="ds-perm">'+all.map(function(k){var on=have.indexOf(k)>-1;return'<li class="'+(on?"":"no")+'">'+D.icon(on?"check":"x",18)+"<span>"+esc(LABEL[k])+(on?"":" (not included)")+"</span></li>"}).join("")+"</ul>"}
  function disabledBtn(label,icon){return'<button type="button" class="ds-btn w" disabled aria-describedby="ds-why">'+(icon?D.icon(icon,18)+" ":"")+esc(label)+'</button><p class="ds-why" id="ds-why">'+WHY+"</p>"}
  A["ds-tm-invite"]=function(b){var plane=b.getAttribute("data-id")||"store",set=plane==="store"?STORE:PLAT;
    var cards=Object.keys(set).filter(function(r){return r!=="owner"}).map(function(r){return'<button type="button" class="ds-rc" data-r="'+r+'" aria-pressed="false"><span class="ds-grow"><b>'+set[r][0]+"</b><small>"+esc(set[r][1])+"</small></span></button>"}).join("");
    var s=D.sheet({title:plane==="store"?"Invite to your team":"Invite staff",html:'<label class="ds-field"><span>Email</span><input type="email" inputmode="email" autocomplete="off" placeholder="name@example.com"></label><p class="ds-tmh" style="margin-top:0">Role</p><div class="ds-tmp">'+cards+'</div><label class="ds-field"><span>Access ends (optional)</span><input type="date"></label>'+disabledBtn("Send invite","send")});
    s.body.addEventListener("click",function(e){var c=e.target.closest(".ds-rc");if(!c)return;[].forEach.call(s.body.querySelectorAll(".ds-rc"),function(x){x.setAttribute("aria-pressed",x===c?"true":"false")})})};
  A["ds-tm-person"]=function(b){var a=(b.getAttribute("data-id")||"").split(":"),set=a[0]==="store"?STORE:PLAT,p=PEOPLE[a[0]==="store"?"store":"plat"].filter(function(x){return x.id===a[1]})[0];if(!p)return;
    D.sheet({title:p.name,html:'<div class="ds-chips">'+D.chip(set[p.role][0])+stChip(p)+"</div><p class=\"lead\">"+esc(p.email)+"</p><h3 class=\"ds-tmh\">What this role can do</h3>"+perms(a[0],p.role)+(p.role==="owner"?'<p class="ds-why">The owner cannot be removed or changed here.</p>':disabledBtn("Change role","edit")+'<div style="height:10px"></div>'+disabledBtn("Remove access","x"))})};
  A["ds-tm-role"]=function(b){var a=(b.getAttribute("data-id")||"").split(":"),set=a[0]==="store"?STORE:PLAT;if(!set[a[1]])return;
    D.sheet({title:set[a[1]][0],html:'<p class="lead">'+esc(set[a[1]][1])+"</p>"+perms(a[0],a[1])})};
  function flagOn(){try{return sessionStorage.getItem("ev-proto")==="1"}catch(e){return false}}
  var op=V.portal,oa=V.admin;
  V.portal=function(p){if(p&&p[0]==="team"&&flagOn())return{layout:"portal",active:"portal/team",title:"Team",html:page("store")};return op(p)};
  V.admin=function(p){var me=C.me&&C.me();if(p&&p[0]==="staff"&&flagOn()&&me&&me.role==="admin")return{layout:"admin",active:"admin/staff",title:"Staff",html:page("plat")};return oa(p)};
})();
