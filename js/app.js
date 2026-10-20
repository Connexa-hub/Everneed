(function(){
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var ctx=function(){return Ctx.get()};
var fmt=function(n){var c=ctx();return c.symbol+Number(n).toLocaleString(c.locale)};
var tint=function(s){var h=0;s=String(s);for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return"hsl("+h+" 28% 88%)"};
var cart=S.get("cart",{}),user=S.get("user",null),timer,after=null,pkT=null;
var inCty=function(o){return!o.cty||!o.cty.length||o.cty.indexOf(ctx().code)>-1};
var P=function(){return S.products().filter(inCty)};
var byId=function(id){return P().find(function(p){return p.id===id})};
var inStock=function(p){return p.stock==null||p.stock===""||p.stock>0};
var isAdmin=function(){return!!(user&&user.admin)};
var cols=function(){var s=CFG.collections.slice();P().forEach(function(p){if(s.indexOf(p.col)<0)s.push(p.col)});return s};
var empty=function(t,d){return'<div class="c"><h3>'+t+'</h3><p class="m">'+d+'</p></div>'};
var ST={awaiting_transfer:"Awaiting transfer",payment_reported:"Payment reported",sent:"Sent on WhatsApp"};
var LBL={name:"name",email:"email",phone:"phone",addr:"address",price:"price",title:"title",pm:"payment method"};
var IC={home:'<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',shop:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',cart:'<path d="M5 7h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/>',me:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',set:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'};
var ico=function(n,s){s=s||22;return'<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[n]+'</svg>'};
function notify(m,k){var n=document.createElement("div");n.className="note "+(k||"ok");n.innerHTML="<i></i><span>"+esc(m)+"</span>";$("#notes").appendChild(n);setTimeout(function(){n.remove()},3200)}
window.addEventListener("en-error",function(e){notify(e.detail,"err")});
function tot(){var c=ctx(),s=0,n=0;Object.keys(cart).forEach(function(id){var p=byId(id);if(p){s+=p.price*cart[id];n+=cart[id]}});var f=c.fee>0&&!(c.freeFrom>0&&s>=c.freeFrom)?c.fee:0;return{sub:s,fee:f,total:s+f,n:n}}
function sheet(h,n){var s=$(n?"#sheet2":"#sheet");if(h==null){s.className="";return}s.innerHTML='<div class="pn">'+h+'</div>';s.className="on"}
function shrink(file,max,cb){var r=new FileReader();r.onload=function(){var i=new Image();i.onload=function(){var k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*k;c.height=i.height*k;c.getContext("2d").drawImage(i,0,0,c.width,c.height);cb(c.toDataURL("image/jpeg",.78))};i.src=r.result};r.readAsDataURL(file)}
function withImg(f,cb){var fl=f.file&&f.file.files[0];if(fl)shrink(fl,900,cb);else cb(f.url?f.url.value.trim():"")}
function theme(){var t=S.get("theme","system");if(t==="system")document.documentElement.removeAttribute("data-theme");else document.documentElement.dataset.theme=t}
function legal(){var c=ctx(),l=function(u,t){return u?'<a href="'+esc(u)+'" target="_blank" rel="noopener">'+t+"</a>":t};return"By continuing you accept the "+l(c.terms,"Terms")+" and "+l(c.privacy,"Privacy Policy")+" for "+esc(c.name)+"."}
function av(u){return u&&u.photo?'<div class="av"><img alt="" src="'+esc(u.photo)+'"></div>':u?'<div class="av" style="background:'+tint(u.name)+'">'+esc(u.name.slice(0,1).toUpperCase())+"</div>":'<div class="av">'+ico("me",40)+"</div>"}
var PK={theme:function(){return[["system","System"],["light","Light"],["dark","Dark"]]},
 country:function(){return Object.keys(CFG.countries).map(function(k){return[k,CFG.countries[k].name]})},
 type:function(){return[["event","Event"],["promo","Promo"],["announcement","Announcement"]]},
 scope:function(){return[["all","Home"]].concat(cols().map(function(c){return[c,c]}))},
 col:function(){return cols().map(function(c){return[c,c]})},
 priority:function(){return[1,2,3,4,5].map(function(n){return[String(n),"Priority "+n]})}};
function field(name,label,val,live){var o=PK[name]().filter(function(x){return x[0]===val})[0];return'<label class="lb">'+label+'</label><button type="button" class="pick" data-pk="'+name+'"><span>'+esc(o?o[1]:val)+'</span>›</button><input type="hidden" name="'+name+'" value="'+esc(val)+'"'+(live?' data-live="1"':"")+'>'}
var fileBtn=function(t){return'<label class="filebtn"><input type="file" name="file" accept="image/*" hidden><span>'+t+"</span></label>"};

function card(p){var oos=!inStock(p),off=p.old>p.price?Math.round((1-p.price/p.old)*100):0;
return'<a class="card'+(oos?" oos":"")+'" href="#/p/'+p.id+'"><div class="ph" style="background:'+tint(p.name)+'">'+(p.img?'<img loading="lazy" alt="" src="'+esc(p.img)+'">':'<span class="mono">'+esc(p.name.slice(0,2))+"</span>")+'<i class="tag">'+(oos?"Sold out":fmt(p.price))+"</i>"+(oos?"":'<button class="add" data-add="'+p.id+'" aria-label="Add '+esc(p.name)+' to cart">+</button>')+'</div><b>'+esc(p.name)+"</b><small>"+esc(p.col)+(off?" · <u>−"+off+"%</u>":"")+"</small></a>"}
function banners(col){var l=Banners.pick(P(),S.banners().filter(inCty),col);if(!l.length)return"";
return'<div class="bn" id="bn">'+l.map(function(b){return'<a class="slide" href="'+esc(b.href)+'" style="background:'+tint(b.title)+'">'+(b.img?'<img alt="" src="'+esc(b.img)+'">':"")+'<div class="bt'+(b.img?" lt":"")+'"><small>'+esc(b.kind)+"</small><h2>"+esc(b.title)+"</h2><p>"+esc(b.text)+"</p></div></a>"}).join("")+"</div>"}
function grid(l,msg){return l.length?'<div class="grid">'+l.map(card).join("")+"</div>":empty(msg,"")}
function home(){var l=P();if(!l.length)return empty("No products in "+esc(ctx().name)+" yet","Products show up here as soon as they are added.")+(isAdmin()?'<p class="c"><a class="btn" href="#/admin">Add a product</a></p>':"");
return banners(null)+cols().filter(function(c){return l.some(function(p){return p.col===c})}).map(function(c){var m=l.filter(function(p){return p.col===c});return'<div class="sec"><h3>'+esc(c)+'</h3><a href="#/c/'+encodeURIComponent(c)+'">See all</a></div><div class="row">'+m.slice(0,8).map(card).join("")+"</div>"}).join("")}
function shop(){var l=P();return'<div class="sec"><h3>Shop</h3></div>'+cols().map(function(c){var n=l.filter(function(p){return p.col===c}).length;return'<a class="rw" href="#/c/'+encodeURIComponent(c)+'"><b>'+esc(c)+"</b><small>"+n+" items ›</small></a>"}).join("")}
function coll(c){return banners(c)+'<div class="sec"><h3>'+esc(c)+"</h3></div>"+grid(P().filter(function(p){return p.col===c}),"Nothing in "+esc(c)+" yet")}
function srch(q){var k=q.toLowerCase();return'<div class="sec"><h3>Results for “'+esc(q)+"”</h3></div>"+grid(P().filter(function(p){return(p.name+" "+p.col+" "+(p.desc||"")).toLowerCase().indexOf(k)>-1}),"No matches")}
function prod(id){var p=byId(id);if(!p)return empty("Product not found","It may have been removed or is not sold in your country.");var off=p.old>p.price;
return'<div class="pd"><div class="ph big" style="background:'+tint(p.name)+'">'+(p.img?'<img alt="" src="'+esc(p.img)+'">':'<span class="mono">'+esc(p.name.slice(0,2))+"</span>")+"</div><h1>"+esc(p.name)+'</h1><p class="pr">'+fmt(p.price)+(off?" <s>"+fmt(p.old)+"</s>":"")+'</p><p class="m">'+esc(p.col)+"</p><p>"+esc(p.desc||"")+"</p>"+(inStock(p)?'<button class="btn" data-add="'+p.id+'">Add to cart</button>':'<button class="btn" disabled>Sold out</button>')+"</div>"}
function cartV(){var ids=Object.keys(cart).filter(byId);if(!ids.length)return empty("Your cart is empty","Add something you like and it will wait here.");var t=tot(),c=ctx();
return'<div class="sec"><h3>Cart</h3></div>'+ids.map(function(i){var p=byId(i);return'<div class="rw"><span><b>'+esc(p.name)+"</b><small>"+fmt(p.price)+'</small></span><div class="step"><button data-step="'+i+'|-1" aria-label="Remove one">−</button><b>'+cart[i]+'</b><button data-step="'+i+'|1" aria-label="Add one">+</button></div></div>'}).join("")+'<div class="tt" style="margin-top:14px"><span class="m">Items</span><span>'+fmt(t.sub)+"</span></div>"+(c.fee>0?'<div class="tt"><span class="m">Delivery</span><span>'+(t.fee?fmt(t.fee):"Free")+"</span></div>":"")+'<div class="tt"><b>Total</b><b>'+fmt(t.total)+'</b></div><button class="btn w" data-act="checkout">Checkout</button>'}
function ordRow(o){return'<div class="rw"><span><b>'+fmt(o.total)+"</b><small>"+new Date(o.at).toLocaleDateString()+" · "+(ST[o.status]||o.status)+"</small></span>"+(o.status==="awaiting_transfer"?'<button class="btn s" data-act="paid" data-id="'+o.id+'">I\'ve paid</button>':"")+"</div>"}
function meBody(){var c=ctx(),u=user,o=u?S.get("o",[]):[];var r=function(k,v){return'<div class="rw"><span class="m">'+k+"</span><span>"+esc(v||"—")+"</span></div>"};
return'<div class="c">'+av(u)+"<h2>"+(u?esc(u.name):"Guest")+'</h2><p class="m">'+(u?"Signed in on this device":"Sign in to track orders and check out faster.")+"</p></div>"+(u?"":'<button class="btn w" data-act="login">Sign in or create profile</button>')+'<div class="sec"><h3>Details</h3></div>'+r("Email",u&&u.email)+r("Phone",u&&u.phone)+r("Country",c.name+" · "+c.symbol)+r("Member since",u&&new Date(u.since||Date.now()).toLocaleDateString())+r("Verification",u&&"Not verified yet")+(u?'<div class="sec"><h3>Orders</h3></div>'+(o.length?o.slice(0,6).map(ordRow).join(""):'<p class="m">No orders yet.</p>')+'<a class="rw" href="#/settings"><b>Settings</b><span>›</span></a>':"")+'<p class="m" style="margin-top:16px">'+legal()+"</p>"}
function settings(){var c=ctx();return'<div class="sec"><h3>Settings</h3></div>'+(isAdmin()?'<a class="rw" href="#/admin"><b>Manage store</b><span>›</span></a>':"")+field("theme","Theme",S.get("theme","system"),1)+field("country","Country and currency",c.code,1)+'<div class="sec"><h3>Payment methods</h3></div>'+Pay.methods().map(function(x){return'<div class="rw"><span><b>'+x.label+"</b><small>"+x.note+"</small></span><small>"+(x.on()?"Active":"Off")+"</small></div>"}).join("")+'<button class="btn o w" disabled>Add a card (Stage 3)</button><button class="btn o w" data-act="out">Sign out</button><p class="m" style="margin-top:16px">'+legal()+"</p>"}
function admin(){var pl=S.get("p",[]),bl=S.get("b",[]),ol=S.get("o",[]),c=ctx();
return'<h2>Manage store</h2><p class="m">Saved on this device. Stage 2 syncs it for every customer.</p><div class="sec"><h3>Add product</h3></div><form data-form="product" novalidate><input name="name" placeholder="Product name">'+field("col","Collection",cols()[0])+'<input name="price" type="number" step="any" placeholder="Price ('+c.symbol+')"><input name="old" type="number" step="any" placeholder="Old price (optional)"><input name="stock" type="number" placeholder="Stock (blank = unlimited)"><input name="cty" placeholder="Countries, e.g. NG,GH (blank = all)"><input name="url" placeholder="Image link">'+fileBtn("Or choose a photo")+'<textarea name="desc" rows="2" placeholder="Description"></textarea><button class="btn w">Add product</button></form>'
+'<div class="sec"><h3>Add banner</h3></div><form data-form="banner" novalidate><input name="title" placeholder="Title"><input name="text" placeholder="Short text">'+field("type","Type","event")+field("scope","Shows on","all")+field("priority","Priority","1")+'<input name="from" placeholder="Starts (YYYY-MM-DD)"><input name="to" placeholder="Ends (YYYY-MM-DD)"><input name="cty" placeholder="Countries, e.g. NG,GH (blank = all)"><input name="link" placeholder="Opens (e.g. #/c/Skincare)"><input name="url" placeholder="Image link (optional)">'+fileBtn("Or choose a photo")+'<button class="btn w">Add banner</button></form>'
+'<div class="sec"><h3>Products</h3></div>'+(pl.length?pl.map(function(p){return'<div class="rw"><span><b>'+esc(p.name)+"</b><small>"+esc(p.col)+" · "+p.price+'</small></span><button class="btn s o" data-act="delp" data-id="'+p.id+'">Delete</button></div>'}).join(""):'<p class="m">None yet.</p>')
+'<div class="sec"><h3>Banners</h3></div>'+(bl.length?bl.map(function(b){return'<div class="rw"><span><b>'+esc(b.title)+"</b><small>"+esc(b.type)+" · "+esc(b.scope)+" · priority "+b.priority+'</small></span><button class="btn s o" data-act="delb" data-id="'+b.id+'">Delete</button></div>'}).join(""):'<p class="m">None yet. Collections still get banners generated from their products.</p>')
+'<div class="sec"><h3>Orders</h3></div>'+(ol.length?ol.map(function(o){return'<div class="rw"><span><b>'+o.total+" · "+esc(o.cust.name)+"</b><small>"+esc(o.cust.phone)+" · "+(ST[o.status]||o.status)+"<br>"+o.items.map(function(i){return i.qty+" x "+esc(i.name)}).join(", ")+"</small></span></div>"}).join(""):'<p class="m">No orders yet.</p>')}
function login(why,next){after=next||null;var c=ctx(),N={phone:"Phone number (SMS code)",google:"Google",nin:"NIN verification"};
sheet('<button class="x" data-act="close" aria-label="Close">✕</button><h3>Sign in or create profile</h3><p class="m">'+(why||"We detected your region. Confirm it to see the right products, prices and offers.")+'</p><form data-form="signin" novalidate>'+field("country","Country",c.code)+'<input name="name" placeholder="Full name" autocomplete="name"><input name="email" type="email" placeholder="Email" autocomplete="email"><input name="phone" placeholder="Phone number" inputmode="tel" autocomplete="tel">'+fileBtn("Add a photo (optional)")+'<button class="btn w">Continue</button></form><p class="m" style="margin-top:10px">'+legal()+'</p><div class="sec"><h3>More ways to sign in</h3></div>'+c.auth.filter(function(a){return a!=="email"}).map(function(a){return'<div class="rw dis"><span><b>'+N[a]+"</b><small>Opens with accounts in Stage 2</small></span><span>›</span></div>"}).join(""))}
function checkout(){var m=Pay.methods(),u=user||{},t=tot(),first=-1;m.forEach(function(x,i){if(first<0&&x.on())first=i});
if(first<0){sheet('<h3>Checkout</h3><p class="m">No payment method is set up for '+esc(ctx().name)+'. Add a bank account or WhatsApp number for it in js/config.js.</p><button class="btn o w" data-act="close">Close</button>');return}
sheet('<button class="x" data-act="close" aria-label="Close">✕</button><h3>Checkout</h3><form data-form="order" novalidate><input name="name" placeholder="Full name" value="'+esc(u.name)+'"><input name="phone" placeholder="Phone number" inputmode="tel" value="'+esc(u.phone)+'"><textarea name="addr" rows="2" placeholder="Delivery address"></textarea>'+m.map(function(x,i){return'<label class="opt'+(x.on()?"":" off")+'"><input type="radio" name="pm" value="'+x.id+'" hidden'+(x.on()?"":" disabled")+(i===first?" checked":"")+"><span><b>"+x.label+"</b><small>"+x.note+"</small></span></label>"}).join("")+'<button class="btn w">Place order · '+fmt(t.total)+"</button></form>")}
function view(v,arg){return v==="c"?coll(arg):v==="p"?prod(arg):v==="s"?srch(arg):v==="shop"?shop():v==="cart"?cartV():v==="me"?(user?settings():'<div class="sec"><h3>Me</h3></div>'+meBody()):v==="settings"?(user?settings():meBody()):v==="admin"?(isAdmin()?admin():meBody()):home()}
function chrome(v){var t=tot(),T=[["home","Home","",["","p"]],["shop","Shop","shop",["shop","c","s"]],["cart","Cart","cart",["cart"]],user?["set","Settings","settings",["settings","admin","me"]]:["me","Me","me",["me","settings"]]];
$("#tabs").innerHTML=T.map(function(x){return'<a href="#/'+x[2]+'"'+(x[3].indexOf(v)>-1?' class="on"':"")+"><span>"+ico(x[0])+"</span><b>"+x[1]+"</b>"+(x[0]==="cart"&&t.n?"<em>"+t.n+"</em>":"")+"</a>"}).join("");
var f=$("#fab");f.className=t.n&&v!=="cart"?"on":"";f.innerHTML=ico("cart",24)+(t.n?"<em>"+t.n+"</em>":"")}
function hdr(){$("#hd").innerHTML='<a class="logo" href="#/">'+esc(CFG.name.toLowerCase())+'<i></i></a><input id="q" type="search" placeholder="Search" aria-label="Search products"><button class="hav" data-act="drawer" aria-label="Open profile">'+av(user)+"</button>"}
function drawer(on){var d=$("#drawer");if(on){$("#dp").innerHTML='<button class="x" data-act="dclose" aria-label="Close">✕</button>'+meBody()}d.className=on?"on":""}
function cur(){var a=location.hash.replace(/^#\/?/,"").split("/");return[a[0],decodeURIComponent(a.slice(1).join("/"))]}
function refresh(){var c=cur();$("#app").innerHTML=view(c[0],c[1]);chrome(c[0])}
function route(){clearInterval(timer);sheet(null);sheet(null,1);drawer(0);refresh();window.scrollTo(0,0);var b=$("#bn");
if(b&&b.children.length>1)timer=setInterval(function(){var w=b.firstChild.offsetWidth+10;b.scrollTo({left:b.scrollLeft+w>=b.scrollWidth-5?0:b.scrollLeft+w,behavior:"smooth"})},5000)}
function addCart(id){var p=byId(id);if(!p||!inStock(p))return;if(p.stock!=null&&p.stock!==""&&(cart[id]||0)>=p.stock){notify("Only "+p.stock+" in stock","err");return}cart[id]=(cart[id]||0)+1;S.set("cart",cart);chrome(cur()[0]);notify("Added to cart")}
function miss(d,ks){for(var i=0;i<ks.length;i++)if(!String(d[ks[i]]||"").trim()){notify("Please fill in the "+(LBL[ks[i]]||ks[i])+" field.","err");return true}return false}
function live(n,v){if(n==="theme"){S.set("theme",v);theme()}if(n==="country"){Ctx.set(v);if(user){user.country=v;S.set("user",user)}}refresh()}
var cty=function(s){return String(s||"").split(",").map(function(x){return x.trim().toUpperCase()}).filter(Boolean)};

document.addEventListener("click",function(e){var t=e.target;
if(t.id==="sheet"){sheet(null);return}if(t.id==="sheet2"){sheet(null,1);return}if(t.id==="drawer"){drawer(0);return}
var a=t.closest("[data-add],[data-step],[data-act],[data-pk],[data-pv]");if(!a)return;var d=a.dataset;
if(d.pk){pkT=a;var cv=a.nextElementSibling.value;sheet('<h3>Choose</h3>'+PK[d.pk]().map(function(x){return'<button type="button" class="opt'+(x[0]===cv?" on":"")+'" data-pv="'+esc(x[0])+'">'+esc(x[1])+"</button>"}).join(""),1);return}
if(d.pv!==undefined){var i=pkT.nextElementSibling;i.value=d.pv;pkT.firstChild.textContent=a.textContent;sheet(null,1);if(i.dataset.live)live(i.name,d.pv);return}
if(d.add){e.preventDefault();addCart(d.add);return}
if(d.step){var x=d.step.split("|"),p=byId(x[0]);if(+x[1]>0&&p&&p.stock!=null&&p.stock!==""&&cart[x[0]]>=p.stock){notify("Only "+p.stock+" in stock","err");return}cart[x[0]]+=+x[1];if(cart[x[0]]<=0)delete cart[x[0]];S.set("cart",cart);refresh();return}
var k=d.act;
if(k==="checkout"){if(!user)login("Sign in to place your order. You will return to checkout right after.",checkout);else checkout()}
else if(k==="login")login();
else if(k==="drawer")drawer(1);
else if(k==="dclose")drawer(0);
else if(k==="close")sheet(null);
else if(k==="out"){user=null;S.set("user",null);hdr();location.hash="#/";route();notify("Signed out")}
else if(k==="paid"){S.upd("o",d.id,{status:"payment_reported"});refresh();drawer(0)}
else if(k==="delp"){S.del("p",d.id);refresh()}
else if(k==="delb"){S.del("b",d.id);refresh()}});
document.addEventListener("submit",function(e){var f=e.target,k=f.dataset.form;if(!k)return;e.preventDefault();var d=Object.fromEntries(new FormData(f));
if(k==="signin"){if(miss(d,["name","email"]))return;if(!/.+@.+\..+/.test(d.email)){notify("Enter a valid email address.","err");return}
var fl=f.file.files[0],go=function(ph){Ctx.set(d.country);user={name:d.name.trim(),email:d.email.trim(),phone:d.phone.trim(),photo:ph,country:d.country,since:Date.now(),admin:CFG.adminEmail?d.email.trim().toLowerCase()===CFG.adminEmail.toLowerCase():true};S.set("user",user);var n=after;after=null;hdr();refresh();notify("Welcome, "+user.name.split(" ")[0]);if(n)n();else sheet(null)};fl?shrink(fl,200,go):go("");return}
if(k==="product"){if(miss(d,["name","price"]))return;return withImg(f,function(img){if(S.add("p",{name:d.name.trim(),col:d.col,price:+d.price,old:d.old?+d.old:0,stock:d.stock===""?null:+d.stock,cty:cty(d.cty),img:img,desc:d.desc.trim()})){notify("Product added");refresh()}})}
if(k==="banner"){if(miss(d,["title"]))return;return withImg(f,function(img){if(S.add("b",{title:d.title.trim(),text:d.text.trim(),type:d.type,scope:d.scope,priority:+d.priority,from:d.from.trim(),to:d.to.trim(),cty:cty(d.cty),link:d.link.trim(),img:img})){notify("Banner added");refresh()}})}
if(k==="order"){if(miss(d,["name","phone","addr","pm"]))return;var t=tot(),o=S.add("o",{items:Object.keys(cart).filter(byId).map(function(id){var p=byId(id);return{id:id,name:p.name,price:p.price,qty:cart[id]}}),total:t.total,country:ctx().code,pm:d.pm,cust:{name:d.name,phone:d.phone,addr:d.addr},status:"new"});if(!o)return;
var r=Pay.run(d.pm,o);S.upd("o",o.id,{status:r.status});cart={};S.set("cart",cart);refresh();
sheet('<h3>Order placed</h3><p class="m">Reference <b>'+o.id.toUpperCase()+"</b></p><p>"+r.lines.map(esc).join("<br>")+"</p>"+(r.url?'<a class="btn w" target="_blank" rel="noopener" href="'+esc(r.url)+'">Open WhatsApp</a>':"")+'<button class="btn o w" data-act="close">Done</button>')}});
document.addEventListener("change",function(e){var t=e.target;if(t.type==="file"&&t.files[0])t.nextElementSibling.textContent=t.files[0].name});
document.addEventListener("input",function(e){if(e.target.id==="q"){var v=e.target.value.trim();location.hash=v?"#/s/"+encodeURIComponent(v):"#/"}});
window.addEventListener("hashchange",route);
S.load().then(function(){theme();hdr();route()});
})();
