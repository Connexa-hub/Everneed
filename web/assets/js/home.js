/* New marketing home: cinematic hero, interactive app showcase, theme demo, web + admin sync demo, payout calculator. */
(function(){
  var C=Core,V=C.V,A=C.A,esc=C.esc,$=C.$;
  var TAB=[["setup","Apply in minutes","Five short steps: store, location, delivery, payout and business. Progress saves as you go."],["product","List your products","Add a photo, price and stock, then submit for review. You are told the moment it goes live."],["orders","Fulfil orders","Each order shows only your items. Accept, prepare, then hand over to the hub or deliver yourself."],["code","Confirm with a code","Every delivery has a four-digit code. When the buyer shares it, the order is complete."],["earn","Watch earnings release","Sales and commission go to a ledger. Earnings release after the holding period."]];
  var FAQ=[["Can shoppers buy on the website?","Not at launch. Shoppers use the Everneed app. The website is for sellers and the Everneed team."],["How long does review take?","An admin reviews every store and product. If something needs fixing you see the reason and can resubmit."],["When do I get paid?","Earnings release after a holding period that protects buyers, then payouts go to your bank account."],["What does it cost?","New stores get a free trial, and commission applies only when you sell. See Plans for details."]];
  function phone(screen,attrs){return'<div class="phone" data-screen="'+screen+'"'+(attrs||"")+'><div class="scr"></div></div>'}
  function marquee(){var w=CFG.collections.concat(["Fashion","Home","Beauty"]).map(function(c){return"<span><b>"+esc(c)+"</b> ·</span>"}).join("");return'<div class="mq" aria-hidden="true"><div>'+w+w+"</div></div>"}
  function html(){var P=Theme.palettes;return`
<section class="h-hero night"><div class="w"><div class="hero-copy">
<span class="pillx"><i></i>Now onboarding sellers</span>
<h1 class="h1x">Open a store. Let Everneed handle the rest.</h1>
<p class="lead">Storefront, orders, delivery codes and payouts in one place. Your products reach shoppers in the Everneed app.</p>
<div class="row cta"><a class="btn" href="#/login/new">Open your store</a><button class="btn o" data-act="scrollto" data-t="#showcase">See how it works</button></div>
<p class="sm" style="margin-top:14px">Free to apply. Commission only when you sell.</p></div>
<div class="hero-stage">${phone("home")}<div class="float f1"><b>New order #1042</b><br><small>Palm oil 1L x2 · ₦9,000</small></div><div class="float f2"><b>Code confirmed</b><br><small>Earnings moved to pending</small></div></div></div></section>
${marquee()}
<section class="sx" id="showcase"><div class="w"><h2 class="h2x rv">Run your whole store from your phone.</h2><p class="lead rv">Tap through the real flow. This is the same experience sellers get in the Everneed app.</p>
<div class="sc rv" id="sc"><div class="sct">${TAB.map(function(t,i){return'<button class="'+(i===0?"on":"")+'"><b>'+t[1]+"</b><p>"+t[2]+'</p><span class="pgb"><i></i></span></button>'}).join("")}</div><div class="phwrap">${phone("setup")}</div></div></div></section>
<section class="sx night"><div class="w sc2"><div class="rv"><h2 class="h2x">Looks like your brand. Works in any light.</h2><p class="lead">Six colour palettes plus light, dark and AMOLED modes, the same ones in the app. Pick one and the whole experience follows.</p>
<div class="tg" id="tmode" style="margin-top:24px"><button class="on" data-th="mode" data-v="dark">Dark</button><button data-th="mode" data-v="light">Light</button><button data-th="mode" data-v="amoled">AMOLED</button></div>
<div class="swgrid2" id="tpal">${P.map(function(x,i){return'<button data-th="pal" data-v="'+x[0]+'" class="'+(i===0?"on":"")+'"><span class="dots2"><i style="background:'+x[3]+'"></i><i style="background:'+x[4]+'"></i></span>'+x[1]+"</button>"}).join("")}</div></div>
<div class="phwrap rv">${phone("store",' id="thph" data-mode="dark" data-palette="emerald"')}</div></div></section>
<section class="sx alt"><div class="w"><h2 class="h2x rv">One database. The app and the web stay in step.</h2><p class="lead rv">Sellers work in the app or the web portal. The Everneed team reviews in the admin console. It is all the same data, so a decision shows up everywhere.</p>
<div class="syncrow rv"><span><b>1</b>Seller submits</span><i></i><span><b>2</b>Admin reviews</span><i></i><span><b>3</b>Live in the app</span></div>
<div class="tg" style="margin:28px 0 16px"><button class="on" data-w="tab" data-t="portal">Seller portal</button><button data-w="tab" data-t="admin">Admin console</button></div>
<div class="bf rv" id="bf"><div class="bar"><i></i><i></i><i></i><span>everneed.app/portal</span></div><div class="bc"><div class="bs"></div><div class="bm"></div></div></div><p class="sm" id="syn" style="margin-top:12px"></p></div></section>
<section class="sx"><div class="w calc"><div class="rv"><h2 class="h2x">See what you take home.</h2><p class="lead">Move the sliders. Illustrative only: your plan’s commission rate applies.</p>
<label class="lb">Price per item: <b id="cpv"></b><input id="cp" type="range" min="500" max="50000" step="500" value="4500"></label>
<label class="lb">Items sold per month: <b id="cuv"></b><input id="cu" type="range" min="1" max="500" step="1" value="40"></label>
<label class="lb">Commission rate (example)<select id="cr"><option value="5">5%</option><option value="8">8%</option><option value="10" selected>10%</option><option value="12">12%</option></select></label></div>
<div class="card res rv"><small>Sales</small><div class="bigd" id="cs"></div><div class="split2"><i id="cb" style="background:var(--brand)"></i><i id="cb2" style="background:var(--accent)"></i></div><div class="row" style="justify-content:space-between"><span>Commission <b id="cf"></b></span><span>You receive <b id="cn"></b></span></div></div></div></section>
<section class="sx night"><div class="w"><div class="stats2"><div class="rv"><b data-count="5">0</b><small>steps to apply</small></div><div class="rv"><b data-count="2">0</b><small>ways to deliver</small></div><div class="rv"><b data-count="6">0</b><small>countries, local currency</small></div><div class="rv"><b data-count="4">0</b><small>digits prove each delivery</small></div></div></div></section>
<section class="sx alt"><div class="w"><h2 class="h2x rv">Questions</h2><div class="rv" style="margin-top:24px;max-width:760px">${FAQ.map(function(q){return"<details><summary>"+q[0]+"</summary><p>"+q[1]+"</p></details>"}).join("")}</div></div></section>
<section class="sx"><div class="w"><div class="band rv"><h2 class="h2x" style="max-width:none;margin:auto">Ready to sell?</h2><p>Create your seller account and start your application today.</p><a class="btn" href="#/login/new">Open your store</a></div></div></section>`}
  function counters(el){var n=+el.getAttribute("data-count"),t0=null;function f(t){if(!t0)t0=t;var p=Math.min(1,(t-t0)/900);el.textContent=Math.round(n*p);if(p<1)requestAnimationFrame(f)}requestAnimationFrame(f)}
  function init(){
    Mock.init(document);Mock.resetWeb();Mock.web($("#bf"),"portal");
    var sc=$("#sc"),ph=sc.querySelector(".phone"),tabs=sc.querySelectorAll(".sct button"),cur=0,timer;
    function go(i,user){cur=i;tabs.forEach(function(b,j){b.classList.toggle("on",j===i)});Mock.show(ph,TAB[i][0]);if(user){sc.classList.add("paused");clearInterval(timer)}}
    tabs.forEach(function(b,i){b.addEventListener("click",function(){go(i,true)})});
    ph.addEventListener("click",function(){sc.classList.add("paused");clearInterval(timer)});
    timer=setInterval(function(){if(!document.body.contains(sc)){clearInterval(timer);return}go((cur+1)%TAB.length)},7000);
    var th=$("#thph");document.addEventListener("click",function(e){var b=e.target.closest("[data-th]");if(!b||!th||!th.isConnected)return;var k=b.getAttribute("data-th"),v=b.getAttribute("data-v");
      th.setAttribute(k==="pal"?"data-palette":"data-mode",v);b.parentNode.querySelectorAll("[data-th]").forEach(function(x){x.classList.toggle("on",x===b)})});
    var nf=new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0});
    function calc(){var p=+$("#cp").value,u=+$("#cu").value,r=+$("#cr").value/100,s=p*u,f=s*r;$("#cpv").textContent=nf.format(p);$("#cuv").textContent=u;$("#cs").textContent=nf.format(s);$("#cf").textContent=nf.format(f);$("#cn").textContent=nf.format(s-f);$("#cb").style.width=(100-r*100)+"%";$("#cb2").style.width=(r*100)+"%"}
    ["#cp","#cu","#cr"].forEach(function(s){$(s).addEventListener("input",calc)});calc();
    var els=document.querySelectorAll(".rv"),cs=document.querySelectorAll("[data-count]");
    if(!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("in")});cs.forEach(function(e){e.textContent=e.getAttribute("data-count")});return}
    var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add("in");var c=x.target.querySelector("[data-count]");if(c&&!c._d){c._d=1;counters(c)}io.unobserve(x.target)}})},{threshold:.15});
    els.forEach(function(e){io.observe(e)})}
  A.scrollto=function(b){var t=document.querySelector(b.getAttribute("data-t"));if(t)t.scrollIntoView({behavior:"smooth"})};
  V.home=function(){return{layout:"pub",title:"",active:"",html:html(),after:init}};
})();
