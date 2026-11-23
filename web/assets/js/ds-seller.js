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
  A["ds-reload"]=A["ds-reload"]||function(){C.go(location.pathname,true)};

  /* Any problem inside the redesigned pages falls back to the original page, never to an error screen. */
  V.portal=function(p){
    var sub=p[0]||"";
    return Promise.resolve(old(p)).then(function(res){
      if(sub==="plan"&&res&&res.layout==="portal"&&Supa.uid())return planNow(res).catch(function(){return res});
      if(sub==="orders"&&res&&res.layout==="portal"&&Supa.uid())return Supa.get("stores?select=activation_status&owner_id=eq."+enc(Supa.uid())).then(function(r){return r&&r[0]&&r[0].activation_status==="live"?orders(res):res},function(){return res});
      try{
        if(!res||res.layout!=="portal"||!Supa.uid())return res;
        var r=null;
        if(sub===""&&res.title==="Dashboard")r=home(res);
        else if(sub==="products"&&res.title==="Products")r=products(res);
        else if(sub==="product"&&res.html&&res.html.indexOf('id="wsform"')>-1)r=product(res,p[1]);
        return r?Promise.resolve(r).then(function(x){return x||res},function(){return res}):res;
      }catch(e){return res}
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
    }).catch(function(){return orig});
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
  D.spVals=function(){return SP.vals};D.spOk=function(){return SP.ok};
  function defsFor(name){
    var by={},c=SP.cols.filter(function(x){return x.name===name})[0],ids=[],g=0;
    while(c&&g++<6){ids.push(c.id);c=SP.cols.filter(function(x){return x.id===c.parent_id})[0]}
    return SP.defs.filter(function(d){return ids.indexOf(d.collection_id)>-1&&!by[d.attribute_key]&&(by[d.attribute_key]=1)});
  }
  function field(d,v){
    var k=esc(d.attribute_key),lab=esc(d.label)+(d.unit?" ("+esc(d.unit)+")":"")+(d.required?" *":""),n='name="attr_'+k+'"',t=d.input_type,h="";
    if(t==="select"||t==="boolean"){
      var opts=t==="boolean"?["Yes","No"]:(d.options||[]),cv=t==="boolean"?(v===true||v==="true"?"Yes":v===false||v==="false"?"No":""):(v==null?"":String(v));
      h='<div class="lb"><span>'+lab+'</span><button type="button" class="ds-pick-btn" data-act="ds-sp-pick" data-t="'+esc(d.label)+'" data-o="'+esc(JSON.stringify(opts))+'" data-bool="'+(t==="boolean"?1:0)+'"><span class="v'+(cv?"":" ph")+'">'+esc(cv||"Not stated")+"</span>"+D.icon("chevd",18)+'</button><input type="hidden" '+n+' value="'+esc(t==="boolean"?(cv==="Yes"?"true":cv==="No"?"false":""):cv)+'"></div>';
    }else if(t==="multiselect"){
      var cur=Array.isArray(v)?v:[];
      h='<div class="lb"><span>'+lab+'</span><input type="hidden" '+n+' value="'+esc(cur.join("|"))+'"><div class="ds-chips" role="group" aria-label="'+esc(d.label)+'">'
        +(d.options||[]).concat(cur.filter(function(c){return(d.options||[]).indexOf(c)<0})).map(function(o){var on=cur.indexOf(o)>-1;return'<button type="button" class="ds-chip'+(on?" on":"")+'" data-act="ds-ms" data-v="'+esc(o)+'" aria-pressed="'+on+'">'+esc(o)+"</button>"}).join("")+'<button type="button" class="ds-chip add" data-act="ds-ms-add">'+D.icon("plus",14)+" Other</button></div></div>";
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
    Array.prototype.forEach.call(f.querySelectorAll('[name^="attr_"]'),function(el){var k=el.name.slice(5);if(k==="ds_rest"||k==="variant_colours")return;var t=(f.querySelector('[name="attrt_'+k+'"]')||{}).value;SP.vals[k]=t==="multiselect"?(el.value?el.value.split("|"):[]):(t==="number"?(el.value===""?"":Number(el.value)):el.value)});
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
    if(D.barUpdate)D.barUpdate();
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
      var known={variant_colours:1},gated=!!(cap&&cap.category_attributes_enabled===false);if(!gated)SP.defs.forEach(function(d2){known[d2.attribute_key]=1});
      var rest={};Object.keys(SP.vals||{}).forEach(function(k){if(!known[k])rest[k]=SP.vals[k]});
      var keep2=SP.ok?'<input type="hidden" name="attrt_ds_rest" value="json"><input type="hidden" name="attr_ds_rest" value="'+esc(Object.keys(rest).length?JSON.stringify(rest):"")+'">':"";
      var specs=cap&&cap.category_attributes_enabled===false
        ?'<div id="ds-sec-specs">'+D.gate({icon:"lock",title:"Category specifications",text:"Add details like size, material or ingredients with a higher plan.",action:UP})+"</div>"
        :'<div class="card" id="ds-sec-specs"><h3>Specifications</h3><div id="ds-specs-body">'+specsBody(x.col||"")+"</div></div>";
      html=html.replace('<div class="card" id="ds-sec-photos">',keep2+specs+'<div class="card" id="ds-sec-photos">');
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

  /* ---------- orders: status changes go through the seller_transition RPC, which checks ownership, payment and legal steps ---------- */
  var OS={pending:["New","warn","bell"],accepted:["Accepted","info","okc"],preparing:["Preparing","info","box"],ready:["Ready","info","okc"],handover_pending:["Handover","info","clock"],at_hub:["At hub","info","store"],consolidated:["At hub","info","store"],out_for_delivery:["On its way","info","send"],delivered:["Delivered","ok","okc"],cancelled:["Cancelled","bad","x"],rejected:["Declined","bad","x"],returned:["Returned","bad","alert"]};
  var OT=[["all","All"],["pending","New"],["active","In progress"],["delivered","Delivered"],["closed","Closed"]];
  var OL=[],OF={tab:"all",q:""};
  function grp(o){return o.status==="pending"?"pending":o.status==="delivered"?"delivered":ACTIVE.indexOf(o.status)>-1?"active":"closed"}
  function oname(o){return o.customer_name||"Customer"}
  function orders(orig){
    return Supa.rpc("my_seller_orders",{}).then(unwrap).then(function(list){
      list=Array.isArray(list)?list:[];OL=list;OF.tab="all";OF.q="";
      var cnt={all:list.length,pending:0,active:0,delivered:0,closed:0};list.forEach(function(o){cnt[grp(o)]++});
      var earned=list.filter(function(o){return o.status==="delivered"}).reduce(function(t,o){return t+Number(o.earning||0)},0);
      var cards=list.map(function(o,i){
        var st=OS[o.status]||[o.status,"","box"];
        return'<button type="button" class="ds-card ds-od" data-act="ds-od" data-id="'+i+'" data-g="'+grp(o)+'" data-name="'+esc((oname(o)+" "+(o.customer_city||"")+" "+o.order_id).toLowerCase())+'">'
          +'<span class="ds-ico">'+D.icon(st[2],20)+'</span><span class="ds-grow"><b>'+esc(oname(o))+'</b><small>'+esc(C.ago(o.created_at))+(o.customer_city?" · "+esc(o.customer_city):"")+'</small></span>'
          +'<span class="ds-odr"><b>'+C.money(o.subtotal)+'</b>'+D.chip(st[0],st[1])+'</span></button>';
      }).join("");
      var seg='<div class="ds-chips ds-pf" role="group" aria-label="Filter orders">'+OT.map(function(t){return'<button type="button" class="ds-chip'+(t[0]==="all"?" on":"")+'" data-act="ds-of" data-id="'+t[0]+'" aria-pressed="'+(t[0]==="all"?"true":"false")+'">'+t[1]+' <span class="n">'+(cnt[t[0]]||0)+"</span></button>"}).join("")+"</div>";
      var html='<div class="ds-headrow"><h1 class="ds-title">Orders</h1></div>'
        +(list.length?'<div class="ds-stats">'+D.stat({icon:"bell",value:cnt.pending,label:"New"})+D.stat({icon:"box",value:cnt.active,label:"In progress"})+D.stat({icon:"okc",value:earned,money:true,label:"Earned, delivered"})+"</div>"
          +'<div class="ds-search">'+D.icon("search",20)+'<input type="search" data-dso placeholder="Search by name, city or order" aria-label="Search orders" autocomplete="off"></div>'+seg
          +'<div class="ds-stack" id="ds-olist">'+cards+'</div><div id="ds-onone" hidden>'+D.empty({icon:"search",title:"Nothing here",text:"No orders match this filter or search."})+"</div>"
          :D.empty({icon:"receipt",title:"No orders yet",text:"When a shopper buys from your store, the order appears here with the delivery details."}));
      return out(html,"Orders","portal/orders");
    }).catch(function(){return out(D.empty({icon:"alert",title:"Orders could not load",text:"Check your connection and try again.",action:{label:"Try again",act:"ds-reload"}}),"Orders","portal/orders")});
  }
  function oapply(){
    var q=((document.querySelector("[data-dso]")||{}).value||"").trim().toLowerCase(),n=0;
    Array.prototype.forEach.call(document.querySelectorAll("#ds-olist>[data-g]"),function(c){var ok=(OF.tab==="all"||c.getAttribute("data-g")===OF.tab)&&(!q||c.getAttribute("data-name").indexOf(q)>-1);c.hidden=!ok;if(ok)n++});
    var none=document.getElementById("ds-onone");if(none)none.hidden=n>0;
  }
  A["ds-of"]=function(b){OF.tab=b.getAttribute("data-id");Array.prototype.forEach.call(document.querySelectorAll(".ds-pf .ds-chip"),function(c){var on=c===b;c.classList.toggle("on",on);c.setAttribute("aria-pressed",on?"true":"false")});oapply()};
  document.addEventListener("input",function(e){if(e.target&&e.target.hasAttribute&&e.target.hasAttribute("data-dso"))oapply()});
  function line(k,v){return v?'<div class="ds-kv"><span>'+esc(k)+'</span><b>'+v+"</b></div>":""}
  A["ds-od"]=function(b){
    var o=OL[Number(b.getAttribute("data-id"))];if(!o)return;
    var st=OS[o.status]||[o.status,"","box"],items=Array.isArray(o.items)?o.items:[];
    var its=items.map(function(i){i=i||{};var n=i.name||i.title||i.product_name||"Item",q=Number(i.qty||i.quantity||1),pr=Number(i.price||i.unit_price||0);
      return D.row({icon:"box",title:n+(i.variant||i.size?" · "+(i.variant||i.size):""),sub:"Qty "+q+(pr?" · "+C.money(pr):"")})}).join("");
    var ph=o.customer_phone?'<a href="tel:'+esc(String(o.customer_phone).replace(/[^+\d]/g,""))+'">'+esc(o.customer_phone)+"</a>":"";
    var sh=D.sheet({title:oname(o),html:'<div class="ds-chips">'+D.chip(st[0],st[1],st[2])+(o.route?D.chip(String(o.route).replace(/_/g," ")):"")+"</div>"
      +'<div class="ds-kvs">'+line("Placed",esc(C.when(o.created_at)))+(o.status==="pending"&&o.accept_by?line("Respond by",esc(C.when(o.accept_by))):"")
      +line("Order total",C.money(o.subtotal))+line("Everneed commission",o.commission!=null?C.money(o.commission):"")+line("You earn",o.earning!=null?C.money(o.earning):"")
      +line("City",esc(o.customer_city||""))+line("Address",esc(o.customer_address||""))+line("Phone",ph)+"</div>"
      +(its?'<div class="ds-h"><h2>Items</h2></div><div class="ds-rows">'+its+"</div>":"")
      +'<div class="ds-acts" id="ds-oacts">'+oacts(o)+"</div>"});
    sh.body.addEventListener("click",function(e){
      var x=e.target.closest("[data-to]");if(!x||x.disabled)return;
      var to=x.getAttribute("data-to");
      if(to==="rejected")return D.confirm({title:"Decline this order?",text:"The shopper is told why. Declining cannot be undone.",ok:"Decline order",danger:true,input:{label:"Reason for the shopper",required:true,placeholder:"For example: item is out of stock"}}).then(function(v){if(v)go(o,sh,x,to,{reason:v})});
      if(to==="out_for_delivery")return courier(o,sh,x);
      go(o,sh,x,to,{});
    });
  };
  function oacts(o){
    var r=o.route,m={pending:[["accepted","Accept order"],["rejected","Decline","o d"]],accepted:[["preparing","Start preparing"]],preparing:[["ready","Mark ready"]],ready:r==="direct"?[["out_for_delivery","Send out for delivery"]]:r==="hub"?[["handover_pending","Hand over to hub"]]:[]};
    var l=m[o.status]||[],h=l.map(function(a){return'<button type="button" class="ds-btn'+(a[2]?" "+a[2].replace(" d"," d"):"")+'" data-to="'+a[0]+'">'+a[1]+"</button>"}).join("");
    var note=l.length?(o.status==="pending"?"Accept within the response time, or the order may be cancelled.":""):/^(handover_pending|at_hub|consolidated|out_for_delivery)$/.test(o.status)?"The next step is handled by the Everneed hub or delivery team.":o.status==="ready"?"Waiting for the delivery route to be set.":"";
    if(o.status!=="pending"&&["accepted","preparing","ready","handover_pending"].indexOf(o.status)>-1)note+=(note?" ":"")+"To cancel an accepted order, contact Everneed.";
    return h+(note?'<p class="ds-note">'+esc(note)+"</p>":"");
  }
  function go(o,sh,x,to,payload){
    var all=sh.body.querySelectorAll("[data-to]");Array.prototype.forEach.call(all,function(b){b.disabled=true});x.setAttribute("aria-busy","true");
    Supa.rpc("seller_transition",{p_so:o.id,p_to:to,p_payload:payload||{}}).then(function(){
      sh.close();D.toast(to==="rejected"?"Order declined":"Order updated");A["ds-reload"]&&A["ds-reload"]();
    }).catch(function(e){
      Array.prototype.forEach.call(all,function(b){b.disabled=false});x.removeAttribute("aria-busy");
      D.toast((e&&e.message)||"That did not work. Try again.",true);
    });
  }
  function courier(o,sh,x){
    var c=D.sheet({title:"Send out for delivery",html:'<p class="lead">Optional: who is delivering, so the shopper can reach them.</p>'
      +'<label class="ds-field"><span>Courier name</span><input id="ds-cn" maxlength="80" autocomplete="off"></label>'
      +'<label class="ds-field"><span>Courier phone</span><input id="ds-cp" type="tel" maxlength="30" autocomplete="off"></label>'
      +'<label class="ds-field"><span>Note</span><input id="ds-cm" maxlength="300" autocomplete="off"></label>'
      +'<div class="ds-foot"><button type="button" class="ds-btn o" data-c="0">Cancel</button><button type="button" class="ds-btn" data-c="1">Send out</button></div>'});
    c.body.addEventListener("click",function(e){var b=e.target.closest("[data-c]");if(!b)return;
      if(b.getAttribute("data-c")==="0")return c.close();
      var v=function(i){return(c.body.querySelector(i).value||"").trim()};
      c.close();go(o,sh,x,"out_for_delivery",{courier_name:v("#ds-cn"),courier_phone:v("#ds-cp"),note:v("#ds-cm")});
    });
  };
  if(window.AX&&AX.shell){var shell0=AX.shell;AX.shell=function(kind,active,inner,me){
    var h=shell0.apply(this,arguments);
    if(kind!=="portal"||h.indexOf('href="/portal/products"')<0||h.indexOf('href="/portal/orders"')>-1)return h;
    var on=String(active||"")==="portal/orders";
    h=h.replace(/<a href="\/portal\/products"([^>]*)>[\s\S]*?<\/a>/g,function(m){
      var big=m.indexOf('width="24"')>-1;
      return m+'<a href="/portal/orders"'+(on?' class="on" aria-current="page"':"")+">"+D.icon("receipt",big?24:22)+"<span>Orders</span></a>"});
    h=h.replace('class="ax-tabs" style="--n:4"','class="ax-tabs" style="--n:5"');
    if(on)h=h.replace(/(<a href="\/me")\s+class="on" aria-current="page"/g,"$1");
    return h;
  }}

  /* ---------- messages: compact chat-link card (the list and chips are restyled in ds.css) ---------- */
  var inb=V.inbox;
  V.inbox=function(p){
    return Promise.resolve(inb(p)).then(function(r){
      try{
        if(!r||r.redirect||r.layout!=="portal"||typeof r.html!=="string")return r;
        var m=/<button class="btn s" data-act="copylink" data-l="([^"]*)"/.exec(r.html);if(!m)return r;
        var a=r.html.indexOf('<div class="note"'),b=r.html.indexOf('<div class="ibx"');if(a<0||b<a)return r;
        r.html=r.html.slice(0,a)+'<div class="ds-lnk"><span class="ds-ico">'+D.icon("link",20)+'</span><span class="ds-grow"><b>Your store chat link</b><small>Share it with customers</small></span>'
          +'<button type="button" class="ds-btn s o" data-act="copylink" data-l="'+m[1]+'">Copy link</button></div>'+r.html.slice(b);
        return r;
      }catch(e){return r}
    });
  };

  /* ---------- plan page: your current plan, usage and renewal above the plan carousel ---------- */
  var SUBST={active:["Active","ok"],trialing:["Trial","info"],past_due:["Payment due","bad"],cancelled:["Cancelled","bad"],canceled:["Cancelled","bad"],expired:["Expired","bad"],paused:["Paused","warn"]};
  function planNow(res){
    return Supa.get("stores?select=id&owner_id=eq."+enc(Supa.uid())).then(function(r){
      var st=r&&r[0];if(!st)return res;
      return Promise.all([Supa.rpc("my_store_entitlements",{}).then(unwrap).catch(function(){return null}),Supa.get("store_subscriptions?select=status,current_period_end,plan_id&store_id=eq."+enc(st.id)).catch(soft)]).then(function(a){
        var e=a[0],sub=(a[1]||[])[0];if(!e||e.configured!==true)return res;
        var used=e.active_products||0,lim=e.active_products_unlimited?null:e.active_product_limit,pct=lim?Math.min(100,Math.round(used/lim*100)):0,ss=sub&&SUBST[sub.status]||(sub?[String(sub.status||"").replace(/_/g," "),""]:null);
        var card='<div class="ds-card ds-ringcard ds-cur">'+(lim?D.ring(pct,pct>=80?"warn":"ok",used+" of "+lim+" products used"):"")
          +'<div class="ds-grow"><small>Your current plan</small><b>'+D.plan(e.plan_name||"Plan")+"</b>"
          +'<p>'+(lim?used+" of "+lim+" products used":used+" products, no limit")+"</p>"
          +(e.daily_new_products_unlimited?"":"<small>Today: "+(e.daily_new_products_used||0)+" of "+e.daily_new_product_limit+" new listings</small>")
          +(ss||(sub&&sub.current_period_end)?'<div class="ds-chips">'+(ss?D.chip(ss[0],ss[1]):"")+(sub&&sub.current_period_end?D.chip((sub.status==="trialing"?"Trial ends ":"Renews ")+C.when(sub.current_period_end),"","clock"):"")+"</div>":"")
          +"</div></div>";
        var k='<form data-form="sfplan"';if(typeof res.html!=="string"||res.html.indexOf(k)<0)return res;
        res.html=res.html.replace(k,card+k);return res;
      });
    });
  }
})();
