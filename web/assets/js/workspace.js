/* Seller workspace: dashboard with setup guide, products list, full product editor.
   It sits on top of portal.js. It answers /portal (for live stores), /portal/products and /portal/product/<id>, and hands every
   onboarding state (draft, in review, rejected, suspended, verification, activation) back to portal.js.
   How product options are stored (the same way the app reads them, see js/opts.js):
     axes   the option names, one or two, for example ["Size"] or ["Color","Size"]
     sizes  the option labels, for example ["S","M","L"] or ["Red-M","Red-L","Black-M"] (colour, hyphen, size)
     stocks a map from label to how many are in stock, for example {"Red-M":4}. A missing label means "not tracked".
     stock  the total when there are no options, or the sum of the options. Empty means not tracked. */
(function(){
  var C=Core,esc=C.esc,$=C.$,V=C.V,A=C.A,F=C.F,enc=encodeURIComponent,base=V.portal;
  var W={uid:null,store:null,priv:null,app:null,prods:[],pn:{},cats:[],charts:[],notes:[],at:0,tab:"all",q:"",sel:{}};
  var E=null; /* the product being edited */
  var CUR={NG:"NGN",GH:"GHS",KE:"KES",ZA:"ZAR",GB:"GBP",US:"USD"};
  var SYM={NG:"₦",GH:"GH₵",KE:"KSh",ZA:"R",GB:"£",US:"$"};
  var STATUS={draft:["Draft",""],pending_review:["In review","info"],published:["Live","ok"],rejected:["Needs changes","bad"],archived:["Archived",""]};
  var TABS=[["all","All"],["published","Live"],["pending_review","In review"],["draft","Drafts"],["rejected","Needs changes"],["archived","Archived"]];
  var ORIGINS={NG:"Nigeria",GH:"Ghana",KE:"Kenya",ZA:"South Africa",GB:"United Kingdom",US:"United States",CN:"China",IN:"India",TR:"Turkey",AE:"United Arab Emirates",DE:"Germany",FR:"France",HK:"Hong Kong"};
  /* A label like "Red-M" counts as colour plus size when one side looks like a size. Same rule as the app. */
  var SIZE=/^(\d{1,3}(\.\d)?|[2-6]?x{1,3}[sl]|[2-6]xl|xs|xxs|s|m|l|xl|xxl|xxxl|one size|free size|os)$/i;
  var MAX_PHOTOS=8,MAX_VARIANTS=60;

  /* ---------- small helpers ---------- */
  function clean(v,n){return String(v==null?"":v).replace(/\s+/g," ").trim().slice(0,n||200)}
  function area(v,n){return String(v==null?"":v).replace(/\r/g,"").trim().slice(0,n||2000)}
  function num(v){var n=Number(String(v==null?"":v).replace(/,/g,"").trim());return isFinite(n)?n:NaN}
  function fail(e){C.toast(e&&e.message||"That did not work",true)}
  function need(list){for(var i=0;i<list.length;i++){if(!list[i][0]){C.toast(list[i][1],true);return true}}return false}
  function country(){return(W.store&&W.store.country)||"NG"}
  function sym(){return SYM[country()]||""}
  function fmt(n){try{return new Intl.NumberFormat(undefined,{style:"currency",currency:CUR[country()]||"NGN",maximumFractionDigits:0}).format(n||0)}catch(e){return sym()+(n||0)}}
  function pill(label,cls){return'<span class="pill '+(cls||"")+'">'+esc(label)+"</span>"}
  function byId(id){for(var i=0;i<W.prods.length;i++){if(W.prods[i].id===id)return W.prods[i]}return null}
  function photos(p){return p.images&&p.images.length?p.images:(p.img?[p.img]:[])}
  function splitLabel(l){var m=String(l).split("-");if(m.length<2)return null;var last=m[m.length-1],head=m.slice(0,-1).join("-");if(SIZE.test(last)&&!SIZE.test(head))return[head,last];var first=m[0],rest=m.slice(1).join("-");if(SIZE.test(first)&&!SIZE.test(rest))return[rest,first];return null}
  function again(){C.go(location.pathname,true)}

  /* ---------- data ---------- */
  function load(force){
    var uid=Supa.uid();
    if(!force&&W.uid===uid&&Date.now()-W.at<30000)return Promise.resolve();
    return Supa.get("stores?select=*&owner_id=eq."+enc(uid)).then(function(r){
      W.uid=uid;W.store=r&&r[0]||null;W.prods=[];W.pn={};W.priv=null;W.app=null;W.notes=[];
      if(!W.store)return;
      var id=enc(W.store.id),soft=function(){return[]};
      return Promise.all([
        Supa.get("products?select=*&store_id=eq."+id+"&order=at.desc"),
        Supa.get("product_private?select=product_id,review_note,compliance_ref").catch(soft),
        Supa.get("collections?select=name,grp,icon&order=name.asc").catch(soft),
        Supa.get("size_charts?select=id,name,kind&order=name.asc").catch(soft),
        Supa.get("store_private?select=*&store_id=eq."+id).catch(soft),
        Supa.get("store_applications?select=*&store_id=eq."+id).catch(soft),
        Supa.get("notifications?select=*&order=created_at.desc&limit=6").catch(soft)
      ]).then(function(a){
        W.prods=a[0]||[];(a[1]||[]).forEach(function(x){W.pn[x.product_id]=x});
        W.cats=a[2]||[];W.charts=a[3]||[];W.priv=(a[4]||[])[0]||null;W.app=(a[5]||[])[0]||null;W.notes=a[6]||[];
      });
    }).then(function(){W.at=Date.now()});
  }

  function page(html,active,title,after){return{layout:"portal",active:active,html:html,title:title,after:after||null}}
  V.portal=function(p){
    var sub=p[0]||"";
    if(!Supa.uid()||(sub!==""&&sub!=="products"&&sub!=="product"))return base(p);
    return load(sub!=="product").then(function(){
      var s=W.store;
      if(!s||s.status!=="approved")return base(p);
      if(sub===""){return s.activation_status==="live"?page(home(),"portal","Dashboard"):base(p)}
      if(sub==="products")return page(list(),"portal/products","Products",bindList);
      return page(editor(p[1]),"portal/products","Product",bindEditor);
    });
  };

  /* ---------- inventory wording ---------- */
  function stockText(p){
    var v=p.sizes||[],st=p.stocks||{};
    if(v.length){
      var tracked=v.filter(function(l){return st[l]!=null}),total=tracked.reduce(function(n,l){return n+Number(st[l]||0)},0),out=tracked.filter(function(l){return Number(st[l])<=0}).length;
      return v.length+" variant"+(v.length>1?"s":"")+(tracked.length?" · "+total+" in stock":"")+(out?" · "+out+" sold out":"");
    }
    if(p.stock==null)return"Stock not tracked";
    return p.stock<=0?"Sold out":p.stock+" in stock";
  }
  function isLow(p){
    var v=p.sizes||[],st=p.stocks||{};
    if(v.length)return v.some(function(l){return st[l]!=null&&Number(st[l])<=2});
    return p.stock!=null&&p.stock<=5;
  }
  function counts(){
    var c={all:0,published:0,pending_review:0,draft:0,rejected:0,archived:0};
    W.prods.forEach(function(p){if(c[p.status]!=null)c[p.status]++;if(p.status!=="archived")c.all++});
    return c;
  }

  /* ---------- dashboard ---------- */
  function home(){
    var s=W.store,c=counts(),withoutPhoto=W.prods.filter(function(p){return p.status!=="archived"&&!photos(p).length}).length,
      steps=[
        ["Your store is approved",true,""],
        ["Add your first product",W.prods.length>0,"/portal/product/new"],
        ["Give every product a photo",W.prods.length>0&&withoutPhoto===0,"/portal/products"],
        ["Send a product for review",W.prods.some(function(p){return p.status==="pending_review"||p.status==="published"}),"/portal/products"],
        ["Get a product live",c.published>0,"/portal/products"]
      ],done=steps.filter(function(x){return x[1]}).length,
      guide=done<steps.length?'<div class="card" style="margin-top:18px"><div class="sech"><h3>Set up your store</h3><small>'+done+" of "+steps.length+' done</small></div><div class="meter" aria-hidden="true"><i style="width:'+Math.round(done/steps.length*100)+'%"></i></div>'
        +steps.map(function(x){return'<a class="rw guide-step'+(x[1]?" done":"")+'"'+(x[2]&&!x[1]?' href="'+x[2]+'"':"")+'><span><b>'+(x[1]?"✓ ":"")+esc(x[0])+"</b></span>"+(x[1]?"":'<span class="m">Go</span>')+"</a>"}).join("")+"</div>":"",
      fix=W.prods.filter(function(p){return p.status==="rejected"}).map(function(p){var n=W.pn[p.id];return'<a class="rw" href="/portal/product/'+enc(p.id)+'"><span><b>'+esc(p.name)+"</b><small>"+esc(n&&n.review_note||"Needs changes")+"</small></span><span>Fix</span></a>"}).join(""),
      low=W.prods.filter(function(p){return p.status==="published"&&isLow(p)}).map(function(p){return'<a class="rw" href="/portal/product/'+enc(p.id)+'"><span><b>'+esc(p.name)+"</b><small>"+esc(stockText(p))+"</small></span><span>Restock</span></a>"}).join(""),
      notes=W.notes.length?'<div class="sech"><h3>Messages from Everneed</h3></div>'+W.notes.map(function(n){return'<div class="rw"><span><b>'+esc(n.title)+"</b><small>"+esc(n.body||"")+"</small></span><small>"+C.ago(n.created_at)+"</small></div>"}).join(""):"";
    return'<div class="sech"><h1 style="font-size:2.2rem">'+esc(s.name)+"</h1>"+pill("Live","ok")+"</div>"
      +'<div class="kpis"><div><b>'+c.published+"</b><small>Live products</small></div><div><b>"+c.pending_review+"</b><small>In review</small></div><div><b>"+c.draft+"</b><small>Drafts</small></div><div><b>"+c.rejected+"</b><small>Need changes</small></div></div>"
      +'<div class="row" style="margin-top:6px"><a class="btn" href="/portal/product/new">Add product</a><a class="btn o" href="/portal/products">All products</a><a class="btn o" href="/inbox">Messages</a></div>'
      +guide
      +(fix?'<div class="sech"><h3>Needs your attention</h3></div>'+fix:"")
      +(low?'<div class="sech"><h3>Running low</h3></div>'+low:"")
      +notes;
  }

  /* ---------- products list ---------- */
  function visible(){
    var q=W.q.toLowerCase();
    return W.prods.filter(function(p){
      if(W.tab==="all"?p.status==="archived":p.status!==W.tab)return false;
      return !q||String(p.name).toLowerCase().indexOf(q)>-1||String(p.sku||"").toLowerCase().indexOf(q)>-1;
    });
  }
  function row(p){
    var st=STATUS[p.status]||[p.status,""],n=W.pn[p.id],im=photos(p)[0],
      acts=(p.status==="draft"||p.status==="rejected"?'<button class="btn s" type="button" data-act="wsub" data-id="'+esc(p.id)+'">Submit for review</button>':"")
        +'<a class="btn o s" href="/portal/product/'+enc(p.id)+'">Edit</a>'
        +'<button class="btn o s" type="button" data-act="wdup" data-id="'+esc(p.id)+'">Duplicate</button>'
        +(p.status!=="archived"?'<button class="btn o s" type="button" data-act="warch" data-id="'+esc(p.id)+'">Archive</button>':'<button class="btn o s" type="button" data-act="wrest" data-id="'+esc(p.id)+'">Restore</button>');
    return'<div class="prow"><label class="selbox"><input type="checkbox" data-sel="'+esc(p.id)+'"'+(W.sel[p.id]?" checked":"")+' aria-label="Select '+esc(p.name)+'"></label>'
      +'<a class="pth" href="/portal/product/'+enc(p.id)+'">'+(im?'<img alt="" loading="lazy" src="'+esc(im)+'">':esc(String(p.name).slice(0,2)))+"</a>"
      +'<div class="pin"><a href="/portal/product/'+enc(p.id)+'"><b>'+esc(p.name)+"</b></a><small>"+fmt(p.price)+(p.old>p.price?" · was "+fmt(p.old):"")+" · "+esc(stockText(p))+(p.col?" · "+esc(p.col):"")+"</small>"
      +"<span>"+pill(st[0],st[1])+(p.sku?' <small>SKU '+esc(p.sku)+"</small>":"")+"</span>"
      +(p.status==="rejected"&&n&&n.review_note?"<small>"+esc(n.review_note)+"</small>":"")
      +'<div class="acts">'+acts+"</div></div></div>";
  }
  function rows(){
    var l=visible();
    if(l.length)return l.map(row).join("");
    if(!W.prods.length)return C.empty("No products yet","Add your first product. It goes live after the Everneed team approves it.");
    return C.empty("Nothing here","No products match this tab or search.");
  }
  function tabsHtml(){
    var c=counts();
    return TABS.map(function(t){return'<button type="button" data-tab="'+t[0]+'" class="'+(W.tab===t[0]?"on":"")+'">'+t[1]+"<small>"+c[t[0]]+"</small></button>"}).join("");
  }
  function selectedIds(){return Object.keys(W.sel).filter(function(k){return W.sel[k]})}
  function bulkText(){var n=selectedIds().length;return n?n+" selected":""}
  function list(){
    W.tab=W.tab||"all";
    return'<div id="wsroot"><div class="sech"><h1 style="font-size:2.2rem">Products</h1><a class="btn s" href="/portal/product/new">Add product</a></div>'
      +'<div class="tabs" id="wstabs" role="tablist">'+tabsHtml()+"</div>"
      +'<label class="srch"><span class="sr">Search products</span><input id="wsq" type="search" placeholder="Search by name or SKU" value="'+esc(W.q)+'" autocomplete="off"></label>'
      +'<div id="plist">'+rows()+"</div>"
      +'<div class="actbar" id="wsbulk" hidden><span id="wsbn" class="m"></span><button class="btn o s" type="button" data-bulk="archive">Archive</button><button class="btn o s" type="button" data-bulk="restore">Restore</button><button class="btn s" type="button" data-bulk="review">Submit for review</button></div></div>';
  }
  function refreshList(){
    var box=$("#plist"),t=$("#wstabs"),b=$("#wsbulk");
    if(box)box.innerHTML=rows();
    if(t)t.innerHTML=tabsHtml();
    if(b){var n=selectedIds().length;b.hidden=!n;var s=$("#wsbn");if(s)s.textContent=bulkText()}
  }
  function bindList(){
    var root=$("#wsroot");if(!root)return;
    root.addEventListener("click",function(e){
      var t=e.target.closest("[data-tab]");
      if(t){W.tab=t.getAttribute("data-tab");W.sel={};refreshList();return}
      var b=e.target.closest("[data-bulk]");
      if(b)bulk(b.getAttribute("data-bulk"));
    });
    root.addEventListener("change",function(e){
      var s=e.target.closest("[data-sel]");
      if(s){W.sel[s.getAttribute("data-sel")]=s.checked;refreshList()}
    });
    var q=$("#wsq");
    if(q)q.addEventListener("input",function(){W.q=q.value.trim();refreshList()});
  }
  function setStatus(id,status){return Supa.patch("products",id,{status:status})}
  function afterChange(msg){C.toast(msg);return load(true).then(again)}
  A.wsub=function(b){var p=byId(b.getAttribute("data-id"));if(!p)return;
    if(!photos(p).length){C.toast("Add at least one photo before sending this product for review.",true);return}
    setStatus(p.id,"pending_review").then(function(){return afterChange("Sent for review")}).catch(fail)};
  A.warch=function(b){setStatus(b.getAttribute("data-id"),"archived").then(function(){return afterChange("Archived")}).catch(fail)};
  A.wrest=function(b){setStatus(b.getAttribute("data-id"),"draft").then(function(){return afterChange("Moved back to drafts")}).catch(fail)};
  A.wdup=function(b){
    var p=byId(b.getAttribute("data-id"));if(!p)return;
    var copy={store_id:W.store.id,status:"draft",cty:p.cty||[],name:(p.name+" (copy)").slice(0,160),col:p.col,price:p.price,old:p.old||0,stock:p.stock,descr:p.descr,
      img:p.img,images:p.images||[],chart:p.chart,sizes:p.sizes||[],stocks:p.stocks||{},axes:p.axes||[],maker:p.maker,maker_addr:p.maker_addr,origin:p.origin,ships_from:p.ships_from,weight_g:p.weight_g,dims:p.dims,material:p.material};
    Supa.insert("products",copy).then(function(r){C.toast("Copied as a draft");return load(true).then(function(){C.go("/portal/product/"+enc(r[0].id))})}).catch(fail)};
  function bulk(kind){
    var ids=selectedIds(),to={review:"pending_review",archive:"archived",restore:"draft"}[kind],done=0,skipped=0,errors=[];
    if(!ids.length)return;
    ids.reduce(function(chain,id){
      return chain.then(function(){
        var p=byId(id);
        if(!p||(kind==="review"&&((p.status!=="draft"&&p.status!=="rejected")||!photos(p).length))||(kind==="archive"&&p.status==="archived")||(kind==="restore"&&p.status!=="archived")){skipped++;return}
        return setStatus(id,to).then(function(){done++},function(e){errors.push(p.name+": "+(e&&e.message||"failed"))});
      });
    },Promise.resolve()).then(function(){
      W.sel={};
      C.toast(done+" updated"+(skipped?", "+skipped+" skipped (wrong status or no photo)":"")+(errors.length?". "+errors[0]:""),!!errors.length);
      return load(true);
    }).then(again).catch(fail);
  }

  /* ---------- product editor: state ---------- */
  function list2(v){var seen={},out=[];String(v||"").split(/[,\n]/).forEach(function(x){x=x.replace(/\s+/g," ").trim().slice(0,40);var k=x.toLowerCase();if(x&&!seen[k]){seen[k]=1;out.push(x)}});return out}
  function startEditor(x){
    var sizes=x&&x.sizes||[],axes=x&&x.axes||[],E0={id:x?x.id:"",mode:"none",n1:"Size",v1:"",n2:"Size",v2:"",stocks:Object.assign({},x&&x.stocks||{}),items:photos(x||{}).map(function(u){return{url:u}}),timer:null};
    if(sizes.length){
      var sp=sizes.map(splitLabel);
      if(sp.every(Boolean)){
        var cs=[],ss=[];sp.forEach(function(s){if(cs.indexOf(s[0])<0)cs.push(s[0]);if(ss.indexOf(s[1])<0)ss.push(s[1])});
        E0.mode="two";E0.n1=axes[0]||"Color";E0.v1=cs.join(", ");E0.n2=axes[1]||"Size";E0.v2=ss.join(", ");
      }else{E0.mode="one";E0.n1=axes[0]||"Size";E0.v1=sizes.join(", ")}
    }
    E=E0;
  }
  function labels(){
    if(E.mode==="one")return list2(E.v1);
    if(E.mode==="two"){var out=[];list2(E.v1).forEach(function(c){list2(E.v2).forEach(function(s){out.push(c+"-"+s)})});return out}
    return[];
  }

  /* ---------- product editor: markup ---------- */
  function field(name,label,value,o){
    o=o||{};
    return'<label class="lb">'+label+'<input name="'+name+'" value="'+esc(value==null?"":value)+'"'+(o.max?' maxlength="'+o.max+'"':"")+(o.ph?' placeholder="'+esc(o.ph)+'"':"")+(o.mode?' inputmode="'+o.mode+'"':"")+(o.req?" required":"")+(o.ac?' autocomplete="'+o.ac+'"':"")+">"+(o.hint?'<span class="hint">'+o.hint+"</span>":"")+"</label>";
  }
  function countrySelect(name,label,value){
    var keys=Object.keys(ORIGINS);
    return'<label class="lb">'+label+'<select name="'+name+'"><option value="">Not stated</option>'+keys.map(function(k){return'<option value="'+k+'"'+(k===value?" selected":"")+">"+esc(ORIGINS[k])+"</option>"}).join("")+"</select></label>";
  }
  function categoryOptions(x){
    var names=W.cats.length?W.cats.map(function(c){return c.name}):(CFG.collections||[]).slice(),cur=x?x.col:"";
    if(cur&&names.indexOf(cur)<0)names.unshift(cur);
    return'<option value="">Choose a category</option>'+names.map(function(n){return"<option"+(n===cur?" selected":"")+">"+esc(n)+"</option>"}).join("");
  }
  function editor(id){
    var x=id&&id!=="new"?byId(id):null;
    if(id&&id!=="new"&&!x)return C.empty("Product not found","It may have been removed.")+'<a class="btn o" href="/portal/products">Back to products</a>';
    startEditor(x);
    var pn=x&&W.pn[x.id]||{},st=x?x.status:"draft",sinfo=STATUS[st]||[st,""],mode=E.mode,
      statusHelp={draft:"Only you can see this. Send it for review when it is ready.",pending_review:"Everneed is checking this product. You can still save changes.",published:"Shoppers can see this product. Changing the name, photos or description sends it back for review.",rejected:"Everneed asked for changes. Fix them and send it for review again.",archived:"Hidden from shoppers. Restore it from the products list."}[st]||"";
    var primary=(st==="published"||st==="pending_review"||st==="archived")?'<button class="btn" type="submit" value="save">Save changes</button>'
      :'<button class="btn o" type="submit" value="draft">Save draft</button><button class="btn" type="submit" value="review">'+(st==="rejected"?"Resubmit for review":"Submit for review")+"</button>";
    return(st==="rejected"&&pn.review_note?'<div class="note err"><span><b>Changes needed</b>'+esc(pn.review_note)+"</span></div>":"")
      +'<p class="sm"><a href="/portal/products">‹ Products</a></p><h1 style="font-size:2.2rem;margin-top:4px">'+(x?esc(x.name):"Add product")+"</h1>"
      +'<form data-form="wsprod" id="wsform"><input type="hidden" name="id" value="'+esc(x?x.id:"")+'"><div class="edgrid"><div class="edmain">'

      +'<div class="card"><h3>Product</h3>'+field("name","Title",x&&x.name,{max:160,req:1,ph:"Short, clear product name"})
      +'<label class="lb">Description<textarea name="descr" rows="6" maxlength="3000" placeholder="What it is, what it is made of, who it is for">'+esc(x&&x.descr||"")+"</textarea></label></div>"

      +'<div class="card"><h3>Photos</h3><p class="sm">Up to '+MAX_PHOTOS+' photos. The first one is the cover shoppers see in lists. Large photos are made smaller for you.</p><div class="gal-ed" id="wsmedia"></div></div>'

      +'<div class="card"><h3>Pricing</h3><div class="fgrid">'+field("price","Price ("+sym()+")",x&&x.price,{mode:"decimal",max:12,req:1,ph:"0"})+field("old","Compare-at price ("+sym()+")",x&&x.old?x.old:"",{mode:"decimal",max:12,ph:"Optional",hint:"A higher price shown crossed out, to show a discount."})+'</div><p class="sm" id="wsdisc"></p></div>'

      +'<div class="card"><h3>Inventory</h3><div class="fgrid">'+field("sku","SKU (your own code)",x&&x.sku,{max:60})+field("code","Barcode (EAN, UPC or ISBN)",x&&x.code,{max:40,mode:"numeric"})+"</div>"
      +'<div id="wsqty"'+(mode==="none"?"":" hidden")+'><div class="sw"><span><b>Track quantity</b><small style="display:block">Turn off if you never run out.</small></span><span class="cc"><input type="checkbox" id="wstrack" name="track" value="1"'+(!x||x.stock!=null?" checked":"")+'><label class="chip" for="wstrack">Yes</label></span></div>'
      +'<div id="wsqtyin">'+field("stock","Quantity in stock",x&&x.stock!=null?x.stock:"",{mode:"numeric",max:6,ph:"0"})+"</div></div>"
      +'<p class="sm" id="wsqtynote"'+(mode==="none"?" hidden":"")+'>Quantity is set for each variant below.</p></div>'

      +'<div class="card"><h3>Variants</h3><p class="sm">Does this product come in different sizes or colours?</p>'
      +'<div class="seg" role="radiogroup" aria-label="Variants">'+[["none","No options"],["one","One option"],["two","Colour and size"]].map(function(m){return'<input type="radio" name="vmode" id="vm-'+m[0]+'" value="'+m[0]+'"'+(mode===m[0]?" checked":"")+'><label for="vm-'+m[0]+'">'+m[1]+"</label>"}).join("")+"</div>"
      +'<div id="wsvopts"'+(mode==="none"?" hidden":"")+'><div class="fgrid">'
      +'<label class="lb">Option name<input id="wsn1" value="'+esc(E.n1)+'" maxlength="30" placeholder="Size"></label>'
      +'<label class="lb"><span id="wsv1l">Values</span><input id="wsv1" value="'+esc(E.v1)+'" placeholder="S, M, L, XL"></label>'
      +'<label class="lb" id="wsn2w"'+(mode==="two"?"":" hidden")+'>Second option name<input id="wsn2" value="'+esc(E.n2)+'" maxlength="30" placeholder="Size"></label>'
      +'<label class="lb" id="wsv2w"'+(mode==="two"?"":" hidden")+'>Second option values<input id="wsv2" value="'+esc(E.v2)+'" placeholder="S, M, L, XL or 40, 42, 44"><span class="hint">Use sizes: S, M, L, XL, XXL or numbers like 42.</span></label></div>'
      +'<div class="vtbl" id="wstbl"></div></div></div>'

      +'<div class="card"><h3>Shipping and details</h3><div class="fgrid">'+field("weight","Weight (grams)",x&&x.weight_g,{mode:"decimal",max:9})+field("dims","Size (length × width × height)",x&&x.dims,{max:60,ph:"30 × 20 × 10 cm"})
      +field("material","Material",x&&x.material,{max:80})+field("maker","Brand or maker",x&&x.maker,{max:80})+field("maker_addr","Maker address",x&&x.maker_addr,{max:200})
      +countrySelect("origin","Made in",x&&x.origin)+countrySelect("ships_from","Ships from",(x&&x.ships_from)||country())+"</div></div>"

      +'<div class="card"><h3>Registration</h3>'+field("comp","Registration number, if your product needs one (for example NAFDAC)",pn.compliance_ref,{max:80})+"</div>"
      +'</div><div class="edside">'

      +'<div class="card"><h3>Status</h3><p>'+pill(sinfo[0],sinfo[1])+'</p><p class="sm">'+esc(statusHelp)+"</p></div>"
      +'<div class="card"><h3>Organisation</h3><label class="lb">Category<select name="col" required>'+categoryOptions(x)+"</select></label>"
      +(W.charts.length?'<label class="lb">Size guide<select name="chart"><option value="">None</option>'+W.charts.map(function(c){return'<option value="'+esc(c.id)+'"'+(x&&x.chart===c.id?" selected":"")+">"+esc(c.name)+"</option>"}).join("")+"</select></label>":"")
      +"</div></div></div>"
      +'<div class="actbar"><a class="btn o" href="/portal/products">Cancel</a>'+primary+"</div></form>";
  }

  /* ---------- product editor: behaviour ---------- */
  function drawMedia(){
    var box=$("#wsmedia");if(!box)return;
    box.innerHTML=E.items.map(function(it,i){
      return'<div class="it"><img alt="" src="'+esc(it.url||it.preview)+'">'+(i===0?'<span class="cover">Cover</span>':'<button type="button" class="mk" data-mk="'+i+'" aria-label="Make this the cover">★</button>')+'<button type="button" class="rm" data-rm="'+i+'" aria-label="Remove this photo">✕</button></div>';
    }).join("")+(E.items.length<MAX_PHOTOS?'<label class="it add"><input type="file" id="wsfile" accept="image/*" multiple hidden><span>+ Add photos</span></label>':"");
  }
  function drawVariants(){
    var box=$("#wstbl");if(!box)return;
    if(E.mode==="none"){box.innerHTML="";return}
    var ls=labels();
    if(!ls.length){box.innerHTML='<p class="sm">Type the values above, separated by commas. A row appears for each one.</p>';return}
    if(ls.length>MAX_VARIANTS){box.innerHTML='<div class="note err"><span><b>Too many variants</b>You can have up to '+MAX_VARIANTS+". This setup makes "+ls.length+".</span></div>";return}
    box.innerHTML='<div class="vrow vh"><b>Variant</b><b>In stock</b></div>'+ls.map(function(l,i){
      return'<div class="vrow"><span>'+esc(l)+'</span><input type="number" min="0" step="1" inputmode="numeric" data-vl="'+i+'" placeholder="Not tracked" aria-label="Stock for '+esc(l)+'" value="'+(E.stocks[l]!=null?esc(E.stocks[l]):"")+'"></div>';
    }).join("")+'<p class="sm" id="wssum"></p>';
    sumStock();
  }
  function sumStock(){
    var s=$("#wssum");if(!s)return;
    var ls=labels(),tracked=ls.filter(function(l){return E.stocks[l]!=null}),total=tracked.reduce(function(n,l){return n+Number(E.stocks[l]||0)},0);
    s.textContent=tracked.length?"Total in stock: "+total+(tracked.length<ls.length?" (some variants are not tracked)":""):"Leave a box empty if you do not track that variant.";
  }
  function drawMode(){
    var m=E.mode;
    [["wsvopts",m!=="none"],["wsqty",m==="none"],["wsn2w",m==="two"],["wsv2w",m==="two"]].forEach(function(p){var el=document.getElementById(p[0]);if(el)el.hidden=!p[1]});
    var n=$("#wsqtynote");if(n)n.hidden=(m==="none");
    var l=$("#wsv1l");if(l)l.textContent=m==="two"?"Colour values":"Values";
    var v=$("#wsv1");if(v)v.placeholder=m==="two"?"Red, Black, Navy":"S, M, L, XL";
    drawVariants();
  }
  function discount(){
    var f=$("#wsform"),el=$("#wsdisc");if(!f||!el)return;
    var p=num(f.price.value),o=num(f.old.value);
    el.textContent=(o>0&&p>0&&o>p)?"Shoppers see "+Math.round((1-p/o)*100)+"% off.":(o>0&&p>0&&o<=p?"The compare-at price should be higher than the price.":"");
  }
  function bindEditor(){
    var f=$("#wsform");if(!f)return;
    drawMedia();drawMode();discount();
    var tr=$("#wstrack"),qi=$("#wsqtyin");
    function trk(){if(qi)qi.hidden=!(tr&&tr.checked)}
    if(tr){tr.addEventListener("change",trk);trk()}
    f.addEventListener("click",function(e){
      var rm=e.target.closest("[data-rm]"),mk=e.target.closest("[data-mk]");
      if(rm){var i=+rm.getAttribute("data-rm"),it=E.items[i];if(it&&it.preview){try{URL.revokeObjectURL(it.preview)}catch(x){}}E.items.splice(i,1);drawMedia();return}
      if(mk){var j=+mk.getAttribute("data-mk"),moved=E.items.splice(j,1)[0];E.items.unshift(moved);drawMedia()}
    });
    f.addEventListener("change",function(e){
      var t=e.target;
      if(t.id==="wsfile"){
        var room=MAX_PHOTOS-E.items.length,files=[].slice.call(t.files||[]).filter(function(x){return /^image\//.test(x.type)});
        if(files.length>room)C.toast("Only "+MAX_PHOTOS+" photos are allowed. Extra ones were skipped.",true);
        files.slice(0,room).forEach(function(file){E.items.push({file:file,preview:URL.createObjectURL(file)})});
        drawMedia();return;
      }
      if(t.name==="vmode"){
        E.mode=t.value;
        if(E.mode==="two"){if(E.n1==="Size")E.n1="Color";if(!E.n2)E.n2="Size";var a=$("#wsn1");if(a)a.value=E.n1}
        if(E.mode==="one"&&E.n1==="Color"){E.n1="Size";var b=$("#wsn1");if(b)b.value=E.n1}
        drawMode();
      }
    });
    f.addEventListener("input",function(e){
      var t=e.target;
      if(t.name==="price"||t.name==="old"){discount();return}
      if(t.id==="wsn1")E.n1=t.value;
      else if(t.id==="wsn2")E.n2=t.value;
      else if(t.id==="wsv1"||t.id==="wsv2"){if(t.id==="wsv1")E.v1=t.value;else E.v2=t.value;clearTimeout(E.timer);E.timer=setTimeout(drawVariants,200)}
      else if(t.getAttribute&&t.getAttribute("data-vl")!==null){
        var l=labels()[+t.getAttribute("data-vl")];
        if(l){if(t.value==="")delete E.stocks[l];else E.stocks[l]=Number(t.value)}
        sumStock();
      }
    });
  }

  /* ---------- photos: make them smaller, then upload ---------- */
  function shrink(file){
    return new Promise(function(done){
      if(file.type==="image/gif"&&file.size<4e6)return done(file);
      var img=new Image(),url=URL.createObjectURL(file);
      img.onload=function(){
        var w=img.naturalWidth,h=img.naturalHeight,k=Math.min(1,1600/Math.max(w,h));
        if(k===1&&file.size<1500000){URL.revokeObjectURL(url);return done(file)}
        var cv=document.createElement("canvas");cv.width=Math.max(1,Math.round(w*k));cv.height=Math.max(1,Math.round(h*k));
        var cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(img,0,0,cv.width,cv.height);
        cv.toBlob(function(b){URL.revokeObjectURL(url);if(!b)return done(file);done(new File([b],(file.name||"photo").replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}))},"image/jpeg",0.85);
      };
      img.onerror=function(){URL.revokeObjectURL(url);done(file)};
      img.src=url;
    });
  }
  function uploadAll(){
    var urls=[],total=E.items.filter(function(i){return i.file}).length,n=0;
    return E.items.reduce(function(chain,it){
      return chain.then(function(){
        if(it.url){urls.push(it.url);return}
        n++;C.toast("Uploading photo "+n+" of "+total+"…");
        return shrink(it.file).then(function(f){return Supa.upload(f,"stores/"+W.store.id)}).then(function(u){urls.push(u)});
      });
    },Promise.resolve()).then(function(){return urls});
  }

  /* ---------- product editor: save ---------- */
  function collect(d,action){
    var name=clean(d.name,160),price=num(d.price),old=d.old?num(d.old):0,labs=labels(),mode=E.mode,tracked=!!d.track,qty=String(d.stock||"").trim(),
      weight=String(d.weight||"").trim()===""?null:num(d.weight),stocks={},stock=null,sizes=[],axes=[];
    if(need([[name.length>=2,"Enter the product title."],[d.col,"Choose a category."],[price>0&&isFinite(price),"Enter a price above zero."],[!d.old||(old>0&&isFinite(old)),"The compare-at price must be a number."],[weight===null||(isFinite(weight)&&weight>=0),"Weight must be a number in grams."]]))return null;
    if(mode==="none"){
      if(tracked){
        var q=Number(qty);
        if(need([[qty!==""&&Number.isInteger(q)&&q>=0,"Enter how many you have in stock, or turn off Track quantity."]]))return null;
        stock=q;
      }
    }else{
      var n1=clean(E.n1,30),n2=clean(E.n2,30);
      if(need([[n1,"Give the option a name, for example Size."],[mode!=="two"||n2,"Give the second option a name."],[labs.length>0,"Add at least one option value."],[labs.length<=MAX_VARIANTS,"That makes too many variants. The limit is "+MAX_VARIANTS+"."]]))return null;
      if(mode==="two"){
        var bad=list2(E.v2).filter(function(s){return !SIZE.test(s)});
        if(need([[list2(E.v1).length>0,"Add at least one colour."],[bad.length===0,"These are not sizes: "+bad.join(", ")+". Use S, M, L, XL or numbers like 42, or choose One option."]]))return null;
      }
      var all=true,total=0;
      for(var i=0;i<labs.length;i++){
        var v=E.stocks[labs[i]];
        if(v==null){all=false;continue}
        if(need([[Number.isInteger(v)&&v>=0,"Stock for "+labs[i]+" must be a whole number, or empty."]]))return null;
        stocks[labs[i]]=v;total+=v;
      }
      stock=all?total:null;sizes=labs;axes=mode==="two"?[n1,n2]:[n1];
    }
    if(action==="review"&&need([[E.items.length>0,"Add at least one photo before sending this product for review."]]))return null;
    return{name:name,col:d.col,price:price,old:old||0,stock:stock,descr:area(d.descr,3000)||null,
      sku:clean(d.sku,60)||null,code:clean(d.code,40)||null,weight_g:weight,dims:clean(d.dims,60)||null,material:clean(d.material,80)||null,
      maker:clean(d.maker,80)||null,maker_addr:clean(d.maker_addr,200)||null,origin:d.origin||null,ships_from:d.ships_from||null,chart:d.chart||null,
      sizes:sizes,stocks:stocks,axes:axes};
  }
  F.wsprod=function(f,d,e){
    var action=(e.submitter&&e.submitter.value)||"save",btn=e.submitter,ex=d.id?byId(d.id):null,body=collect(d,action);
    if(!body)return;
    var all=[].slice.call(f.querySelectorAll("button[type=submit]"));
    all.forEach(function(b){b.disabled=true});
    var row=null;
    uploadAll().then(function(urls){
      body.images=urls;body.img=urls[0]||null;
      return ex?Supa.patch("products",ex.id,body):Supa.insert("products",Object.assign({store_id:W.store.id,status:"draft",cty:[]},body));
    }).then(function(r){
      row=r&&r[0]||ex;if(!row)throw new Error("Could not save the product");
      var comp=clean(d.comp,80),has=!!W.pn[row.id];
      if(!comp&&!has)return;
      return has?Supa.patchBy("product_private","product_id",row.id,{compliance_ref:comp||null}):Supa.insert("product_private",{product_id:row.id,compliance_ref:comp});
    }).then(function(){
      if(action==="review"&&row.status!=="pending_review"&&row.status!=="published")return Supa.patch("products",row.id,{status:"pending_review"}).then(function(r){row=r&&r[0]||row});
    }).then(function(){
      var msg=action==="review"?"Sent for review":(ex&&ex.status==="published"&&row.status==="pending_review"?"Saved. Because the name, photos or description changed, Everneed will review it again before it goes back live.":"Saved");
      C.toast(msg);return load(true);
    }).then(function(){C.go("/portal/products")}).catch(function(err){all.forEach(function(b){b.disabled=false});fail(err)});
  };
})();
