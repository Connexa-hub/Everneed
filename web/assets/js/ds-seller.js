/* Seller workspace, redesigned on the design system (ds.js). Wraps V.portal so workspace.js and seller-flow.js stay untouched.
   Drawn here: the live-store home and the products list. Everything else (product editor, orders, plan, verification) falls through
   to the existing pages and is only restyled by ds.css and the select/tab upgrades.
   All numbers come from the database. Plan-gated modules (analytics, promotions, bulk tools) need entitlement flags that sellers cannot
   read yet (request R10), so they say "not available yet"; no upgrade claim and no number is invented.
   Actions are prefixed ds- so they cannot collide. Backend requests: docs/WORKFLOW/SELLER_APP_EXPERIENCE_BACKEND_HANDOFF.md. */
(function(){
  var C=window.Core,D=window.DS,esc=C.esc,V=C.V,A=C.A,old=V.portal;
  if(!D||!old)return;
  var enc=encodeURIComponent,soft=function(){return[]};
  var ST={draft:["Draft","","clip"],pending_review:["In review","info","clock"],published:["Live","ok","okc"],rejected:["Needs changes","bad","errc"],archived:["Archived","","box"]};
  var TABS=[["all","All"],["published","Live"],["pending_review","In review"],["draft","Drafts"],["rejected","Needs changes"],["archived","Archived"]];
  var ACTIVE=["accepted","preparing","ready","handover_pending","at_hub","consolidated","out_for_delivery"];
  function unwrap(r){return r&&r.data!==undefined?r.data:r}
  function num(n){try{return new Intl.NumberFormat().format(n||0)}catch(e){return String(n||0)}}
  function photo(p){return p.images&&p.images.length?p.images[0]:(p.img||"")}
  function isLow(p){var v=p.sizes||[],st=p.stocks||{};if(v.length)return v.some(function(l){return st[l]!=null&&Number(st[l])<=2});return p.stock!=null&&p.stock<=5}
  function stock(p){
    var v=p.sizes||[],st=p.stocks||{};
    if(v.length){var t=v.filter(function(l){return st[l]!=null}),n=t.reduce(function(a,l){return a+Number(st[l]||0)},0);return v.length+" variant"+(v.length>1?"s":"")+(t.length?" · "+n+" in stock":"")}
    if(p.stock==null)return"Stock not tracked";
    return p.stock<=0?"Sold out":p.stock+" in stock";
  }
  function thumb(p,cls){
    var im=photo(p),k=D.artFor(p.col||"");
    return'<span class="ds-thumb'+(cls?" "+cls:"")+'">'+(im?'<img alt="" loading="lazy" src="'+esc(im)+'">':D.art(k,cls?28:40))+"</span>";
  }
  function out(h,t,active){return{layout:"portal",active:active||"portal",html:h,title:t}}
  function fail(e){return D.banner("error","This page could not load",e&&e.message||"Please try again in a moment.",{label:"Try again",act:"ds-reload"})}
  A["ds-reload"]=A["ds-reload"]||function(){C.go(location.pathname,true)};

  V.portal=function(p){
    var sub=p[0]||"";
    return Promise.resolve(old(p)).then(function(res){
      if(!res||res.layout!=="portal"||!Supa.uid())return res;
      if(sub===""&&res.title==="Dashboard")return home(res);
      if(sub==="products"&&res.title==="Products")return products(res);
      return res;
    });
  };

  /* ---------- home ---------- */
  function home(orig){
    return Supa.get("stores?select=*&owner_id=eq."+enc(Supa.uid())).then(function(r){
      var s=r&&r[0];if(!s||s.activation_status!=="live")return orig;
      var id=enc(s.id),failed=0,q=function(pr){return pr.catch(function(){failed++;return[]})};
      return Promise.all([
        q(Supa.get("products?select=id,name,col,status,stock,sizes,stocks,img,images&store_id=eq."+id)),
        q(Supa.rpc("my_seller_orders",{}).then(unwrap)),
        q(Supa.get("product_private?select=product_id,review_note")),
        Supa.rpc("my_store_entitlements",{}).then(unwrap).catch(function(){return null})
      ]).then(function(a){
        var prods=(a[0]||[]).filter(function(x){return x.status!=="archived"}),orders=Array.isArray(a[1])?a[1]:[],pn={},e=a[3];
        (a[2]||[]).forEach(function(x){pn[x.product_id]=x});
        var c=function(st){return prods.filter(function(x){return x.status===st}).length};
        var fresh=orders.filter(function(o){return o.status==="pending"}),act=orders.filter(function(o){return ACTIVE.indexOf(o.status)>-1});
        var inprog=act.reduce(function(n,o){return n+Number(o.earning||0)},0);
        var tasks=[];
        if(fresh.length){var due=fresh.map(function(o){return o.accept_by}).filter(Boolean).sort()[0];
          tasks.push(D.row({icon:"bell",tone:"warn",title:fresh.length+" new order"+(fresh.length>1?"s":"")+" waiting",sub:due?"Respond by "+C.when(due):"Respond promptly",href:"/portal/orders"}))}
        prods.filter(function(x){return x.status==="rejected"}).slice(0,3).forEach(function(x){
          tasks.push(D.row({icon:"errc",tone:"bad",title:x.name,sub:(pn[x.id]&&pn[x.id].review_note)||"Needs changes",href:"/portal/product/"+enc(x.id),end:D.chip("Fix","bad")}))});
        prods.filter(function(x){return x.status==="published"&&isLow(x)}).slice(0,3).forEach(function(x){
          tasks.push(D.row({icon:"alert",tone:"warn",title:x.name,sub:"Running low · "+stock(x),href:"/portal/product/"+enc(x.id)}))});
        if(c("draft"))tasks.push(D.row({icon:"clip",title:c("draft")+" draft"+(c("draft")>1?"s":"")+" not sent yet",sub:"Send them for review to go live",href:"/portal/products"}));
        if(!prods.length)tasks.push(D.row({icon:"plus",title:"Add your first product",sub:"It goes live after review",href:"/portal/product/new"}));
        var plan="";
        if(e&&e.configured===true){
          var used=e.active_products||0,lim=e.active_products_unlimited?null:e.active_product_limit,pct=lim?Math.min(100,Math.round(used/lim*100)):0;
          plan='<a class="ds-card ds-ringcard" href="/portal/plan">'+(lim?D.ring(pct,pct>=80?"warn":"ok",used+" of "+lim+" products used"):"")
            +'<div class="ds-grow"><b>'+D.plan(e.plan_name||"Plan")+"</b><p>"+(lim?used+" of "+lim+" products":used+" products, no limit")+"</p>"
            +(e.daily_new_products_unlimited?"":"<small>Today: "+(e.daily_new_products_used||0)+" of "+e.daily_new_product_limit+" new listings</small>")+"</div>"+D.icon("chevr",18)+"</a>";
        }
        var recent=orders.slice(0,4).map(function(o){return D.row({icon:"box",title:(o.customer_name||"Customer")+" · "+C.money(o.subtotal),sub:C.ago(o.created_at)+(o.customer_city?" · "+o.customer_city:""),href:"/portal/orders"})}).join("");
        var html='<div class="ds-hero"><span class="ds-logo">'+(s.logo_url?'<img alt="" src="'+esc(s.logo_url)+'">':esc(String(s.name||"?").charAt(0).toUpperCase()))+'</span>'
          +'<div class="ds-grow"><h1 class="ds-title">'+esc(s.name)+"</h1><div>"+D.chip("Live","ok","okc")+"</div></div>"+(s.slug?'<a class="ds-btn s o" href="/store/'+esc(s.slug)+'">View store</a>':"")+"</div>"
          +(failed?D.banner("warning","Some numbers could not load","The figures below may be incomplete.",{label:"Try again",act:"ds-reload"}):"")
          +'<div class="ds-stats">'+D.stat({icon:"bell",value:fresh.length,label:"New orders",href:"/portal/orders"})+D.stat({icon:"box",value:act.length,label:"In progress",href:"/portal/orders"})
          +D.stat({icon:"okc",value:c("published"),label:"Live products",href:"/portal/products"})+D.stat({icon:"clock",value:c("pending_review"),label:"In review",href:"/portal/products"})+"</div>"
          +'<div class="ds-actions"><a class="ds-btn" href="/portal/product/new">'+D.icon("plus",18)+' Add product</a><a class="ds-btn o" href="/portal/products">Products</a><a class="ds-btn o" href="/inbox">Messages</a></div>'
          +'<div class="ds-h"><h2>To do</h2></div><div class="ds-rows">'+(tasks.length?tasks.join(""):D.empty({icon:"okc",title:"You are all caught up",text:"Nothing needs your attention right now."}))+"</div>"
          +plan
          +'<div class="ds-h"><h2>Recent orders</h2></div><div class="ds-rows">'+(recent||D.empty({icon:"box",title:"No orders yet",text:"Orders appear here as shoppers buy."}))+"</div>"
          +'<div class="ds-card"><b>In progress, not yet delivered</b><p class="ds-sub">'+C.money(inprog)+"</p><small>Withdrawals are not available yet.</small></div>"
          +'<div class="ds-h"><h2>Growth tools</h2></div><div class="ds-grid c2">'
          +["Analytics","Promotions","Bulk tools"].map(function(n){return D.gate({icon:"lock",title:n,text:"Not available yet. This module appears when it is ready for your plan."})}).join("")+"</div>";
        return out(html,"Dashboard","portal");
      });
    }).catch(function(){return orig});
  }

  /* ---------- products ---------- */
  var F={tab:"all",q:""};
  function products(orig){
    return Supa.get("stores?select=id&owner_id=eq."+enc(Supa.uid())).then(function(r){
      var s=r&&r[0];if(!s)return orig;
      return Promise.all([Supa.get("products?select=*&store_id=eq."+enc(s.id)+"&order=at.desc"),Supa.get("product_private?select=product_id,review_note").catch(soft)]).then(function(a){
        var list=a[0]||[],pn={},cnt={all:0};(a[1]||[]).forEach(function(x){pn[x.product_id]=x});
        list.forEach(function(x){cnt[x.status]=(cnt[x.status]||0)+1;if(x.status!=="archived")cnt.all++});
        var cards=list.map(function(x){
          var st=ST[x.status]||[x.status,"","box"],n=pn[x.id],id=esc(x.id),can=x.status==="draft"||x.status==="rejected";
          return'<article class="ds-card ds-pr" data-st="'+esc(x.status)+'" data-name="'+esc((x.name+" "+(x.sku||"")).toLowerCase())+'" data-lp>'
            +'<a href="/portal/product/'+enc(x.id)+'" aria-label="Edit '+esc(x.name)+'">'+thumb(x)+'</a><div class="ds-grow"><a href="/portal/product/'+enc(x.id)+'"><b>'+esc(x.name)+"</b></a>"
            +"<small>"+C.money(x.price)+(x.old>x.price?" · was "+C.money(x.old):"")+" · "+esc(stock(x))+"</small>"
            +'<div class="ds-chips">'+D.chip(st[0],st[1]||"",st[2])+(x.col?D.chip(x.col):"")+"</div>"
            +(x.status==="rejected"&&n&&n.review_note?"<small>"+esc(n.review_note)+"</small>":"")
            +'<div class="ds-acts">'+(can?'<button type="button" class="ds-btn s" data-act="wsub" data-id="'+id+'">Submit for review</button>':"")
            +'<a class="ds-btn s o" href="/portal/product/'+enc(x.id)+'">Edit</a><button type="button" class="ds-btn s o" data-act="wdup" data-id="'+id+'">Duplicate</button>'
            +(x.status!=="archived"?'<button type="button" class="ds-btn s o" data-act="ds-arch" data-id="'+id+'">Archive</button>':'<button type="button" class="ds-btn s o" data-act="wrest" data-id="'+id+'">Restore</button>')
            +"</div></div></article>";
        }).join("");
        var seg='<div class="ds-chips ds-pf" role="group" aria-label="Filter products">'+TABS.map(function(t){return'<button type="button" class="ds-chip'+(t[0]==="all"?" on":"")+'" data-act="ds-pf" data-id="'+t[0]+'" aria-pressed="'+(t[0]==="all"?"true":"false")+'">'+t[1]+' <span class="n">'+(cnt[t[0]]||0)+"</span></button>"}).join("")+"</div>";
        var html='<div class="ds-headrow"><h1 class="ds-title">Products</h1><a class="ds-btn s" href="/portal/product/new">'+D.icon("plus",16)+' Add product</a></div>'
          +(list.length?'<div class="ds-search">'+D.icon("search",20)+'<input type="search" data-dsp placeholder="Search by name or SKU" aria-label="Search products" autocomplete="off"></div>'+seg
            +'<div class="ds-grid c2" id="ds-plist">'+cards+'</div><div id="ds-pnone" hidden>'+D.empty({icon:"search",title:"Nothing here",text:"No products match this filter or search."})+"</div>"
            :D.empty({icon:"box",title:"No products yet",text:"Add your first product. It goes live after the Everneed team approves it.",action:{label:"Add product",href:"/portal/product/new"}}))
          +'<div class="ds-h"><h2>Bulk tools</h2></div>'+D.gate({icon:"lock",title:"Bulk edit, import and duplicate in bulk",text:"Not available yet. This appears when it is ready for your plan."});
        F.tab="all";F.q="";
        return out(html,"Products","portal/products");
      });
    }).catch(function(e){return{layout:"portal",active:"portal/products",title:"Products",html:fail(e)}});
  }
  function apply(){
    var q=((document.querySelector("[data-dsp]")||{}).value||"").trim().toLowerCase(),shown=0;
    Array.prototype.forEach.call(document.querySelectorAll("#ds-plist>[data-st]"),function(c){
      var st=c.getAttribute("data-st"),okT=F.tab==="all"?st!=="archived":st===F.tab,okQ=!q||c.getAttribute("data-name").indexOf(q)>-1;
      c.hidden=!(okT&&okQ);if(!c.hidden)shown++;
    });
    var none=document.getElementById("ds-pnone");if(none)none.hidden=shown>0;
  }
  A["ds-pf"]=function(b){F.tab=b.getAttribute("data-id");Array.prototype.forEach.call(document.querySelectorAll(".ds-pf .ds-chip"),function(c){var on=c===b;c.classList.toggle("on",on);c.setAttribute("aria-pressed",on?"true":"false")});apply()};
  A["ds-arch"]=function(b){
    D.confirm({title:"Archive this product?",text:"It leaves your store. You can restore it later from Archived.",ok:"Archive",danger:true}).then(function(y){if(y&&A.warch)A.warch(b)});
  };
  document.addEventListener("input",function(e){if(e.target&&e.target.hasAttribute&&e.target.hasAttribute("data-dsp"))apply()});
})();
