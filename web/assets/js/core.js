/* Core: helpers, router, layouts, appearance panel. Theme itself comes from the app's js/theme.js (copied at build).
   Routing uses real paths (/portal/products). Old #/ links and hash writes are converted automatically (see legacy and the history shim),
   so files can be moved to real paths one at a time. */
window.Core=(function(){
  var V={},A={},F={},me=null,ic=Ico.svg,rt=null;
  /* Anything older code writes as "#/x" (history.replaceState, pushState) becomes a real path "/x". */
  ["pushState","replaceState"].forEach(function(k){var o=history[k];history[k]=function(s,t,u){if(typeof u==="string"&&u.indexOf("#/")===0)u=u.slice(1);return o.call(history,s,t,u)}});
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function $(s,r){return(r||document).querySelector(s)}
  function money(n){try{return new Intl.NumberFormat("en-NG",{style:"currency",currency:CFG.baseCurrency,maximumFractionDigits:0}).format(n||0)}catch(e){return"₦"+(n||0)}}
  function when(t){return t?new Date(t).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):""}
  function ago(t){var s=Math.max(1,Math.round((Date.now()-new Date(t).getTime())/1000));if(s<60)return"just now";if(s<3600)return Math.round(s/60)+" min ago";if(s<86400)return Math.round(s/3600)+" h ago";return Math.round(s/86400)+" d ago"}
  function toast(m,err){var t=$("#toast");if(!t){t=document.createElement("div");t.id="toast";t.setAttribute("role",err?"alert":"status");t.setAttribute("aria-live",err?"assertive":"polite");document.body.appendChild(t)}t.innerHTML='<span class="toast-icon">'+ic(err?"alert":"check",18)+'</span><span class="toast-copy"><b>'+(err?"Please check this":"Everneed")+'</b><small>'+esc(m)+'</small></span><span class="toast-progress"></span>';t.className=err?"toast-error show":"show";clearTimeout(t._t);t._t=setTimeout(function(){t.className=""},4800)}

  function ask(title,label,required){return new Promise(function(res){var d=document.createElement("dialog");
    d.innerHTML='<form method="dialog"><h3>'+esc(title)+'</h3><label class="lb">'+esc(label)+'<textarea rows="4" maxlength="300"'+(required?' required minlength="3"':"")+'></textarea></label><div class="row"><button class="btn o s" value="x" formnovalidate>Cancel</button><button class="btn s" value="ok">Confirm</button></div></form>';
    document.body.appendChild(d);d.addEventListener("close",function(){var v=d.returnValue==="ok"?$("textarea",d).value.trim():null;d.remove();res(v)});d.showModal()})}
  function logo(){return'<a class="logo" href="/"><img src="/favicon.svg" alt="" width="30" height="30"><span>Everneed</span></a>'}
  function empty(t,s){return'<div class="empty"><b>'+esc(t)+"</b>"+(s?"<p>"+esc(s)+"</p>":"")+"</div>"}
  function appearance(){var T=window.Theme,m=T.mode(),p=T.palette(),dark=T.resolved()!=="light",am=localStorage.getItem("en_amoled")==="1";
    return'<div class="card"><h3>Mode</h3><div class="seg" role="radiogroup" aria-label="Mode">'+["system","light","dark"].map(function(x){return'<input type="radio" name="tmode" id="tm-'+x+'" value="'+x+'" data-tact="mode"'+(m===x?" checked":"")+'><label for="tm-'+x+'">'+x.charAt(0).toUpperCase()+x.slice(1)+"</label>"}).join("")+"</div>"
      +'<div class="sw"><span><b>AMOLED black</b><small style="display:block">'+(dark?"Pure black background in dark mode.":"Available in dark mode.")+'</small></span><button type="button" role="switch" aria-label="AMOLED black" aria-checked="'+(am&&dark)+'" data-tact="amoled"'+(dark?"":" disabled")+"></button></div>"
      +'<h3 style="margin-top:12px">Colour</h3><div class="swgrid" role="radiogroup" aria-label="Colour">'+T.palettes.map(function(x){return'<button type="button" class="swatch" role="radio" aria-checked="'+(p===x[0])+'" data-tact="pal" data-v="'+x[0]+'"><span class="dots2"><i style="background:'+x[3]+'"></i><i style="background:'+x[4]+'"></i></span><span><b>'+x[1]+"</b><small>"+esc(x[2])+"</small></span></button>"}).join("")+'</div><p class="sm" style="margin-top:14px">Saved in this browser'+(Supa.uid()?" and to your account, so it follows you to the app.":". Sign in to keep it on every device.")+"</p></div>"}

  /* Who is signed in and where their own page is. A signed-in person is never shown Sign in or Create account. */
  function intent(){var r=String(me&&me.role||"customer").toLowerCase();return{role:r,home:r==="admin"?"/admin":(r==="merchant"||r==="seller"?"/portal":"/account"),label:r==="customer"?"My account":"Dashboard",store:r==="customer"?"/portal/apply":"/portal"}}
  function signedIn(){return!!(me||Supa.uid())}
  /* Public pages: Home, About, How it works, For sellers, Help, then Sign in and Create account (only when signed out). Shopping happens in the app, so Shop goes to the app page. */
  function pub(inner,active){var L=[["","Home","home"],["about","About","info"],["how-it-works","How it works","help"],["sell","For sellers","store"],["help","Help","help"]],
      nav=L.map(function(n){var on=n[0]===""?curPath()==="/":active===n[0];return'<a href="/'+n[0]+'"'+(on?' class="on"':"")+">"+n[1]+"</a>"}).join(""),
      i=intent(),home=i.home,role=i.role,
      acct=me?'<a class="btn s hide-m" href="'+home+'">'+i.label+'</a>':'<a class="btn o s hide-m" href="/sign-in">Sign in</a><a class="btn s hide-m" href="/create-account">Create account</a>',
      dr=L.map(function(n){return'<a href="/'+n[0]+'">'+ic(n[2],20)+n[1]+'</a>'}).join("")+'<a href="/shop">'+ic("bag",20)+'Shop in the app</a><a href="/pricing">'+ic("tag",20)+'Plans</a><a href="/appearance">'+ic("palette",20)+'Theme and colour</a>'+(me?'<a class="btn" href="'+home+'">'+ic("dash",18)+i.label+'</a><button class="btn o" data-act="out">'+ic("exit",16)+'Sign out</button>':'<a href="/sign-in">'+ic("me",20)+'Sign in</a><a class="btn" href="/create-account">'+ic("me",18)+'Create account</a>'),
      acctCol=me?'<a href="'+home+'">'+i.label+'</a><a href="/appearance">Theme and colour</a>':'<a href="/sign-in">Sign in</a><a href="/create-account">Create account</a><a href="/appearance">Theme and colour</a>';
    return'<header class="top"><div class="w nav">'+logo()+'<nav aria-label="Main">'+nav+'</nav><span class="sp"></span><a class="btn o s hide-m" href="/shop">Shop in app</a><button class="ib" data-tact="quick" aria-label="Switch light or dark"></button><a class="btn o s hide-m" href="/appearance">'+ic("palette",16)+"Theme</a>"+acct
      +'<button class="ib menu-b" data-act="menu" aria-label="Menu">'+ic("menu",20,1.8)+'</button></div><div class="drawer">'+dr+"</div></header><main>"+inner+'</main>'
      +'<footer class="foot"><div class="w"><div class="fg"><div>'+logo()+'<p class="m" style="margin-top:12px;max-width:30ch">One marketplace for shoppers and independent sellers. Shopping happens in the Everneed app.</p></div>'
      +'<div><h4>Explore</h4><a href="/shop">Shop in the app</a><a href="/how-it-works">How it works</a><a href="/sell">For sellers</a><a href="/pricing">Plans</a></div><div><h4>Company</h4><a href="/about">About</a><a href="/help">Help</a><a href="/early-access">Early access</a></div><div><h4>Account</h4>'+acctCol+'</div></div><div class="cp sm">© 2026 Everneed</div></div></footer>'}
  /* Pages written before sign-in state was known still contain fixed "Create account" buttons. For a signed-in person they are rewritten here to lead somewhere useful, so no page can ever invite an existing member to create an account. */
  function adapt(root){
    if(!signedIn()||!root)return;
    var i=intent();
    root.querySelectorAll('a[href="/sign-in"]').forEach(function(a){if(a.parentNode)a.parentNode.removeChild(a)});
    root.querySelectorAll(".band").forEach(function(b){if(!b.querySelector('a[href="/create-account"]'))return;b.innerHTML='<h2 class="h2x" style="max-width:none;margin:auto">Good to have you here.</h2><p>Your Everneed account is ready.</p><a class="btn" href="'+i.home+'">'+i.label+"</a>"});
    root.querySelectorAll('a[href="/create-account"]').forEach(function(a){
      var t=a.textContent||"";
      if(/store|sell/i.test(t)){a.setAttribute("href",i.store);a.textContent=i.role==="customer"?"Open your store":"Go to my store"}
      else{a.setAttribute("href",i.home);a.textContent=i.label}
    });
  }
  /* Seller setup: a focused page. No Products, Messages or Orders while a store is still being set up. */
  function setup(inner){return'<header class="top"><div class="w nav">'+logo()+'<span class="sp"></span><a class="btn o s" href="/account">Back to Everneed</a><button class="btn o s" data-act="out">'+ic("exit",16)+'Sign out</button></div></header><main><div class="w" style="max-width:820px;padding-top:24px;padding-bottom:80px">'+inner+"</div></main>"}
  function shell(kind,active,inner){var nav=kind==="admin"?[["admin","Overview","dash"],["inbox","Inbox","chat",1],["admin/applications","Applications","mail"],["admin/review","Product review","check"],["admin/stores","Stores","shop"],["admin/waitlist","Waitlist","users"],["supportset","Support settings","set"],["admin/appearance","Appearance","palette"]]:[["portal","Dashboard","dash"],["inbox","Messages","chat",1],["portal/products","Products","box"],["portal/verification","Verification","check"],["portal/appearance","Appearance","palette"]];
    return'<div class="shell"><aside class="side">'+logo()+'<small class="who">'+(kind==="admin"?"Admin console":"Seller portal")+'</small><nav aria-label="Sections">'+nav.map(function(n){return'<a href="/'+n[0]+'"'+(n[0]===active?' class="on"':"")+">"+ic(n[2],20)+n[1]+(n[3]?'<span class="nbd" hidden>0</span>':"")+"</a>"}).join("")+'</nav><div class="grow"></div><div class="row"><button class="ib" data-tact="quick" aria-label="Switch light or dark"></button><button class="btn o s" data-act="out">'+ic("exit",16)+"Sign out</button></div></aside><section class=\"main\">"+inner+"</section></div>"}
  function night(){var p=document.documentElement.getAttribute("data-palette")||"emerald";document.querySelectorAll(".night").forEach(function(n){n.setAttribute("data-mode","dark");n.setAttribute("data-palette",p)})}
  new MutationObserver(night).observe(document.documentElement,{attributes:true,attributeFilter:["data-palette"]});
  function thumbs(){document.querySelectorAll(".pth").forEach(function(el){if(el.querySelector("img"))return;var b=el.nextElementSibling&&el.nextElementSibling.querySelector("b");el.innerHTML='<img alt="" src="'+Art.guess(b?b.textContent:"")+'">'})}
  function loadMe(){if(!Supa.uid()){me=null;return Promise.resolve(null)}if(me)return Promise.resolve(me);return Supa.profile().then(function(p){me=p;if(window.Theme)Theme.fromProfile(p);return p}).catch(function(){return null})}

  /* ---------- Router: real paths ---------- */
  /* A leftover "#/x/y" in the address bar (old links, emailed links, code that still sets location.hash) becomes "/x/y". OAuth "#access_token=" fragments are left alone. */
  function legacy(){var h=location.hash;if(h&&h.indexOf("#/")===0){try{history.replaceState(null,"",h.slice(1))}catch(e){}}}
  function curPath(){return location.pathname.replace(/\/+$/,"")||"/"}
  function norm(to){to=String(to||"/");if(to.indexOf("#/")===0)to=to.slice(1);if(to.charAt(0)!=="/")to="/"+to;return to}
  /* Same links written in the markup of older files as href="#/x" become real hrefs, so open-in-new-tab, copy link and long-press all work. */
  function fixLinks(root){(root||document).querySelectorAll('a[href^="#/"]').forEach(function(a){a.setAttribute("href",a.getAttribute("href").slice(1))})}
  function go(to,replace){to=norm(to);if(to!==location.pathname+location.search){try{history[replace?"replaceState":"pushState"](null,"",to)}catch(e){location.href=to;return}}route()}
  function route(){legacy();
    var path=curPath(),parts=path==="/"?[]:path.slice(1).split("/"),authPath=path==="/sign-in"||path==="/create-account"||path==="/login"||path==="/login/new",
      seg=authPath?"login":(parts[0]||"home"),args=authPath?[path==="/create-account"||path==="/login/new"?"new":"in"]:parts.slice(1),f=V[seg],app=$("#root");
    document.body.classList.remove("dr","auth-page");
    /* Someone who is already signed in has no reason to see Sign in or Create account: send them to their own page. */
    if(authPath&&Supa.uid()){loadMe().then(function(){go(intent().home,true)});return}
    if(!f){loadMe().then(function(){app.innerHTML=pub(empty("Page not found","That address does not exist. Check the link or go back to the home page."));document.title="Page not found · Everneed";window.scrollTo(0,0);Theme.apply();night();fixLinks(app);adapt(app)});return}
    loadMe().then(function(){if(window.Chat&&me&&!authPath)Chat.boot(me);return f(args)}).then(function(r){if(r.redirect){go(r.redirect,true);return}
      if(r.layout==="auth"){document.body.classList.add("auth-page");app.innerHTML=r.html}
      else app.innerHTML=r.layout==="pub"?pub(r.html,r.active):r.layout==="setup"?setup(r.html):shell(r.layout,r.active,r.html);
      fixLinks(app);if(r.layout==="pub")adapt(app);document.title=(r.title?r.title+" · ":"")+"Everneed";window.scrollTo(0,0);Theme.apply();night();thumbs();if(window.Chat&&r.layout!=="auth"&&r.layout!=="setup"){Chat.mount(r.layout);Chat.refresh()}if(r.after)r.after()})
    .catch(function(e){document.body.classList.remove("auth-page");app.innerHTML=pub(empty("Something went wrong",e&&e.message||"Please try again."));fixLinks(app);adapt(app)})}
  /* Page-to-page navigation without a reload. Files, other sites, new tabs and modified clicks are left to the browser. */
  document.addEventListener("click",function(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    var a=e.target.closest&&e.target.closest("a[href]");if(!a||(a.target&&a.target!=="_self")||a.hasAttribute("download"))return;
    var h=a.getAttribute("href")||"";if(h.indexOf("#/")===0)h=h.slice(1);else if(h.charAt(0)!=="/"||h.charAt(1)==="/")return;
    if(/^\/(assets|fonts)\//.test(h)||/\.[a-z0-9]{2,5}($|\?)/i.test(h))return;
    e.preventDefault();go(h)});

  document.addEventListener("click",function(e){var b=e.target.closest("[data-act]");if(b){var f=A[b.getAttribute("data-act")];if(f){e.preventDefault();f(b,e)}}if(e.target.closest("[data-tact]"))setTimeout(ap,0)});
  document.addEventListener("change",function(e){if(e.target.getAttribute&&e.target.getAttribute("data-tact"))setTimeout(ap,0)});
  document.addEventListener("submit",function(e){var f=e.target.closest("[data-form]");if(!f)return;e.preventDefault();var h=F[f.getAttribute("data-form")];if(!h)return;var d={};new FormData(f).forEach(function(v,k){if(!(k in d))d[k]=v});h(f,d,e)});
  function ap(){var el=$("#apprw");if(el)el.innerHTML=appearance()}
  A.out=function(){Supa.out();me=null;try{history.replaceState(null,"","/")}catch(e){}location.reload()};
  A.menu=function(){document.body.classList.toggle("dr")};
  /* popstate (back and forward) and hashchange (old code, and the "re-render this page" event some screens dispatch) can both fire for one action, so they are merged. */
  function soon(){clearTimeout(rt);rt=setTimeout(route,16)}
  return{V:V,A:A,F:F,esc:esc,$:$,money:money,when:when,ago:ago,toast:toast,ask:ask,empty:empty,appearance:appearance,me:function(){return me},reset:function(){me=null},go:go,path:curPath,
    start:function(){addEventListener("hashchange",soon);addEventListener("popstate",soon);route()}};
})();
