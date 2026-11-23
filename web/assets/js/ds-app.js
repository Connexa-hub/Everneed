/* App-style seller shell (phone). Floating bottom bar, store header, full-screen menu and search.
   Switched on with ?shell=app (remembered, ?shell=web turns it off) or inside the native app, on phone-width screens only.
   It only changes the frame around the existing seller screens; every screen, number and action still comes from the live
   data code in ds-seller.js and workspace.js. Nothing here is mock data. */
(function(){
  var C=window.Core,D=window.DS,AX=window.AX;if(!C||!D||!AX||!AX.shell)return;
  var A=C.A,esc=C.esc,enc=encodeURIComponent,doc=document,html=doc.documentElement,KEY="ev-shell",RK="ev-recent";
  function on(){
    try{
      var m=/[?&]shell=(app|web)\b/.exec(location.search);if(m)localStorage.setItem(KEY,m[1]);
      var f=localStorage.getItem(KEY)==="app"||!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
      return f&&matchMedia("(max-width:700px)").matches;
    }catch(e){return false}
  }
  var ST=null,SUB=null;
  function initial(s){return(String(s||"E").trim().charAt(0)||"E").toUpperCase()}
  function brand(){
    var n=ST&&ST.name||"My store";
    return'<span class="ds-stl">'+(ST&&ST.logo_url?'<img alt="" src="'+esc(ST.logo_url)+'">':esc(initial(n)))+'</span><b>'+esc(n)+"</b>";
  }
  function load(){
    if(!window.Supa||!Supa.uid||!Supa.uid())return;
    Supa.get("stores?select=id,name,logo_url&owner_id=eq."+enc(Supa.uid())).then(function(r){
      ST=r&&r[0]||null;var el=doc.querySelector(".ds-st");if(el)el.innerHTML=brand();
      if(!ST)return;
      return Supa.get("store_subscriptions?select=status,current_period_end&store_id=eq."+enc(ST.id)).then(function(x){SUB=x&&x[0]||null;pill()});
    }).catch(function(){});
  }
  function pill(){
    var el=doc.querySelector(".ds-ap");if(!el)return;
    var d=SUB&&SUB.status==="trialing"&&SUB.current_period_end?Math.ceil((new Date(SUB.current_period_end)-Date.now())/864e5):null;
    if(d==null||d<0){el.hidden=true;return}
    el.hidden=false;el.querySelector("i").textContent=d+(d===1?" day left":" days left");
  }
  function cur(a){a=String(a||"");return a==="portal"?"home":a==="portal/orders"?"orders":a.indexOf("portal/product")===0?"products":a==="inbox"?"msg":""}
  var prev=AX.shell;
  AX.shell=function(kind,active,inner,me){
    var app=kind==="portal"&&on();html.classList.toggle("ds-appsh",app);
    if(!app)return prev.apply(this,arguments);
    var c=cur(active),focus=String(active||"").indexOf("portal/product")===0&&/^\/portal\/product\//.test(location.pathname);
    function it(k,href,icon,label){return'<a href="'+href+'"'+(c===k?' class="on" aria-current="page"':"")+' aria-label="'+label+'">'+D.icon(icon,24)+"</a>"}
    setTimeout(load,0);
    if(String(active||"")!=="portal")inner=String(inner).replace(/<h1 class="ds-title">([^<]*)<\/h1>/,function(m,t){return'<h1 class="ds-title"><button type="button" class="ds-ts" data-act="ds-asw" aria-haspopup="dialog">'+t+D.icon("chevd",18)+"</button></h1>"});
    return'<div class="ax ds-appsh-w" data-kind="portal"><header class="ds-ah"><a class="ds-av" href="/me" aria-label="Account and settings">'+esc(initial(me&&(me.name||me.email)))+'</a>'
      +'<a class="ds-st" href="/portal" aria-label="Store home">'+brand()+"</a>"+AX.bell()+"</header>"
      +'<section class="main" id="main">'+inner+"</section>"
      +(focus?"":'<a class="ds-ap" href="/portal/plan" hidden><b>Pick a plan</b><i></i></a>'
      +'<nav class="ds-ab" aria-label="Seller navigation"><button type="button" class="ds-abc" data-act="ds-asearch" aria-label="Search">'+D.icon("search",24)+"</button>"
      +'<div class="ds-abp">'+it("home","/portal","home","Home")+it("orders","/portal/orders","receipt","Orders")+it("products","/portal/products","box","Products")
      +'<button type="button" data-act="ds-amenu" aria-label="Menu" aria-haspopup="dialog">'+D.icon("menu",24)+"</button></div>"
      +'<a class="ds-abc'+(c==="msg"?" on":"")+'" href="/inbox" aria-label="Messages">'+D.icon("chat",24)+'<span class="nbd" hidden>0</span></a></nav>')+"</div>";
  };

  /* ---------- full-screen menu ---------- */
  var ITEMS=[["Home","/portal","home"],["Orders","/portal/orders","receipt"],["Products","/portal/products","box",[["All products","/portal/products"],["Add product","/portal/product/new"]]],["Messages","/inbox","chat"],["Plan","/portal/plan","crown"],["Store settings","/portal/settings","gear"],["Account","/me","user"]];
  A["ds-asw"]=function(){D.actions({title:"Go to",items:ITEMS.map(function(i){return{label:i[0],icon:i[2],run:function(){C.go(i[1])}}})})};
  function overlay(cls,label,inner){
    var el=doc.createElement("div");el.className=cls;el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label",label);el.innerHTML=inner;
    var last=doc.activeElement,root=doc.getElementById("root");doc.body.appendChild(el);html.classList.add("ds-lock");if(root)root.setAttribute("inert","");
    function close(){if(!el.parentNode)return;el.remove();html.classList.remove("ds-lock");if(root)root.removeAttribute("inert");doc.removeEventListener("keydown",key);if(last&&last.focus&&doc.body.contains(last))last.focus()}
    function key(e){if(e.key==="Escape")close()}
    doc.addEventListener("keydown",key);
    el.addEventListener("click",function(e){if(e.target.closest("[data-x]")||e.target.closest("a[href]"))close()});
    return{el:el,close:close};
  }
  A["ds-amenu"]=function(){
    var rows=ITEMS.map(function(i,n){
      var kids=i[3];
      if(!kids)return'<a class="ds-mi" href="'+i[1]+'">'+D.icon(i[2],24)+"<b>"+i[0]+"</b></a>";
      return'<button type="button" class="ds-mi" data-act="ds-mg" aria-expanded="false" aria-controls="ds-mg'+n+'">'+D.icon(i[2],24)+"<b>"+i[0]+'</b><span class="ds-chv">'+D.icon("chevd",20)+'</span></button><div class="ds-mk" id="ds-mg'+n+'" hidden>'
        +kids.map(function(k){return'<a href="'+k[1]+'">'+k[0]+"</a>"}).join("")+"</div>";
    }).join("");
    var o=overlay("ds-am","Menu",'<nav class="ds-ml" aria-label="Seller menu">'+rows+'</nav><div class="ds-mf"><a class="ds-mb" href="/portal/settings" aria-label="Store settings">'+D.icon("gear",22)+'</a><a class="ds-mpill" href="/portal/product/new">'+D.icon("plus",20)+' Add product</a><button type="button" class="ds-mb" data-x aria-label="Close menu">'+D.icon("x",22)+"</button></div>");
    var f=o.el.querySelector("a,button");if(f)f.focus();
  };
  A["ds-mg"]=function(b){var k=doc.getElementById(b.getAttribute("aria-controls")),open=b.getAttribute("aria-expanded")!=="true";b.setAttribute("aria-expanded",String(open));if(k)k.hidden=!open};

  /* ---------- search ---------- */
  function recent(){try{return JSON.parse(localStorage.getItem(RK)||"[]").slice(0,6)}catch(e){return[]}}
  function remember(q){try{var l=recent().filter(function(x){return x!==q});l.unshift(q);localStorage.setItem(RK,JSON.stringify(l.slice(0,6)))}catch(e){}}
  var SD={tab:"all",q:"",prods:null,orders:null,busy:false};
  function skel(){return'<div class="ds-sk" aria-hidden="true">'+"<i></i>".repeat(4)+"</div>"}
  function paintSearch(el){
    var body=el.querySelector(".ds-sres"),q=SD.q.trim().toLowerCase();
    if(!q){var r=recent();body.innerHTML=r.length?'<p class="ds-sh">Recent searches</p>'+r.map(function(x){return'<button type="button" class="ds-sr" data-act="ds-srec" data-q="'+esc(x)+'">'+D.icon("clock",18)+"<span>"+esc(x)+"</span></button>"}).join("")+'<button type="button" class="ds-btn s o" data-act="ds-sclr">Clear recent</button>':D.empty({icon:"search",title:"No recent searches",text:"Search your products and orders."});return}
    if(SD.busy){body.innerHTML=skel();return}
    var P=(SD.tab==="orders"?[]:(SD.prods||[]).filter(function(x){return String(x.name||"").toLowerCase().indexOf(q)>-1})),
        O=(SD.tab==="products"?[]:(SD.orders||[]).filter(function(o){return(String(o.customer_name||"")+" "+(o.customer_city||"")+" "+(o.order_id||"")).toLowerCase().indexOf(q)>-1}));
    var h=(P.length?'<p class="ds-sh">Products</p>'+P.slice(0,8).map(function(x){return'<a class="ds-sr" href="/portal/product/'+enc(x.id)+'" data-q="'+esc(SD.q)+'">'+(D.sellerThumb?D.sellerThumb(x,"s"):"")+"<span><b>"+esc(x.name)+"</b><small>"+esc(String(x.status||"").replace(/_/g," "))+"</small></span></a>"}).join(""):"")
      +(O.length?'<p class="ds-sh">Orders</p>'+O.slice(0,8).map(function(o){return'<a class="ds-sr" href="/portal/orders" data-ord="1" data-q="'+esc(SD.q)+'"><span class="ds-ico">'+D.icon("receipt",20)+"</span><span><b>"+esc(o.customer_name||"Customer")+" · "+C.money(o.subtotal)+"</b><small>"+esc(C.ago(o.created_at))+(o.customer_city?" · "+esc(o.customer_city):"")+"</small></span></a>"}).join(""):"");
    body.innerHTML=h||D.empty({icon:"search",title:"No results found",text:"Nothing in your products or orders matches that."});
  }
  A["ds-asearch"]=function(){
    SD.q="";SD.tab="all";
    var o=overlay("ds-as","Search",'<div class="ds-sbar"><label class="ds-sin">'+D.icon("search",20)+'<input type="search" data-dsq placeholder="Search" aria-label="Search products and orders" autocomplete="off" enterkeyhint="search"></label><button type="button" class="ds-mb" data-x aria-label="Close search">'+D.icon("x",22)+"</button></div>"
      +'<div class="ds-chips" role="group" aria-label="Search in">'+[["all","All"],["orders","Orders"],["products","Products"]].map(function(t){return'<button type="button" class="ds-chip'+(t[0]==="all"?" on":"")+'" data-act="ds-stab" data-id="'+t[0]+'" aria-pressed="'+(t[0]==="all")+'">'+t[1]+"</button>"}).join("")+'</div><div class="ds-sres" aria-live="polite"></div>');
    paintSearch(o.el);var i=o.el.querySelector("input");if(i)i.focus();
    if(SD.prods&&SD.orders)return;
    SD.busy=true;
    Promise.all([ST?Supa.get("products?select=id,name,col,status,img,images&store_id=eq."+enc(ST.id)):Promise.resolve([]).then(function(){return Supa.get("stores?select=id&owner_id=eq."+enc(Supa.uid())).then(function(r){return r&&r[0]?Supa.get("products?select=id,name,col,status,img,images&store_id=eq."+enc(r[0].id)):[]})}),
      Supa.rpc("my_seller_orders",{}).then(function(r){return r&&r.data!==undefined?r.data:r}).catch(function(){return[]})]).then(function(a){SD.prods=a[0]||[];SD.orders=Array.isArray(a[1])?a[1]:[]}).catch(function(){SD.prods=[];SD.orders=[]}).then(function(){SD.busy=false;var e=doc.querySelector(".ds-as");if(e)paintSearch(e)});
  };
  doc.addEventListener("input",function(e){var t=e.target;if(t&&t.hasAttribute&&t.hasAttribute("data-dsq")){SD.q=t.value;var e2=doc.querySelector(".ds-as");if(e2)paintSearch(e2)}});
  A["ds-stab"]=function(b){SD.tab=b.getAttribute("data-id");Array.prototype.forEach.call(doc.querySelectorAll(".ds-as .ds-chip"),function(c){var on=c===b;c.classList.toggle("on",on);c.setAttribute("aria-pressed",String(on))});var e=doc.querySelector(".ds-as");if(e)paintSearch(e)};
  A["ds-srec"]=function(b){SD.q=b.getAttribute("data-q");var e=doc.querySelector(".ds-as"),i=e&&e.querySelector("input");if(i){i.value=SD.q;i.focus()}if(e)paintSearch(e)};
  A["ds-sclr"]=function(){try{localStorage.removeItem(RK)}catch(e){}var e=doc.querySelector(".ds-as");if(e)paintSearch(e)};
  doc.addEventListener("click",function(e){var r=e.target.closest&&e.target.closest(".ds-as a.ds-sr[data-q]");if(r){remember(r.getAttribute("data-q"));try{sessionStorage.setItem("ev-oq",r.hasAttribute("data-ord")?r.getAttribute("data-q"):"")}catch(x){}}},true);
})();
