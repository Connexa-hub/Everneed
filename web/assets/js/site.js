/* Marketing pages, sign in, early access. */
(function(){
  var C=Core,esc=C.esc,V=C.V,A=C.A,F=C.F,wlWidget=null;
  function pub(html,active,title){return{layout:"pub",html:html,active:active,title:title}}
  var TOOLS=[["Your own storefront","A store page with your name, cover, colour and link. Share it anywhere."],["Reviewed listings","Every product is checked before it goes live, so shoppers trust what they see."],["Orders that split by seller","One cart can hold many sellers. You only see and handle your own part."],["Hub or direct delivery","Hand items to the Everneed hub, or deliver yourself in the areas you choose."],["A ledger you can read","Every sale and commission is recorded. Earnings release after the holding period."],["Messages from Everneed","Approvals, change requests and payout news land in your dashboard."]];
  V.home=function(){return pub(`
<section class="hero night"><div class="w hg"><div>
<h1>Open a store. Let Everneed handle the rest.</h1>
<p class="lead">Storefront, order tools, delivery and payouts in one place. Shoppers find you in the Everneed app.</p>
<div class="row" style="margin-top:28px"><a class="btn" href="#/login/new">Open your store</a><a class="btn o" href="#/pricing">See plans</a></div>
<p class="sm" style="margin-top:14px">Free to apply. You pay commission only when you sell.</p></div>
<div class="mock" aria-hidden="true"><div class="shd"><div class="av"></div><div><b>Ada’s Pantry</b><br><span class="pill ok">Live</span></div></div>
<div class="kpis" style="margin:0"><div><b>24</b><small>Live products</small></div><div><b>3</b><small>In review</small></div></div>
<div class="rw"><span><b>Palm oil 1L</b><small>Order accepted</small></span><span class="pill info">Preparing</span></div><div class="rw"><span><b>Shea butter</b><small>Ready for hub</small></span><span class="pill ok">Ready</span></div></div>
</div></section>
<section class="sec"><div class="w"><div class="stats"><div><b>5 steps</b><small>to apply, saved as you go</small></div><div><b>2 ways</b><small>to deliver: hub or direct</small></div><div><b>Every sale</b><small>written to your ledger</small></div><div><b>6 countries</b><small>with local currency</small></div></div></div></section>
<section class="sec alt"><div class="w"><h2 style="max-width:20ch">Everything a seller needs</h2><div class="g3">${TOOLS.map(function(t){return'<div class="card"><h3>'+t[0]+"</h3><p>"+t[1]+"</p></div>"}).join("")}</div></div></section>
<section class="sec"><div class="w split"><div><h2>Apply in five steps</h2><p class="lead">Stop anytime and carry on later. We review your store and your first products, then you go live.</p>
<ol class="steps"><li><div><b>Your store</b><br><small>Name, tagline, logo and cover</small></div></li><li><div><b>About and location</b><br><small>Categories, state and city</small></div></li><li><div><b>Pickup and delivery</b><br><small>Where items are kept and areas you cover</small></div></li><li><div><b>Payout</b><br><small>The bank account for your earnings</small></div></li><li><div><b>Business and agreement</b><br><small>Details for review</small></div></li></ol></div>
<div class="card"><h3>Shoppers use the app</h3><p>Buyers browse, pay and track deliveries in the Everneed app, with a delivery code that proves each order arrived. Your website tools are for running the store.</p><div class="row" style="margin-top:18px"><a class="btn" href="#/early-access">Get early access</a></div></div></div></section>
<section class="sec alt"><div class="w"><h2>Questions</h2><div style="margin-top:20px;max-width:760px">${FAQ()}</div></div></section>
<section class="sec"><div class="w"><div class="band"><h2>Ready to sell?</h2><p>Create your seller account and start your application today.</p><a class="btn" href="#/login/new">Open your store</a></div></div></section>`,"","")};
  function FAQ(){return[["Can shoppers buy on the website?","Not at launch. Shoppers use the Everneed app. The website is for sellers and the Everneed team."],["How long does review take?","An admin reviews every store and product. If something needs fixing you see the reason in your dashboard and can resubmit."],["When do I get paid?","Earnings release after a holding period that protects buyers, then payouts go to your bank account."],["What does it cost?","See Plans. New stores get a free trial, and commission applies only when you sell."]].map(function(q){return"<details><summary>"+q[0]+"</summary><p>"+q[1]+"</p></details>"}).join("")}
  V.sell=function(){return pub('<section class="sec"><div class="w"><h1>Sell on Everneed</h1><p class="lead">Apply once. We review, you go live, and you manage products, orders and earnings from your portal.</p><div class="g3"><div class="card"><h3>1. Apply</h3><p>Five short steps, saved as you go.</p></div><div class="card"><h3>2. Get reviewed</h3><p>Approval, or a clear note on what to change.</p></div><div class="card"><h3>3. Sell and get paid</h3><p>Accept orders, hand over for delivery, watch earnings release.</p></div></div><div class="row" style="margin-top:28px"><a class="btn" href="#/login/new">Open your store</a><a class="btn o" href="#/pricing">See plans</a></div></div></section>',"sell","Sell")};
  V.pricing=function(){return Supa.get("store_plans?select=*").then(function(p){return p||[]},function(){return[]}).then(function(p){
    var cards=p.length?p.map(function(x,i){var price=x.price!=null?x.price:x.price_ngn!=null?x.price_ngn:x.monthly_price;return'<div class="card"><h3>'+esc(x.name||"Plan")+'</h3><p style="font:700 1.8rem var(--font-display);color:var(--text-1)">'+(price!=null?esc(C.money(price))+' <small>/ month</small>':"Free trial")+"</p><p>"+esc(x.description||"Store, products and orders")+'</p><a class="btn s" style="margin-top:16px" href="#/login/new">Open your store</a></div>'}).join("")
      :["Starter","Growth","Pro"].map(function(n){return'<div class="card"><h3>'+n+'</h3><p style="font:700 1.5rem var(--font-display);color:var(--text-1)">Announced at launch</p><p>Storefront, product and order tools, ledger and payouts.</p><a class="btn s" style="margin-top:16px" href="#/early-access">Get early access</a></div>'}).join("");
    return pub('<section class="sec"><div class="w"><h1>Plans</h1><p class="lead">A store rental plus commission on each sale. Plan prices are managed by the Everneed team and appear here automatically.</p><div class="g3">'+cards+"</div></div></section>","pricing","Plans")})};
  V.help=function(){return pub('<section class="sec"><div class="w"><h1>Help</h1><div style="margin-top:24px;max-width:760px">'+FAQ()+"</div></div></section>","help","Help")};
  V.about=function(){return pub('<section class="sec"><div class="w"><h1>About Everneed</h1><p class="lead">Everneed is a marketplace that treats small sellers like real businesses: their own store, a fair ledger and a delivery process shoppers can trust.</p></div></section>',"about","About")};
  V.appearance=function(){return pub('<section class="sec"><div class="w" style="max-width:760px"><h1 style="font-size:clamp(2rem,5vw,3rem)">Theme and colour</h1><p class="lead">Same modes and palettes as the app.</p><div id="apprw" style="margin-top:24px">'+C.appearance()+"</div></div></section>","","Theme")};
  V["early-access"]=function(){var page=pub('<section class="sec"><div class="w split"><div><h1 style="font-size:clamp(2.2rem,5vw,3.6rem)">Get early access</h1><p class="lead">Tell us who you are and where. We write once, when your country opens.</p></div><div class="card"><form data-form="wl"><label class="lb">Name<input name="name" autocomplete="name"></label><label class="lb">Email<input type="email" name="email" required autocomplete="email"></label><label class="lb">I want to<select name="role"><option value="seller">Sell</option><option value="shopper">Shop</option><option value="both">Both</option></select></label><label class="lb">Country<select name="country">'+Object.keys(CFG.countries).map(function(k){return'<option value="'+k+'">'+CFG.countries[k]+"</option>"}).join("")+'</select></label><label class="lb">What would you sell or buy?<input name="interest" placeholder="Groceries, skincare..."></label>'+(CFG.env==="staging"?'<div id="wl-turnstile" style="margin-top:14px"></div>':"")+'<button class="btn wide" style="margin-top:18px">Join the list</button></form><div id="wlmsg"></div></div></div></section>',"","Early access");page.after=function(){if(CFG.env!=="staging")return;wlWidget=null;Turnstile.mount(document.getElementById("wl-turnstile"),"waitlist").then(function(w){wlWidget=w}).catch(function(){C.toast("Security check could not load. Please refresh and try again.",true)})};return page};
  F.wl=function(f,d){var b=f.querySelector("button"),req,args={p_email:d.email,p_name:d.name||null,p_role:d.role,p_country:d.country,p_interest:d.interest||null,p_source:"website"};if(CFG.env==="staging"){try{if(!wlWidget)throw new Error("Security check is still loading");args.token=wlWidget.take()}catch(e){b.disabled=false;C.toast(e.message,true);return}req=Supa.fn("public-forms",Object.assign({action:"waitlist"},args))}else req=Supa.rpcAnon("join_waitlist",args);b.disabled=true;
    req.then(function(){if(wlWidget)wlWidget.reset();document.getElementById("wlmsg").innerHTML='<div class="note"><span><b>You’re on the list.</b>We’ll email you when your country opens.</span></div>';f.reset();b.disabled=false})
    .catch(function(e){if(wlWidget)wlWidget.reset();b.disabled=false;C.toast(e.message||"Could not join the list. Please try again.",true)})};
  /* Unified Everneed account access: welcoming shopping story + progressive account steps. */
  function roleRoute(profile){
    var role=String(profile&&profile.role||"customer").toLowerCase();
    if(role==="admin")return "#/admin";
    if(role==="merchant"||role==="seller")return "#/portal";
    return "#/account";
  }
  function authPage(up){
    var steps=up?["Your details","Email address","Create password","Confirm password"]:["Email address","Your password"];
    var state={step:0,name:"",email:"",pw:"",pw2:""};
    function field(label,name,type,placeholder,autocomplete,value){
      return '<label class="auth-field"><span>'+label+'</span><input id="auth-current" name="current" type="'+type+'" value="'+esc(value||"")+'" placeholder="'+placeholder+'" autocomplete="'+autocomplete+'" '+(type==="email"?'inputmode="email"':'')+' required></label>';
    }
    function panel(){
      var i=state.step,content="",hint="";
      if(up){
        if(i===0){content=field("What should we call you?","name","text","Your full name","name",state.name);hint="Use the name you want associated with your Everneed account."}
        if(i===1){content=field("Your email address","email","email","you@example.com","email",state.email);hint="We’ll use this to sign you in and send account updates."}
        if(i===2){content=field("Create a password","pw","password","At least 8 characters","new-password",state.pw);hint="Use at least 8 characters. Choose something only you know."}
        if(i===3){content=field("Confirm your password","pw2","password","Enter the same password again","new-password",state.pw2);hint="One last check, then your account is ready."}
      }else{
        if(i===0){content=field("Email address","email","email","you@example.com","email",state.email);hint="Enter the email linked to your Everneed account."}
        if(i===1){content=field("Password","pw","password","Your password","current-password",state.pw);hint="Your account, your stores and your shopping access in one place."}
      }
      var last=i===steps.length-1;
      return '<div class="auth-progress" aria-label="Step '+(i+1)+' of '+steps.length+'"><div class="auth-progress-top"><span>'+steps[i]+'</span><span>'+String(i+1).padStart(2,"0")+' / '+String(steps.length).padStart(2,"0")+'</span></div><div class="auth-progress-track"><i style="width:'+((i+1)/steps.length*100)+'%"></i></div></div>'
        +'<div class="auth-step" key="'+i+'"><span class="auth-step-kicker">'+(up?"CREATE YOUR ACCOUNT":"SIGN IN SECURELY")+'</span><h2>'+(up?["Let’s get to know you.","Where can we reach you?","Keep your account secure.","Ready to join Everneed?"][i]:["Welcome back.","Good to have you back."][i])+'</h2><p class="auth-intro">'+hint+'</p>'+content
        +'<div class="auth-step-actions">'+(i>0?'<button class="btn o" type="button" data-auth-back>Back</button>':'<a class="auth-back-link" href="#/">Back to Everneed</a>')
        +(last?'<button class="btn auth-primary" type="submit">'+(up?"Create my account":"Sign in")+' <span aria-hidden="true">→</span></button>':'<button class="btn auth-primary" type="button" data-auth-next>Continue <span aria-hidden="true">→</span></button>')+'</div></div>';
    }
    var switcher=up?'Already have an account? <a href="#/login">Sign in</a>':'New to Everneed? <a href="#/login/new">Create an account</a>';
    var form='<form class="auth-form" data-form="auth" data-mode="'+(up?"up":"in")+'" novalidate>'
      +'<input type="hidden" name="name"><input type="hidden" name="email"><input type="hidden" name="pw"><input type="hidden" name="pw2">'
      +'<div id="auth-stage" aria-live="polite">'+panel()+'</div></form>';
    var html='<section class="auth-experience"><div class="auth-glow auth-glow-a"></div><div class="auth-glow auth-glow-b"></div><div class="w auth-layout">'
      +'<div class="auth-story"><a class="auth-eyebrow" href="#/"> <span class="auth-brand-dot"></span> EVERNEED <span>·</span> ONE MARKETPLACE</a>'
      +'<div class="auth-story-copy"><span class="auth-overline">DISCOVER MORE. SHOP FROM MANY STORES.</span><h1>'+(up?'Your next favourite store is just around the corner.':'Everything you love, from stores you can trust.')+'</h1><p>Everneed brings independent stores and shoppers together in one easy-to-use marketplace. Discover products, explore stores and shop in the Everneed mobile app.</p>'
      +'<div class="auth-benefits"><div><b>01</b><span><strong>Many stores</strong><small>One place to discover them</small></span></div><div><b>02</b><span><strong>One Everneed account</strong><small>For shopping and selling</small></span></div><div><b>03</b><span><strong>Shopping made simple</strong><small>Orders and delivery in one app</small></span></div></div></div>'
      +'<div class="auth-showcase" aria-label="Everneed marketplace preview"><div class="auth-orbit orbit-one"></div><div class="auth-orbit orbit-two"></div><div class="auth-market-card"><div class="auth-market-top"><span class="auth-mini-logo">e</span><span>Discover stores</span><span class="auth-live-dot"></span></div><div class="auth-market-hero"><small>THE EVERNEED MARKETPLACE</small><b>Find your<br>everyday favourites.</b><span>Explore stores near you <i>↗</i></span></div><div class="auth-store-row"><div class="auth-store-icon store-amber">A</div><div><b>Everyday Finds</b><small>Fashion · Home · More</small></div><span class="auth-follow">Explore</span></div><div class="auth-store-row"><div class="auth-store-icon store-mint">G</div><div><b>Green Basket</b><small>Groceries · Essentials</small></div><span class="auth-follow">Explore</span></div><div class="auth-market-foot"><span>✦</span> One marketplace. Many independent stores.</div></div><div class="auth-float auth-float-one"><span>✦</span><b>One account</b><small>Many possibilities</small></div><div class="auth-float auth-float-two"><span class="auth-check">✓</span><b>Shop with confidence</b></div></div>'
      +'<div class="auth-story-foot"><span>SHOPPERS · SELLERS · ONE COMMUNITY</span><a href="#/sell">Discover selling on Everneed ↗</a></div></div>'
      +'<div class="auth-entry"><div class="auth-entry-head"><span class="auth-entry-mark">e</span><div><b>'+(up?'Create your account':'Welcome back')+'</b><small>'+(up?'Your Everneed journey starts here.':'Sign in to continue to Everneed.')+'</small></div></div>'
      +'<div class="auth-entry-card">'+form+'<p class="auth-switch">'+switcher+'</p><p class="auth-trust"><span>⌑</span> Your account access is protected. Seller and admin tools appear only with the required approval.</p></div>'
      +'<p class="auth-legal">By continuing, you agree to Everneed’s account terms and privacy practices.</p></div></div></section>';
    var page=pub(html,"",up?"Create account":"Sign in");
    page.after=function(){
      var stage=document.getElementById("auth-stage"),formEl=document.querySelector('[data-form="auth"]');
      function sync(){["name","email","pw","pw2"].forEach(function(k){var el=formEl.querySelector('[name="'+k+'"]');if(el)el.value=state[k]})}
      function render(){stage.innerHTML=panel();var input=stage.querySelector("#auth-current");if(input)input.focus({preventScroll:true})}
      stage.addEventListener("click",function(e){
        var back=e.target.closest("[data-auth-back]"),next=e.target.closest("[data-auth-next]");
        if(back){state.step=Math.max(0,state.step-1);render();return}
        if(next){
          var input=stage.querySelector("#auth-current"),value=input.value.trim();
          if(!input.reportValidity())return;
          if(up&&state.step===0)state.name=value;
          if((up&&state.step===1)||(!up&&state.step===0)){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){input.setCustomValidity("Enter a valid email address.");input.reportValidity();input.setCustomValidity("");return}state.email=value.toLowerCase()}
          if((up&&state.step===2)||(!up&&state.step===1)){if(value.length<8){input.setCustomValidity("Use at least 8 characters.");input.reportValidity();input.setCustomValidity("");return}state.pw=value}
          state.step++;sync();render();
        }
      });
      stage.addEventListener("keydown",function(e){if(e.key==="Enter"&&stage.querySelector("[data-auth-next]")){e.preventDefault();stage.querySelector("[data-auth-next]").click()}});
      formEl.addEventListener("submit",function(e){
        var input=stage.querySelector("#auth-current"),value=input?input.value:"";
        if(up&&state.step===3){if(value!==state.pw){e.preventDefault();e.stopPropagation();C.toast("Your passwords do not match.",true);return}state.pw2=value}
        if(!up&&state.step===1)state.pw=value;
        if(up&&state.step===2)state.pw=value;
        sync();
      });
    };
    return page;
  }
  V.login=function(p){
    if(Supa.uid()){
      return Supa.profile().then(function(profile){return{redirect:roleRoute(profile)}}).catch(function(){return{redirect:"#/account"}});
    }
    return authPage(p[0]==="new");
  };
  V.account=function(){
    var me=C.me()||{},name=esc(me.name||me.full_name||"there");
    return pub('<section class="sec"><div class="w" style="max-width:760px">'
      +'<span class="pillx"><i></i>Your Everneed account</span><h1 style="margin-top:18px">You’re in, '+name+'.</h1>'
      +'<p class="lead">Your Everneed account is ready. Shopping takes place in the Everneed mobile app, while store tools are available to sellers with the appropriate access.</p>'
      +'<div class="g2" style="margin-top:28px"><div class="card"><h3>Shop with Everneed</h3><p>Discover products from independent stores in the mobile app. The website will show official download options when they are published.</p><a class="btn" style="margin-top:16px" href="#/shop">About the app</a></div>'
      +'<div class="card"><h3>Open a store</h3><p>Interested in selling? Start with your existing Everneed account. Store approval is a separate process.</p><a class="btn o" style="margin-top:16px" href="#/portal/apply">Explore seller application</a></div></div>'
      +'<div class="row" style="margin-top:24px"><button class="btn o" data-act="out">Sign out</button></div></div></section>',"","My account");
  };
  V.shop=function(){
    return pub('<section class="sec"><div class="w" style="max-width:760px"><span class="pillx"><i></i>Everneed mobile app</span>'
      +'<h1 style="margin-top:18px">The marketplace lives in the app.</h1>'
      +'<p class="lead">Browse stores, discover products, manage your cart and place orders in the Everneed mobile app. We will publish official download links here when a release is available.</p>'
      +'<div class="note" style="margin-top:24px"><span><b>App release information</b>Official download options are not being displayed until they are verified and publicly available.</span></div>'
      +'<div class="row" style="margin-top:22px"><a class="btn" href="#/login/new">Create an account</a><a class="btn o" href="#/sell">For sellers</a></div></div></section>',"","Shop in the app");
  };
  F.auth=function(f,d){
    var b=f.querySelector('button[type="submit"]'),mode=d.mode||f.getAttribute("data-mode")||"in";
    if(mode==="up"&&String(d.pw||"")!==String(d.pw2||"")){C.toast("Your passwords do not match.",true);return}
    if(!d.email||!d.pw||(mode==="up"&&!d.name)){C.toast("Please complete the required account details.",true);return}
    if(b)b.disabled=true;
    var req=mode==="up"?Supa.signUp(String(d.email||"").trim(),d.pw,{name:String(d.name||"").trim()}):Supa.signIn(String(d.email||"").trim(),d.pw);
    req.then(function(r){
      if(mode==="up"&&r&&r.confirm){if(b)b.disabled=false;C.toast("Account created. Check your email to confirm your address, then sign in.");location.hash="#/login";return}
      return Supa.profile().then(function(profile){
        C.reset();location.hash=roleRoute(profile);location.reload();
      }).catch(function(){
        C.reset();location.hash="#/account";location.reload();
      });
    }).catch(function(e){if(b)b.disabled=false;C.toast(e.message||"Could not complete that request. Please try again.",true)});
  };
})();
