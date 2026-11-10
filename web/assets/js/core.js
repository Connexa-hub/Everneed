/* Core: helpers, router, layouts, appearance panel. Theme itself comes from the app's js/theme.js (copied at build). */
window.Core=(function(){
  var V={},A={},F={},me=null;
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function $(s,r){return(r||document).querySelector(s)}
  function money(n){try{return new Intl.NumberFormat("en-NG",{style:"currency",currency:CFG.baseCurrency,maximumFractionDigits:0}).format(n||0)}catch(e){return"₦"+(n||0)}}
  function when(t){return t?new Date(t).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):""}
  function ago(t){var s=Math.max(1,Math.round((Date.now()-new Date(t).getTime())/1000));if(s<60)return"just now";if(s<3600)return Math.round(s/60)+" min ago";if(s<86400)return Math.round(s/3600)+" h ago";return Math.round(s/86400)+" d ago"}
  function toast(m,err){var t=$("#toast");if(!t){t=document.createElement("div");t.id="toast";t.setAttribute("role","status");document.body.appendChild(t)}t.className=err?"err show":"show";t.textContent=m;clearTimeout(t._t);t._t=setTimeout(function(){t.className=""},3600)}
  function ask(title,label,required){return new Promise(function(res){var d=document.createElement("dialog");
    d.innerHTML='<form method="dialog"><h3>'+esc(title)+'</h3><label class="lb">'+esc(label)+'<textarea rows="4" maxlength="300"'+(required?' required minlength="3"':"")+'></textarea></label><div class="row"><button class="btn o s" value="x" formnovalidate>Cancel</button><button class="btn s" value="ok">Confirm</button></div></form>';
    document.body.appendChild(d);d.addEventListener("close",function(){var v=d.returnValue==="ok"?$("textarea",d).value.trim():null;d.remove();res(v)});d.showModal()})}
  function logo(){return'<a class="logo" href="#/"><img src="/favicon.svg" alt="" width="30" height="30"><span>Everneed</span></a>'}
  function empty(t,s){return'<div class="empty"><b>'+esc(t)+"</b>"+(s?"<p>"+esc(s)+"</p>":"")+"</div>"}
  function appearance(){var T=window.Theme,m=T.mode(),p=T.palette(),dark=T.resolved()!=="light",am=localStorage.getItem("en_amoled")==="1";
    return'<div class="card"><h3>Mode</h3><div class="seg" role="radiogroup" aria-label="Mode">'+["system","light","dark"].map(function(x){return'<input type="radio" name="tmode" id="tm-'+x+'" value="'+x+'" data-tact="mode"'+(m===x?" checked":"")+'><label for="tm-'+x+'">'+x.charAt(0).toUpperCase()+x.slice(1)+"</label>"}).join("")+"</div>"
      +'<div class="sw"><span><b>AMOLED black</b><small style="display:block">'+(dark?"Pure black background in dark mode.":"Available in dark mode.")+'</small></span><button type="button" role="switch" aria-label="AMOLED black" aria-checked="'+(am&&dark)+'" data-tact="amoled"'+(dark?"":" disabled")+"></button></div>"
      +'<h3 style="margin-top:12px">Colour</h3><div class="swgrid" role="radiogroup" aria-label="Colour">'+T.palettes.map(function(x){return'<button type="button" class="swatch" role="radio" aria-checked="'+(p===x[0])+'" data-tact="pal" data-v="'+x[0]+'"><span class="dots2"><i style="background:'+x[3]+'"></i><i style="background:'+x[4]+'"></i></span><span><b>'+x[1]+"</b><small>"+esc(x[2])+"</small></span></button>"}).join("")+'</div><p class="sm" style="margin-top:14px">Saved in this browser'+(Supa.uid()?" and to your account, so it follows you to the app.":". Sign in to keep it on every device.")+"</p></div>"}
  function pub(inner,active){var nav=[["sell","Sell"],["pricing","Pricing"],["help","Help"],["about","About"]].map(function(n){return'<a href="#/'+n[0]+'"'+(active===n[0]?' class="on"':"")+">"+n[1]+"</a>"}).join("");
    return'<header class="top"><div class="w nav">'+logo()+'<nav aria-label="Main">'+nav+'</nav><span class="sp"></span><button class="ib" data-tact="quick" aria-label="Switch light or dark"></button><a class="btn o s" href="#/appearance">Theme</a>'
      +(me?'<a class="btn s" href="#/'+(me.role==="admin"?"admin":"portal")+'">Dashboard</a>':'<a class="btn o s" href="#/login">Sign in</a><a class="btn s" href="#/login/new">Open a store</a>')+"</div></header><main>"+inner+'</main>'
      +'<footer class="foot"><div class="w"><div class="fg"><div>'+logo()+'<p class="m" style="margin-top:12px;max-width:30ch">Sellers run their store here. Shoppers buy in the Everneed app.</p></div>'
      +'<div><h4>Sell</h4><a href="#/sell">Open a store</a><a href="#/pricing">Plans</a><a href="#/login">Seller sign in</a></div><div><h4>Company</h4><a href="#/about">About</a><a href="#/help">Help</a><a href="#/early-access">Early access</a></div><div><h4>Preferences</h4><a href="#/appearance">Theme and colour</a></div></div><div class="cp sm">© 2026 Everneed</div></div></footer>'}
  function shell(kind,active,inner){var nav=kind==="admin"?[["admin","Overview"],["admin/applications","Applications"],["admin/review","Product review"],["admin/stores","Stores"],["admin/waitlist","Waitlist"],["admin/appearance","Appearance"]]:[["portal","Dashboard"],["portal/products","Products"],["portal/apply","Store setup"],["portal/appearance","Appearance"]];
    return'<div class="shell"><aside class="side">'+logo()+'<small class="who">'+(kind==="admin"?"Admin console":"Seller portal")+'</small><nav aria-label="Sections">'+nav.map(function(n){return'<a href="#/'+n[0]+'"'+(n[0]===active?' class="on"':"")+">"+n[1]+"</a>"}).join("")+'</nav><div class="grow"></div><div class="row"><button class="ib" data-tact="quick" aria-label="Switch light or dark"></button><button class="btn o s" data-act="out">Sign out</button></div></aside><section class="main">'+inner+"</section></div>"}
  function night(){var p=document.documentElement.getAttribute("data-palette")||"emerald";document.querySelectorAll(".night").forEach(function(n){n.setAttribute("data-mode","dark");n.setAttribute("data-palette",p)})}
  new MutationObserver(night).observe(document.documentElement,{attributes:true,attributeFilter:["data-palette"]});
  function loadMe(){if(!Supa.uid()){me=null;return Promise.resolve(null)}if(me)return Promise.resolve(me);return Supa.profile().then(function(p){me=p;if(window.Theme)Theme.fromProfile(p);return p}).catch(function(){return null})}
  function route(){var h=location.hash.replace(/^#\/?/,"").split("?")[0],parts=h?h.split("/"):[],seg=parts[0]||"home",f=V[seg]||V.home,app=$("#root");
    loadMe().then(function(){return f(parts.slice(1))}).then(function(r){if(r.redirect){location.hash=r.redirect;return}
      app.innerHTML=r.layout==="pub"?pub(r.html,r.active):shell(r.layout,r.active,r.html);document.title=(r.title?r.title+" · ":"")+"Everneed";window.scrollTo(0,0);Theme.apply();night();if(r.after)r.after()})
    .catch(function(e){app.innerHTML=pub(empty("Something went wrong",e&&e.message||"Please try again."))})}
  document.addEventListener("click",function(e){var b=e.target.closest("[data-act]");if(b){var f=A[b.getAttribute("data-act")];if(f){e.preventDefault();f(b,e)}}if(e.target.closest("[data-tact]"))setTimeout(ap,0)});
  document.addEventListener("change",function(e){if(e.target.getAttribute&&e.target.getAttribute("data-tact"))setTimeout(ap,0)});
  document.addEventListener("submit",function(e){var f=e.target.closest("[data-form]");if(!f)return;e.preventDefault();var h=F[f.getAttribute("data-form")];if(!h)return;var d={};new FormData(f).forEach(function(v,k){if(!(k in d))d[k]=v});h(f,d,e)});
  function ap(){var el=$("#apprw");if(el)el.innerHTML=appearance()}
  A.out=function(){Supa.out();me=null;location.hash="#/"};
  return{V:V,A:A,F:F,esc:esc,$:$,money:money,when:when,ago:ago,toast:toast,ask:ask,empty:empty,appearance:appearance,me:function(){return me},reset:function(){me=null},
    start:function(){addEventListener("hashchange",route);route()}};
})();
