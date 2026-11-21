/* App shell for the seller workspace and the admin console.
   Phones: slim top bar (brand, bell, account tile) and a bottom tab bar. Desktop: the same items as a left rail.
   Focused pages (store setup) get a plain header with one account menu instead of loose buttons.
   Icons are inline SVG drawn here so nothing depends on the shared icon set. */
(function(){
  var C=Core,A=C.A,esc=C.esc,AX={};
  var P={
    home:'<path d="M4 11l8-7 8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9"/>',
    box:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    chat:'<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    bell:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
    store:'<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5 12v8h14v-8"/>',
    chart:'<path d="M5 20V11M12 20V4M19 20v-6"/>',
    clip:'<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9.5 13l2 2 3.5-4"/>',
    exit:'<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 8l4 4-4 4M19 12H9"/>',
    chev:'<path d="M9 6l6 6-6 6"/>',
    palette:'<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.3-2.5 1.7-2.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8" r="1"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
    sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    card:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
    x:'<path d="M6 6l12 12M18 6L6 18"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>'
  };
  AX.icon=function(n,s){s=s||22;return'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(P[n]||"")+"</svg>"};
  function initial(me){return(String(me&&(me.name||me.email)||"E").trim().charAt(0)||"E").toUpperCase()}
  function bell(){return'<button type="button" class="ax-btn" data-act="notif" aria-label="Notifications" aria-haspopup="dialog">'+AX.icon("bell",22)+'<span class="ax-badge" hidden>0</span></button>'}
  AX.bell=bell;
  function brand(href){return'<a class="ax-brand" href="'+href+'"><img src="/favicon.svg" alt="" width="28" height="28"><span>Everneed</span></a>'}

  var NAV={
    portal:[["portal","Home","home","/portal"],["portal/products","Products","box","/portal/products"],["inbox","Messages","chat","/inbox",1],["me","Me","user","/me"]],
    admin:[["admin","Overview","chart","/admin"],["admin/sellers","Sellers","store","/admin/sellers"],["admin/review","Review","clip","/admin/review"],["inbox","Inbox","chat","/inbox",1],["me","Me","user","/me"]]
  };
  function current(kind,active){
    var a=String(active||"");
    if(a==="inbox")return"inbox";
    if(kind==="admin"){if(a==="admin")return"admin";if(a.indexOf("admin/sellers")===0)return"admin/sellers";if(a==="admin/review")return"admin/review";return"me"}
    if(a==="portal"||a==="portal/apply")return"portal";
    if(a.indexOf("portal/product")===0)return"portal/products";
    return"me";
  }
  AX.shell=function(kind,active,inner,me){
    var items=NAV[kind]||NAV.portal,cur=current(kind,active),home=kind==="admin"?"/admin":"/portal";
    function link(n,cls){return'<a href="'+n[3]+'"'+(n[0]===cur?' class="on" aria-current="page"':"")+">"+AX.icon(n[2],cls)+"<span>"+n[1]+"</span>"+(n[4]?'<span class="nbd" hidden>0</span>':"")+"</a>"}
    return'<div class="ax" data-kind="'+kind+'"><header class="ax-top">'+brand(home)+'<span class="ax-ctx">'+(kind==="admin"?"Admin":"Seller")+'</span><span class="ax-sp"></span>'+bell()
      +'<a class="ax-me" href="/me" aria-label="Me">'+esc(initial(me))+"</a></header>"
      +'<aside class="ax-rail"><nav aria-label="Sections">'+items.map(function(n){return link(n,22)}).join("")+"</nav></aside>"
      +'<section class="main" id="main">'+inner+"</section>"
      +'<nav class="ax-tabs" style="--n:'+items.length+'" aria-label="Sections">'+items.map(function(n){return link(n,24)}).join("")+"</nav></div>";
  };
  /* Focused pages (store setup): brand on the left, one account tile on the right. */
  AX.setup=function(inner,me){
    return'<header class="ax-top ax-plain">'+brand("/")+'<span class="ax-sp"></span>'+bell()
      +'<button type="button" class="ax-me" data-act="axme" aria-label="Account menu" aria-haspopup="true" aria-expanded="false">'+esc(initial(me))+"</button>"
      +'<div class="ax-pop" id="axpop" hidden><p class="ax-pn"><b>'+esc(me&&me.name||"Your account")+"</b><small>"+esc(me&&me.email||"")+'</small></p><a href="/account">Back to Everneed</a><button type="button" data-act="out">Sign out</button></div></header>'
      +'<main><div class="w" style="max-width:820px;padding-top:24px;padding-bottom:80px">'+inner+"</div></main>";
  };
  A.axme=function(b){var p=document.getElementById("axpop");if(!p)return;var open=p.hidden;p.hidden=!open;b.setAttribute("aria-expanded",String(open))};
  document.addEventListener("click",function(e){var p=document.getElementById("axpop");if(!p||p.hidden)return;if(e.target.closest("#axpop")||e.target.closest('[data-act="axme"]'))return;p.hidden=true;var b=document.querySelector('[data-act="axme"]');if(b)b.setAttribute("aria-expanded","false")});
  document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;var p=document.getElementById("axpop");if(p&&!p.hidden){p.hidden=true;var b=document.querySelector('[data-act="axme"]');if(b){b.setAttribute("aria-expanded","false");b.focus()}}});
  window.AX=AX;
})();
