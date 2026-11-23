/* Notification centre. Everything shown is real data:
   - unread conversations (conversation_members.unread for members, admin_unread for admins), so a buyer, admin or any other message appears here;
   - rows in notifications addressed to the signed-in person (filtered to this person, admins included).
   While Everneed is open the page checks every 30 seconds, when the tab regains focus and whenever the chat layer reports a change.
   A new item shows a toast, and a browser alert if the person allowed alerts and the tab is in the background.
   Alerts while the site is closed need web push, which the backend does not offer yet (see the handoff document). */
(function(){
  var C=Core,A=C.A,esc=C.esc,AX=window.AX,N={items:[],convs:[],seen:null,first:true,open:false,last:null,busy:false};
  var KIND={store:"Customer",support:"Support",seller_admin:"Everneed",admin_user:"Everneed"};
  function uid(){return Supa.uid()}
  function isAdmin(){var m=C.me();return!!(m&&m.role==="admin")}
  function soft(){return[]}
  function seen(){if(N.seen)return N.seen;try{N.seen=JSON.parse(sessionStorage.getItem("en_seen")||"{}")}catch(e){N.seen={}}return N.seen}
  function saveSeen(){try{sessionStorage.setItem("en_seen",JSON.stringify(N.seen))}catch(e){}}
  function unreadN(){return N.items.filter(function(n){return!n.read_at}).length}
  function unreadC(){return N.convs.length}
  function total(){return unreadN()+unreadC()}

  function fetchAll(){
    if(!uid()||N.busy)return Promise.resolve();
    N.busy=true;
    var nq=Supa.get("notifications?select=*&user_id=eq."+encodeURIComponent(uid())+"&order=created_at.desc&limit=20").catch(soft);
    var F="id,kind,subject,last_preview,last_message_at,order_id,priority,status";
    var cq=isAdmin()?Supa.get("conversations?select="+F+"&admin_unread=eq.true&order=last_message_at.desc&limit=15").catch(soft)
      :Supa.get("conversation_members?select=conversation_id,unread&user_id=eq."+encodeURIComponent(uid())+"&unread=gt.0").then(function(m){
        if(!m||!m.length)return[];var by={};m.forEach(function(x){by[x.conversation_id]=x.unread});
        return Supa.get("conversations?select="+F+"&id=in.("+Object.keys(by).map(encodeURIComponent).join(",")+")&order=last_message_at.desc&limit=15").then(function(l){return(l||[]).map(function(c){c.unread=by[c.id];return c})});
      }).catch(soft);
    return Promise.all([nq,cq]).then(function(a){
      N.items=a[0]||[];N.convs=a[1]||[];N.busy=false;alertNew();paint();if(N.open)render();
    },function(){N.busy=false});
  }
  /* New since the last check: toast, plus a browser alert when the tab is in the background and alerts are allowed. */
  function alertNew(){
    var s=seen(),fresh=[];
    N.items.forEach(function(n){var k="n:"+n.id;if(!s[k]){s[k]=1;if(!n.read_at)fresh.push({t:n.title,b:n.body||"",tag:k})}});
    N.convs.forEach(function(c){var k="c:"+c.id+":"+c.last_message_at;if(!s[k]){s[k]=1;fresh.push({t:(KIND[c.kind]||"New")+" message",b:c.last_preview||c.subject||"",tag:k})}});
    saveSeen();
    if(N.first){N.first=false;return}
    fresh.slice(0,3).forEach(function(f){
      if(document.hidden&&window.Notification&&Notification.permission==="granted"){try{new Notification(f.t,{body:f.b,tag:f.tag,icon:"/favicon.svg"})}catch(e){}}
      else C.toast(f.t+(f.b?": "+f.b:""));
    });
  }
  function paint(){
    var n=total(),txt=n>99?"99+":String(n);
    document.querySelectorAll(".ax-badge").forEach(function(b){b.textContent=txt;b.hidden=!n});
    document.querySelectorAll(".nbd").forEach(function(b){var c=unreadC();b.textContent=c>99?"99+":String(c);b.hidden=!c});
    document.querySelectorAll('[data-act="notif"]').forEach(function(b){b.setAttribute("aria-label",n?"Notifications, "+n+" unread":"Notifications")});
    var t=document.title.replace(/^\(\d+\+?\)\s/,"");document.title=n?"("+(n>99?"99+":n)+") "+t:t;
  }
  function perm(){
    if(!window.Notification)return"";
    var p=Notification.permission;
    if(p==="granted")return'<p class="nt-perm">Alerts are on for this device while Everneed is open.</p>';
    if(p==="denied")return'<p class="nt-perm">Alerts are blocked in your browser settings for this site.</p>';
    return'<div class="nt-perm"><span>Get an alert when a message arrives while Everneed is open in a tab.</span><button type="button" class="btn o s" data-act="notifperm">Turn on alerts</button></div>';
  }
  function dest(n){
    var u=n.data&&n.data.url;if(typeof u==="string"&&u.charAt(0)==="/"&&u.charAt(1)!=="/")return u;
    if(n.kind==="store_approved")return"/portal";if(n.kind==="store_submitted")return"/admin/sellers";return"";
  }
  function I(n,z){return window.DS&&DS.icon?DS.icon(n,z):AX.icon(n,z)}
  function kic(k){k=String(k||"");return/message|chat/.test(k)?"chat":/order/.test(k)?"receipt":/store|seller|application/.test(k)?"store":/plan|payout|billing|payment/.test(k)?"card":/product|review/.test(k)?"box":"bell"}
  function row(href,icon,title,sub,when,dot,attrs){
    var inner='<span class="nt-ic">'+I(icon,20)+'</span><span class="nt-tx"><b>'+esc(title)+"</b>"+(sub?"<small>"+esc(sub)+"</small>":"")+'</span><span class="nt-mt">'+(when?"<time>"+esc(when)+"</time>":"")+(dot?'<i class="nt-dot" aria-label="Unread"></i>':"")+"</span>";
    return href?'<a class="nt-row'+(dot?" un":"")+'" href="'+href+'" '+(attrs||"")+">"+inner+"</a>":'<div class="nt-row'+(dot?" un":"")+'" '+(attrs||"")+">"+inner+"</div>";
  }
  function render(){
    var el=document.getElementById("ax-notif");if(!el)return;
    var body=el.querySelector(".nt-body"),msgs=N.convs.map(function(c){
      return row("/inbox/"+encodeURIComponent(c.id),"chat",(KIND[c.kind]||"Message")+(c.subject?" · "+c.subject:""),c.last_preview||"New message",C.ago(c.last_message_at),true,'data-act="notifclose"');
    }).join("");
    var shown=N.f==="unread"?N.items.filter(function(n){return!n.read_at}):N.items;
    var ups=shown.map(function(n){
      var d=dest(n);return row(d,kic(n.kind),n.title,n.body||"",C.ago(n.created_at),!n.read_at,'data-act="notifread" data-id="'+esc(n.id)+'" data-to="'+esc(d)+'"');
    }).join("");
    var seg=N.items.length?'<div class="nt-f" role="group" aria-label="Filter updates"><button type="button" data-act="notiff" data-f="all" aria-pressed="'+(N.f!=="unread")+'">All</button><button type="button" data-act="notiff" data-f="unread" aria-pressed="'+(N.f==="unread")+'">Unread'+(unreadN()?" "+unreadN():"")+"</button></div>":"";
    body.innerHTML=seg+(msgs?'<h3 class="nt-h">Messages</h3>'+msgs:"")+(ups?'<h3 class="nt-h">Updates</h3>'+ups:"")
      +(!msgs&&!ups?'<div class="nt-empty"><b>You are all caught up</b><p>New messages and updates will appear here.</p></div>':"")+perm();
    var all=el.querySelector('[data-act="notifall"]');if(all)all.hidden=!unreadN();
  }
  function openPanel(){
    if(document.getElementById("ax-notif"))return;
    var el=document.createElement("div");el.id="ax-notif";el.className="ax-sheet";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label","Notifications");
    el.innerHTML='<div class="ax-sheet-bd" data-act="notifclose"></div><section class="ax-sheet-pn"><header><h2>Notifications</h2><button type="button" class="ax-txt" data-act="notifall">Mark all read</button><button type="button" class="ax-btn" data-act="notifclose" aria-label="Close notifications">'+AX.icon("x",22)+'</button></header><div class="nt-body"></div></section>';
    document.body.appendChild(el);document.body.classList.add("ax-lock");N.open=true;N.last=document.activeElement;render();
    var c=el.querySelector('.ax-sheet-pn [data-act="notifclose"]');if(c)c.focus();fetchAll();
  }
  function closePanel(){
    var el=document.getElementById("ax-notif");if(el)el.remove();document.body.classList.remove("ax-lock");N.open=false;
    if(N.last&&N.last.focus&&document.body.contains(N.last))N.last.focus();N.last=null;
  }
  A.notiff=function(b){N.f=b.getAttribute("data-f");render()};
  A.notif=function(){N.open?closePanel():openPanel()};
  A.notifclose=function(){closePanel()};
  A.notifperm=function(){
    if(!window.Notification)return;
    Notification.requestPermission().then(function(){render();var m=document.querySelector(".me-alert");if(m)m.textContent=alertState()});
  };
  A.notifread=function(b){
    var id=b.getAttribute("data-id"),n=N.items.filter(function(x){return x.id===id})[0],to=b.getAttribute("data-to");
    if(n&&!n.read_at){n.read_at=new Date().toISOString();Supa.patch("notifications",id,{read_at:n.read_at}).catch(function(){n.read_at=null;paint();render()});paint();render()}
    if(to)closePanel();
  };
  A.notifall=function(){
    var ids=N.items.filter(function(n){return!n.read_at});if(!ids.length)return;var now=new Date().toISOString();
    ids.forEach(function(n){n.read_at=now;Supa.patch("notifications",n.id,{read_at:now}).catch(function(){})});paint();render();
  };
  function alertState(){if(!window.Notification)return"Not supported by this browser";var p=Notification.permission;return p==="granted"?"On while Everneed is open":p==="denied"?"Blocked in browser settings":"Off"}
  window.Notify={refresh:fetchAll,alertState:alertState,counts:function(){return{messages:unreadC(),updates:unreadN()}}};

  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&N.open)closePanel()});
  window.addEventListener("chat:change",function(){fetchAll()});
  document.addEventListener("visibilitychange",function(){if(!document.hidden)fetchAll()});
  setInterval(function(){if(!document.hidden)fetchAll()},30000);
  var root=document.getElementById("root"),t=null;
  if(root)new MutationObserver(function(){clearTimeout(t);t=setTimeout(function(){paint();if(uid()&&N.items.length===0&&N.convs.length===0)fetchAll()},40)}).observe(root,{childList:true});
  if(uid())fetchAll();
})();
