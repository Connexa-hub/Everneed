/* Marketing pages, sign in, early access. */
(function(){
  var C=Core,esc=C.esc,V=C.V,A=C.A,F=C.F,wlWidget=null,activeAuth=null;
  function pub(html,active,title){return{layout:"pub",html:html,active:active,title:title}}
  var TOOLS=[["Your own storefront","A store page with your name, cover, colour and link. Share it anywhere."],["Reviewed listings","Every product is checked before it goes live, so shoppers trust what they see."],["Orders that split by seller","One cart can hold many sellers. You only see and handle your own part."],["Hub or direct delivery","Hand items to the Everneed hub, or deliver yourself in the areas you choose."],["A ledger you can read","Every sale and commission is recorded. Earnings release after the holding period."],["Messages from Everneed","Approvals, change requests and payout news land in your dashboard."]];
  V.home=function(){return pub(`
<section class="hero night"><div class="w hg"><div>
<h1>Open a store. Let Everneed handle the rest.</h1>
<p class="lead">Storefront, order tools, delivery and payouts in one place. Shoppers find you in the Everneed app.</p>
<div class="row" style="margin-top:28px"><a class="btn" href="/create-account">Open your store</a><a class="btn o" href="#/pricing">See plans</a></div>
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
<section class="sec"><div class="w"><div class="band"><h2>Ready to sell?</h2><p>Create your seller account and start your application today.</p><a class="btn" href="/create-account">Open your store</a></div></div></section>`,"","")};
  function FAQ(){return[["Can shoppers buy on the website?","Not at launch. Shoppers use the Everneed app. The website is for sellers and the Everneed team."],["How long does review take?","An admin reviews every store and product. If something needs fixing you see the reason in your dashboard and can resubmit."],["When do I get paid?","Earnings release after a holding period that protects buyers, then payouts go to your bank account."],["What does it cost?","See Plans. New stores get a free trial, and commission applies only when you sell."]].map(function(q){return"<details><summary>"+q[0]+"</summary><p>"+q[1]+"</p></details>"}).join("")}
  V.sell=function(){return pub('<section class="sec"><div class="w"><h1>Sell on Everneed</h1><p class="lead">Apply once. We review, you go live, and you manage products, orders and earnings from your portal.</p><div class="g3"><div class="card"><h3>1. Apply</h3><p>Five short steps, saved as you go.</p></div><div class="card"><h3>2. Get reviewed</h3><p>Approval, or a clear note on what to change.</p></div><div class="card"><h3>3. Sell and get paid</h3><p>Accept orders, hand over for delivery, watch earnings release.</p></div></div><div class="row" style="margin-top:28px"><a class="btn" href="/create-account">Open your store</a><a class="btn o" href="#/pricing">See plans</a></div></div></section>',"sell","Sell")};
  V.pricing=function(){return Supa.get("store_plans?select=*").then(function(p){return p||[]},function(){return[]}).then(function(p){
    var cards=p.length?p.map(function(x,i){var price=x.price!=null?x.price:x.price_ngn!=null?x.price_ngn:x.monthly_price;return'<div class="card"><h3>'+esc(x.name||"Plan")+'</h3><p style="font:700 1.8rem var(--font-display);color:var(--text-1)">'+(price!=null?esc(C.money(price))+' <small>/ month</small>':"Free trial")+"</p><p>"+esc(x.description||"Store, products and orders")+'</p><a class="btn s" style="margin-top:16px" href="/create-account">Open your store</a></div>'}).join("")
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
  function socialOptions(){
    var providers=[["google","Google"],["apple","Apple"],["facebook","Facebook"]];
    return '<div class="auth-social" aria-label="Other sign-in options">'+providers.map(function(p){
      var icon=p[0]==="google"?'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.38a4.6 4.6 0 0 1-2 3.02v2.47h3.24c1.9-1.75 2.98-4.33 2.98-7.36z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.41l-3.24-2.47c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.55A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.41 13.96a6 6 0 0 1 0-3.92V7.49H3.06a10 10 0 0 0 0 9.02z"/><path fill="#EA4335" d="M12 5.92c1.47 0 2.78.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.35 2.55C7.2 7.68 9.4 5.92 12 5.92z"/></svg>':p[0]==="apple"?'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.2c.02 2.18 1.91 2.9 1.93 2.91-.02.05-.3 1.03-.99 2.04-.6.88-1.22 1.75-2.2 1.77-.96.02-1.27-.57-2.37-.57s-1.45.55-2.36.59c-.95.04-1.68-.95-2.29-1.82-1.25-1.8-2.2-5.08-.92-7.3.64-1.1 1.78-1.8 3.02-1.82.94-.02 1.83.63 2.4.63.58 0 1.66-.78 2.8-.67.48.02 1.84.19 2.71 1.46-.07.04-1.62.95-1.6 2.78M14.53 6.77c.5-.6.83-1.44.74-2.27-.72.03-1.6.48-2.12 1.08-.47.54-.88 1.4-.77 2.22.8.06 1.64-.4 2.15-1.03"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-8.2h2.76l.41-3.2H13.5V7.56c0-.93.26-1.56 1.6-1.56h1.7V3.14c-.3-.04-1.34-.14-2.55-.14-2.52 0-4.25 1.54-4.25 4.38V9.6H7.15v3.2H10V21z"/></svg>';
      return '<button type="button" class="auth-social-button is-unavailable" data-auth-provider="'+p[0]+'" aria-disabled="true"><span class="auth-social-icon">'+icon+'</span><span>'+p[1]+'</span></button>';
    }).join("")+'</div>';
  }
  function authPage(up){
    var steps=up?["Your details","Email address","Password","Review details"]:["Email address","Password"];
    var state={step:0,name:"",email:"",pw:"",pw2:"",verifying:false};
    function input(label,type,placeholder,autocomplete,value,attrs){
      var field='<input id="auth-current" type="'+type+'" value="'+esc(value||"")+'" placeholder="'+placeholder+'" autocomplete="'+autocomplete+'" '+(type==="email"?'inputmode="email"':'')+' '+(attrs||"")+' required>';
      if(type==="password")field='<div class="auth-password-control">'+field+'<button type="button" class="auth-eye" data-auth-eye aria-label="Show password" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg></button></div>';
      return '<label class="auth-field"><span>'+label+'</span>'+field+'</label>';
    }
    function productWave(){
      var items=[
        ["serum","Skincare","https://img.magnific.com/premium-psd/golden-serum-dropper-bottle-skincare-beauty-products_84443-66236.jpg?q=80&semt=ais_hybrid&w=740"],
        ["audio","Electronics","https://images.rawpixel.com/image_png_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTA5L3Jhd3BpeGVsb2ZmaWNlNl9pbWFnZV9vZl9hX21vZGVybl93aXJlbGVzc19ibGFja19oZWFkcGhvbmVfbWluaV9lYzY2MDgzZS04ZTZjLTRmMjEtOTc3Ny05YTg2YzdmMzQ2ZmYucG5n.png"],
        ["watch","Accessories","https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA5L3NtYWxsZGVzaWduY29tcGFueTAxX21lbnNfd2F0Y2hfaXNvbGF0ZWRfd2hpdGVfYmFja2dyb3VuZF81NmQwNmEzMS01YWRkLTRlZjYtOGY1My01MjY5NDg0NmVjMWFfMS5qcGc.jpg"],
        ["sneaker","Fashion","https://productshotai.app/images/productshot/free-image-tools/remove-background/workbench/default-after.webp"]
      ];
      return '<div class="auth-product-wave" aria-label="Real product showcase"><svg class="auth-wave-connector" viewBox="0 0 900 120" preserveAspectRatio="none" aria-hidden="true"><path d="M8 62 C110 62 120 12 225 12 S340 108 450 108 S565 12 675 12 S790 62 892 62"/></svg>'+items.map(function(x,i){return '<div class="auth-product-tile product-'+x[0]+'"><div class="auth-product-art"><img src="'+x[2]+'" alt="'+x[1]+' product" loading="eager" decoding="async"></div><span>'+x[1]+'</span></div>'}).join("")+'</div>';
    }
    function panel(){
      if(state.verifying){
        return '<div class="auth-progress"><div class="auth-progress-top"><span>Email confirmation</span><span>VERIFY</span></div><div class="auth-progress-track"><i style="width:100%"></i></div></div>'
          +'<div class="auth-step"><span class="auth-step-kicker">ONE LAST STEP</span><h2>Check your inbox.</h2><p class="auth-intro">We sent a confirmation code to <strong>'+esc(state.email)+'</strong>. Enter the code from that email to activate your Everneed account.</p>'
          +input("6-digit email code","text","Enter confirmation code","one-time-code","","inputmode=\"numeric\" maxlength=\"6\" pattern=\"[0-9]{6}\"")
          +'<div class="auth-step-actions"><button class="btn o" type="button" data-auth-back>Back</button><button class="btn auth-primary" type="submit">Confirm email <span aria-hidden="true">→</span></button></div>'
          +'<div class="auth-resend-row"><span>Didn’t receive the code?</span><button type="button" class="auth-text-button" data-auth-resend>Resend code</button></div><p class="auth-verify-note">Check your spam or promotions folder too. The account will only be activated after the code is verified.</p></div>';
      }
      var i=state.step,content="",hint="";
      if(up){
        if(i===0){content=input("Your name","text","Full name","name",state.name);hint="Let’s start with the name you use."}
        if(i===1){content=input("Email address","email","you@example.com","email",state.email);hint="We’ll send a one-time confirmation code to this address."}
        if(i===2){content=input("Create a password","password","At least 8 characters","new-password",state.pw);hint="Use at least 8 characters and keep it private."}
        if(i===3){content='<div class="auth-review-row"><span>Name</span><b>'+esc(state.name)+'</b></div><div class="auth-review-row"><span>Email</span><b>'+esc(state.email)+'</b></div><div class="auth-review-row"><span>Password</span><b>••••••••</b></div>';hint="Review your details before creating your account."}
      }else{
        if(i===0){content=input("Email address","email","you@example.com","email",state.email);hint="Use the email address connected to your Everneed account."}
        if(i===1){content=input("Password","password","Enter your password","current-password",state.pw);hint="Your Everneed account works for shopping and selling."}
      }
      var last=i===steps.length-1;
      return '<div class="auth-progress"><div class="auth-progress-top"><span>'+steps[i]+'</span><span>'+String(i+1).padStart(2,"0")+' / '+String(steps.length).padStart(2,"0")+'</span></div><div class="auth-progress-track"><i style="width:'+((i+1)/steps.length*100)+'%"></i></div></div>'
        +'<div class="auth-step"><span class="auth-step-kicker">'+(up?"CREATE YOUR ACCOUNT":"YOUR EVERNEED ACCOUNT")+'</span><h2>'+(up?["Let’s get started.","Where should we reach you?","Secure your account.","Everything look right?"][i]:["Welcome back.","Enter your password."][i])+'</h2><p class="auth-intro">'+hint+'</p>'+content
        +'<div class="auth-step-actions">'+(i>0?'<button class="btn o" type="button" data-auth-back>Back</button>':'<a class="auth-back-link" href="/">Back to Everneed</a>')
        +(last?'<button class="btn auth-primary" type="submit">'+(up?"Create account":"Sign in")+' <span aria-hidden="true">→</span></button>':'<button class="btn auth-primary" type="button" data-auth-next>Continue <span aria-hidden="true">→</span></button>')+'</div></div>';
    }
    var switcher=up?'Already have an account? <a href="/sign-in">Sign in</a>':'New to Everneed? <a href="/create-account">Create an account</a>';
    var form='<form class="auth-form" data-form="auth" data-mode="'+(up?"up":"in")+'" novalidate>'
      +'<input type="hidden" name="name"><input type="hidden" name="email"><input type="hidden" name="pw"><input type="hidden" name="pw2"><input type="hidden" name="otp">'
      +'<div id="auth-stage" aria-live="polite">'+panel()+'</div></form>';
    var html='<main class="auth-experience"><div class="w auth-page-wrap"><header class="auth-topbar"><a class="auth-logo" href="/"><img src="/favicon.svg" alt="Everneed" width="34" height="34"><span>Everneed</span></a></header>'
      +'<section class="auth-intro-area">'+productWave()+'</section><section class="auth-form-area"><div class="auth-entry-head"><h2>'+(up?"Create your account":"Sign in")+'</h2></div>'
      +'<div class="auth-entry-card">'+form+'<div class="auth-social-divider"><span>Or continue with</span></div>'+socialOptions()+'<p class="auth-switch">'+switcher+'</p></div></section></div></main>';
    var page={layout:"auth",html:html,title:up?"Create account":"Sign in"};
    page.after=function(){
      var stage=document.getElementById("auth-stage"),formEl=document.querySelector('[data-form="auth"]');
      function sync(){["name","email","pw","pw2","otp"].forEach(function(k){var el=formEl.querySelector('[name="'+k+'"]');if(el)el.value=state[k]})}
      function render(){stage.innerHTML=panel();var input=stage.querySelector("#auth-current");if(input)input.focus({preventScroll:true})}
      activeAuth={showVerify:function(){state.verifying=true;state.step=0;formEl.setAttribute("data-mode","verify");render()},state:state};formEl.__authState=state;formEl.__authRender=render;
      var social=document.querySelector(".auth-social");
      if(social){
        Supa.authSettings().then(function(settings){
          var enabled=settings&&settings.external||{};
          social.querySelectorAll("[data-auth-provider]").forEach(function(button){
            var provider=button.getAttribute("data-auth-provider"),available=enabled[provider]===true;
            button.classList.toggle("is-available",available);button.classList.toggle("is-unavailable",!available);
            button.setAttribute("aria-disabled",available?"false":"true");
          });
        }).catch(function(){});
        social.addEventListener("click",function(e){
          var button=e.target.closest("[data-auth-provider]");if(!button)return;
          var provider=button.getAttribute("data-auth-provider");
          if(!button.classList.contains("is-available")){C.toast(provider.charAt(0).toUpperCase()+provider.slice(1)+" sign-in is not available yet. Use email and password for now.",true);return}
          var url=CFG.supabase.url.replace(/\/$/,"")+"/auth/v1/authorize?provider="+encodeURIComponent(provider)+"&redirect_to="+encodeURIComponent(location.origin+"/")+"&apikey="+encodeURIComponent(CFG.supabase.key);
          location.href=url;
        });
      }
      stage.addEventListener("click",function(e){
        var eye=e.target.closest("[data-auth-eye]");
        if(eye){var password=stage.querySelector("#auth-current");if(password){var show=password.type==="password";password.type=show?"text":"password";eye.setAttribute("aria-pressed",show?"true":"false");eye.setAttribute("aria-label",show?"Hide password":"Show password");eye.classList.toggle("is-visible",show)}return}
        var back=e.target.closest("[data-auth-back]"),next=e.target.closest("[data-auth-next]"),resend=e.target.closest("[data-auth-resend]");
        if(back){if(state.verifying){state.verifying=false;formEl.setAttribute("data-mode",up?"up":"in");state.step=up?1:0}else state.step=Math.max(0,state.step-1);render();return}
        if(resend){resend.disabled=true;Supa.resendSignup(state.email).then(function(){C.toast("A new confirmation code has been sent.")}).catch(function(err){C.toast(err.message||"We couldn’t resend the code. Try again shortly.",true)}).finally(function(){resend.disabled=false});return}
        if(next){
          var el=stage.querySelector("#auth-current"),value=el.value.trim();
          if(!el.reportValidity())return;
          if(up&&state.step===0)state.name=value;
          if((up&&state.step===1)||(!up&&state.step===0)){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){el.setCustomValidity("Enter a valid email address.");el.reportValidity();el.setCustomValidity("");return}state.email=value.toLowerCase()}
          if((up&&state.step===2)||(!up&&state.step===1))state.pw=value;
          state.step++;sync();render();
        }
      });
      stage.addEventListener("keydown",function(e){if(e.key==="Enter"&&stage.querySelector("[data-auth-next]")){e.preventDefault();stage.querySelector("[data-auth-next]").click()}});
      formEl.addEventListener("submit",function(e){
        var el=stage.querySelector("#auth-current"),value=el?el.value.trim():"";
        if(state.verifying){state.otp=value;sync();return}
        if(up&&state.step===3){state.pw2=state.pw}
        if(!up&&state.step===1)state.pw=value;
        sync();
      });
    };
    return page;
  }
  V.login=function(p){var up=p[0]==="new";if(Supa.uid()){Supa.profile().then(function(profile){location.href="/"+roleRoute(profile)}).catch(function(){location.href="/#/account"})}return authPage(up)};
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
      +'<div class="row" style="margin-top:22px"><a class="btn" href="/create-account">Create an account</a><a class="btn o" href="#/sell">For sellers</a></div></div></section>',"","Shop in the app");
  };
  F.auth=function(f,d){
    var mode=f.dataset.mode||"in",state=f.__authState||{},b=f.querySelector('button[type="submit"]');
    if(mode==="verify"){
      var code=String(d.otp||"").trim();
      if(!/^\d{6}$/.test(code)){C.toast("Enter the 6-digit code from your email.",true);return}
      if(b)b.disabled=true;
      Supa.verifySignup(String(d.email||state.email||"").trim(),code).then(function(){
        return Supa.profile().catch(function(){return{}});
      }).then(function(profile){
        C.reset();location.href="/"+roleRoute(profile);
      }).catch(function(err){
        if(b)b.disabled=false;
        C.toast(err.message||"That code could not be verified. Check it and try again.",true);
      });
      return;
    }
    if(mode==="up"&&String(d.pw||"")!==String(d.pw2||"")){C.toast("The passwords do not match. Please try again.",true);return}
    if(!d.email||!d.pw||(mode==="up"&&!d.name)){C.toast("Please complete the required details.",true);return}
    if(b)b.disabled=true;
    var email=String(d.email).trim().toLowerCase();
    var req=mode==="up"?Supa.signUp(email,d.pw,{name:String(d.name).trim()}):Supa.signIn(email,d.pw);
    req.then(function(r){
      if(mode==="up"&&r&&r.confirm){
        state.email=email;state.verifying=true;state.step=0;f.dataset.mode="verify";
        if(b)b.disabled=false;
        if(f.__authRender)f.__authRender();
        return;
      }
      return Supa.profile().then(function(profile){
        C.reset();location.href="/"+roleRoute(profile);
      });
    }).catch(function(err){
      if(b)b.disabled=false;
      var msg=err.message||"We couldn’t complete that request. Please try again.";
      if(/not confirmed|email.*confirm/i.test(msg)&&state.email){
        state.verifying=true;state.step=0;f.dataset.mode="verify";
        if(f.__authRender)f.__authRender();
        C.toast("Your email still needs confirmation. Enter the code we sent or request a new one.",true);
        return;
      }
      C.toast(msg,true);
    });
  };
})();
