/* Chat: realtime client, signed-in persistent chat (thread component), guest live chat (ephemeral broadcast), support widget.
   Signed-in chats live in Postgres (messages, conversations) with realtime; guest chats are never stored: they only exist in the two browsers. */
window.Chat=(function(){
  var C=Core,esc=C.esc,ic=Ico.svg,$=C.$,cl=null,libP=null,uid=null,booted=false,W={open:false,view:"home",th:null,g:null,conv:null,store:null,wait:null,ts:null,offlineTs:null};
  Ico.IC.chat='<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>';
  Ico.IC.send='<path d="M21 3L10 14M21 3l-7 18-4-8-8-4z"/>';
  var SB="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  function lib(){if(window.supabase&&window.supabase.createClient)return Promise.resolve();if(libP)return libP;libP=new Promise(function(ok,no){var s=document.createElement("script");s.src=SB;s.onload=ok;s.onerror=function(){libP=null;no(new Error("Live updates are unavailable"))};document.head.appendChild(s)});return libP}
  function client(){return lib().then(function(){if(!cl){cl=window.supabase.createClient(CFG.supabase.url,CFG.supabase.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});setInterval(function(){Supa.token().then(function(t){cl.realtime.setAuth(t||CFG.supabase.key)})},20*60*1000)}return Supa.token()}).then(function(t){cl.realtime.setAuth(t||CFG.supabase.key);return cl})}
  function rid(n){var a=new Uint8Array(n||18),s="";(window.crypto||window.msCrypto).getRandomValues(a);for(var i=0;i<a.length;i++)s+=(a[i]%36).toString(36);return s}
  function hm(t){return new Date(t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
  function dayl(t){var d=new Date(t),n=new Date();if(d.toDateString()===n.toDateString())return"Today";if(d.toDateString()===new Date(n-864e5).toDateString())return"Yesterday";return d.toLocaleDateString(undefined,{day:"numeric",month:"short"})}
  function beep(){try{var a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.frequency.value=660;g.gain.value=.04;o.connect(g);g.connect(a.destination);o.start();setTimeout(function(){o.stop();a.close()},130)}catch(e){}}
  function label(m){return m.sender_role==="admin"?"Everneed Support":m.sender_role==="seller"?"Seller":m.sender_role==="buyer"?"Customer":"Member"}
  function bub(m,own,seen){var t=m.kind||"text";
    if(t==="system")return'<div class="sy">'+ic("info",14)+esc(m.body)+"</div>";
    if(t==="shield")return'<div class="sh">'+ic("shield",20)+"<div><b>Everneed Shield</b><span>"+esc(m.body)+"</span></div></div>";
    if(t==="order_card")return'<div class="oc"><span class="itile">'+ic("box",20)+"</span><div><b>"+esc(m.body)+"</b><small>Live order status</small></div></div>";
    return'<div class="mg '+(own?"me":"ot")+(t==="note"?" nt":"")+'">'+(!own?'<small class="who">'+esc(m.who||label(m))+"</small>":"")+'<div class="bb">'+(t==="note"?"<i>"+ic("lock",12)+"Internal note</i>":"")+esc(m.body).replace(/\n/g,"<br>")+'</div><small class="tm">'+hm(m.created_at)+(seen?" · Seen":"")+"</small></div>"}
  function composer(o){return'<div class="ty" aria-live="polite"></div><div class="tpl" hidden></div><div class="cmp">'+(o.canned?'<button type="button" class="ibx2" data-c="tpl" aria-label="Quick replies">'+ic("bolt",18)+"</button>":"")+(o.notes?'<button type="button" class="ibx2" data-c="note" aria-pressed="false" aria-label="Internal note">'+ic("lock",18)+"</button>":"")+'<textarea rows="1" maxlength="2000" placeholder="'+esc(o.ph||"Write a message")+'" aria-label="Message"></textarea><button type="button" class="snd" data-c="send" aria-label="Send">'+ic("send",20,1.9)+"</button></div>"}
  var CAN=null;function canned(scope){if(CAN)return Promise.resolve(CAN);return Supa.get("canned_replies?select=title,body&order=created_at.asc").then(function(r){CAN=r||[];return CAN},function(){return[]})}
  function wire(box,o){var TA=$("textarea",box),TP=$(".tpl",box),note=false,tt=0;
    function grow(){TA.style.height="auto";TA.style.height=Math.min(120,TA.scrollHeight)+"px"}
    TA.addEventListener("input",function(){grow();if(o.typing&&Date.now()-tt>2000){tt=Date.now();o.typing()}});
    TA.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();go()}});
    function go(){var v=TA.value.trim();if(!v)return;TA.value="";grow();o.send(v,note,function(){TA.value=v;grow()})}
    box.addEventListener("click",function(e){var b=e.target.closest("[data-c]");if(!b)return;var a=b.getAttribute("data-c");
      if(a==="send")go();
      else if(a==="note"){note=!note;b.setAttribute("aria-pressed",note);b.classList.toggle("on",note);TA.placeholder=note?"Internal note (only staff see this)":(o.ph||"Write a message")}
      else if(a==="tpl"){if(!TP.hidden){TP.hidden=true;return}canned().then(function(l){TP.innerHTML=l.length?l.map(function(x,i){return'<button type="button" data-c="use" data-i="'+i+'"><b>'+esc(x.title)+"</b><span>"+esc(x.body)+"</span></button>"}).join(""):'<p class="sm" style="padding:12px">No quick replies yet.</p>';TP.hidden=false})}
      else if(a==="use"){TA.value=CAN[+b.getAttribute("data-i")].body;TP.hidden=true;TA.focus();grow()}});
    return{focus:function(){TA.focus()},disable:function(m){TA.disabled=true;TA.placeholder=m||"Chat ended";$(".snd",box).disabled=true}}}
  /* ---------- Persistent thread (signed-in users, sellers, admins) ---------- */
  function Thread(box,id,o){o=o||{};var me=C.me(),admin=me&&me.role==="admin",msgs=[],reads={},ch=null,pl=null,dead=false,tyT=null,first=true;
    box.innerHTML='<div class="th"><div class="tl" role="log" aria-live="polite" aria-label="Messages"></div>'+composer({canned:o.canned,notes:admin,ph:o.ph})+"</div>";
    var L=$(".tl",box),TY=$(".ty",box);
    function mine(m){return m.sender_id===me.id}
    function paint(){var h="",last="",lo=-1,i;for(i=0;i<msgs.length;i++)if(mine(msgs[i])&&msgs[i].kind==="text")lo=i;
      var seen=lo>-1&&Object.keys(reads).some(function(k){return k!==me.id&&new Date(reads[k])>=new Date(msgs[lo].created_at)});
      msgs.forEach(function(m,j){var d=dayl(m.created_at);if(d!==last){h+='<div class="dy">'+d+"</div>";last=d}h+=bub(m,mine(m),j===lo&&seen)});
      L.innerHTML=h||'<div class="sy">'+ic("chat",14)+"Say hello to start the conversation.</div>"}
    function add(m){if(!m||!m.id||msgs.some(function(x){return x.id===m.id}))return;msgs.push(m);msgs.sort(function(a,b){return new Date(a.created_at)-new Date(b.created_at)});var near=L.scrollHeight-L.scrollTop-L.clientHeight<140;paint();if(near||mine(m)||first)L.scrollTop=L.scrollHeight;if(!mine(m)&&m.kind!=="note"&&m.sender_id)read()}
    function read(){Supa.rpc("chat_read",{p_conv:id}).catch(function(){})}
    function poll(){if(dead)return;var last=msgs.length?msgs[msgs.length-1].created_at:"1970-01-01T00:00:00Z";Supa.get("messages?conversation_id=eq."+id+"&created_at=gt."+encodeURIComponent(last)+"&order=created_at.asc").then(function(r){(r||[]).forEach(add)},function(){})}
    function startPoll(){if(!pl&&!dead)pl=setInterval(poll,4000)}
    var W2=wire(box,{canned:o.canned,notes:admin,ph:o.ph,
      send:function(v,note,undo){Supa.rpc("chat_send",{p_conv:id,p_body:v,p_note:!!note}).then(function(m){add(m)}).catch(function(e){undo();C.toast(e.message,true)})},
      typing:function(){if(ch)ch.send({type:"broadcast",event:"typing",payload:{u:me.id,n:admin?"Everneed Support":(me.name||"Someone")}})}});
    Promise.all([Supa.get("messages?conversation_id=eq."+id+"&select=*&order=created_at.asc&limit=300"),Supa.get("conversation_members?conversation_id=eq."+id+"&select=user_id,last_read_at")]).then(function(a){
      msgs=a[0]||[];(a[1]||[]).forEach(function(r){reads[r.user_id]=r.last_read_at});paint();L.scrollTop=L.scrollHeight;first=false;read();if(o.onLoad)o.onLoad(msgs);
      client().then(function(c){if(dead)return;ch=c.channel("chat:"+id)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+id},function(p){add(p.new)})
        .on("postgres_changes",{event:"UPDATE",schema:"public",table:"conversation_members",filter:"conversation_id=eq."+id},function(p){reads[p.new.user_id]=p.new.last_read_at;paint()})
        .on("broadcast",{event:"typing"},function(p){if(p.payload.u===me.id)return;TY.textContent=p.payload.n+" is typing...";clearTimeout(tyT);tyT=setTimeout(function(){TY.textContent=""},3000)})
        .subscribe(function(s){if(s==="SUBSCRIBED"){clearInterval(pl);pl=null}else if(s==="CHANNEL_ERROR"||s==="TIMED_OUT"||s==="CLOSED")startPoll()})}).catch(startPoll)
    }).catch(function(e){L.innerHTML='<div class="sy">'+ic("alert",14)+esc(e.message)+"</div>"});
    return{focus:W2.focus,destroy:function(){dead=true;clearInterval(pl);if(ch&&cl)cl.removeChannel(ch)}}}
  /* ---------- Guest chat (never stored) ---------- */
  function gmsg(m){return{id:m.id,body:m.text,kind:"text",sender_role:m.from==="agent"?"admin":"user",created_at:m.ts,who:m.from==="agent"?(m.name||"Everneed Support"):(m.name||"Visitor")}}
  function GuestSide(box,g,side,o){var ch=null,msgs=[],ids={},dead=false,L,TY,tyT=null,W3,me=C.me(),agentName=null;
    box.innerHTML='<div class="th"><div class="tl" role="log" aria-live="polite"></div>'+composer({ph:o.ph,canned:side==="agent"})+"</div>";L=$(".tl",box);TY=$(".ty",box);
    function paint(){var h="",last="";msgs.forEach(function(m){if(m.sys){h+='<div class="sy">'+ic("info",14)+esc(m.text)+"</div>";return}var d=dayl(m.ts);if(d!==last){h+='<div class="dy">'+d+"</div>";last=d}h+=bub(gmsg(m),m.from===side)});L.innerHTML=h;L.scrollTop=L.scrollHeight}
    function add(m){if(!m||!m.id||ids[m.id])return;ids[m.id]=1;msgs.push(m);paint();if(o.onMsg)o.onMsg(m)}
    function sys(t){add({id:rid(8),sys:true,text:t,ts:new Date().toISOString()})}
    function snd(ev,p){if(ch)ch.send({type:"broadcast",event:ev,payload:p})}
    W3=wire(box,{canned:side==="agent",ph:o.ph,
      send:function(v){var m={id:rid(10),from:side,text:v,ts:new Date().toISOString(),name:side==="agent"?agentName:o.name};add(m);snd("msg",m)},
      typing:function(){snd("typing",{from:side})}});
    client().then(function(c){if(dead)return;ch=c.channel("guest:"+g.id,{config:{broadcast:{self:false}}})
      .on("broadcast",{event:"msg"},function(p){add(p.payload)})
      .on("broadcast",{event:"typing"},function(p){if(p.payload.from===side)return;TY.textContent=(side==="agent"?"Visitor":"Everneed Support")+" is typing...";clearTimeout(tyT);tyT=setTimeout(function(){TY.textContent=""},3000)})
      .on("broadcast",{event:"join"},function(p){if(side==="guest"){agentName=p.payload.name;sys((p.payload.name||"A teammate")+" from Everneed joined the chat.");snd("sync",{msgs:msgs.filter(function(x){return x.from==="guest"})});if(o.onJoin)o.onJoin(p.payload.name)}})
      .on("broadcast",{event:"sync"},function(p){(p.payload.msgs||[]).forEach(add)})
      .on("broadcast",{event:"end"},function(){sys(side==="agent"?"The visitor ended the chat.":"The chat was ended by Everneed.");W3.disable();if(o.onEnd)o.onEnd()})
      .subscribe(function(s){if(s==="SUBSCRIBED"){if(o.ready)o.ready(function(ev,p){snd(ev,p)});if(side==="agent"){agentName=(me.name||"Everneed").split(" ")[0];snd("join",{name:agentName})}}else if(s==="CHANNEL_ERROR"||s==="TIMED_OUT"){sys("Live chat could not connect. Please try again.")}})}).catch(function(e){sys(e.message)});
    return{add:add,sys:sys,focus:W3.focus,end:function(){snd("end",{});W3.disable()},send:snd,destroy:function(){dead=true;if(ch&&cl)cl.removeChannel(ch)}}}
  /* ---------- Session-level realtime: unread badges, new visitors ---------- */
  function setBadge(n){document.querySelectorAll(".nbd").forEach(function(e){e.textContent=n>99?"99+":n;e.hidden=!n});var b=$("#cw .cwl .bdg");if(b){b.textContent=n>99?"99+":n;b.classList.toggle("z",!n)}}
  function refresh(){if(!uid)return;var me=C.me(),admin=me&&me.role==="admin";
    var p=admin?Supa.get("conversations?admin_unread=eq.true&select=id"):Supa.get("conversation_members?user_id=eq."+uid+"&select=unread");
    p.then(function(r){var n=admin?r.length:r.reduce(function(s,x){return s+(x.unread||0)},0);setBadge(n)}).catch(function(){})}
  function boot(me){if(!me||!me.id)return;if(booted&&uid===me.id)return;uid=me.id;booted=true;var admin=me.role==="admin",t=null;
    function ping(d){clearTimeout(t);t=setTimeout(function(){refresh();window.dispatchEvent(new CustomEvent("chat:change",{detail:d||{}}))},250)}
    client().then(function(c){var ch=c.channel("me:"+uid).on("postgres_changes",{event:"*",schema:"public",table:"conversation_members",filter:"user_id=eq."+uid},function(){ping()});
      if(admin)ch.on("postgres_changes",{event:"*",schema:"public",table:"conversations"},function(p){ping({conv:p.new&&p.new.id});if(p.eventType==="UPDATE"&&p.new.status==="escalated"&&p.old&&p.old.status!=="escalated"){C.toast("A chat was escalated to Everneed");beep()}})
        .on("postgres_changes",{event:"*",schema:"public",table:"support_queue"},function(p){ping({queue:1});if(p.eventType==="INSERT"){C.toast("A visitor is waiting for chat");beep()}});
      ch.subscribe()}).catch(function(){});
    refresh()}
  /* ---------- Support widget ---------- */
  var TOPICS=[["store","Open a store"],["tag","Pricing and plans"],["bell","Early access"],["help","Something else"]];
  function P(){return $("#cw .cwp")}
  function head(sub,back){return'<div class="cwh">'+(back?'<button class="ibx2 inv" data-w="home" aria-label="Back">'+ic("back",18)+"</button>":'<span class="itile inv">'+ic("chat",20)+"</span>")+'<div class="grow1"><b>Everneed Support</b><small>'+esc(sub||"We usually reply in a few minutes")+'</small></div><button class="ibx2 inv" data-w="close" aria-label="Close chat">'+ic("x",18,2)+"</button></div>"}
  function destroyViews(){if(W.th){W.th.destroy();W.th=null}if(W.g){W.g.destroy();W.g=null}if(W.ts){W.ts.remove();W.ts=null}if(W.offlineTs){W.offlineTs.remove();W.offlineTs=null}}
  function view(v){destroyViews();W.view=v;var p=P(),me=C.me();
    if(v==="home"){if(me&&me.id)return signedIn();
      p.innerHTML=head()+'<div class="cwb"><h3>Hi, how can we help?</h3><label class="cws">'+ic("search",18)+'<input id="cwq" placeholder="Search help articles" aria-label="Search help articles"></label><div id="cwr"></div><div class="tops">'+TOPICS.map(function(t){return'<button data-w="topic" data-t="'+esc(t[1])+'">'+ic(t[0],18)+t[1]+"</button>"}).join("")+'</div><button class="btn wide" data-w="name">'+ic("chat",18)+'Start live chat</button><p class="sm" style="margin-top:12px">Chats with visitors are not saved. <a href="#/login" data-w="close"><u>Sign in</u></a> to keep your history.</p></div>';
      $("#cwq").addEventListener("input",function(e){var r=KBSearch(e.target.value,3);$("#cwr").innerHTML=r.map(function(a){return"<details><summary>"+esc(a[1])+"</summary><p>"+esc(a[2])+"</p></details>"}).join("")+(e.target.value.length>2&&!r.length?'<p class="sm">No matching articles. A person can help: start a live chat.</p>':"")})}
    else if(v==="name"){p.innerHTML=head("Before we connect you",true)+'<div class="cwb"><h3>Your name</h3><p class="m">Optional. It helps our team greet you.</p><label class="lb"><input id="cwn" maxlength="40" autocomplete="given-name" placeholder="Your first name"></label><div id="cw-turnstile" style="margin-top:14px"></div><button class="btn wide" data-w="go" style="margin-top:18px">Connect me'+ic("arrow",18,2)+"</button></div>";$("#cwn").focus();Turnstile.mount($("#cw-turnstile"),"guest_open").then(function(w){W.ts=w}).catch(function(){C.toast("Security check could not load. Please try again.",true)})}
    else if(v==="guest")guestView();
    else if(v==="ask")askView();
    else if(v==="thread"){p.innerHTML=head("Your messages are saved",false).replace('data-w="home"','data-w="home"')+'<div class="cwt"></div><div class="cwf"><a href="#/inbox" data-w="close">All conversations</a></div>';W.th=Thread($(".cwt",p),W.conv,{ph:"Write a message"});W.th.focus()}}
  function guestView(){var p=P(),gid=W.gid;p.innerHTML=head("Connecting you to a person...",false)+'<div class="ntc">'+ic("info",14)+'This chat is not saved. <a href="#/login/new" data-w="close"><u>Create an account</u></a> to keep history.</div><div class="cwt"></div><div class="cwf"><button class="lnk" data-w="end">End chat</button></div>';
    var sub=$(".cwh small",p);
    W.g=GuestSide($(".cwt",p),{id:gid},"guest",{name:W.name,ph:"Type your message",onJoin:function(n){sub.textContent=(n||"A teammate")+" is here";clearTimeout(W.wait)},
      ready:function(send){send("hello",{name:W.name,topic:W.topic})}});
    W.g.sys("Hi"+(W.name?" "+W.name:"")+"! A teammate will join shortly. You can type your question now.");
    W.wait=setTimeout(function(){if(W.g)W.g.sys("Our team is busy right now. Keep this window open, or leave your email and we will write to you.");offlineForm()},90000)}
  function offlineForm(){var t=$(".cwf");if(!t||$("#cwe"))return;t.insertAdjacentHTML("afterbegin",'<form class="off" data-w="offline"><input id="cwe" type="email" required placeholder="Your email" aria-label="Your email"><div id="cw-offline-turnstile" style="margin:10px 0"></div><button class="btn s">Notify me</button></form>');Turnstile.mount($("#cw-offline-turnstile"),"waitlist").then(function(w){W.offlineTs=w}).catch(function(){C.toast("Security check could not load. Please try again.",true)})}
  function askView(){var p=P();p.innerHTML=head("Your messages are saved",false)+'<div class="cwb"><h3>How can we help?</h3><p class="m">Tell us what you need. Everneed support will reply here, and you will see the whole history any time.</p><label class="lb"><textarea id="cwa" rows="4" maxlength="2000" placeholder="Write your message"></textarea></label><button class="btn wide" data-w="first" style="margin-top:14px">Send'+ic("send",18,1.9)+'</button></div><div class="cwf"><a href="#/inbox" data-w="close">All conversations</a></div>';$("#cwa").focus()}
  function signedIn(){var p=P();p.innerHTML=head("Loading...",false)+'<div class="cwb"><div class="sy">'+ic("clock",14)+"One moment</div></div>";
    Promise.all([Supa.get("conversations?kind=in.(support,seller_admin)&created_by=eq."+uid+"&status=neq.resolved&select=id,kind,store_id&order=last_message_at.desc&limit=1"),Supa.get("stores?owner_id=eq."+uid+"&status=eq.approved&select=id,name&limit=1")]).then(function(a){
      W.store=a[1]&&a[1][0]||null;if(a[0]&&a[0][0]){W.conv=a[0][0].id;view("thread")}else view("ask")}).catch(function(e){p.innerHTML=head("Support")+'<div class="cwb"><div class="sy">'+ic("alert",14)+esc(e.message)+"</div></div>"})}
  function openW(on){W.open=on;var w=$("#cw");w.classList.toggle("open",on);$(".cwl",w).setAttribute("aria-expanded",on);if(on){if(!W.view||W.view==="home"||!P().innerHTML)view("home");else{}}}
  function widgetClick(e){var b=e.target.closest("[data-w]");if(!b)return;var a=b.getAttribute("data-w"),me=C.me();
    if(a==="close"){openW(false);return}
    e.preventDefault();
    if(a==="home")view("home");
    else if(a==="topic"){W.topic=b.getAttribute("data-t");var q=$("#cwq");q.value=W.topic;q.dispatchEvent(new Event("input"));q.focus()}
    else if(a==="name")view("name");
    else if(a==="go"){W.name=($("#cwn").value||"").trim().slice(0,40);W.gid=rid(24);var token;try{if(!W.ts)throw new Error("Security check is still loading");token=W.ts.take()}catch(x){C.toast(x.message,true);return}b.disabled=true;
      Supa.fn("public-forms",{action:"guest_open",token:token,p_id:W.gid,p_name:W.name||null,p_topic:W.topic||"Live chat",p_page:location.hash.slice(0,100)}).then(function(){view("guest");W.ping=setInterval(function(){if(!W.g){clearInterval(W.ping);return}Supa.fn("public-forms",{action:"guest_ping",p_id:W.gid}).catch(function(){})},25000)}).catch(function(x){if(W.ts)W.ts.reset();b.disabled=false;C.toast(x.message,true)})}
    else if(a==="end"){if(W.g)W.g.end();Supa.fn("public-forms",{action:"guest_close",p_id:W.gid}).catch(function(){});clearInterval(W.ping);clearTimeout(W.wait);W.gid=null;W.name="";view("home")}
    else if(a==="first"){var v=($("#cwa").value||"").trim();if(!v){C.toast("Write your message first",true);return}b.disabled=true;
      Supa.rpc("chat_start",{p_kind:W.store?"seller_admin":"support",p_store:W.store?W.store.id:null,p_first:v}).then(function(id){W.conv=id;view("thread")}).catch(function(x){b.disabled=false;C.toast(x.message,true)})}}
  function widgetSubmit(e){var f=e.target.closest("[data-w=offline]");if(!f)return;e.preventDefault();var em=$("#cwe").value,token;try{if(!W.offlineTs)throw new Error("Security check is still loading");token=W.offlineTs.take()}catch(x){C.toast(x.message,true);return}var b=f.querySelector("button");b.disabled=true;Supa.fn("public-forms",{action:"waitlist",token:token,p_email:em,p_role:"both",p_interest:"Wants a reply to a live chat",p_source:"support-callback"}).then(function(){if(W.offlineTs){W.offlineTs.remove();W.offlineTs=null}f.outerHTML='<p class="sm">Thanks. We will email you.</p>'}).catch(function(x){if(W.offlineTs)W.offlineTs.reset();b.disabled=false;C.toast(x.message,true)})}
  function mount(layout){document.body.classList.toggle("nochat",layout!=="pub");if($("#cw"))return;var d=document.createElement("div");d.id="cw";d.innerHTML='<div class="cwp" role="dialog" aria-label="Support chat"></div><button class="cwl" aria-label="Open support chat" aria-expanded="false">'+ic("chat",26,1.8)+'<i class="bdg z">0</i></button>';document.body.appendChild(d);
    $(".cwl",d).addEventListener("click",function(){openW(!W.open)});d.addEventListener("click",widgetClick);d.addEventListener("submit",widgetSubmit);
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&W.open)openW(false)})}
  A=C.A;A.chat=function(){mount("pub");openW(true)};
  return{client:client,boot:boot,mount:mount,refresh:refresh,Thread:Thread,GuestSide:GuestSide,bub:bub,beep:beep,hm:hm,rid:rid,setBadge:setBadge,open:function(){mount("pub");openW(true)}};
})();
