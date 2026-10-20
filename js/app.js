(function(){
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var fmt=function(n){return CFG.symbol+Number(n).toLocaleString("en-NG")};
var tint=function(s){var h=0;s=String(s);for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return"hsl("+h+" 28% 88%)"};
var cart=S.get("cart",{}),user=S.get("user",null),timer;
var P=function(){return S.products()};
var byId=function(id){return P().find(function(p){return p.id===id})};
var inStock=function(p){return p.stock==null||p.stock===""||p.stock>0};
var isAdmin=function(){return!!(user&&user.admin)};
var cols=function(){var s=CFG.collections.slice();P().forEach(function(p){if(s.indexOf(p.col)<0)s.push(p.col)});return s};
var empty=function(t,d){return'<div class="c"><h3>'+t+'</h3><p class="m">'+d+'</p></div>'};
var ST={awaiting_transfer:"Awaiting transfer",payment_reported:"Payment reported",sent:"Sent on WhatsApp"};
function tot(){var s=0,n=0;Object.keys(cart).forEach(function(id){var p=byId(id);if(p){s+=p.price*cart[id];n+=cart[id]}});var f=CFG.fee>0&&!(CFG.freeFrom>0&&s>=CFG.freeFrom)?CFG.fee:0;return{sub:s,fee:f,total:s+f,n:n}}
function toast(m){var t=$("#toast");t.textContent=m;t.className="on";clearTimeout(toast.t);toast.t=setTimeout(function(){t.className=""},1700)}
function sheet(h){var s=$("#sheet");if(h==null){s.className="";return}s.innerHTML='<div class="pn">'+h+'</div>';s.className="on"}
function shrink(file,max,cb){var r=new FileReader();r.onload=function(){var i=new Image();i.onload=function(){var k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*k;c.height=i.height*k;c.getContext("2d").drawImage(i,0,0,c.width,c.height);cb(c.toDataURL("image/jpeg",.78))};i.src=r.result};r.readAsDataURL(file)}
function withImg(f,cb){var fl=f.file&&f.file.files[0];if(fl)shrink(fl,900,cb);else cb(f.url?f.url.value.trim():"")}
function theme(){var t=S.get("theme","system");if(t==="system")document.documentElement.removeAttribute("data-theme");else document.documentElement.dataset.theme=t}

function card(p){var oos=!inStock(p),off=p.old>p.price?Math.round((1-p.price/p.old)*100):0;
return'<a class="card'+(oos?" oos":"")+'" href="#/p/'+p.id+'"><div class="ph" style="background:'+tint(p.name)+'">'+(p.img?'<img loading="lazy" alt="" src="'+esc(p.img)+'">':'<span class="mono">'+esc(p.name.slice(0,2))+'</span>')+'<i class="tag">'+(oos?"Sold out":fmt(p.price))+'</i>'+(oos?"":'<button class="add" data-add="'+p.id+'" aria-label="Add '+esc(p.name)+' to cart">+</button>')+'</div><b>'+esc(p.name)+'</b><small>'+esc(p.col)+(off?" · <u>−"+off+"%</u>":"")+'</small></a>'}
function banners(ctx){var l=Banners.pick(P(),S.banners(),ctx);if(!l.length)return"";
return'<div class="bn" id="bn">'+l.map(function(b){return'<a class="slide" href="'+esc(b.href)+'" style="background:'+tint(b.title)+'">'+(b.img?'<img alt="" src="'+esc(b.img)+'">':"")+'<div class="bt'+(b.img?" lt":"")+'"><small>'+esc(b.kind)+'</small><h2>'+esc(b.title)+'</h2><p>'+esc(b.text)+'</p></div></a>'}).join("")+'</div>'}
function grid(l,msg){return l.length?'<div class="grid">'+l.map(card).join("")+'</div>':empty(msg,"")}

function home(){var l=P();if(!l.length)return empty("No products yet","Products show up here as soon as they are added.")+(isAdmin()?'<p class="c"><a class="btn" href="#/admin">Add your first product</a></p>':"");
return banners(null)+cols().filter(function(c){return l.some(function(p){return p.col===c})}).map(function(c){var m=l.filter(function(p){return p.col===c});return'<div class="sec"><h3>'+esc(c)+'</h3><a href="#/c/'+encodeURIComponent(c)+'">See all</a></div><div class="row">'+m.slice(0,8).map(card).join("")+'</div>'}).join("")}
function shop(){var l=P();return'<div class="sec"><h3>Shop</h3></div>'+cols().map(function(c){var n=l.filter(function(p){return p.col===c}).length;return'<a class="rw" href="#/c/'+encodeURIComponent(c)+'"><b>'+esc(c)+'</b><small>'+n+' items ›</small></a>'}).join("")}
function coll(c){return banners(c)+'<div class="sec"><h3>'+esc(c)+'</h3></div>'+grid(P().filter(function(p){return p.col===c}),"Nothing in "+esc(c)+" yet")}
function srch(q){var k=q.toLowerCase();return'<div class="sec"><h3>Results for “'+esc(q)+'”</h3></div>'+grid(P().filter(function(p){return(p.name+" "+p.col+" "+(p.desc||"")).toLowerCase().indexOf(k)>-1}),"No matches")}
function prod(id){var p=byId(id);if(!p)return empty("Product not found","It may have been removed.");var off=p.old>p.price;
return'<div class="pd"><div class="ph big" style="background:'+tint(p.name)+'">'+(p.img?'<img alt="" src="'+esc(p.img)+'">':'<span class="mono">'+esc(p.name.slice(0,2))+'</span>')+'</div><h1>'+esc(p.name)+'</h1><p class="pr">'+fmt(p.price)+(off?" <s>"+fmt(p.old)+"</s>":"")+'</p><p class="m">'+esc(p.col)+'</p><p>'+esc(p.desc||"")+'</p>'+(inStock(p)?'<button class="btn" data-add="'+p.id+'">Add to cart</button>':'<button class="btn" disabled>Sold out</button>')+'</div>'}
function cartV(){var ids=Object.keys(cart).filter(byId);if(!ids.length)return empty("Your cart is empty","Add something you like and it will wait here.");var t=tot();
return'<div class="sec"><h3>Cart</h3></div>'+ids.map(function(i){var p=byId(i);return'<div class="rw"><span><b>'+esc(p.name)+'</b><small>'+fmt(p.price)+'</small></span><div class="step"><button data-step="'+i+'|-1" aria-label="Remove one">−</button><b>'+cart[i]+'</b><button data-step="'+i+'|1" aria-label="Add one">+</button></div></div>'}).join("")+'<div class="tt" style="margin-top:14px"><span class="m">Items</span><span>'+fmt(t.sub)+'</span></div>'+(CFG.fee>0?'<div class="tt"><span class="m">Delivery</span><span>'+(t.fee?fmt(t.fee):"Free")+'</span></div>':"")+'<div class="tt"><b>Total</b><b>'+fmt(t.total)+'</b></div><button class="btn w" data-act="checkout">Checkout</button>'}
function av(u){return u&&u.photo?'<div class="av"><img alt="" src="'+esc(u.photo)+'"></div>':u?'<div class="av" style="background:'+tint(u.name)+'">'+esc(u.name.slice(0,1).toUpperCase())+'</div>':'<div class="av"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></div>'}
function ordRow(o){return'<div class="rw"><span><b>'+fmt(o.total)+'</b><small>'+new Date(o.at).toLocaleDateString()+" · "+(ST[o.status]||o.status)+'</small></span>'+(o.status==="awaiting_transfer"?'<button class="btn s" data-act="paid" data-id="'+o.id+'">I\'ve paid</button>':"")+'</div>'}
function me(){var th=S.get("theme","system");
var sets='<div class="sec"><h3>Settings</h3></div><label class="lb">Theme</label><select data-pick="theme">'+["system","light","dark"].map(function(x){return'<option value="'+x+'"'+(x===th?" selected":"")+'>'+x[0].toUpperCase()+x.slice(1)+'</option>'}).join("")+'</select>';
if(!user)return'<div class="c">'+av()+'<h2>Welcome</h2><p class="m">Create your profile to check out faster. It is kept on this device until accounts launch.</p></div><form data-form="signin"><input name="name" placeholder="Full name" required><input name="email" type="email" placeholder="Email" required><input name="phone" placeholder="Phone" inputmode="tel"><label class="lb">Profile photo (optional)</label><input name="file" type="file" accept="image/*"><button class="btn w">Continue</button></form>'+sets;
var o=S.get("o",[]);
return'<div class="c">'+av(user)+'<h2>'+esc(user.name)+'</h2><p class="m">'+esc(user.email)+(user.phone?" · "+esc(user.phone):"")+'</p></div>'+(isAdmin()?'<a class="rw" href="#/admin"><b>Manage store</b><span>›</span></a>':"")+'<div class="sec"><h3>Orders</h3></div>'+(o.length?o.slice(0,6).map(ordRow).join(""):'<p class="m">No orders yet.</p>')+'<div class="sec"><h3>Payment methods</h3></div>'+Pay.methods().map(function(x){return'<div class="rw"><span><b>'+x.label+'</b><small>'+x.note+'</small></span><small>'+(x.on()?"Active":"Off")+'</small></div>'}).join("")+'<button class="btn o w" disabled>Add a card (Stage 3)</button>'+sets+'<button class="btn o w" data-act="out">Sign out</button>'}
function admin(){var op=cols().map(function(c){return"<option>"+esc(c)+"</option>"}).join(""),pl=S.get("p",[]),bl=S.get("b",[]),ol=S.get("o",[]);
return'<h2>Manage store</h2><p class="m">Changes save on this device. Stage 2 syncs them for every customer.</p><div class="sec"><h3>Add product</h3></div><form data-form="product"><input name="name" placeholder="Product name" required><input name="col" list="cl" placeholder="Collection" required><datalist id="cl">'+op+'</datalist><input name="price" type="number" min="0" step="any" placeholder="Price" required><input name="old" type="number" min="0" step="any" placeholder="Old price (optional)"><input name="stock" type="number" min="0" placeholder="Stock (blank = unlimited)"><input name="url" placeholder="Image link"><label class="lb">Or choose a photo</label><input name="file" type="file" accept="image/*"><textarea name="desc" rows="2" placeholder="Description"></textarea><button class="btn w">Add product</button></form>'
+'<div class="sec"><h3>Add banner</h3></div><form data-form="banner"><input name="title" placeholder="Title" required><input name="text" placeholder="Short text"><select name="type"><option value="event">Event</option><option value="promo">Promo</option><option value="announcement">Announcement</option></select><select name="scope"><option value="all">Show on Home</option>'+op+'</select><select name="priority"><option value="1">Priority 1 (lowest)</option><option value="2">Priority 2</option><option value="3">Priority 3</option><option value="4">Priority 4</option><option value="5">Priority 5 (top)</option></select><label class="lb">Starts</label><input name="from" type="date"><label class="lb">Ends</label><input name="to" type="date"><input name="link" placeholder="Opens (e.g. #/c/Skincare)"><input name="url" placeholder="Image link (optional)"><input name="file" type="file" accept="image/*"><button class="btn w">Add banner</button></form>'
+'<div class="sec"><h3>Products</h3></div>'+(pl.length?pl.map(function(p){return'<div class="rw"><span><b>'+esc(p.name)+'</b><small>'+esc(p.col)+" · "+fmt(p.price)+'</small></span><button class="btn s o" data-act="delp" data-id="'+p.id+'">Delete</button></div>'}).join(""):'<p class="m">None yet.</p>')
+'<div class="sec"><h3>Banners</h3></div>'+(bl.length?bl.map(function(b){return'<div class="rw"><span><b>'+esc(b.title)+'</b><small>'+esc(b.type)+" · "+esc(b.scope)+" · priority "+b.priority+'</small></span><button class="btn s o" data-act="delb" data-id="'+b.id+'">Delete</button></div>'}).join(""):'<p class="m">None yet. Collections still get banners generated from their products.</p>')
+'<div class="sec"><h3>Orders</h3></div>'+(ol.length?ol.map(function(o){return'<div class="rw"><span><b>'+fmt(o.total)+" · "+esc(o.cust.name)+'</b><small>'+esc(o.cust.phone)+" · "+(ST[o.status]||o.status)+'<br>'+o.items.map(function(i){return i.qty+" x "+esc(i.name)}).join(", ")+'</small></span></div>'}).join(""):'<p class="m">No orders yet.</p>')}
function checkout(){var m=Pay.methods(),u=user||{},t=tot(),first=-1;m.forEach(function(x,i){if(first<0&&x.on())first=i});
if(first<0){sheet('<h3>Checkout</h3><p class="m">No payment method is set up. Add a bank account or WhatsApp number in js/config.js.</p><button class="btn o w" data-act="close">Close</button>');return}
sheet('<h3>Checkout</h3><form data-form="order"><input name="name" placeholder="Full name" required value="'+esc(u.name)+'"><input name="phone" placeholder="Phone" inputmode="tel" required value="'+esc(u.phone)+'"><textarea name="addr" rows="2" placeholder="Delivery address" required></textarea>'+m.map(function(x,i){return'<label class="opt'+(x.on()?"":" off")+'"><input type="radio" name="pm" value="'+x.id+'"'+(x.on()?"":" disabled")+(i===first?" checked":"")+'><span><b>'+x.label+'</b><small>'+x.note+'</small></span></label>'}).join("")+'<button class="btn w">Place order · '+fmt(t.total)+'</button></form>')}
function view(v,arg){return v==="c"?coll(arg):v==="p"?prod(arg):v==="s"?srch(arg):v==="shop"?shop():v==="cart"?cartV():v==="me"?me():v==="admin"?(isAdmin()?admin():me()):home()}
function chrome(v){var t=tot(),T=[["Home","",["","p"]],["Shop","shop",["shop","c","s"]],["Cart"+(t.n?" "+t.n:""),"cart",["cart"]],["Me","me",["me","admin"]]];
$("#tabs").innerHTML=T.map(function(x){return'<a href="#/'+x[1]+'"'+(x[2].indexOf(v)>-1?' class="on"':"")+'>'+x[0]+'</a>'}).join("")}
function cur(){var a=location.hash.replace(/^#\/?/,"").split("/");return[a[0],decodeURIComponent(a.slice(1).join("/"))]}
function refresh(){var c=cur();$("#app").innerHTML=view(c[0],c[1]);chrome(c[0])}
function route(){clearInterval(timer);sheet(null);refresh();window.scrollTo(0,0);var b=$("#bn");
if(b&&b.children.length>1)timer=setInterval(function(){var w=b.firstChild.offsetWidth+10;b.scrollTo({left:b.scrollLeft+w>=b.scrollWidth-5?0:b.scrollLeft+w,behavior:"smooth"})},5000)}
function addCart(id){var p=byId(id);if(!p||!inStock(p))return;if(p.stock!=null&&p.stock!==""&&(cart[id]||0)>=p.stock){toast("Only "+p.stock+" in stock");return}cart[id]=(cart[id]||0)+1;S.set("cart",cart);chrome(cur()[0]);toast("Added to cart")}

document.addEventListener("click",function(e){var t=e.target;if(t.id==="sheet"){sheet(null);return}
var a=t.closest("[data-add],[data-step],[data-act]");if(!a)return;var d=a.dataset;
if(d.add){e.preventDefault();addCart(d.add);return}
if(d.step){var x=d.step.split("|"),p=byId(x[0]);if(+x[1]>0&&p&&p.stock!=null&&p.stock!==""&&cart[x[0]]>=p.stock){toast("Only "+p.stock+" in stock");return}cart[x[0]]+=+x[1];if(cart[x[0]]<=0)delete cart[x[0]];S.set("cart",cart);refresh();return}
if(d.act==="checkout")checkout();
else if(d.act==="close")sheet(null);
else if(d.act==="out"){user=null;S.set("user",null);refresh()}
else if(d.act==="paid"){S.upd("o",d.id,{status:"payment_reported"});refresh()}
else if(d.act==="delp"){S.del("p",d.id);refresh()}
else if(d.act==="delb"){S.del("b",d.id);refresh()}});
document.addEventListener("submit",function(e){var f=e.target,k=f.dataset.form;if(!k)return;e.preventDefault();var d=Object.fromEntries(new FormData(f));
if(k==="signin"){var fl=f.file.files[0],go=function(ph){user={name:d.name.trim(),email:d.email.trim(),phone:d.phone.trim(),photo:ph,admin:CFG.adminEmail?d.email.trim().toLowerCase()===CFG.adminEmail.toLowerCase():true};S.set("user",user);refresh()};fl?shrink(fl,200,go):go("");return}
if(k==="product")return withImg(f,function(img){if(S.add("p",{name:d.name.trim(),col:d.col.trim(),price:+d.price,old:d.old?+d.old:0,stock:d.stock===""?null:+d.stock,img:img,desc:d.desc.trim()})){toast("Product added");refresh()}});
if(k==="banner")return withImg(f,function(img){if(S.add("b",{title:d.title.trim(),text:d.text.trim(),type:d.type,scope:d.scope,priority:+d.priority,from:d.from,to:d.to,link:d.link.trim(),img:img})){toast("Banner added");refresh()}});
if(k==="order"){var t=tot(),o=S.add("o",{items:Object.keys(cart).filter(byId).map(function(id){var p=byId(id);return{id:id,name:p.name,price:p.price,qty:cart[id]}}),total:t.total,pm:d.pm,cust:{name:d.name,phone:d.phone,addr:d.addr},status:"new"});if(!o)return;
var r=Pay.run(d.pm,o);S.upd("o",o.id,{status:r.status});cart={};S.set("cart",cart);refresh();
sheet('<h3>Order placed</h3><p class="m">Reference <b>'+o.id.toUpperCase()+'</b></p><p>'+r.lines.map(esc).join("<br>")+'</p>'+(r.url?'<a class="btn w" target="_blank" rel="noopener" href="'+esc(r.url)+'">Open WhatsApp</a>':"")+'<button class="btn o w" data-act="close">Done</button>')}});
document.addEventListener("change",function(e){if(e.target.dataset.pick==="theme"){S.set("theme",e.target.value);theme()}});
window.addEventListener("hashchange",route);
S.load().then(function(){theme();$("#hd").innerHTML='<a class="logo" href="#/">'+esc(CFG.name.toLowerCase())+'<i></i></a><input id="q" type="search" placeholder="Search" aria-label="Search products">';
$("#q").addEventListener("input",function(){var v=this.value.trim();location.hash=v?"#/s/"+encodeURIComponent(v):"#/"});route()});
})();
