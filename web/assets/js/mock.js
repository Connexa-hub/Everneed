/* Interactive app mockups. Same design tokens and layout language as the Everneed app; sample data only. */
window.Mock=(function(){
  var E=function(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
  var I={home:"M3 11l9-8 9 8v10h-6v-6H9v6H3z",search:"M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",bag:"M5 8h14l-1 12H6zM9 8a3 3 0 016 0",me:"M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0"};
  var TABS=[["home","Home"],["search","Search"],["bag","Orders"],["me","Me"]],ACT={home:"home",store:"home",setup:"me",product:"me",orders:"bag",code:"bag",earn:"me"};
  var PR=[["Palm oil 1L","₦4,500","Ada’s Pantry"],["Shea butter","₦3,200","Zuri Naturals"],["Power strip","₦8,900","VoltHub"],["Vitamin C serum","₦12,000","Glow Lab"]];
  var SETUP=[["Your store","Store name","Ada’s Pantry","Tagline","Fresh staples from Lagos"],["About and location","State","Lagos","City","Ikeja"],["Delivery","Pickup address","12 Allen Avenue, Ikeja","Deliver myself","Yes: Ikeja and Lekki"],["Payout","Bank","Demo Bank","Account number","0123456789"],["Business","Business name","Ada’s Pantry Ltd","ID type","NIN"]];
  var OS=[["New","wa","Accept"],["Accepted","in","Mark ready"],["Ready for hub","ok",""]];
  function svg(d){return'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg>'}
  function tabbar(a){return'<div class="tb">'+TABS.map(function(t){return'<span class="'+(t[0]===a?"on":"")+'">'+svg(I[t[0]])+t[1]+"</span>"}).join("")+"</div>"}
  function done(t,s,btn,m){return'<div style="text-align:center;padding-top:56px"><div class="okc">✓</div><b style="display:block;font:700 17px var(--font-display);margin:12px 0 4px">'+t+'</b><span style="color:var(--text-2)">'+s+'</span>'+m+'<div style="margin-top:16px"><button class="ab o" data-m="'+btn[0]+'">'+btn[1]+"</button></div></div>"}
  var S={
    home:function(st){return'<div class="ah"><div><small>Deliver to</small><br><b>Lagos</b></div><span style="position:relative">'+svg(I.bag)+'<i class="bdg">'+st.cart+"</i></span></div>"
      +'<div class="fi" style="margin:0 0 10px;color:var(--text-3)">Search groceries, skincare...</div><div class="chips2">'+CFG.collections.map(function(c,i){return'<span data-m="chip" class="'+(i===0?"on":"")+'">'+E(c)+"</span>"}).join("")+"</div>"
      +'<div class="ban"><b style="font:700 15px var(--font-display)">Fresh from local sellers</b><br><small>Every order arrives with a code</small></div><div class="grid2">'
      +PR.map(function(p){return'<div class="pc2"><div class="im"></div><b>'+E(p[0])+"</b><small>"+E(p[2])+'</small><div class="pr"><span>'+p[1]+'</span><button data-m="add" aria-label="Add to cart">+</button></div></div>'}).join("")+"</div>"},
    store:function(){return'<div style="height:78px;border-radius:16px;background:linear-gradient(135deg,var(--brand),color-mix(in srgb,var(--accent) 50%,var(--brand)))"></div><div style="display:flex;gap:10px;align-items:center;margin:-22px 6px 8px"><div style="flex:none;width:48px;height:48px;border-radius:50%;border:3px solid var(--bg);background:var(--brand-soft)"></div><div style="flex:1;padding-top:24px"><b style="font:700 15px var(--font-display)">Ada’s Pantry</b><br><span class="st ok">Verified seller</span></div><button class="ab o" data-m="follow" style="margin-top:24px">Follow</button></div><div class="chips2"><span class="on">Products</span><span>About</span><span>Reviews</span></div>'
      +PR.slice(0,3).map(function(p){return'<div class="cd" style="display:flex;gap:10px;align-items:center"><div style="flex:none;width:44px;height:44px;border-radius:10px;background:var(--brand-soft)"></div><div style="flex:1"><b>'+E(p[0])+'</b><br><span style="font-weight:700">'+p[1]+'</span></div><button class="ab" data-m="add">Add</button></div>'}).join("")},
    setup:function(st){if(st.done)return done("Application sent","We will message you here as soon as there is a decision.",["again","Start over"],'<div style="margin-top:12px"><span class="st in">In review</span></div>');
      var s=SETUP[st.step-1];return'<div class="ah"><b>Store setup</b><small>Step '+st.step+' of 5</small></div><div class="dots5">'+[1,2,3,4,5].map(function(n){return'<i class="'+(n<=st.step?"on":"")+'"></i>'}).join("")+'</div><b style="display:block;font:700 16px var(--font-display);margin:14px 0 2px">'+s[0]+'</b><div class="fi"><small>'+s[1]+"</small>"+E(s[2])+'</div><div class="fi"><small>'+s[3]+"</small>"+E(s[4])+'</div><button class="ab w" data-m="next" style="margin-top:14px">'+(st.step===5?"Send application":"Save and continue")+"</button>"+(st.step>1?'<button class="ab o w" data-m="back" style="margin-top:8px">Back</button>':"")},
    product:function(st){var p=st.ps;return'<div class="ah"><b>Add product</b>'+(p===0?'<span class="st">Draft</span>':p===1?'<span class="st in">In review</span>':'<span class="st ok">Live</span>')+'</div><div style="height:84px;border-radius:14px;background:linear-gradient(135deg,var(--brand-soft),var(--surface-3));display:grid;place-items:center;color:var(--text-3)">Photo added</div><div class="fi"><small>Product name</small>Palm oil 1L</div><div class="fi"><small>Price</small>₦4,500</div><div class="fi"><small>Stock</small>40</div>'
      +(p===0?'<button class="ab w" data-m="psub" style="margin-top:12px">Submit for review</button><button class="ab o w" data-m="draft" style="margin-top:8px">Save draft</button>':p===1?'<div class="cd" style="color:var(--text-2)">Everneed is reviewing your product. You will get a message here.</div>':'<div class="cd" style="color:var(--success);font-weight:600">Approved. Shoppers can buy it in the app now.</div><button class="ab o w" data-m="preset" style="margin-top:8px">Try again</button>')},
    orders:function(st){var L=[["#1042","Palm oil 1L x2","Ikeja","₦9,000"],["#1043","Shea butter","Lekki","₦3,200"],["#1044","Power strip","Yaba","₦8,900"]];
      return'<div class="ah"><b>Orders</b><span class="st in">'+st.o.filter(function(x){return x<2}).length+" open</span></div>"+L.map(function(o,i){var s=OS[st.o[i]];return'<div class="cd"><div style="display:flex;justify-content:space-between"><b>'+o[0]+'</b><span class="st '+s[1]+'">'+s[0]+'</span></div><div style="color:var(--text-2);margin:4px 0">'+o[1]+" · "+o[2]+'</div><div style="display:flex;justify-content:space-between;align-items:center"><b>'+o[3]+"</b>"+(st.o[i]<2?'<button class="ab" data-m="oadv" data-i="'+i+'">'+s[2]+"</button>":'<span style="color:var(--success);font-weight:600">Hub will collect</span>')+"</div></div>"}).join("")},
    code:function(st){if(st.ok)return done("Delivered","Code confirmed. ₦9,000 moves to your pending earnings.",["rcode","Try again"],"");
      var c=st.code||"";return'<div class="ah"><b>Confirm delivery</b></div><div style="color:var(--text-2);margin-bottom:10px">Ask the buyer for the 4-digit code for order #1042. Try 4821.</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">'+[0,1,2,3].map(function(i){return'<div class="kp'+(st.err?" shake":"")+'">'+(c.charAt(i)||"")+"</div>"}).join("")+'</div><div class="keys">'+[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map(function(k){return k===""?"<span></span>":'<button data-m="key" data-k="'+k+'">'+k+"</button>"}).join("")+"</div>"},
    earn:function(st){var r=st.r,d=r==="7"?[34,52,41,68,47,82,63]:[20,28,35,30,44,40,52,48,60,58,70,82];
      return'<div class="ah"><b>Earnings</b><span class="chips2"><span data-m="range" data-r="7" class="'+(r==="7"?"on":"")+'">7 days</span><span data-m="range" data-r="30" class="'+(r==="30"?"on":"")+'">30 days</span></span></div><small>Total earnings</small><div style="font:700 26px var(--font-display)">'+(r==="7"?"₦186,400":"₦642,900")+'</div><div class="bars">'+d.map(function(h){return'<i style="height:'+h+'%"></i>'}).join("")+'</div><div class="cd" style="display:flex;justify-content:space-between"><span>Released</span><b>₦142,000</b></div><div class="cd" style="display:flex;justify-content:space-between"><span>Pending release</span><b>₦44,400</b></div>'}
  };
  function fresh(){return{cart:0,step:1,done:false,ps:0,o:[0,0,0],code:"",err:false,ok:false,r:"7"}}
  function render(ph,name){ph._screen=name;ph.querySelector(".scr").innerHTML='<i class="nt"></i><div class="sb"><span>9:41</span><span>5G</span></div><div class="bd2">'+S[name](ph._st)+"</div>"+tabbar(ACT[name])}
  function init(root){(root||document).querySelectorAll(".phone[data-screen]").forEach(function(ph){ph._st=fresh();render(ph,ph.getAttribute("data-screen"))})}
  function show(ph,name){ph._st=fresh();render(ph,name)}
  document.addEventListener("click",function(e){var b=e.target.closest("[data-m]"),ph=b&&b.closest(".phone");if(!ph||!ph._st)return;var a=b.getAttribute("data-m"),st=ph._st,re=function(){render(ph,ph._screen)};
    if(a==="add"){st.cart++;var bd=ph.querySelector(".bdg");if(bd){bd.textContent=st.cart;bd.classList.remove("pop");void bd.offsetWidth;bd.classList.add("pop")}else b.textContent="Added"}
    else if(a==="chip"){b.parentNode.querySelectorAll("span").forEach(function(x){x.classList.toggle("on",x===b)})}
    else if(a==="follow"){b.textContent=b.textContent==="Follow"?"Following":"Follow"}
    else if(a==="next"){if(st.step===5)st.done=true;else st.step++;re()}
    else if(a==="back"){st.step=Math.max(1,st.step-1);re()}
    else if(a==="again"){st.step=1;st.done=false;re()}
    else if(a==="draft"){b.textContent="Saved"}
    else if(a==="psub"){st.ps=1;re();setTimeout(function(){if(ph.isConnected&&ph._screen==="product"&&st.ps===1){st.ps=2;re()}},1500)}
    else if(a==="preset"){st.ps=0;re()}
    else if(a==="oadv"){var i=+b.getAttribute("data-i");st.o[i]=Math.min(2,st.o[i]+1);re()}
    else if(a==="range"){st.r=b.getAttribute("data-r");re()}
    else if(a==="rcode"){st.ok=false;st.code="";re()}
    else if(a==="key"){var k=b.getAttribute("data-k");if(k==="⌫")st.code=st.code.slice(0,-1);else if(st.code.length<4)st.code+=k;
      if(st.code.length===4){if(st.code==="4821")st.ok=true;else{st.err=true;st.code=""}}re();st.err=false}});
  /* Web portal + admin demo: one shared state, so an action in one view shows up in the other. */
  var W={prod:"draft",app:0,msg:""};
  function pill(c,l){return'<span class="pill '+c+'">'+l+"</span>"}
  function wr(n,s,r){return'<div class="wr"><span><b>'+n+"</b><small>"+s+'</small></span><span class="wrr">'+r+"</span></div>"}
  function kp(a){return'<div class="wk">'+a.map(function(k){return"<div><b>"+k[0]+"</b><small>"+k[1]+"</small></div>"}).join("")+"</div>"}
  function web(bf,tab){if(tab)bf._tab=tab;tab=bf._tab=bf._tab||"portal";
    var pr=W.prod,live=23+(pr==="live"?1:0),rev=2+(pr==="review"?1:0),dr=(pr==="draft"||pr==="changes")?1:0,h;
    if(tab==="portal"){var right=pr==="draft"?pill("","Draft")+'<button class="ab" data-w="submit">Submit for review</button>':pr==="review"?pill("info","In review")+"<small>Waiting for Everneed</small>":pr==="live"?pill("ok","Live")+"<small>Live in the app</small>":pill("bad","Needs changes")+'<button class="ab" data-w="submit">Resubmit</button>';
      h='<b class="wh">Ada’s Pantry</b>'+kp([[live,"Live products"],[rev,"In review"],[dr,"Drafts"],["₦186k","Earnings"]])+wr("Palm oil 1L","₦4,500",pill("ok","Live"))+wr("Black soap","₦1,800",pill("ok","Live"))+wr("Shea butter","₦3,200"+(pr==="changes"?" · Note: add a clearer photo":""),right)}
    else{h='<b class="wh">Review queue</b>'+kp([[W.app?0:1,"Applications"],[pr==="review"?1:0,"Products to review"],[live,"Live products"]])
      +(W.app?wr("Zuri Naturals","Approved. The seller was notified.",pill("ok","Approved")):wr("Zuri Naturals","Store application · Skincare · Abuja",'<button class="ab" data-w="appr">Approve</button>'))
      +(pr==="review"?wr("Shea butter","Ada’s Pantry · ₦3,200 · Product review",'<button class="ab" data-w="pub">Publish</button><button class="ab o" data-w="chg">Ask for changes</button>'):"")
      +(W.app&&pr!=="review"?'<div class="empty" style="margin-top:12px">Nothing else waiting.</div>':"")}
    var side=tab==="portal"?["Dashboard","Products","Orders","Payouts"]:["Overview","Applications","Product review","Stores"];
    bf.querySelector(".bs").innerHTML=side.map(function(x,i){return'<span class="'+(i===0?"on":"")+'">'+x+"</span>"}).join("");bf.querySelector(".bm").innerHTML=h;bf.querySelector(".bar span").textContent="everneed.app/"+(tab==="portal"?"portal":"admin");
    var sy=document.getElementById("syn");if(sy)sy.textContent=W.msg||"Try it: submit the draft in Seller portal, switch to Admin console, then publish it."}
  document.addEventListener("click",function(e){var b=e.target.closest("[data-w]"),bf=document.getElementById("bf");if(!b||!bf)return;var a=b.getAttribute("data-w");
    if(a==="tab"){document.querySelectorAll("[data-w=tab]").forEach(function(x){x.classList.toggle("on",x===b)});web(bf,b.getAttribute("data-t"));return}
    if(a==="submit"){W.prod="review";W.msg="Sent to the admin queue. Switch to Admin console to review it."}
    if(a==="pub"){W.prod="live";W.msg="Published. It is now live in the app for shoppers."}
    if(a==="chg"){W.prod="changes";W.msg="Sent back to the seller with a note. Switch to Seller portal to see it."}
    if(a==="appr"){W.app=1;W.msg="Store approved. The seller gets a message in the app and on the web."}
    web(bf)});
  return{init:init,show:show,web:web,resetWeb:function(){W={prod:"draft",app:0,msg:""}}};
})();
