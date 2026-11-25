/* Dispatcher workspace: PREVIEW WITH SAMPLE DATA (loaded on demand by ds-lazy.js, only with ?proto=1; ?proto=off clears it).
   Contract: EVERNEED_UNIVERSAL_PLATFORM_ARCHITECTURE.md (logistics) and PHASE_A_KICKOFF_CLAUDE_HANDOFF.md.
   Uses ONLY today's vocabulary: deliveries.mode direct|hub, deliveries.status pending|dispatched|delivered|failed,
   seller_orders.status ready|handover_pending|out_for_delivery|at_hub|consolidated|delivered, proof code_verified|customer_confirmed|admin_override|auto_confirmed.
   The UI reads a backend timeline and never writes a status. Everything here is MOCK: no request, nothing saved, assignment is disabled with its reason.
   Route: /admin/dispatch. Not in any real menu until the dispatch backend and permissions (logistics.dispatch.*) exist. */
(function(){
  var C=window.Core,D=window.DS,esc=C.esc,V=C.V,A=C.A;if(!C||!D)return;
  var ZONES=[["all","All zones"],["island","Island"],["mainland","Mainland"],["ikeja","Ikeja"]];
  var GROUPS=[["queue","Unassigned"],["out","Out for delivery"],["hub","At hub"],["issue","Needs attention"]];
  var ST={pending:["Waiting","warn","clock"],dispatched:["On the way","info","send"],delivered:["Delivered","ok","okc"],failed:["Failed attempt","bad","alert"]};
  var SO={ready:"Ready for pickup",handover_pending:"Handover pending",out_for_delivery:"Out for delivery",at_hub:"At hub",consolidated:"Consolidated",delivered:"Delivered"};
  var COURIERS=[["Sample rider A","Free now",1],["Sample rider B","2 drops left",1],["Sample rider C","Off duty",0]];
  var JOBS=[
    {id:"1",n:"Sample order 1042",from:"Sample Store A",to:"Lekki",zone:"island",mode:"direct",d:"pending",so:"ready",sla:22,x:230,y:150},
    {id:"2",n:"Sample order 1043",from:"Sample Store B",to:"Yaba",zone:"mainland",mode:"hub",d:"pending",so:"handover_pending",sla:75,x:120,y:110},
    {id:"3",n:"Sample order 1044",from:"Sample Store A",to:"Ikeja GRA",zone:"ikeja",mode:"direct",d:"pending",so:"ready",sla:-12,x:90,y:50},
    {id:"4",n:"Sample order 1038",from:"Sample Store C",to:"Surulere",zone:"mainland",mode:"direct",d:"dispatched",so:"out_for_delivery",sla:48,x:150,y:160,c:"Sample rider A"},
    {id:"5",n:"Sample order 1039",from:"Sample Store B",to:"Victoria Island",zone:"island",mode:"hub",d:"dispatched",so:"out_for_delivery",sla:30,x:250,y:110,c:"Sample rider B"},
    {id:"6",n:"Sample order 1035",from:"Sample Store D",to:"Maryland",zone:"ikeja",mode:"hub",d:"pending",so:"at_hub",sla:95,x:60,y:100},
    {id:"7",n:"Sample order 1036",from:"Sample Store D",to:"Ajah",zone:"island",mode:"hub",d:"pending",so:"consolidated",sla:140,x:280,y:185},
    {id:"8",n:"Sample order 1031",from:"Sample Store A",to:"Yaba",zone:"mainland",mode:"direct",d:"failed",so:"out_for_delivery",sla:-30,x:110,y:140,c:"Sample rider A",why:"Customer unreachable"}
  ];
  var F={g:"queue",z:"all",v:"list"};
  function grp(j){return j.d==="failed"||j.sla<0?"issue":j.d==="dispatched"?"out":(j.so==="at_hub"||j.so==="consolidated")?"hub":"queue"}
  function mins(m){return m<0?Math.abs(m)+" min late":m<60?m+" min left":Math.floor(m/60)+" h "+(m%60)+" min left"}
  function tone(j){return j.sla<0||j.d==="failed"?"bad":j.sla<30?"warn":"ok"}
  function css(){if(document.getElementById("ds-dp-css"))return;var s=document.createElement("style");s.id="ds-dp-css";
    s.textContent=".ds-mock{display:flex;gap:10px;align-items:flex-start;margin:0 0 var(--ds-s4,16px);padding:12px 14px;border-radius:var(--r-card,16px);background:var(--warning-soft);color:var(--text-1);font:600 14px/1.4 var(--font-body)}.ds-mock svg{flex:none;margin-top:1px;color:var(--warning)}"
    +".ds-dp-hero{display:flex;align-items:center;gap:14px;margin:0 0 var(--ds-s4,16px)}.ds-dp-hero svg{flex:none;width:92px;height:auto}.ds-dp-hero p{margin:0;color:var(--text-2)}"
    +".ds-dp-rt{fill:none;stroke:var(--brand);stroke-width:3;stroke-linecap:round;stroke-dasharray:2 8;animation:dpd 1.4s linear infinite}.ds-dp-pk{fill:var(--brand);animation:dpg 3.6s ease-in-out infinite}.ds-dp-hb{fill:var(--text-1)}"
    +".ds-dp-tabs{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;margin:0 -2px;scrollbar-width:none}.ds-dp-tabs::-webkit-scrollbar{display:none}"
    +".ds-dp-tabs button{flex:none;min-height:44px;padding:0 14px;border-radius:99px;border:1.5px solid var(--border);background:var(--surface-1);color:var(--text-1);font:600 14px var(--font-body);cursor:pointer;transition:transform .12s,background-color .2s,border-color .2s}.ds-dp-tabs button:active{transform:scale(.96)}.ds-dp-tabs button[aria-pressed=true]{background:var(--brand);border-color:var(--brand);color:var(--text-on-brand)}.ds-dp-tabs .n{display:inline-block;min-width:20px;margin-left:6px;padding:1px 6px;border-radius:99px;background:color-mix(in srgb,currentColor 16%,transparent);font-size:12px;text-align:center}"
    +".ds-dp-sw{display:inline-flex;padding:3px;border-radius:99px;background:var(--surface-3);margin:0 0 12px}.ds-dp-sw button{min-height:40px;padding:0 18px;border:0;border-radius:99px;background:transparent;color:var(--text-2);font:600 14px var(--font-body);cursor:pointer;transition:background-color .25s,color .25s}.ds-dp-sw button[aria-pressed=true]{background:var(--surface-1);color:var(--text-1);box-shadow:var(--shadow-1)}"
    +".ds-dp-l>*{animation:dpr .45s var(--ease,ease) both}.ds-dp-l>*:nth-child(2){animation-delay:.05s}.ds-dp-l>*:nth-child(3){animation-delay:.1s}.ds-dp-l>*:nth-child(4){animation-delay:.15s}.ds-dp-l>*:nth-child(n+5){animation-delay:.2s}"
    +".ds-dp-card{display:flex;align-items:center;gap:12px;width:100%;min-height:72px;padding:12px;border:1px solid var(--border);border-radius:var(--r-card,16px);background:var(--surface-1);color:var(--text-1);text-align:left;font:inherit;cursor:pointer;transition:transform .12s}.ds-dp-card:active{transform:scale(.985)}"
    +".ds-dp-card .g{flex:1;min-width:0}.ds-dp-card b{display:block}.ds-dp-card small{display:block;color:var(--text-2);margin-top:2px}.ds-dp-card .e{display:grid;justify-items:end;gap:4px}"
    +".ds-dp-map{position:relative;border-radius:var(--r-card,16px);background:var(--brand-soft);border:1px solid var(--border);overflow:hidden;animation:dpr .5s both}.ds-dp-map svg{display:block;width:100%;height:auto}"
    +".ds-dp-z{fill:var(--surface-1);opacity:.7;stroke:var(--border-strong);stroke-width:1.5}.ds-dp-ln{stroke:var(--brand);stroke-width:2;stroke-dasharray:2 6;stroke-linecap:round;opacity:.7;animation:dpd 1.6s linear infinite}"
    +".ds-dp-pin{cursor:pointer;outline:none}.ds-dp-pin circle.c{fill:var(--brand)}.ds-dp-pin.warn circle.c{fill:var(--warning)}.ds-dp-pin.bad circle.c{fill:var(--danger)}.ds-dp-pin circle.p{fill:none;stroke:currentColor;stroke-width:2;transform-box:fill-box;transform-origin:center;animation:dpp 2s ease-out infinite}.ds-dp-pin.warn{color:var(--warning)}.ds-dp-pin.bad{color:var(--danger)}.ds-dp-pin{color:var(--brand)}.ds-dp-pin:focus-visible circle.c{stroke:var(--text-1);stroke-width:3}"
    +".ds-dp-note{margin:8px 2px 0;color:var(--text-3);font:500 12px var(--font-body)}"
    +".ds-dp-tl{list-style:none;margin:0 0 14px;padding:0 0 0 4px}.ds-dp-tl li{position:relative;display:flex;gap:12px;align-items:flex-start;padding:0 0 18px;min-height:28px;color:var(--text-3)}.ds-dp-tl li.on{color:var(--text-1)}"
    +".ds-dp-tl i{flex:none;width:14px;height:14px;margin-top:3px;border-radius:50%;border:2px solid var(--border-strong);background:var(--surface-1);position:relative;z-index:1}.ds-dp-tl li.on i{background:var(--brand);border-color:var(--brand);animation:dpb .4s both}.ds-dp-tl li:not(:last-child):after{content:\"\";position:absolute;left:6px;top:20px;bottom:0;width:2px;background:var(--border)}.ds-dp-tl li.on:not(:last-child):after{background:var(--brand);transform-origin:top;animation:dpl .5s .1s both}"
    +".ds-dp-cr{display:flex;gap:12px;align-items:center;width:100%;min-height:56px;padding:12px;margin:0 0 8px;border:1.5px solid var(--border);border-radius:var(--r-card,16px);background:var(--surface-1);color:var(--text-1);font:inherit;text-align:left;cursor:pointer}.ds-dp-cr[aria-pressed=true]{border-color:var(--brand);background:var(--brand-soft)}.ds-dp-cr[disabled]{opacity:.5;cursor:not-allowed}.ds-dp-cr small{display:block;color:var(--text-2)}"
    +".ds-dp-why{margin:8px 2px 0;color:var(--text-2);font:500 13px/1.4 var(--font-body)}"
    +"@keyframes dpd{to{stroke-dashoffset:-20}}@keyframes dpr{from{opacity:0;transform:translateY(14px)}}@keyframes dpp{0%{opacity:.8;transform:scale(.6)}100%{opacity:0;transform:scale(2.6)}}@keyframes dpb{from{transform:scale(0)}60%{transform:scale(1.35)}}@keyframes dpl{from{transform:scaleY(0)}}@keyframes dpg{0%{transform:translate(8px,50px)}50%{transform:translate(44px,26px)}100%{transform:translate(80px,8px)}}"
    +"@media(prefers-reduced-motion:reduce){.ds-dp-rt,.ds-dp-ln,.ds-dp-pk,.ds-dp-l>*,.ds-dp-map,.ds-dp-pin circle.p,.ds-dp-tl i,.ds-dp-tl li:after{animation:none!important}}";document.head.appendChild(s)}
  function counts(){var n={queue:0,out:0,hub:0,issue:0};JOBS.forEach(function(j){n[grp(j)]++});return n}
  function visible(){return JOBS.filter(function(j){return grp(j)===F.g&&(F.z==="all"||j.zone===F.z)})}
  function hero(){return'<div class="ds-dp-hero"><svg viewBox="0 0 100 70" aria-hidden="true" focusable="false"><path class="ds-dp-rt" d="M8 62C30 62 34 38 56 36S84 22 92 10"/><circle class="ds-dp-hb" cx="92" cy="10" r="6"/><rect class="ds-dp-pk" x="-7" y="-7" width="14" height="14" rx="4"/></svg><p>Assign each delivery, watch the route, and step in when something is late.</p></div>'}
  function card(j){var s=ST[j.d];return'<button type="button" class="ds-dp-card" data-act="ds-dp-open" data-id="'+j.id+'"><span class="ds-ico">'+D.icon(j.mode==="hub"?"store":"send",20)+'</span><span class="g"><b>'+esc(j.n)+"</b><small>"+esc(j.from)+" → "+esc(j.to)+"</small><small>"+(j.c?esc(j.c)+" · ":"")+mins(j.sla)+'</small></span><span class="e">'+D.chip(s[0],s[1],s[2])+D.chip(j.mode==="hub"?"Via hub":"Direct")+"</span></button>"}
  function map(list){
    var pins=list.map(function(j){var t=tone(j);return'<g class="ds-dp-pin '+t+'" tabindex="0" role="button" aria-label="'+esc(j.n+", "+j.to+", "+mins(j.sla))+'" data-act="ds-dp-open" data-id="'+j.id+'" transform="translate('+j.x+" "+j.y+')"><circle class="p" r="10"/><circle class="c" r="9"/><circle r="3.5" fill="var(--text-on-brand)"/></g>'}).join("");
    var lines=list.filter(function(j){return j.d==="dispatched"}).map(function(j){return'<path class="ds-dp-ln" d="M160 100L'+j.x+" "+j.y+'"/>'}).join("");
    return'<div class="ds-dp-map"><svg viewBox="0 0 340 220" role="group" aria-label="Sample map of deliveries"><path class="ds-dp-z" d="M30 70L130 20 200 50 190 120 100 150 30 130z"/><path class="ds-dp-z" d="M200 50L320 70 330 150 290 205 200 190 190 120z"/><path class="ds-dp-z" d="M100 150L190 120 200 190 120 205 60 180z"/>'+lines+'<circle cx="160" cy="100" r="9" class="ds-dp-hb"/><text x="160" y="126" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text-2)">Hub</text>'+pins+'</svg></div><p class="ds-dp-note">Sample map, not real locations.</p>'}
  function body(){var list=visible();
    if(!list.length)return D.empty({icon:"box",title:"Nothing here",text:"No deliveries match this view."});
    return F.v==="map"?map(list):'<div class="ds-stack ds-dp-l">'+list.map(card).join("")+"</div>"}
  function page(){css();var n=counts();
    return'<div class="ds-mock" role="note">'+D.icon("alert",18)+"<span>Preview with sample deliveries. Nothing is assigned or saved.</span></div>"
      +'<div class="ds-headrow"><h1 class="ds-title">Dispatch</h1></div>'+hero()
      +'<div class="ds-stats">'+D.stat({icon:"clock",value:n.queue,label:"Unassigned"})+D.stat({icon:"alert",value:n.issue,label:"Need attention"})+"</div>"
      +'<div class="ds-dp-tabs" role="group" aria-label="Delivery groups" style="margin-top:14px">'+GROUPS.map(function(g){return'<button type="button" data-act="ds-dp-g" data-id="'+g[0]+'" aria-pressed="'+(F.g===g[0])+'">'+g[1]+'<span class="n">'+n[g[0]]+"</span></button>"}).join("")+"</div>"
      +'<div class="ds-dp-tabs" role="group" aria-label="Zones">'+ZONES.map(function(z){return'<button type="button" data-act="ds-dp-z" data-id="'+z[0]+'" aria-pressed="'+(F.z===z[0])+'">'+z[1]+"</button>"}).join("")+"</div>"
      +'<div class="ds-dp-sw" role="group" aria-label="View">'+[["list","List"],["map","Map"]].map(function(v){return'<button type="button" data-act="ds-dp-v" data-id="'+v[0]+'" aria-pressed="'+(F.v===v[0])+'">'+v[1]+"</button>"}).join("")+"</div>"
      +'<div id="ds-dp-body" aria-live="polite">'+body()+"</div>"}
  function redraw(){var h=document.getElementById("ds-dp-body");if(!h)return;h.innerHTML=body();
    [].forEach.call(document.querySelectorAll("[data-act=ds-dp-g],[data-act=ds-dp-z],[data-act=ds-dp-v]"),function(b){var id=b.getAttribute("data-id"),a=b.getAttribute("data-act");b.setAttribute("aria-pressed",String((a==="ds-dp-g"&&F.g===id)||(a==="ds-dp-z"&&F.z===id)||(a==="ds-dp-v"&&F.v===id)))});
    var n=counts();[].forEach.call(document.querySelectorAll("[data-act=ds-dp-g] .n"),function(el){el.textContent=n[el.parentNode.getAttribute("data-id")]})}
  A["ds-dp-g"]=function(b){F.g=b.getAttribute("data-id");redraw()};A["ds-dp-z"]=function(b){F.z=b.getAttribute("data-id");redraw()};A["ds-dp-v"]=function(b){F.v=b.getAttribute("data-id");redraw()};
  function steps(j){var m=j.mode==="hub",l=[["Order ready","ready"],m?["At the hub","at_hub"]:null,["Rider assigned",""],["Out for delivery","out_for_delivery"],["Delivered","delivered"]].filter(Boolean);
    var order={ready:0,handover_pending:0,at_hub:1,consolidated:1,out_for_delivery:m?3:2,delivered:m?4:3},at=order[j.so]||0;if(j.c&&at<(m?2:1))at=m?2:1;
    return'<ul class="ds-dp-tl" aria-label="Timeline">'+l.map(function(x,i){return'<li class="'+(i<=at?"on":"")+'"><i></i><span>'+x[0]+(i===at?" · now":"")+"</span></li>"}).join("")+"</ul>"}
  A["ds-dp-open"]=function(b){var j=JOBS.filter(function(x){return x.id===b.getAttribute("data-id")})[0];if(!j)return;var s=ST[j.d],pick=-1;
    var cr=COURIERS.map(function(c,i){return'<button type="button" class="ds-dp-cr" data-i="'+i+'" aria-pressed="false"'+(c[2]?"":" disabled")+'><span class="ds-ico">'+D.icon("users",20)+'</span><span class="ds-grow"><b>'+c[0]+"</b><small>"+c[1]+"</small></span></button>"}).join("");
    var sh=D.sheet({title:j.n,html:'<div class="ds-chips">'+D.chip(s[0],s[1],s[2])+D.chip(j.mode==="hub"?"Via hub":"Direct")+D.chip(SO[j.so])+"</div><p class=\"lead\">"+esc(j.from)+" → "+esc(j.to)+" · "+mins(j.sla)+(j.why?" · "+esc(j.why):"")+"</p>"+steps(j)
      +(j.d==="delivered"?"":'<h3 class="ds-tmh" style="margin:0 0 10px;font:700 15px var(--font-body);color:var(--text-2)">'+(j.c?"Reassign rider":"Assign a rider")+"</h3>"+cr+'<button type="button" class="ds-btn w" disabled aria-describedby="ds-dp-why">'+D.icon("send",18)+" Assign</button><p class=\"ds-dp-why\" id=\"ds-dp-why\">Not available yet. Assigning needs the dispatch backend and the logistics.dispatch.assign permission.</p>")});
    sh.body.addEventListener("click",function(e){var c=e.target.closest(".ds-dp-cr");if(!c||c.disabled)return;[].forEach.call(sh.body.querySelectorAll(".ds-dp-cr"),function(x){x.setAttribute("aria-pressed",x===c?"true":"false")})})};
  function on(){try{return!!sessionStorage.getItem("ev-proto")}catch(e){return false}}
  var oa=V.admin;
  V.admin=function(p){var me=C.me&&C.me();if(p&&p[0]==="dispatch"&&on()&&me&&me.role==="admin")return{layout:"admin",active:"admin/dispatch",title:"Dispatch",html:page()};return oa(p)};
})();
