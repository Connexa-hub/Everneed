/* Seller workspace, redesigned on the design system (ds.js). Wraps V.portal so workspace.js and seller-flow.js stay untouched.
   Drawn here: the live-store home and the products list. Everything else (product editor, orders, plan, verification) falls through
   to the existing pages and is only restyled by ds.css and the select/tab upgrades.
   All numbers come from the database. Plan-gated modules (analytics, promotions, bulk tools) need entitlement flags that sellers cannot
   seller_product_capabilities() returns them. A module the plan lacks shows an upgrade card; a module the plan includes but whose data
   contract is missing (R5, R7) says so. No number is invented.
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
      if(sub==="product"&&res.html&&res.html.indexOf('id="wsform"')>-1)return product(res,p[1]);
      return res;
    });
  };

  /* ---------- plan-gated modules (flags from seller_product_capabilities) ---------- */
  var UP={label:"See plans",href:"/portal/plan"};
  function tools(cap){
    var an=cap.analytics_level&&cap.analytics_level!=="none";
    return[
      an?D.gate({icon:"chart",title:"Analytics ("+cap.analytics_level+")",text:"Included in your plan. Sales figures are not available yet."}):D.gate({icon:"lock",title:"Analytics",text:"Sales and product insight come with a higher plan.",action:UP}),
      cap.promotions_enabled?D.gate({icon:"percent",title:"Promotions",text:"Included in your plan. Promotions are not available yet."}):D.gate({icon:"lock",title:"Promotions",text:"Discounts and offers come with a higher plan.",action:UP}),
      cap.bulk_tools_enabled?D.gate({icon:"layers",title:"Bulk tools",text:"Included in your plan. Bulk edit and import are not available yet."}):D.gate({icon:"lock",title:"Bulk tools",text:"Bulk edit and import come with a higher plan.",action:UP})].join("");
  }

  /* ---------- home ---------- */
  function home(orig){
    return Supa.get("stores?select=*&owner_id=eq."+enc(Supa.uid())).then(function(r){
      var s=r&&r[0];if(!s||s.activation_status!=="live")return orig;
      var id=enc(s.id),failed=0,q=function(pr){return pr.catch(function(){failed++;return[]})};
      return Promise.all([
        q(Supa.get("products?select=id,name,col,status,stock,sizes,stocks,img,images&store_id=eq."+id)),
        q(Supa.rpc("my_seller_orders",{}).then(unwrap)),
        q(Supa.get("product_private?select=product_id,review_note")),
        Supa.rpc("my_store_entitlements",{}).then(unwrap).catch(function(){return null}),
        Supa.rpc("seller_product_capabilities",{}).then(unwrap).catch(function(){return null})
      ]).then(function(a){
        var prods=(a[0]||[]).filter(function(x){return x.status!=="archived"}),orders=Array.isArray(a[1])?a[1]:[],pn={},e=a[3],cap=a[4];
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
          +(cap?'<div class="ds-h"><h2>Growth tools</h2></div><div class="ds-grid c2">'+tools(cap)+"</div>":"");
        return out(html,"Dashboard","portal");
      });
    }).catch(function(){return orig});
  }

  /* ---------- products ---------- */
  var F={tab:"all",q:""};
  function products(orig){
    return Supa.get("stores?select=id&owner_id=eq."+enc(Supa.uid())).then(function(r){
      var s=r&&r[0];if(!s)return orig;
      return Promise.all([Supa.get("products?select=*&store_id=eq."+enc(s.id)+"&order=at.desc"),Supa.get("product_private?select=product_id,review_note").catch(soft),Supa.rpc("seller_product_capabilities",{}).then(unwrap).catch(function(){return null})]).then(function(a){
        var cap=a[2],list=a[0]||[],pn={},cnt={all:0};(a[1]||[]).forEach(function(x){pn[x.product_id]=x});
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
          +(cap?'<div class="ds-h"><h2>Bulk tools</h2></div>'+(cap.bulk_tools_enabled?D.gate({icon:"layers",title:"Bulk edit and import",text:"Included in your plan. Bulk actions are not available yet."}):D.gate({icon:"lock",title:"Bulk edit and import",text:"Edit many products at once with a higher plan.",action:UP})):"");
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
  /* ---------- product workspace: section nav, specifications, publish checklist ---------- */
  var SEC=[["basics","Basics"],["specs","Specs"],["photos","Photos"],["pricing","Pricing"],["stock","Stock"],["variants","Variants"],["shipping","Shipping"],["publish","Publish"]];
  var CARD={"Product":"basics","Photos":"photos","Pricing":"pricing","Inventory":"stock","Variants":"variants","Shipping and details":"shipping","Status":"publish"};
  var SP={defs:[],cols:[],vals:{},ok:false,on:false};
  function defsFor(name){
    var by={},c=SP.cols.filter(function(x){return x.name===name})[0],ids=[],g=0;
    while(c&&g++<6){ids.push(c.id);c=SP.cols.filter(function(x){return x.id===c.parent_id})[0]}
    return SP.defs.filter(function(d){return ids.indexOf(d.collection_id)>-1&&!by[d.attribute_key]&&(by[d.attribute_key]=1)});
  }
  function field(d,v){
    var k=esc(d.attribute_key),lab=esc(d.label)+(d.unit?" ("+esc(d.unit)+")":"")+(d.required?" *":""),n='name="attr_'+k+'"',t=d.input_type,h="";
    if(t==="select"||t==="boolean"){
      var opts=t==="boolean"?[["true","Yes"],["false","No"]]:(d.options||[]).map(function(o){return[o,o]});
      h='<label class="lb">'+lab+"<select "+n+'><option value="">Not stated</option>'+opts.map(function(o){return'<option value="'+esc(o[0])+'"'+(String(v)===String(o[0])?" selected":"")+">"+esc(o[1])+"</option>"}).join("")+"</select></label>";
    }else if(t==="multiselect"){
      var cur=Array.isArray(v)?v:[];
      h='<div class="lb"><span>'+lab+'</span><input type="hidden" '+n+' value="'+esc(cur.join("|"))+'"><div class="ds-chips" role="group" aria-label="'+esc(d.label)+'">'
        +(d.options||[]).map(function(o){var on=cur.indexOf(o)>-1;return'<button type="button" class="ds-chip'+(on?" on":"")+'" data-act="ds-ms" data-v="'+esc(o)+'" aria-pressed="'+on+'">'+esc(o)+"</button>"}).join("")+"</div></div>";
    }else{
      h='<label class="lb">'+lab+"<input "+n+' type="'+(t==="date"?"date":t==="url"?"url":"text")+'"'+(t==="number"||t==="measurement"?' inputmode="decimal"':"")+' maxlength="300" value="'+esc(v==null?"":v)+'"></label>';
    }
    return h+'<input type="hidden" name="attrt_'+k+'" value="'+esc(t==="measurement"?"number":t)+'">'+(d.required?'<input type="hidden" name="attrr_'+k+'" value="'+esc(d.label)+'">':"");
  }
  function specsBody(col){
    if(!SP.ok)return D.banner("warning","Specifications could not load","Product details above still save. Try again in a moment.",{label:"Try again",act:"ds-reload"});
    if(!col)return'<p class="sm">Choose a category and its specifications appear here.</p>';
    var l=defsFor(col);
    if(!l.length)return'<p class="sm">This category has no extra specifications.</p>';
    return'<div class="fgrid">'+l.map(function(d){return field(d,SP.vals[d.attribute_key])}).join("")+"</div>";
  }
  function keep(){
    var f=document.getElementById("wsform");if(!f)return;
    Array.prototype.forEach.call(f.querySelectorAll('[name^="attr_"]'),function(el){var k=el.name.slice(5),t=(f.querySelector('[name="attrt_'+k+'"]')||{}).value;SP.vals[k]=t==="multiselect"?(el.value?el.value.split("|"):[]):(t==="number"?(el.value===""?"":Number(el.value)):el.value)});
  }
  function drawSpecs(){
    var b=document.getElementById("ds-specs-body"),f=document.getElementById("wsform");if(!b||!f)return;
    keep();b.innerHTML=specsBody((f.querySelector('[name="col"]')||{}).value);checklist();
  }
  function checklist(){
    var el=document.getElementById("ds-check"),f=document.getElementById("wsform");if(!el||!f)return;
    var g=function(n){var e=f.querySelector('[name="'+n+'"]');return e?String(e.value||"").trim():""},col=g("col"),req=SP.ok&&col?defsFor(col).filter(function(d){return d.required}):[],
      miss=req.filter(function(d){var e=f.querySelector('[name="attr_'+d.attribute_key+'"]');return!e||!String(e.value||"").trim()}).length,
      items=[["Title",g("name").length>=2],["Category",!!col],["Price above zero",Number(g("price").replace(/,/g,""))>0],["At least one photo",!!document.querySelector("#wsmedia .it:not(.add) img")]];
    if(req.length)items.push(["Required specifications"+(miss?" ("+miss+" missing)":""),miss===0]);
    el.innerHTML=items.map(function(i){return'<li class="'+(i[1]?"ok":"")+'">'+D.icon(i[1]?"okc":"dot",16)+"<span>"+esc(i[0])+"</span></li>"}).join("");
  }
  function product(orig,id){
    var isNew=!id||id==="new";
    return Promise.all([
      Supa.get("collections?select=id,name,parent_id").then(function(r){SP.cols=r||[];return Supa.get("category_attributes?select=*&active=eq.true&order=sort_order.asc")}).then(function(r){SP.defs=r||[];SP.ok=true},function(){SP.ok=false}),
      isNew?Promise.resolve([]):Supa.get("products?select=col,attributes&id=eq."+enc(id)).catch(soft),
      Supa.rpc("seller_product_capabilities",{}).then(unwrap).catch(function(){return null})
    ]).then(function(a){
      var x=a[1][0]||{},cap=a[2];SP.vals=x.attributes||{};
      var html=orig.html;
      Object.keys(CARD).forEach(function(t){html=html.replace('<div class="card"><h3>'+t+"</h3>",'<div class="card" id="ds-sec-'+CARD[t]+'"><h3>'+t+"</h3>")});
      var nav=D.seg(SEC.map(function(t){return{act:"ds-jump",id:t[0],label:t[1]}}),"Product sections");
      html=html.replace("</h1><form","</h1>"+nav+"<form");
      var specs=cap&&cap.category_attributes_enabled===false
        ?'<div id="ds-sec-specs">'+D.gate({icon:"lock",title:"Category specifications",text:"Add details like size, material or ingredients with a higher plan.",action:UP})+"</div>"
        :'<div class="card" id="ds-sec-specs"><h3>Specifications</h3><div id="ds-specs-body">'+specsBody(x.col||"")+"</div></div>";
      html=html.replace('<div class="card" id="ds-sec-photos">',specs+'<div class="card" id="ds-sec-photos">');
      html=html.replace('<div class="card" id="ds-sec-stock">',D.gate({icon:"layers",title:"Volume pricing",text:"Price tiers by quantity are not available yet."})+'<div class="card" id="ds-sec-stock">');
      html=html.replace('<h3>Status</h3>','<h3>Status</h3>').replace(/(<div class="card" id="ds-sec-publish">[\s\S]*?)<\/div>/,function(m,a){return a+'<h4 class="ds-h4">Ready to send for review?</h4><ul class="ds-check" id="ds-check" aria-live="polite"></ul></div>'});
      orig.html=html;
      var after=orig.after;
      orig.after=function(){if(after)after();SP.on=true;checklist()};
      return orig;
    }).catch(function(){return orig});
  }
  A["ds-jump"]=function(b){
    var el=document.getElementById("ds-sec-"+b.getAttribute("data-id"));if(!el)return;
    var rm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({behavior:rm?"auto":"smooth",block:"start"});
  };
  A["ds-ms"]=function(b){
    var box=b.parentNode,inp=box.parentNode.querySelector('input[type="hidden"]'),v=b.getAttribute("data-v"),cur=inp.value?inp.value.split("|"):[],i=cur.indexOf(v);
    if(i>-1)cur.splice(i,1);else cur.push(v);
    inp.value=cur.join("|");b.classList.toggle("on",i<0);b.setAttribute("aria-pressed",i<0?"true":"false");checklist();
  };
  document.addEventListener("change",function(e){var t=e.target;if(!SP.on||!t||!t.name)return;if(t.name==="col")drawSpecs();else checklist()});
  document.addEventListener("input",function(e){if(SP.on&&e.target&&e.target.closest&&e.target.closest("#wsform"))checklist()});
  document.addEventListener("click",function(e){if(SP.on&&e.target.closest&&e.target.closest("#wsmedia"))setTimeout(checklist,300)});
})();
