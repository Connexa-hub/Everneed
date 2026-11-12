/* Messages: inbox for admins (all chats + live visitors), sellers (customers + Everneed) and any signed-in user. Support settings for admins. */
(function(){
  var C=Core,V=C.V,A=C.A,F=C.F,esc=C.esc,ic=Ico.svg,$=C.$;
  var S={list:[],unread:{},guests:[],sel:null,tab:"all",q:"",th:null,gt:null,kind:"buyer",store:null,tm:null};
  var KIND={store:"Customer chat",support:"Support",seller_admin:"Seller support",admin_user:"From Everneed"};
  function title(c){var k=S.kind,cr=c.creator&&c.creator.name,st=c.store&&c.store.name;
    if(k==="admin")return c.kind==="store"?(cr||"Customer")+" \u2192 "+(st||"Store"):c.kind==="admin_user"?(c.subject||"Message"):(cr||"Member")+(st?" \u00b7 "+st:"");
    if(k==="seller")return c.kind==="store"?(cr||"Customer"):"Everneed Support";
    return c.kind==="store"?(st||c.subject||"Store"):"Everneed Support"}
  function av(c){if(S.kind!=="admin"&&c.kind!=="store")return'<span class="av2"><img alt="" src="/favicon.svg"></span>';
    if(c.kind==="store"&&S.kind!=="seller"&&c.store)return'<span class="av2"><img alt="" src="'+esc(c.store.logo_url||Art.col(c.store.name))+'"></span>';
    return'<span class="av2">'+(S.kind==="seller"?ic("me",20):esc(title(c).charAt(0).toUpperCase()))+"</span>"}
  function sla(c){if(c.status==="resolved"||!c.sla_due_at||S.kind==="buyer")return"";var m=Math.round((new Date(c.sla_due_at)-Date.now())/60000);
    return m>=0?'<span class="pill info">Reply due in '+(m>=60?Math.round(m/60)+"h":m+"m")+"</span>":'<span class="pill bad">Overdue '+(-m>=60?Math.round(-m/60)+"h":-m+"m")+"</span>"}
  function chips(c){var h="";if(c.status==="escalated")h+='<span class="pill bad">Escalated</span>';else if(c.status==="resolved")h+='<span class="pill ok">Resolved</span>';
    if(c.priority>=2)h+='<span class="pill bad">Urgent</span>';if(S.kind==="admin"&&c.tier&&c.tier!=="none")h+='<span class="pill info">'+ic("star",11,2)+esc(c.tier)+"</span>";
    (c.tags||[]).slice(0,2).forEach(function(t){h+='<span class="pill">'+esc(t)+"</span>"});return h+sla(c)}
  function unread(c){return S.kind==="admin"?(c.admin_unread?1:0):(S.unread[c.id]||0)}
  function tabs(){var a=S.kind;if(a==="admin")return[["all","All"],["escalated","Escalated"],["unassigned","Unassigned"],["mine","Mine"],["resolved","Resolved"]];
    if(a==="seller")return[["store","Customers"],["seller_admin","Everneed"],["resolved","Resolved"]];return[["all","All"],["resolved","Resolved"]]}
  function pass(c){var t=S.tab,me=Supa.uid();if(t==="resolved")return c.status==="resolved";if(c.status==="resolved")return false;
    if(t==="escalated")return c.status==="escalated";if(t==="unassigned")return !c.assignee;if(t==="mine")return c.assignee===me;if(t==="store"||t==="seller_admin")return c.kind===t||(t==="seller_admin"&&(c.kind==="support"||c.kind==="admin_user"));return true}
  function shellHtml(){var admin=S.kind==="admin",btn=admin?'<button class="btn s" data-ix="new">'+ic("plus",16,2)+"New message</button>":S.kind==="seller"?'<button class="btn s" data-ix="sup">'+ic("chat",16)+"Message Everneed</button>":"";
    return'<div class="ibh"><h1>Messages</h1><div class="row">'+(admin?'<button class="btn o s" data-ix="sweep">'+ic("clock",16)+"Check reply deadlines</button>":"")+btn+'</div></div><div class="ibx" id="ibx"><aside class="ibl"><div class="ibf" id="ibf"></div><label class="cws">'+ic("search",18)+'<input id="ibq" placeholder="Search conversations" aria-label="Search conversations"></label><div id="gq"></div><div class="cvl" id="cvl"></div></aside><section class="ibt" id="ibt"><div class="empty"><b>Select a conversation</b><p>Messages arrive here live.</p></div></section></div>'}
  V.inbox=function(p){if(!Supa.uid())return{redirect:"#/login"};var me=C.me(),admin=me&&me.role==="admin";
    return(admin?Promise.resolve([]):Supa.get("stores?owner_id=eq."+Supa.uid()+"&select=id,name,status&limit=1").catch(function(){return[]})).then(function(st){
      S.store=st&&st[0]||null;S.kind=admin?"admin":S.store?"seller":"buyer";S.sel=p[0]||null;S.tab=S.kind==="seller"?"store":"all";S.q="";
      var layout=admin?"admin":S.store?"portal":"pub",h=shellHtml();return{layout:layout,active:"inbox",title:"Messages",html:layout==="pub"?'<section class="sec"><div class="w">'+h+"</div></section>":h,after:init}})};
  var BASE="conversations?select=*&order=last_message_at.desc&limit=150",EMB="conversations?select=*,creator:created_by(name,email),store:store_id(name,logo_url,slug)&order=last_message_at.desc&limit=150";
  function load(){return Promise.all([Supa.get(EMB).catch(function(){return Supa.get(BASE)}),S.kind==="admin"?Promise.resolve([]):Supa.get("conversation_members?user_id=eq."+Supa.uid()+"&select=conversation_id,unread")]).then(function(a){
      S.list=a[0]||[];S.unread={};(a[1]||[]).forEach(function(m){S.unread[m.conversation_id]=m.unread});if(!$("#ibx"))return;paintTabs();paintList();if(S.sel){var c=cur();if(c)hdr(c)}})}
  function cur(){return S.list.filter(function(x){return x.id===S.sel})[0]}
  function paintTabs(){var n={};S.list.forEach(function(c){tabs().forEach(function(t){var o=S.tab;S.tab=t[0];if(pass(c)&&unread(c))n[t[0]]=(n[t[0]]||0)+1;S.tab=o})});
    $("#ibf").innerHTML=tabs().map(function(t){return'<button data-ix="tab" data-t="'+t[0]+'" class="'+(S.tab===t[0]?"on":"")+'">'+t[1]+(n[t[0]]?"<em>"+n[t[0]]+"</em>":"")+"</button>"}).join("")}
  function paintList(){var q=S.q.toLowerCase(),l=S.list.filter(pass).filter(function(c){return!q||(title(c)+" "+(c.last_preview||"")+" "+(c.subject||"")).toLowerCase().indexOf(q)>-1});
    if(S.kind==="admin")l.sort(function(a,b){return(b.status==="escalated")-(a.status==="escalated")||b.priority-a.priority||new Date(b.last_message_at)-new Date(a.last_message_at)});
    $("#cvl").innerHTML=l.length?l.map(function(c){var n=unread(c);return'<div class="cv'+(c.id===S.sel?" on":"")+(n?" un":"")+'" data-ix="open" data-id="'+c.id+'" tabindex="0" role="button">'+av(c)+'<div class="grow1"><div class="rowi"><b>'+esc(title(c))+"</b><small>"+C.ago(c.last_message_at)+"</small></div><p>"+esc(c.last_preview||c.subject||"New conversation")+'</p><div class="cvm">'+chips(c)+"</div></div>"+(n?'<span class="udot">'+(n>99?"99+":n)+"</span>":"")+"</div>"}).join(""):'<div class="empty" style="margin:16px"><b>No conversations here</b><p>'+(S.kind==="seller"?"When a customer messages your store, it appears here instantly.":"Nothing to show yet.")+"</p></div>"}
  function paintGuests(){var el=$("#gq");if(!el||S.kind!=="admin")return;if(!S.guests.length){el.innerHTML="";return}
    el.innerHTML='<h4><span class="live"></span>Live visitors ('+S.guests.length+")</h4>"+S.guests.map(function(g){return'<div class="rw"><span><b>'+esc(g.name||"Visitor")+"</b><small>"+esc(g.topic||"Live chat")+" \u00b7 waiting "+C.ago(g.created_at).replace(" ago","")+'</small></span><button class="btn s" data-ix="join" data-id="'+esc(g.id)+'">'+(g.status==="active"?"Open":"Join")+"</button></div>"}).join("")}
  function loadGuests(){if(S.kind!=="admin")return;Supa.get("support_queue?status=neq.closed&order=created_at.asc").then(function(g){S.guests=(g||[]).filter(function(x){return Date.now()-new Date(x.last_seen)<150000});paintGuests()}).catch(function(){})}
  function dispose(){if(S.th){S.th.destroy();S.th=null}if(S.gt){S.gt.destroy();S.gt=null}}
  function info(c){if(S.kind!=="admin")return"";var cr=c.creator||{};return'<div class="info">'+(cr.email?'<span class="pill">'+ic("mail",12)+esc(cr.email)+"</span>":"")+(c.tier&&c.tier!=="none"?'<span class="pill info">Plan: '+esc(c.tier)+"</span>":"")+(c.escalation_reason?'<span class="pill bad">'+esc(c.escalation_reason)+"</span>":"")+(c.tags||[]).map(function(t){return'<span class="pill">'+esc(t)+"</span>"}).join("")+sla(c)+'<button class="btn o s" data-ix="tags">'+ic("tag",14)+'Tags</button><select data-ix="prio" aria-label="Priority">'+["Normal","High","Urgent","Critical"].map(function(n,i){return'<option value="'+i+'"'+(c.priority===i?" selected":"")+">"+n+"</option>"}).join("")+"</select></div>"}
  function acts(c){var h="",me=Supa.uid();if(c.status==="resolved")h+=S.kind==="admin"?'<button class="btn o s" data-ix="reopen">Reopen</button>':"";else h+='<button class="btn o s" data-ix="resolve">'+ic("check",14)+"Resolve</button>";
    if(S.kind==="admin"&&c.assignee!==me)h+='<button class="btn s" data-ix="mine">Assign to me</button>';
    if(S.kind!=="admin"&&c.status==="open"&&c.kind!=="admin_user")h+='<button class="btn s" data-ix="esc">'+ic("shield",14)+"Ask Everneed to step in</button>";return h}
  function hdr(c){var h=$("#thh");if(h)h.innerHTML='<div class="tth"><button class="ibx2" data-ix="back" aria-label="Back to list">'+ic("back",18)+'</button><div class="grow1"><b>'+esc(title(c))+"</b><small>"+esc(KIND[c.kind]+(c.store&&c.kind!=="store"?" \u00b7 "+c.store.name:"")+(c.order_id?" \u00b7 Order "+c.order_id.slice(0,8):""))+"</small></div>"+acts(c)+"</div>"+info(c)}
  function open(id){var c=S.list.filter(function(x){return x.id===id})[0];if(!c)return;dispose();S.sel=id;try{history.replaceState(null,"","#/inbox/"+id)}catch(e){}$("#ibx").classList.add("sel");
    $("#ibt").innerHTML='<div id="thh"></div><div class="thb" id="thb"></div>';hdr(c);S.th=Chat.Thread($("#thb"),id,{canned:S.kind!=="buyer",ph:S.kind==="buyer"?"Write a message":"Write a reply"});S.unread[id]=0;c.admin_unread=false;paintTabs();paintList()}
  function openGuest(id){var g=S.guests.filter(function(x){return x.id===id})[0];if(!g)return;dispose();S.sel=null;$("#ibx").classList.add("sel");
    $("#ibt").innerHTML='<div class="tth"><button class="ibx2" data-ix="back" aria-label="Back to list">'+ic("back",18)+'</button><div class="grow1"><b>'+esc(g.name||"Visitor")+"</b><small>Live visitor \u00b7 "+esc(g.topic||"")+' \u00b7 not saved</small></div><button class="btn o s" data-ix="invite">Invite to sign in</button><button class="btn o s danger" data-ix="gend">End chat</button></div><div class="thb" id="thb"></div>';
    S.gt=Chat.GuestSide($("#thb"),g,"agent",{ph:"Reply to the visitor",name:"Everneed"});S.gid=g.id;Supa.patch("support_queue",g.id,{status:"active",claimed_by:Supa.uid()}).catch(function(){})}
  function set(args,msg){return Supa.rpc("chat_set",Object.assign({p_conv:S.sel},args)).then(function(){if(msg)C.toast(msg);return load()}).catch(function(e){C.toast(e.message,true)})}
  function modal(html,ok){var d=document.createElement("dialog");d.innerHTML='<form method="dialog">'+html+'<div class="row"><button class="btn o s" value="x" formnovalidate>Cancel</button><button class="btn s" value="ok">Send</button></div></form>';document.body.appendChild(d);
    d.addEventListener("close",function(){var f=d.querySelector("form");if(d.returnValue==="ok")ok(new FormData(f));d.remove()});d.showModal()}
  document.addEventListener("click",function(e){var b=e.target.closest("[data-ix]");if(!b||!$("#ibx"))return;var a=b.getAttribute("data-ix"),me=Supa.uid();
    if(a==="tab"){S.tab=b.getAttribute("data-t");paintTabs();paintList()}
    else if(a==="open")open(b.getAttribute("data-id"));
    else if(a==="join")openGuest(b.getAttribute("data-id"));
    else if(a==="back"){dispose();S.sel=null;$("#ibx").classList.remove("sel");try{history.replaceState(null,"","#/inbox")}catch(x){}paintList()}
    else if(a==="resolve")set({p_status:"resolved"},"Marked resolved");
    else if(a==="reopen")set({p_status:"open"},"Reopened");
    else if(a==="mine")set({p_assignee:me},"Assigned to you");
    else if(a==="esc"){C.ask("Ask Everneed to step in","What do you need help with?",true).then(function(r){if(r)Supa.rpc("chat_escalate",{p_conv:S.sel,p_reason:r}).then(function(){C.toast("Everneed has been alerted");load()}).catch(function(x){C.toast(x.message,true)})})}
    else if(a==="tags"){var c=cur();C.ask("Tags","Comma separated, for example: refund, vip",false).then(function(r){if(r!==null)set({p_tags:r.split(",").map(function(t){return t.trim().toLowerCase()}).filter(Boolean).slice(0,8)},"Tags saved")})}
    else if(a==="invite"){if(S.gt)S.gt.send("msg",{id:Chat.rid(10),from:"agent",text:"To keep this conversation and get faster help, create a free account: "+location.origin+"/#/login/new",ts:new Date().toISOString(),name:"Everneed"})}
    else if(a==="gend"){if(S.gt)S.gt.end();Supa.patch("support_queue",S.gid,{status:"closed"}).then(loadGuests)}
    else if(a==="sweep"){Supa.rpc("support_sla_sweep").then(function(n){C.toast(n?n+" chat"+(n>1?"s":"")+" passed the reply deadline":"All chats are within their reply deadlines");load()}).catch(function(x){C.toast(x.message,true)})}
    else if(a==="new")modal('<h3>New message</h3><label class="lb">Email of the person<input name="em" type="email" required></label><label class="lb">Subject<input name="sb" maxlength="80"></label><label class="lb">Message<textarea name="m" rows="4" maxlength="2000" required></textarea></label>',function(f){
      Supa.get("profiles?email=eq."+encodeURIComponent(String(f.get("em")).trim().toLowerCase())+"&select=id,name&limit=1").then(function(r){if(!r||!r[0])throw new Error("No account with that email");return Supa.rpc("chat_start",{p_kind:"admin_user",p_user:r[0].id,p_subject:f.get("sb")||null,p_first:f.get("m")})}).then(function(id){S.sel=id;return load().then(function(){open(id)})}).catch(function(x){C.toast(x.message,true)})});
    else if(a==="sup")modal('<h3>Message Everneed</h3><label class="lb">Topic<select name="sb"><option>Billing and plans</option><option>Product review</option><option>Delivery and orders</option><option>Account</option><option>Something else</option></select></label><label class="lb">Message<textarea name="m" rows="4" maxlength="2000" required></textarea></label>',function(f){
      Supa.rpc("chat_start",{p_kind:"seller_admin",p_store:S.store.id,p_subject:f.get("sb"),p_first:f.get("m")}).then(function(id){S.sel=id;S.tab="seller_admin";return load().then(function(){open(id)})}).catch(function(x){C.toast(x.message,true)})})});
  document.addEventListener("change",function(e){if(e.target.getAttribute&&e.target.getAttribute("data-ix")==="prio"&&$("#ibx"))set({p_priority:+e.target.value},"Priority updated")});
  document.addEventListener("input",function(e){if(e.target.id==="ibq"){S.q=e.target.value;paintList()}});
  document.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&e.target.classList&&e.target.classList.contains("cv")){e.preventDefault();open(e.target.getAttribute("data-id"))}});
  function init(){clearInterval(S.tm);window.removeEventListener("chat:change",S.onc);S.onc=function(){load();loadGuests()};window.addEventListener("chat:change",S.onc);
    load().then(function(){if(S.sel&&cur())open(S.sel)});loadGuests();var n=0;
    S.tm=setInterval(function(){if(!$("#ibx")){clearInterval(S.tm);return}n++;loadGuests();paintList();if(S.kind==="admin"&&n%4===0)Supa.rpc("support_sla_sweep").then(function(){load()}).catch(function(){})},15000)}
  /* ---------- Support settings (admin) ---------- */
  V.supportset=function(){if(!Supa.uid())return{redirect:"#/login"};var me=C.me();if(!me||me.role!=="admin")return{layout:"portal",active:"",html:'<h1 style="font-size:2.2rem">Admin only</h1>',title:"Support settings"};
    return Promise.all([Supa.get("support_settings?key=eq.sla"),Supa.get("support_rules?order=id.asc")]).then(function(a){var v=a[0][0]&&a[0][0].value||{minutes:{}},m=v.minutes||{};
      function num(n,l,x){return'<label class="lb">'+l+'<input name="'+n+'" type="number" min="1" max="10080" value="'+(x==null?"":x)+'" required></label>'}
      var h='<h1 style="font-size:2.2rem">Support settings</h1><p class="m">Reply targets by plan, and the rules that decide when Everneed steps into a chat.</p>'
        +'<div class="card" style="margin-top:20px"><h3>Reply targets (minutes)</h3><form data-form="sla"><div class="set2">'+num("t_none","No plan",m.none)+num("t_starter","Starter",m.starter)+num("t_growth","Growth",m.growth)+num("t_pro","Pro",m.pro)+num("seller","Seller reply to customers",v.seller_reply_minutes)+'</div><button class="btn" style="margin-top:16px">Save targets</button></form><p class="sm" style="margin-top:10px">These appear on the Pricing page and start the reply timer on every new message.</p></div>'
        +'<div class="sech"><h3>Triage rules</h3></div><div class="tw"><table><thead><tr><th>Rule</th><th>Does</th><th>Tag</th><th>Priority</th><th>Active</th></tr></thead><tbody>'+a[1].map(function(r){return"<tr><td><b>"+esc(r.name)+'</b><br><small>'+esc((r.applies_to||[]).join(", "))+"</small></td><td>"+esc(r.action)+"</td><td>"+esc(r.tag||"")+"</td><td>"+r.priority+'</td><td><button class="btn s '+(r.active?"":"o")+'" data-ix="rule" data-id="'+r.id+'" data-on="'+(r.active?1:0)+'">'+(r.active?"On":"Off")+"</button></td></tr>"}).join("")+"</tbody></table></div>";
      return{layout:"admin",active:"supportset",title:"Support settings",html:h}})};
  F.sla=function(f,d){var v={minutes:{none:+d.t_none,starter:+d.t_starter,growth:+d.t_growth,pro:+d.t_pro},seller_reply_minutes:+d.seller,auto_escalate_extra_minutes:30};
    Supa.patchBy("support_settings","key","sla",{value:v,updated_at:new Date().toISOString()}).then(function(){C.toast("Reply targets saved")}).catch(function(e){C.toast(e.message,true)})};
  document.addEventListener("click",function(e){var b=e.target.closest('[data-ix="rule"]');if(!b)return;var on=b.getAttribute("data-on")==="1";Supa.patch("support_rules",b.getAttribute("data-id"),{active:!on}).then(function(){b.setAttribute("data-on",on?0:1);b.textContent=on?"Off":"On";b.classList.toggle("o",on)}).catch(function(x){C.toast(x.message,true)})});
})();
