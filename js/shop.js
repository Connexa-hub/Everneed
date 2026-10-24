/* Product page (swipe gallery, full-screen viewer, sizes, size guide, reviews) and order tracking. */
window.Shop=(function(){
  var esc=A.esc,fmt=A.fmt,ico=A.ico,notify=A.notify,sheet=A.sheet,$=A.$,sel={},rv={},stars=0;
  var X='<button class="x" data-act="close" aria-label="Close">✕</button>';
  var imgs=function(p){return p.images&&p.images.length?p.images:(p.img?[p.img]:[])};
  var st=function(n){return'<span class="st" style="--v:'+Math.round(n/5*100)+'%">★★★★★</span>'};
  var who=function(n){var a=String(n||"Customer").trim().split(/\s+/);return a[0]+(a[1]?" "+a[1][0].toUpperCase()+".":"")};
  function prod(id){var p=A.byId(id);if(!p)return A.empty("Product not found","It may have been removed or is not sold in your country.");
    var im=imgs(p),r=S.rating(p.id),off=p.old>p.price,ns=p.sizes&&p.sizes.length,ok=p.stock==null||p.stock===""||p.stock>0;
    return'<div class="pd"><div class="gal" id="gal">'+(im.length?im.map(function(u,i){return'<img class="gi" data-act="zoom" data-i="'+i+'" data-id="'+p.id+'" alt="" src="'+esc(u)+'">'}).join(""):'<div class="gi mono" style="background:'+A.tint(p.name)+'">'+esc(p.name.slice(0,2))+"</div>")+"</div>"+(im.length>1?'<div class="gd" id="gd">'+im.map(function(x,i){return"<i"+(i?"":' class="on"')+"></i>"}).join("")+"</div>":"")+"<h1>"+esc(p.name)+'</h1><div class="rt" data-act="rvs">'+(r?st(r.avg)+" <b>"+r.avg+"</b> <small>("+r.n+" review"+(r.n>1?"s":"")+")</small>":"<small>No reviews yet</small>")+'</div><p class="pr">'+fmt(p.price)+(off?" <s>"+fmt(p.old)+"</s>":"")+'</p><p class="m">'+esc(p.col)+"</p>"+(p.ship_days?'<p class="m">Estimated delivery: '+esc(p.ship_days)+" days</p>":"")
      +(ns?'<div class="sec" style="margin-top:6px"><h3>'+esc(p.opt||"Size")+'</h3>'+(p.chart?'<button class="lnk" style="margin:0" data-act="sguide" data-id="'+p.id+'">Size guide</button>':"")+'</div><div class="chips wrap" id="szs">'+p.sizes.map(function(s){return'<button type="button" class="chip'+(sel[p.id]===s?" on":"")+'" data-act="ssel" data-id="'+p.id+'" data-v="'+esc(s)+'">'+esc(s)+"</button>"}).join("")+"</div>":"")
      +"<p>"+esc(p.desc||"")+"</p>"+(ok?'<button class="btn w" id="addb" data-add="'+p.id+'">Add to cart'+(sel[p.id]?" · "+esc(sel[p.id]):"")+"</button>":'<button class="btn w" disabled>Sold out</button>')+'<div class="sec"><h3>Reviews</h3></div><div id="rv"><p class="m">Loading…</p></div></div>'}
  function nudge(){var b=$("#szs");if(b){b.classList.remove("shake");void b.offsetWidth;b.classList.add("shake")}}
  function eligible(pid){var u=A.user();if(!u||!Supa.on())return null;var os=S.orders().filter(function(o){return o.status==="delivered"&&(o.items||[]).some(function(i){return i.id===pid})});return os.length?os[0].id:null}
  function paint(pid){var b=$("#rv");if(!b)return;var l=rv[pid]||[],me=Supa.uid(),mine=l.some(function(x){return x.user_id===me}),oid=eligible(pid);
    b.innerHTML=(l.length?l.map(function(x){return'<div class="rvw"><div>'+st(x.rating)+" <b>"+esc(x.name||"Customer")+"</b> <small>"+new Date(x.at).toLocaleDateString()+"</small></div>"+(x.body?"<p>"+esc(x.body)+"</p>":"")+'<small class="vf">Verified purchase</small></div>'}).join(""):'<p class="m">No reviews yet. Reviews come from customers whose order was delivered.</p>')+(oid&&!mine?'<button class="btn o w" data-act="rate" data-p="'+pid+'" data-o="'+oid+'">Write a review</button>':"")}
  function loadRv(pid){if(!Supa.on()){var b=$("#rv");if(b)b.innerHTML='<p class="m">Reviews appear when the store is online.</p>';return}
    Supa.q("/rest/v1/reviews?product_id=eq."+encodeURIComponent(pid)+"&select=*&order=at.desc&limit=30","GET",true).then(function(l){rv[pid]=l;paint(pid)}).catch(function(){var b=$("#rv");if(b)b.innerHTML='<p class="m">Could not load reviews.</p>'})}
  function mount(){var g=$("#gal");if(!g)return;var d=$("#gd");
    g.addEventListener("scroll",function(){var i=Math.round(g.scrollLeft/g.clientWidth);if(d)[].forEach.call(d.children,function(x,j){x.className=j===i?"on":""})},{passive:true});
    var c=A.cur();if(c[0]==="p")loadRv(c[1])}
  function place(c,r,fit,rad){c.style.left=r.left+"px";c.style.top=r.top+"px";c.style.width=r.width+"px";c.style.height=r.height+"px";c.style.objectFit=fit;c.style.borderRadius=rad+"px"}
  function zoom(id,i,el){var im=imgs(A.byId(id));if(!im.length||$("#vw"))return;
    var v=document.createElement("div");v.id="vw";v.innerHTML='<div class="vb"></div>';document.body.appendChild(v);
    var c=new Image(),full={left:0,top:0,width:innerWidth,height:innerHeight};c.className="vc";c.src=im[i];place(c,el.getBoundingClientRect(),"cover",22);v.appendChild(c);
    requestAnimationFrame(function(){requestAnimationFrame(function(){v.firstChild.style.opacity=1;place(c,full,"contain",0)})});
    setTimeout(function(){var t=document.createElement("div"),n=document.createElement("div"),x=document.createElement("button");t.className="vt";t.innerHTML=im.map(function(u){return'<img alt="" src="'+esc(u)+'">'}).join("");
      n.className="vn";n.textContent=(i+1)+" / "+im.length;x.className="vx";x.textContent="✕";x.setAttribute("aria-label","Close");v.appendChild(t);v.appendChild(n);v.appendChild(x);t.scrollLeft=i*innerWidth;c.remove();
      t.addEventListener("scroll",function(){n.textContent=(Math.round(t.scrollLeft/innerWidth)+1)+" / "+im.length},{passive:true});
      var shut=function(){var k=Math.round(t.scrollLeft/innerWidth),g=$("#gal"),th=g&&g.children[k];if(g&&th)g.scrollLeft=k*g.clientWidth;
        var c2=new Image();c2.className="vc";c2.src=im[k];place(c2,full,"contain",0);v.appendChild(c2);t.remove();n.remove();x.remove();
        requestAnimationFrame(function(){requestAnimationFrame(function(){v.firstChild.style.opacity=0;if(th)place(c2,th.getBoundingClientRect(),"cover",22);else c2.style.opacity=0})});setTimeout(function(){v.remove()},400)};
      x.onclick=shut;t.onclick=shut},380)}
  function guide(id){var p=A.byId(id),c=p&&S.chart(p.chart);if(!c){notify("No size guide for this product yet.","err");return}
    sheet(X+'<h3>Size guide</h3><p class="m">'+esc(c.name)+'</p><div class="tw"><table class="tbl"><tr><th>Size</th>'+c.cols.map(function(h){return"<th>"+esc(h)+"</th>"}).join("")+"</tr>"+c.rows.map(function(r){return'<tr class="'+(p.sizes.indexOf(r[0])>-1?"":"na")+'">'+r.map(function(v){return"<td>"+esc(v)+"</td>"}).join("")+"</tr>"}).join("")+'</table></div><p class="m sm">Dimmed sizes are not available for this product. Measurements are a guide.</p>')}
  function rate(pid,oid){stars=0;var p=A.byId(pid);sheet(X+"<h3>Rate "+esc(p?p.name:"this product")+'</h3><div class="sr" id="sr">'+[1,2,3,4,5].map(function(n){return'<button type="button" class="sb" data-act="rstar" data-v="'+n+'" aria-label="'+n+' star">★</button>'}).join("")+'</div><form data-form="areview" novalidate><input type="hidden" name="p" value="'+esc(pid)+'"><input type="hidden" name="o" value="'+esc(oid)+'"><textarea name="body" rows="3" placeholder="Tell others what you think (optional)"></textarea><button class="btn w">Submit review</button></form>')}
  function submit(k,f,d){if(k!=="areview")return false;if(!stars){notify("Tap a star to rate.","err");return true}
    Supa.insert("reviews",{product_id:d.p,order_id:d.o,rating:stars,body:(d.body||"").trim(),name:who(A.user().name)}).then(function(){sheet(null);notify("Thanks for your review");return S.loadRatings()}).then(function(){A.refresh()}).catch(function(e){/duplicate|unique/i.test(e.message)?notify("You have already reviewed this product.","err"):A.netErr(e)});return true}
  var CJ={CREATED:"Order received",IN_CART:"Order received",UNPAID:"Order received",UNSHIPPED:"Being prepared for shipping",SHIPPED:"On its way",DELIVERED:"Delivered",CANCELLED:"Cancelled by the supplier"};
  function trackHtml(o){var t=o.track;if(!t||!t.cjOrderId)return"";
    return'<div class="sec"><h3>Delivery tracking</h3></div><div class="rw"><span><b>'+esc(CJ[t.cjStatus]||"Processing with our supplier")+"</b><small>"+(t.carrier?esc(t.carrier)+" · ":"")+(t.trackNumber?"Tracking "+esc(t.trackNumber):"Tracking number not assigned yet")+"</small></span>"+(t.trackingUrl?'<a class="btn s o" target="_blank" rel="noopener" href="'+esc(t.trackingUrl)+'">Track</a>':"")+"</div>"+(t.events&&t.events.length?t.events.slice(0,6).map(function(e){return'<div class="rw"><span><b>'+esc(e.trackingStatus||e.status||e.desc||"Update")+"</b><small>"+esc(e.trackingTime||e.time||"")+"</small></span></div>"}).join(""):"")+'<button class="btn o w" data-act="trk" data-id="'+esc(o.id)+'">Refresh tracking</button>'}
  function trackRefresh(id,quiet){if(!Supa.on())return;Supa.fn("cj",{action:"refresh",order_id:id},quiet).then(function(r){var o=S.orders().filter(function(x){return x.id===id})[0];if(o){o.track=r.track;if(r.status)o.status=r.status}if($("#sheet").className==="on")order(id)}).catch(function(e){if(!quiet)A.netErr(e)})}
  function order(id){var o=S.orders().filter(function(x){return x.id===id})[0];if(!o)return;
    var idx={new:0,awaiting_transfer:0,awaiting_payment:0,sent:0,payment_reported:0,paid:1,shipped:2,delivered:3}[o.status],steps=["Placed","Paid","Shipped","Delivered"],m=function(n){return Ctx.money(n,o.currency)};
    sheet(X+"<h3>Order "+esc(o.id.toUpperCase())+'</h3><button class="lnk" style="margin:0 0 6px" data-act="ocopy" data-id="'+esc(o.id)+'">Copy order ID</button><p class="m" style="margin:0">'+new Date(o.at).toLocaleString()+"</p>"+(o.status==="cancelled"?'<div class="alert">This order was cancelled.</div>':'<div class="tl">'+steps.map(function(s,i){return'<div class="ts'+(i<=idx?" on":"")+'"><i></i>'+s+"</div>"}).join("")+"</div>")
      +o.items.map(function(i){return'<div class="rw"><span><b>'+esc(i.name)+"</b><small>"+(i.size?esc(i.size)+" · ":"")+"Qty "+i.qty+" · "+m(i.price*i.qty)+"</small></span>"+(o.status==="delivered"?'<button class="btn s o" data-act="rate" data-p="'+esc(i.id)+'" data-o="'+esc(o.id)+'">Rate</button>':"")+"</div>"}).join("")
      +trackHtml(o)+'<div class="tt" style="margin-top:8px"><b>Total</b><b>'+m(o.total)+'</b></div><div class="rw"><span class="m">Deliver to</span><span style="text-align:right">'+esc((o.cust||{}).addr||"")+"</span></div>");if(o.track&&o.track.cjOrderId&&Date.now()-(o.track.checkedAt||0)>6e5)trackRefresh(o.id,true)}
  function copy(id){var t=String(id).toUpperCase();if(navigator.clipboard)navigator.clipboard.writeText(t).then(function(){notify("Order ID copied")},function(){notify(t)});else notify(t)}
  function act(k,d,a){
    if(k==="zoom"){zoom(d.id,+d.i,a);return true}
    if(k==="ssel"){sel[d.id]=d.v;[].forEach.call(a.parentNode.children,function(c){c.classList.toggle("on",c===a)});var b=$("#addb");if(b)b.textContent="Add to cart · "+d.v;return true}
    if(k==="sguide"){guide(d.id);return true}
    if(k==="rvs"){var r=$("#rv");if(r)r.scrollIntoView({behavior:"smooth"});return true}
    if(k==="rate"){rate(d.p,d.o);return true}
    if(k==="rstar"){stars=+d.v;[].forEach.call($("#sr").children,function(c,i){c.classList.toggle("on",i<stars)});return true}
    if(k==="trk"){trackRefresh(d.id,false);return true}
    if(k==="myorder"){order(d.id);return true}
    if(k==="ocopy"){copy(d.id);return true}
    return false}
  return{prod:prod,mount:mount,act:act,submit:submit,nudge:nudge,size:function(id){return sel[id]||""}};
})();
