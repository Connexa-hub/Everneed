/* Plan carousel. Plans, prices and limits come from the backend, never from this file.
   store_plans (public read) gives price, period, product limit, commission benefit and feature text.
   If the backend also offers a seller-readable catalogue (rpc seller_plan_catalog, same fields as seller_plan_entitlements),
   daily quota and verification inclusion are shown too. Nothing is guessed when it is absent.
   Depth is plain CSS transforms driven by scroll position; it is switched off for reduced motion and the cards stay readable. */
(function(){
  var C=Core,esc=C.esc,Plans={};
  var reduce=false;try{reduce=matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}
  var LIMIT_LINE=/^(up to \d+ (active )?products?|unlimited products)$/i;

  Plans.load=function(){
    return Supa.get("store_plans?select=id,name,price,period,product_limit,commission_discount,features&active=eq.true&order=price.asc").then(function(rows){
      return Supa.rpc("seller_plan_catalog",{}).then(function(r){return r&&r.data!==undefined?r.data:r},function(){return null}).then(function(cat){
        var by={};(Array.isArray(cat)?cat:[]).forEach(function(x){by[x.plan_id||x.id]=x});
        return(rows||[]).map(function(p){return Object.assign({},p,{ent:by[p.id]||null})});
      });
    });
  };
  Plans.price=function(p){return Number(p.price)>0?C.money(p.price):"Free"};
  Plans.limit=function(p){var e=p.ent;if(e)return e.active_products_unlimited?"Unlimited":String(e.active_product_limit);return p.product_limit==null?"Unlimited":String(p.product_limit)};
  function lines(p){
    var e=p.ent,out=[];
    if(e){out.push(e.daily_new_products_unlimited?"No daily listing limit":e.daily_new_product_limit+" new listings a day")}
    if(Number(p.commission_discount)>0)out.push(p.commission_discount+" points lower commission");
    if(e)out.push(e.verification_included?"Verification included":"Verification optional");
    (p.features||[]).forEach(function(f){
      f=String(f);if(LIMIT_LINE.test(f))return;
      if(e&&/per day$/i.test(f))return;
      if(Number(p.commission_discount)>0&&/lower commission$/i.test(f))return;
      if(out.indexOf(f)<0)out.push(f);
    });
    return out.slice(0,6);
  }
  function cardHtml(p,i,n,chosen){
    var per=Number(p.price)>0?'<small>/'+esc(p.period==="monthly"?"month":p.period||"month")+"</small>":"";
    return'<article class="pc-card" id="pc-'+esc(p.id)+'" data-i="'+i+'" aria-label="'+esc(p.name)+", plan "+(i+1)+" of "+n+'">'
      +(chosen?'<span class="pc-tag">Your choice</span>':"")
      +'<h3>'+esc(p.name)+'</h3><p class="pc-price"><b>'+esc(Plans.price(p))+"</b>"+per+"</p>"
      +'<p class="pc-lim"><b>'+esc(Plans.limit(p))+"</b><span>products</span></p>"
      +'<ul class="pc-list">'+lines(p).map(function(l){return"<li>"+esc(l)+"</li>"}).join("")+"</ul></article>";
  }
  /* opts: {plans, chosen, focus, onFocus(plan)} returns the markup; call Plans.bind(root,opts) after it is in the page. */
  Plans.html=function(o){
    var n=o.plans.length;
    return'<div class="pc" role="group" aria-roledescription="carousel" aria-label="Seller plans">'
      +'<div class="pc-track" tabindex="0" aria-label="Plans. Swipe, or use the left and right arrow keys.">'+o.plans.map(function(p,i){return cardHtml(p,i,n,p.id===o.chosen)}).join("")+"</div>"
      +'<div class="pc-nav"><button type="button" class="pc-arrow" data-pc="prev" aria-label="Previous plan">‹</button><div class="pc-dots">'
      +o.plans.map(function(p,i){return'<button type="button" class="pc-dot" data-pc="go" data-i="'+i+'" aria-label="Show '+esc(p.name)+'"></button>'}).join("")
      +'</div><button type="button" class="pc-arrow" data-pc="next" aria-label="Next plan">›</button></div>'
      +'<p class="sr" aria-live="polite" data-pc="live"></p></div>';
  };
  Plans.bind=function(root,o){
    var box=root.querySelector(".pc");if(!box)return;
    var tr=box.querySelector(".pc-track"),cards=[].slice.call(tr.querySelectorAll(".pc-card")),dots=[].slice.call(box.querySelectorAll(".pc-dot")),live=box.querySelector('[data-pc="live"]'),cur=-1,raf=0,drag=null;
    function centerOf(c){return c.offsetLeft+c.offsetWidth/2}
    function scrollToIdx(i,smooth){
      i=Math.max(0,Math.min(cards.length-1,i));var c=cards[i];
      tr.scrollTo({left:centerOf(c)-tr.clientWidth/2,behavior:smooth&&!reduce?"smooth":"auto"});
    }
    function announce(i){
      var p=o.plans[i];if(!p)return;
      if(live)live.textContent=p.name+", "+Plans.price(p)+(Number(p.price)>0?" per month":"")+", "+Plans.limit(p)+" products. Plan "+(i+1)+" of "+cards.length+".";
    }
    function setFocus(i){
      if(i===cur)return;cur=i;
      cards.forEach(function(c,k){c.classList.toggle("is-focus",k===i);c.setAttribute("aria-current",k===i?"true":"false")});
      dots.forEach(function(d,k){d.classList.toggle("on",k===i);d.setAttribute("aria-current",k===i?"true":"false")});
      announce(i);if(o.onFocus)o.onFocus(o.plans[i],i);
    }
    function frame(){
      raf=0;var mid=tr.scrollLeft+tr.clientWidth/2,best=0,bd=1e9;
      cards.forEach(function(c,k){
        var d=(centerOf(c)-mid)/c.offsetWidth,a=Math.min(Math.abs(d),1.4);
        if(Math.abs(d)<bd){bd=Math.abs(d);best=k}
        if(!reduce){c.style.transform="perspective(900px) rotateY("+(-d*20).toFixed(1)+"deg) scale("+(1-Math.min(a,1)*.1).toFixed(3)+")";c.style.opacity=(1-Math.min(a,1)*.42).toFixed(2)}
      });
      setFocus(best);
    }
    function queue(){if(!raf)raf=requestAnimationFrame(frame)}
    tr.addEventListener("scroll",queue,{passive:true});
    window.addEventListener("resize",function(){if(document.body.contains(tr)){scrollToIdx(Math.max(cur,0),false);queue()}});
    box.addEventListener("click",function(e){
      var b=e.target.closest("[data-pc]"),card=e.target.closest(".pc-card");
      if(b){var k=b.getAttribute("data-pc");if(k==="prev")scrollToIdx(cur-1,true);else if(k==="next")scrollToIdx(cur+1,true);else if(k==="go")scrollToIdx(+b.getAttribute("data-i"),true);return}
      if(card&&!drag)scrollToIdx(+card.getAttribute("data-i"),true);
    });
    tr.addEventListener("keydown",function(e){
      if(e.key==="ArrowRight"){e.preventDefault();scrollToIdx(cur+1,true)}
      else if(e.key==="ArrowLeft"){e.preventDefault();scrollToIdx(cur-1,true)}
      else if(e.key==="Home"){e.preventDefault();scrollToIdx(0,true)}
      else if(e.key==="End"){e.preventDefault();scrollToIdx(cards.length-1,true)}
    });
    /* mouse drag on desktop; touch uses native swipe and scroll snapping */
    tr.addEventListener("pointerdown",function(e){if(e.pointerType!=="mouse"||e.button!==0)return;drag={x:e.clientX,l:tr.scrollLeft,moved:false};tr.classList.add("drag")});
    window.addEventListener("pointermove",function(e){if(!drag)return;var dx=e.clientX-drag.x;if(Math.abs(dx)>4)drag.moved=true;tr.scrollLeft=drag.l-dx});
    window.addEventListener("pointerup",function(){
      if(!drag)return;var moved=drag.moved;tr.classList.remove("drag");
      if(moved){var mid=tr.scrollLeft+tr.clientWidth/2,best=0,bd=1e9;cards.forEach(function(c,k){var d=Math.abs(centerOf(c)-mid);if(d<bd){bd=d;best=k}});scrollToIdx(best,true)}
      setTimeout(function(){drag=null},0);
    });
    var start=Math.max(0,o.plans.map(function(p){return p.id}).indexOf(o.focus||o.chosen||""));
    scrollToIdx(start,false);frame();setFocus(start);
  };
  window.Plans=Plans;
})();
