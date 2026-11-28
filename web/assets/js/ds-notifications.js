/* Notifications centre for sellers (WEB-S12). Loaded on demand by ds-lazy.js for /portal/notifications.
   Everything shown is real: rows in `notifications` addressed to the signed-in person (always filtered by user_id, because the table
   policy also lets admins read everyone's). Newest first, grouped Today / Yesterday / Earlier, with an Unread filter, "Load more" and
   "Mark all as read". Marking read only sets read_at on the person's own rows (the existing "notifications mark read" policy).
   Nothing is created or invented here. A row opens its destination only when one exists; otherwise it is a plain row. */
(function(){
  var C=window.Core,D=window.DS,esc=C.esc,V=C.V,A=C.A,old=V.portal,PAGE=25;
  if(!D||!old)return;
  var S={items:[],unread:false,more:false,busy:false,err:false};
  var KIND={
    new_order:["receipt","New order"],handover_pending:["box","Handover"],hub_issue:["alert","Hub check"],refund_due:["alert","Refund"],
    refund_approved:["receipt","Refund"],refund_processed:["receipt","Refund"],order_update:["receipt","Order"],payment_confirmed:["okc","Payment"],
    out_for_delivery:["box","Delivery"],delivered:["okc","Delivery"],product_publish:["box","Product"],store_approved:["okc","Your store"],
    store_submitted:["clock","Your store"],message:["chat","Message"],message_customer:["chat","Message"]
  };
  function dest(n){
    var d=n.data||{},u=d.url;if(typeof u==="string"&&u.charAt(0)==="/"&&u.charAt(1)!=="/")return u;
    if(n.kind==="store_approved")return"/portal";
    if(d.seller_order_id&&/^(new_order|handover_pending|hub_issue|refund_due)$/.test(n.kind))return"/portal/orders";
    if(n.kind==="product_publish")return"/portal/products";
    return"";
  }
  function day(t){var d=new Date(t),n=new Date(),a=new Date(d.getFullYear(),d.getMonth(),d.getDate()),b=new Date(n.getFullYear(),n.getMonth(),n.getDate()),k=Math.round((b-a)/864e5);return k<=0?"Today":k===1?"Yesterday":"Earlier"}
  function rowOf(n){
    var k=KIND[n.kind]||["bell","Update"],h=dest(n),un=!n.read_at;
    var o={icon:k[0],title:n.title||k[1],sub:(n.body?n.body+" · ":"")+C.ago(n.created_at),end:un?D.chip("New","ok"):""};
    if(h)o.href=h;
    var html=D.row(o);
    return un?html.replace(/^<(a|div) /,'<$1 data-nid="'+esc(n.id)+'" '):html;
  }
  function list(){
    if(S.err&&!S.items.length)return D.banner("warning","Could not load notifications","Check your connection and try again.",{label:"Try again",act:"nc-retry"});
    if(!S.items.length)return D.empty(S.unread?{icon:"okc",title:"You are all caught up",text:"No unread notifications."}:{icon:"bell",title:"No notifications yet",text:"Orders, product reviews, refunds and messages will appear here."});
    var out="",g="";
    S.items.forEach(function(n){var d=day(n.created_at);if(d!==g){g=d;out+=(out?"</div>":"")+'<div class="ds-h"><h2>'+d+'</h2></div><div class="ds-rows">'}out+=rowOf(n)});
    out+="</div>";
    if(S.err)out+=D.banner("warning","Could not load more","Try again.",{label:"Try again",act:"nc-more"});
    else if(S.more)out+='<div class="ds-actions" style="justify-content:center"><button type="button" class="ds-btn o" data-act="nc-more"'+(S.busy?" disabled":"")+">"+(S.busy?"Loading":"Load more")+"</button></div>";
    return out;
  }
  function unreadCount(){return S.items.filter(function(n){return!n.read_at}).length}
  function paint(){
    var el=document.getElementById("ncl");if(el)el.innerHTML=list();
    var b=document.getElementById("ncall");if(b)b.hidden=!unreadCount();
  }
  function fetchPage(reset){
    if(S.busy)return Promise.resolve();S.busy=true;S.err=false;if(reset){S.items=[];S.more=false}
    var q="notifications?select=*&user_id=eq."+encodeURIComponent(Supa.uid())+(S.unread?"&read_at=is.null":"")+"&order=created_at.desc&limit="+(PAGE+1)+"&offset="+S.items.length;
    return Supa.get(q).then(function(r){r=Array.isArray(r)?r:[];S.more=r.length>PAGE;S.items=S.items.concat(r.slice(0,PAGE))}).catch(function(){S.err=true}).then(function(){S.busy=false;paint()});
  }
  function head(){
    return'<div class="sech"><h1 style="font-size:2.2rem">Notifications</h1><button type="button" class="ds-btn o s" id="ncall" data-act="nc-all" hidden>Mark all as read</button></div>'
      +'<div id="ncseg">'+seg()+"</div>";
  }
  function seg(){return D.seg([{label:"All",act:"nc-all-f",on:!S.unread},{label:"Unread",act:"nc-unread-f",on:S.unread}],"Filter notifications")}
  A["nc-retry"]=function(){fetchPage(true)};
  A["nc-more"]=function(){fetchPage(false)};
  function setF(u){if(S.unread===u)return;S.unread=u;var s=document.getElementById("ncseg");if(s)s.innerHTML=seg();var l=document.getElementById("ncl");if(l)l.innerHTML=D.skel("card",3);fetchPage(true)}
  A["nc-all-f"]=function(){setF(false)};A["nc-unread-f"]=function(){setF(true)};
  A["nc-all"]=function(){
    var ids=S.items.filter(function(n){return!n.read_at}),now=new Date().toISOString();if(!ids.length)return;
    var fails=0,left=ids.length;
    ids.forEach(function(n){n.read_at=now;Supa.patch("notifications",n.id,{read_at:now}).catch(function(){n.read_at=null;fails++}).then(function(){if(--left===0){if(fails)C.toast("Some notifications could not be marked as read",true);if(S.unread||S.more)fetchPage(true);else paint()}})});
    paint();
  };
  /* tapping an unread row marks it read, then the link (if any) opens as normal */
  document.addEventListener("click",function(e){
    var r=e.target.closest&&e.target.closest("[data-nid]");if(!r||!document.getElementById("ncl")||!document.getElementById("ncl").contains(r))return;
    var id=r.getAttribute("data-nid"),n=S.items.filter(function(x){return String(x.id)===id})[0];if(!n||n.read_at)return;
    n.read_at=new Date().toISOString();Supa.patch("notifications",id,{read_at:n.read_at}).catch(function(){n.read_at=null});
    if(!r.getAttribute("href"))paint();
  });
  V.portal=function(p){
    if(p[0]!=="notifications"||!Supa.uid())return old(p);
    S.unread=false;
    return Promise.resolve({layout:"portal",active:"portal/notifications",title:"Notifications",html:head()+'<div id="ncl">'+D.skel("card",4)+"</div>",after:function(){fetchPage(true)}});
  };
})();
