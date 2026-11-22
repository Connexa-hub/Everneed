/* Product editor upgrades (loads after ds-seller.js; wraps V.portal for the editor page only):
   - Variant builder: options (Colour, Size, Type, Material and any custom name) are chosen in bottom sheets, with presets and custom values.
   - Colour sheet: named swatches, an RGB mixer (sliders, hex and the phone's own picker) and an automatic colour NAME ("Light Brown") that
     becomes the variant value shoppers see. The exact colour is stored beside it as attributes.variant_colours (name to hex).
   - Several options and every variant at once; "set stock for all"; per-variant stock stays in the existing table.
   - Specification fields that are lists get "choose or type your own" sheets.
   - A calmer bottom action bar with a readiness bar.
   The old inputs (#wsn1, #wsv1, #wsn2, #wsv2, vmode radios) stay in the form, hidden, and keep driving workspace.js, so saving is unchanged.
   Per-variant price, photo and SKU need a backend contract (request R10); the page says so. */
(function(){
  var C=window.Core,D=window.DS,esc=C.esc,V=C.V,A=C.A,old=V.portal;
  if(!D||!old)return;
  var doc=document;

  /* ---------- colour names ---------- */
  var NAMED=[["Black","#111111"],["White","#FFFFFF"],["Grey","#808080"],["Light Grey","#D3D3D3"],["Charcoal","#36454F"],["Silver","#C0C0C0"],["Red","#D62828"],["Burgundy","#800020"],["Pink","#F4A6C0"],["Hot Pink","#E8478B"],
    ["Orange","#F77F00"],["Yellow","#FCD34D"],["Gold","#D4AF37"],["Cream","#F5F0DC"],["Beige","#D9C3A0"],["Tan","#C9A37A"],["Light Brown","#A9744F"],["Brown","#7B4A2B"],["Dark Brown","#4A2C1A"],["Green","#2E9E5B"],
    ["Olive","#6B7A2A"],["Lime","#A6D230"],["Mint","#A8E6CF"],["Teal","#0F8B8D"],["Sky Blue","#7EC8F2"],["Blue","#2563EB"],["Navy","#14213D"],["Purple","#7E3FBF"],["Lavender","#C9B6F2"],["Coral","#FF7F6B"]];
  function rgb(h){h=String(h||"").replace("#","");if(h.length===3)h=h.replace(/(.)/g,"$1$1");var n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255]}
  function hex(r,g,b){return"#"+[r,g,b].map(function(v){v=Math.max(0,Math.min(255,Math.round(v)||0));return(v<16?"0":"")+v.toString(16)}).join("").toUpperCase()}
  function validHex(h){return/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(h||"").trim())}
  function norm(h){h=String(h).trim().replace("#","");if(h.length===3)h=h.replace(/(.)/g,"$1$1");return"#"+h.toUpperCase()}
  function dist(a,b){var rm=(a[0]+b[0])/2,dr=a[0]-b[0],dg=a[1]-b[1],db=a[2]-b[2];return(2+rm/256)*dr*dr+4*dg*dg+(2+(255-rm)/256)*db*db}
  function nameOf(h){var c=rgb(h),best=NAMED[0],bd=1e12;NAMED.forEach(function(n){var d=dist(c,rgb(n[1]));if(d<bd){bd=d;best=n}});return best[0]}
  function lum(h){var c=rgb(h);return(0.299*c[0]+0.587*c[1]+0.114*c[2])/255}
  function hexOfName(n){var k=String(n).toLowerCase(),r="";NAMED.forEach(function(x){if(x[0].toLowerCase()===k)r=x[1]});return r}
  D.colourName=nameOf;

  /* ---------- presets per option kind ---------- */
  var KINDS=[["Colour","palette"],["Size","ruler"],["Type","tag"],["Material","layers"],["Storage","box"],["Pack size","box"],["Scent","tag"],["Flavour","tag"],["Volume","tag"],["Custom option","plus"]];
  var PRE={
    size:[["Clothing",["XS","S","M","L","XL","XXL","3XL"]],["Shoes",["36","37","38","39","40","41","42","43","44","45","46"]],["Waist and numbers",["28","30","32","34","36","38","40"]],["Other",["One size","Free size"]],["Kids",["0 to 3 months","3 to 6 months","6 to 12 months","1 to 2 years","2 to 4 years","4 to 6 years"]]],
    material:[["Common",["Cotton","Leather","Faux leather","Wool","Silk","Linen","Polyester","Denim","Wood","Metal","Plastic","Glass"]]],
    storage:[["Common",["32GB","64GB","128GB","256GB","512GB","1TB"]]],
    "pack size":[["Common",["Single","Pack of 2","Pack of 3","Pack of 6","Pack of 12"]]],
    scent:[["Common",["Unscented","Rose","Lavender","Vanilla","Citrus","Fresh"]]],
    flavour:[["Common",["Original","Chocolate","Vanilla","Strawberry","Mango","Spicy"]]],
    volume:[["Common",["50ml","100ml","250ml","500ml","1 litre","5 litres"]]],
    type:[["Ideas",["Standard","Premium","Deluxe","Slim","Regular","Large"]]]
  };
  function kindKey(n){return String(n||"").trim().toLowerCase()}
  function isColour(n){var k=kindKey(n);return k==="colour"||k==="color"}
  function split(v){var seen={},out=[];String(v||"").split(/[,\n]/).forEach(function(x){x=x.replace(/\s+/g," ").trim().slice(0,40);var k=x.toLowerCase();if(x&&!seen[k]){seen[k]=1;out.push(x)}});return out}

  /* ---------- chooser sheet: presets, your own value, colour mixer ---------- */
  var ICON_OK=function(){return D.icon("check",16)};
  D.choose=function(o){
    var kind=o.kind||"",colour=kind==="colour",multi=o.multi!==false,sel=(o.selected||[]).slice(),hx=Object.assign({},o.hex||{}),mode="list",mix={r:166,g:116,b:79,name:"",auto:true};
    var extra=sel.filter(function(v){return!inPresets(v)});
    function inPresets(v){var k=String(v).toLowerCase();if(colour)return!!hexOfName(v);return(o.groups||[]).some(function(g){return g[1].some(function(x){return x.toLowerCase()===k})})}
    function has(v){return sel.some(function(x){return x.toLowerCase()===String(v).toLowerCase()})}
    function chip(v,swatch){var on=has(v);return swatch?'<button type="button" class="ds-swt'+(on?" on":"")+'" data-v="'+esc(v)+'" aria-pressed="'+on+'" style="--c:'+swatch+';--t:'+(lum(swatch)>.6?"#111":"#fff")+'"><i>'+(on?ICON_OK():"")+"</i><span>"+esc(v)+"</span></button>"
      :'<button type="button" class="ds-chip'+(on?" on":"")+'" data-v="'+esc(v)+'" aria-pressed="'+on+'">'+esc(v)+"</button>"}
    function listView(){
      var h='<div class="ds-ch">';
      if(colour){
        h+='<div class="ds-swgrid">'+NAMED.map(function(n){return chip(n[0],n[1])}).join("")+"</div>";
        var cu=sel.filter(function(v){return!hexOfName(v)});
        if(cu.length)h+='<p class="ds-chl">Your colours</p><div class="ds-swgrid">'+cu.map(function(v){return chip(v,hx[v]||"#9CA3AF")}).join("")+"</div>";
        h+='<button type="button" class="ds-btn o w" data-x="mix">'+D.icon("palette",18)+" Mix a colour with RGB</button>";
      }else{
        (o.groups||[]).forEach(function(g){h+='<p class="ds-chl">'+esc(g[0])+'</p><div class="ds-chips">'+g[1].map(function(v){return chip(v)}).join("")+"</div>"});
        var cu=sel.filter(function(v){return!inPresets(v)});
        if(cu.length)h+='<p class="ds-chl">Your own</p><div class="ds-chips">'+cu.map(function(v){return chip(v)}).join("")+"</div>";
        h+='<p class="ds-chl">Add your own</p><div class="ds-addrow"><input type="text" maxlength="40" placeholder="'+esc(o.placeholder||"Type a value")+'" aria-label="Your own value" enterkeyhint="done"><button type="button" class="ds-btn" data-x="add">'+D.icon("plus",16)+" Add</button></div>";
      }
      h+='</div><div class="ds-chfoot"><span class="ds-chn">'+(multi?sel.length+" selected":"")+'</span><button type="button" class="ds-btn o" data-x="cancel">Cancel</button><button type="button" class="ds-btn" data-x="done">Done</button></div>';
      return h;
    }
    function mixView(){
      var h0=hex(mix.r,mix.g,mix.b),nm=mix.auto?nameOf(h0):mix.name;
      return'<div class="ds-ch ds-mix"><div class="ds-mixprev" style="--c:'+h0+'"><b>'+esc(nm)+"</b><small>"+h0+" · rgb("+mix.r+", "+mix.g+", "+mix.b+")</small></div>"
        +["r","g","b"].map(function(k,i){return'<label class="ds-slr"><span>'+["Red","Green","Blue"][i]+'</span><input type="range" min="0" max="255" value="'+mix[k]+'" data-ch="'+k+'" aria-label="'+["Red","Green","Blue"][i]+'"><input type="number" min="0" max="255" inputmode="numeric" value="'+mix[k]+'" data-chn="'+k+'" aria-label="'+["Red","Green","Blue"][i]+' value"></label>'}).join("")
        +'<div class="ds-addrow"><label class="ds-fl">Hex<input type="text" maxlength="7" value="'+h0+'" data-hex autocapitalize="characters" aria-label="Hex colour"></label><label class="ds-fl">Pick on screen<input type="color" value="'+h0.toLowerCase()+'" data-pick aria-label="Pick a colour on screen"></label></div>'
        +'<label class="ds-fl">Colour name shoppers will see<input type="text" maxlength="40" value="'+esc(nm)+'" data-nm aria-label="Colour name"></label>'
        +'<p class="ds-chl">The name updates as you mix. Rename it if you like.</p></div>'
        +'<div class="ds-chfoot"><button type="button" class="ds-btn o" data-x="back">Back</button><button type="button" class="ds-btn" data-x="addc">Add colour</button></div>';
    }
    var sh=D.sheet({title:o.title||"Choose",html:listView(),snap:true});
    function draw(){var y=sh.body.scrollTop;sh.body.innerHTML=mode==="mix"?mixView():listView();sh.body.scrollTop=y}
    function setMix(from){
      var h0=hex(mix.r,mix.g,mix.b),b=sh.body,q=function(s){return b.querySelector(s)};
      ["r","g","b"].forEach(function(k){var r=q('[data-ch="'+k+'"]'),n=q('[data-chn="'+k+'"]');if(from!=="s"&&r)r.value=mix[k];if(from!=="n"&&n)n.value=mix[k]});
      var hx2=q("[data-hex]");if(hx2&&from!=="h")hx2.value=h0;var pk=q("[data-pick]");if(pk)pk.value=h0.toLowerCase();
      if(mix.auto){var nm=q("[data-nm]");if(nm&&from!=="m")nm.value=nameOf(h0)}
      var pv=q(".ds-mixprev");if(pv){pv.style.setProperty("--c",h0);pv.querySelector("b").textContent=(mix.auto?nameOf(h0):mix.name)||nameOf(h0);pv.querySelector("small").textContent=h0+" · rgb("+mix.r+", "+mix.g+", "+mix.b+")"}
    }
    sh.body.addEventListener("click",function(e){
      var t=e.target.closest("[data-v],[data-x]");if(!t)return;
      if(t.hasAttribute("data-v")){var v=t.getAttribute("data-v"),i=-1;sel.forEach(function(x,k){if(x.toLowerCase()===v.toLowerCase())i=k});
        if(i>-1)sel.splice(i,1);else{if(!multi)sel=[];sel.push(v)}
        if(!multi){sh.close(sel.slice());return}draw();return}
      var x=t.getAttribute("data-x");
      if(x==="done")sh.close(sel.slice());else if(x==="cancel")sh.close(null);
      else if(x==="mix"){mode="mix";mix.auto=true;draw()}
      else if(x==="back"){mode="list";draw()}
      else if(x==="addc"){var h0=hex(mix.r,mix.g,mix.b),nm=((mix.auto?nameOf(h0):mix.name)||"").replace(/\s+/g," ").trim().slice(0,40)||nameOf(h0);
        hx[nm]=h0;if(!has(nm)){if(!multi)sel=[];sel.push(nm)}mode="list";draw()}
      else if(x==="add"){var inp=sh.body.querySelector(".ds-addrow input"),v2=(inp.value||"").replace(/\s+/g," ").trim().slice(0,40);if(!v2){inp.focus();return}
        if(o.noDash)v2=v2.replace(/-/g," ");if(!has(v2)){if(!multi)sel=[];sel.push(v2)}if(!multi){sh.close(sel.slice());return}draw();var n2=sh.body.querySelector(".ds-addrow input");if(n2)n2.focus()}
    });
    sh.body.addEventListener("input",function(e){
      var t=e.target;
      if(t.hasAttribute("data-ch")){mix[t.getAttribute("data-ch")]=+t.value;setMix("s")}
      else if(t.hasAttribute("data-chn")){var k=t.getAttribute("data-chn");mix[k]=Math.max(0,Math.min(255,+t.value||0));setMix("n")}
      else if(t.hasAttribute("data-hex")){if(validHex(t.value)){var c=rgb(norm(t.value));mix.r=c[0];mix.g=c[1];mix.b=c[2];setMix("h")}}
      else if(t.hasAttribute("data-pick")){var c2=rgb(t.value);mix.r=c2[0];mix.g=c2[1];mix.b=c2[2];setMix("p")}
      else if(t.hasAttribute("data-nm")){mix.auto=false;mix.name=t.value;var pv=sh.body.querySelector(".ds-mixprev b");if(pv)pv.textContent=t.value||nameOf(hex(mix.r,mix.g,mix.b))}
    });
    sh.body.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target.matches&&e.target.matches(".ds-addrow input[type=text]")){e.preventDefault();var b=sh.body.querySelector('[data-x="add"]');if(b)b.click()}});
    return sh.done.then(function(v){return v==null?null:{values:v,hex:hx}});
  };

  /* small input sheet (DS.confirm has a minimum of 3 characters, too long for "XL" or a stock number) */
  function ask(o){
    var sh=D.sheet({title:o.title,html:(o.text?'<p class="lead">'+esc(o.text)+"</p>":"")+'<div class="ds-ch"><label class="ds-fl">'+esc(o.label||"")+'<input type="'+(o.number?"number":"text")+'"'+(o.number?' min="0" step="1" inputmode="numeric"':' maxlength="'+(o.max||40)+'"')+' placeholder="'+esc(o.placeholder||"")+'" enterkeyhint="done"></label><p class="ds-chl" id="ds-askerr" role="alert" style="color:var(--danger)"></p></div><div class="ds-chfoot"><button type="button" class="ds-btn o" data-x="cancel">Cancel</button><button type="button" class="ds-btn" data-x="ok">'+esc(o.ok||"Add")+"</button></div>",focus:"input"});
    function go(){var i=sh.body.querySelector("input"),v=(i.value||"").replace(/\s+/g," ").trim();if(!v){sh.body.querySelector("#ds-askerr").textContent="Enter a value.";i.focus();return}
      if(o.number&&(!/^\d+$/.test(v))){sh.body.querySelector("#ds-askerr").textContent="Enter a whole number, zero or more.";i.focus();return}sh.close(v)}
    sh.body.addEventListener("click",function(e){var b=e.target.closest("[data-x]");if(!b)return;if(b.getAttribute("data-x")==="cancel")sh.close(null);else go()});
    sh.body.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();go()}});
    return sh.done.then(function(v){return v==null?null:v});
  }
  D.ask=ask;

  /* ---------- variant builder ---------- */
  var COL={};/* colour name to hex, for swatches */
  function form(){return doc.getElementById("wsform")}
  function el(id){return doc.getElementById(id)}
  function fire(node,type){node.dispatchEvent(new Event(type,{bubbles:true}))}
  function readOpts(){
    var f=form();if(!f)return[];var m=(f.querySelector('input[name="vmode"]:checked')||{}).value||"none",o=[];
    if(m!=="none")o.push({name:(el("wsn1")||{}).value||"",values:split((el("wsv1")||{}).value)});
    if(m==="two")o.push({name:(el("wsn2")||{}).value||"",values:split((el("wsv2")||{}).value)});
    return o;
  }
  function writeOpts(o){
    var f=form();if(!f)return;var m=o.length===0?"none":o.length===1?"one":"two",r=el("vm-"+m);
    if(r&&!r.checked){r.checked=true;fire(r,"change")}
    if(o[0]){set("wsn1",o[0].name);set("wsv1",o[0].values.join(", "))}
    if(o[1]){set("wsn2",o[1].name);set("wsv2",o[1].values.map(function(v){return v.replace(/-/g," ")}).join(", "))}
    saveColours(o);draw();
  }
  function set(id,v){var n=el(id);if(!n)return;n.value=v;fire(n,"input")}
  function saveColours(o){
    var out={};o.forEach(function(x){if(isColour(x.name))x.values.forEach(function(v){var h=COL[v]||hexOfName(v);if(h)out[v]=h})});
    var h=el("ds-vcol");if(h)h.value=Object.keys(out).length?JSON.stringify(out):"";
  }
  function swatchOf(v){var h=COL[v]||hexOfName(v);return h?'<i class="ds-dot" style="--c:'+h+'"></i>':""}
  function draw(){
    var box=el("ds-vb");if(!box)return;var o=readOpts(),n=1;
    o.forEach(function(x){n*=Math.max(1,x.values.length)});
    var cards=o.map(function(x,i){
      var cl=isColour(x.name);
      return'<article class="ds-card ds-vo"><div class="ds-voh"><span class="ds-voi">'+D.icon(cl?"palette":"layers",20)+'</span><div class="ds-grow"><b>'+esc(x.name||"Option")+"</b><small>"+x.values.length+" value"+(x.values.length===1?"":"s")+'</small></div>'
        +'<button type="button" class="ds-btn s o" data-act="ds-vo-edit" data-i="'+i+'">'+D.icon("edit",16)+' Edit</button><button type="button" class="ds-btn s g" data-act="ds-vo-del" data-i="'+i+'" aria-label="Remove '+esc(x.name||"option")+'">'+D.icon("trash",16)+"</button></div>"
        +'<div class="ds-chips">'+(x.values.length?x.values.map(function(v){return'<span class="ds-chip">'+(cl?swatchOf(v):"")+esc(v)+"</span>"}).join(""):'<span class="ds-sub">No values yet.</span>')+"</div></article>";
    }).join("");
    var tooMany=n>200;
    box.innerHTML=(o.length?"":'<div class="ds-vempty"><span>'+D.icon("layers",26)+'</span><b>No options</b><p>This product has one version. Add Colour, Size or anything else if it comes in different versions.</p></div>')
      +cards
      +(o.length<2?'<button type="button" class="ds-btn'+(o.length?" o":"")+' w" data-act="ds-vo-add">'+D.icon("plus",18)+(o.length?" Add another option":" Add an option")+"</button>":'<p class="ds-sub">Two options is the most a product can have.</p>')
      +(o.length?'<div class="ds-vsum"><b>'+n+" variant"+(n===1?"":"s")+'</b><span>'+(tooMany?"That is too many. Remove some values.":"Every combination is created for you. Set the stock below.")+'</span><button type="button" class="ds-btn s o" data-act="ds-vo-fill"'+(n>0&&!tooMany?"":" disabled")+">Set stock for all</button></div>":"");
    saveColours(o);decorate();
  }
  function decorate(){
    var t=el("wstbl");if(!t)return;var o=readOpts(),ci=-1;o.forEach(function(x,i){if(isColour(x.name))ci=i});
    Array.prototype.forEach.call(t.querySelectorAll(".vrow:not(.vh)"),function(r){
      if(r.getAttribute("data-dd")==="1")return;var s=r.querySelector("span");if(!s)return;
      var txt=s.textContent,parts=txt.split("-"),name=txt;
      if(ci===0&&o.length===2){name=parts.slice(0,-1).join("-")}else if(ci===1&&o.length===2){name=parts[parts.length-1]}else if(ci===0)name=txt;
      var d=ci>-1?swatchOf(name):"";if(d)s.innerHTML=d+esc(txt);r.setAttribute("data-dd","1");
    });
  }
  function pickKind(){
    var items=KINDS.map(function(k){return{label:k[0],icon:k[1],run:function(){}}});
    return D.pick({title:"What does it come in?",options:KINDS.map(function(k){return{value:k[0],label:k[0],icon:k[1]}}),search:false}).then(function(v){
      if(v==null)return null;if(v!=="Custom option")return v;
      return ask({title:"Name this option",text:"For example: Style, Capacity or Edition.",label:"Option name",max:30,ok:"Continue"}).then(function(n){return n?n.slice(0,30):null})});
  }
  function valuesFor(name,current,second){
    var k=kindKey(name),cl=isColour(name),groups=cl?null:(PRE[k]||PRE[k==="sizes"?"size":""]||PRE.type);
    if(k==="size"||k==="sizes")groups=PRE.size;
    var hex0={};current.forEach(function(v){var h=COL[v]||hexOfName(v);if(h)hex0[v]=h});
    return D.choose({title:cl?"Choose colours":"Choose "+(name||"values").toLowerCase()+" values",kind:cl?"colour":"",selected:current,hex:hex0,groups:groups,noDash:second,placeholder:cl?"":"Type a "+(name||"value").toLowerCase()});
  }
  function apply(o,i,name,res){
    var next=o.map(function(x){return{name:x.name,values:x.values.slice()}});
    var rec={name:name,values:res.values};
    if(i>=next.length)next.push(rec);else next[i]=rec;
    Object.keys(res.hex||{}).forEach(function(k){COL[k]=res.hex[k]});
    writeOpts(next);
  }
  A["ds-vo-add"]=function(){var o=readOpts();if(o.length>=2)return;
    pickKind().then(function(name){if(!name)return;
      if(o.some(function(x){return kindKey(x.name)===kindKey(name)})){C.toast("You already added "+name+". Use Edit to change its values.",true);return}
      valuesFor(name,[],o.length===1).then(function(r){if(r&&r.values.length)apply(o,o.length,name,r)})})};
  A["ds-vo-edit"]=function(b){var i=+b.getAttribute("data-i"),o=readOpts(),x=o[i];if(!x)return;valuesFor(x.name,x.values,i===1).then(function(r){if(r)apply(o,i,x.name,r)})};
  A["ds-vo-del"]=function(b){var i=+b.getAttribute("data-i"),o=readOpts(),x=o[i];if(!x)return;
    D.confirm({title:"Remove "+(x.name||"this option")+"?",text:"Its stock numbers are cleared for the variants that no longer exist.",ok:"Remove",danger:true}).then(function(y){if(y){o.splice(i,1);writeOpts(o)}})};
  A["ds-vo-fill"]=function(){
    ask({title:"Set stock for all variants",text:"Every variant gets the same number. You can change each one afterwards.",label:"Quantity in stock",number:true,ok:"Apply"}).then(function(v){
      if(v==null)return;var n=Number(v);
      Array.prototype.forEach.call(doc.querySelectorAll("#wstbl input[data-vl]"),function(i){i.value=n;fire(i,"input")});C.toast("Stock set to "+n+" for every variant.")})};

  /* ---------- specification fields that are lists: choose or type your own ---------- */
  A["ds-sp-pick"]=function(b){
    var w=b.closest(".lb"),inp=w.querySelector('input[type="hidden"][name^="attr_"]'),opts=[];try{opts=JSON.parse(b.getAttribute("data-o")||"[]")}catch(e){}
    D.choose({title:b.getAttribute("data-t")||"Choose",multi:false,selected:inp.value?[inp.value]:[],groups:[["Options",opts]],placeholder:"Type your own"}).then(function(r){
      if(!r)return;var v=r.values[0]||"";inp.value=v;var s=b.querySelector(".v");s.textContent=v||"Not stated";s.classList.toggle("ph",!v);fire(inp,"change")})};
  A["ds-ms-add"]=function(b){
    ask({title:"Add your own",label:"Value",ok:"Add"}).then(function(v){
      if(!v)return;v=v.replace(/\s+/g," ").trim().slice(0,40).replace(/\|/g," ");if(!v)return;
      var box=b.parentNode,inp=box.parentNode.querySelector('input[type="hidden"]'),cur=inp.value?inp.value.split("|"):[];
      if(cur.indexOf(v)<0)cur.push(v);inp.value=cur.join("|");
      if(!Array.prototype.some.call(box.querySelectorAll("[data-v]"),function(x){return x.getAttribute("data-v")===v})){var n=doc.createElement("button");n.type="button";n.className="ds-chip on";n.setAttribute("data-act","ds-ms");n.setAttribute("data-v",v);n.setAttribute("aria-pressed","true");n.textContent=v;box.insertBefore(n,b)}
      fire(inp,"change")})};

  /* ---------- wrap the editor page ---------- */
  V.portal=function(p){
    return Promise.resolve(old(p)).then(function(res){
      if(!res||res.layout!=="portal"||p[0]!=="product"||!res.html||res.html.indexOf('id="wsform"')<0)return res;
      var keep=res.html,keepAfter=res.after;
      try{return decorateEditor(res)}catch(e){res.html=keep;res.after=keepAfter;return res}
    });
  };
  function decorateEditor(res){
    {
      var html=res.html,bar=/<div class="actbar">([\s\S]*?)<\/div><\/form>/.exec(html);
      /* variant builder container and the hidden colour map */
      html=html.replace('<div class="card" id="ds-sec-variants"><h3>Variants</h3>','<div class="card ds-vcard" id="ds-sec-variants"><h3>Options and variants</h3><div id="ds-vb" aria-live="polite"></div>'+(D.spOk&&D.spOk()?'<input type="hidden" id="ds-vcol" name="attr_variant_colours" value=""><input type="hidden" name="attrt_variant_colours" value="json">':"")
        +'<div class="ds-vnote">'+D.icon("lock",16)+"<span>Price, photo and SKU for each variant are not available yet. All variants share the product price and photos.</span></div>");
      if(bar){
        var rv=/value="review">([^<]*)</.exec(bar[1]),hasDraft=/value="draft"/.test(bar[1]),hasSave=/value="save"/.test(bar[1]),again=rv&&/Resubmit/i.test(rv[1]);
        html=html.replace(bar[0],'<div class="actbar ds-bar"><i class="ds-barp" id="ds-barp" aria-hidden="true"></i><a class="ds-btn g ds-bx" href="/portal/products" aria-label="Cancel and go back">'+D.icon("x",20)+"</a>"
          +'<span class="ds-bars" id="ds-bars" aria-live="polite"></span>'
          +(hasSave?'<button class="ds-btn" type="submit" value="save">'+D.icon("check",18)+"Save changes</button>"
            :(hasDraft?'<button class="ds-btn o" type="submit" value="draft">Save draft</button>':"")+'<button class="ds-btn" type="submit" value="review">'+D.icon("send",18)+(again?"Send again":"Send for review")+"</button>")+"</div></form>");
      }
      res.html=html;var af=res.after;
      res.after=function(){if(af)af();
        var vals=(D.spVals&&D.spVals())||{},vc=vals.variant_colours;COL={};if(vc&&typeof vc==="object")Object.keys(vc).forEach(function(k){COL[k]=vc[k]});
        draw();new MutationObserver(function(){decorate()}).observe(el("wstbl")||doc.body,{childList:true});
        var f=form();if(f)["change","input"].forEach(function(t){f.addEventListener(t,function(e){if(e.target&&(e.target.id==="wsn1"||e.target.id==="wsv1"||e.target.id==="wsn2"||e.target.id==="wsv2"||e.target.name==="vmode"))setTimeout(draw,0)})});
        bar2()};
      return res;
    }
  }
  function bar2(){
    var l=doc.querySelectorAll("#ds-check li"),t=l.length,ok=doc.querySelectorAll("#ds-check li.ok").length,b=el("ds-barp"),s=el("ds-bars");
    if(b)b.style.setProperty("--p",t?ok/t:0);if(s)s.textContent=t?ok+" of "+t+" ready":"";
  }
  D.barUpdate=bar2;
})();
