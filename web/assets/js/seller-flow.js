/* Seller flow after submission: plan-directed screens and the commerce-first overview.
   Loaded after setup.js and workspace.js and wraps V.portal. It handles an approved store only:
     /portal                 live store -> overview; approved but not live -> plan / verification / open-my-store screens
     /portal/plan            plan screen (choose_plan decides whether a change is allowed)
     /portal/verification    retired top-level page, sends sellers back to /portal
   Everything else (drafts, review, rejected, suspended, products, product editor) stays with portal.js and workspace.js.
   The server is authoritative: this file never marks a store live, never sets a plan price or limit, and never records a
   verification result. If my_store_entitlements is unavailable it falls back to the previous portal untouched. */
(function(){
  var C=Core,esc=C.esc,V=C.V,A=C.A,F=C.F,enc=encodeURIComponent,base=V.portal,Z={vi:null};
  var CHECKS=["phone","identity","face_liveness","business_address"];
  var LABEL={phone:"Phone number",identity:"Identity document",face_liveness:"Face check",business_address:"Business address"};
  var SO={pending:["New","info"],accepted:["Accepted","info"],preparing:["Preparing","info"],ready:["Ready","info"],handover_pending:["Handover","info"],at_hub:["At hub","info"],consolidated:["At hub","info"],out_for_delivery:["On its way","info"],delivered:["Delivered","ok"],rejected:["Declined","bad"],cancelled:["Cancelled","bad"],issue:["Issue","bad"]};
  var ACTIVE=["accepted","preparing","ready","handover_pending","at_hub","consolidated","out_for_delivery"];
  function soft(){return[]}
  function unwrap(r){return r&&r.data!==undefined?r.data:r}
  function fail(e){C.toast(e&&e.message||"That did not work",true)}
  function again(){C.go(location.pathname,true)}
  function pill(l,c){return'<span class="pill '+(c||"")+'">'+esc(l)+"</span>"}
  function num(n){try{return new Intl.NumberFormat().format(n||0)}catch(e){return String(n||0)}}
  function ent(){return Supa.rpc("my_store_entitlements",{}).then(unwrap,function(){return null})}
  function state(){
    return Supa.get("stores?select=*&owner_id=eq."+enc(Supa.uid())).then(function(r){
      var s=r&&r[0]||null;if(!s||s.status!=="approved")return{store:s};
      return Promise.all([ent(),Supa.get("store_applications?select=plan_id&store_id=eq."+enc(s.id)).catch(soft)]).then(function(a){return{store:s,ent:a[0],app:a[1][0]||null}});
    });
  }
  V.portal=function(p){
    var sub=p[0]||"";
    if(!Supa.uid()||(sub!==""&&sub!=="verification"&&sub!=="plan"))return base(p);
    return state().then(function(z){
      var s=z.store;
      if(!s||s.status!=="approved")return sub===""?base(p):{redirect:"/portal"};
      Z.storeId=s.id;
      if(z.ent===null||z.ent===undefined)return base(p);
      if(sub==="verification")return{redirect:"/portal"};
      if(sub==="plan")return planPage(z);
      return s.activation_status==="live"?overview(z):activation(z);
    });
  };
  function limitsText(e){
    if(!e||e.configured!==true)return"";
    var a=e.active_products_unlimited?"Unlimited products":"Up to "+e.active_product_limit+" products",d=e.daily_new_products_unlimited?"":", "+e.daily_new_product_limit+" new a day";
    return a+d;
  }

  /* ---------- plan screens ---------- */
  function planScreen(z,o){
    return Plans.load().then(function(plans){
      if(!plans.length)throw new Error("Plans are not available right now. Please try again in a moment.");
      var chosen=(z.ent&&z.ent.plan_id)||(z.app&&z.app.plan_id)||"";
      var html='<div class="sf-wrap"><p class="skick">'+esc(o.kick)+'</p><h1>'+esc(o.title)+'</h1><p class="ssub">'+esc(o.sub)+'</p><form data-form="sfplan" id="sfform" novalidate>'
        +Plans.html({plans:plans,chosen:chosen,focus:chosen})+'<input type="hidden" name="plan" value=""><p class="pcnote">'+esc(o.note)+'</p><div class="actbar"><a class="btn o" href="/portal">Back</a><button class="btn" type="submit">Choose a plan</button></div></form></div>';
      return{layout:o.layout,active:"portal/plan",title:"Plan",html:html,after:function(){
        var f=document.getElementById("sfform");if(!f)return;var b=f.querySelector("button[type=submit]");
        Plans.bind(f,{plans:plans,chosen:chosen,focus:chosen,onFocus:function(p){f.plan.value=p.id;if(b&&!b.disabled)b.textContent=p.id===chosen?"Keep "+p.name:"Choose "+p.name}});
      }};
    });
  }
  function planPage(z){
    return planScreen(z,{layout:z.store.activation_status==="live"?"portal":"setup",kick:"Your plan",title:"Plans",sub:"Pick the plan that fits your store.",note:"Plan changes are checked by Everneed. Nothing is charged from this page."}).catch(function(e){return{layout:"portal",active:"portal/plan",title:"Plan",html:C.empty("Plans are not available",e.message)}});
  }
  F.sfplan=function(f,d){
    if(!d.plan){C.toast("Swipe to a plan, then choose it.",true);return}
    var b=f.querySelector("button[type=submit]");if(b)b.disabled=true;
    Supa.rpc("choose_plan",{p_plan:d.plan}).then(function(){C.toast("Plan saved");C.go("/portal")}).catch(function(e){
      if(b)b.disabled=false;
      var m=e&&e.message||"";
      if(/pay for the new plan/i.test(m))m="Changing plan after your trial needs a payment, which is not available here yet. Your current plan is unchanged.";
      C.toast(m||"That did not work",true);
    });
  };

  /* ---------- approved, not live ---------- */
  function activation(z){
    var e=z.ent;
    if(e.configured!==true&&e.reason_code==="PLAN_NOT_SELECTED"){
      /* The plan the seller explicitly chose while applying is applied through the same authenticated backend action. */
      if(z.app&&z.app.plan_id&&!Z.applied){
        Z.applied=true;
        return Supa.rpc("choose_plan",{p_plan:z.app.plan_id}).then(function(){return state()}).then(function(z2){return activation(z2)},function(){return stage(z)});
      }
      return stage(z);
    }
    Z.applied=false;
    if(e.configured!==true)return notice(z,"Your plan is being set up","Everneed is finishing your plan settings. Please check again in a little while.");
    if(e.verification_required_to_activate)return verification(z);
    return ready(z);
  }
  function stage(z){
    return planScreen(z,{layout:"setup",kick:"Approved",title:"Choose your plan",sub:"Your store is approved. Pick a plan to open it.",note:"Nothing is charged from this page."}).catch(function(e){return notice(z,"Plans are not available",e.message)});
  }
  function notice(z,title,text){
    return{layout:"setup",active:"portal",title:"Your store",html:'<div class="sf-wrap"><h1>'+esc(title)+'</h1><p class="ssub">'+esc(text)+'</p><div class="sf-acts"><button class="btn" type="button" data-act="sfretry">Check again</button></div></div>'};
  }
  A.sfretry=function(){Z.applied=false;again()};
  function ready(z){
    var e=z.ent;
    return{layout:"setup",active:"portal",title:"Your store",html:'<div class="sf-wrap"><p class="skick">Approved</p><h1>'+esc(z.store.name)+' is approved</h1><p class="ssub">Open your store when you are ready to sell.</p>'
      +'<div class="sf-card"><dl class="sf-state"><dt>Plan</dt><dd>'+esc(e.plan_name||"")+"</dd><dt>Catalogue</dt><dd>"+esc(limitsText(e))+'</dd></dl><div class="sf-acts"><button class="btn" type="button" data-act="sfopen">Open my store</button><a class="btn o" href="/portal/plan">View plans</a></div></div></div>'};
  }
  function reasonText(x){
    var miss=(x&&x.missing_checks||[]).map(function(k){return LABEL[k]||k}).join(", "),c=x&&x.reason_code;
    return({PLAN_NOT_SELECTED:"Choose a plan to open your store.",PLAN_NOT_CONFIGURED:"Your plan settings are not ready yet. Please contact Everneed support.",
      MANDATORY_COMPLIANCE_MISSING:"A regional requirement for opening a store is still outstanding: "+miss+".",
      PLAN_VERIFICATION_REQUIRED:"Your plan includes verification before opening: "+miss+".",
      SUBSCRIPTION_INACTIVE:"Your plan or trial is no longer active.",STORE_SUSPENDED:"This store is suspended. Please contact Everneed support.",
      APPLICATION_NOT_APPROVED:"Your application has to be approved first.",REGIONAL_VERIFICATION_NOT_CONFIGURED:"Opening stores is not set up for your region yet. Please contact support."})[c]||"Your store could not be opened yet. Please try again or contact support.";
  }
  A.sfopen=function(b){
    if(b)b.disabled=true;
    Supa.rpc("request_store_activation",{p_store:Z.storeId}).then(function(r){
      var x=unwrap(r);
      if(x&&x.activated){C.toast("Your store is live.");C.go("/portal");return}
      C.toast(reasonText(x),true);if(b)b.disabled=false;again();
    }).catch(function(e){if(b)b.disabled=false;fail(e)});
  };

  /* ---------- plan-included verification, one screen per check ---------- */
  function verification(z){
    var s=z.store,e=z.ent;Z.storeId=s.id;
    return Promise.all([Supa.get("seller_verification_rules?select=*&enabled=eq.true&country=eq."+enc(s.country||"NG")).catch(soft),Supa.get("store_verification_checks?select=*&store_id=eq."+enc(s.id)).catch(soft)]).then(function(a){
      var rules=(a[0]||[]).filter(function(r){
        var sc=r.requirement_scope||"unclassified";
        return r.required&&(sc==="mandatory_compliance"||sc==="unclassified"||(sc==="commercial"&&e.verification_required_to_activate));
      }).sort(function(x,y){return CHECKS.indexOf(x.check_type)-CHECKS.indexOf(y.check_type)});
      var by={};(a[1]||[]).forEach(function(c){by[c.check_type]=c});
      var st=function(r){return by[r.check_type]&&by[r.check_type].status||"not_started"};
      var left=rules.filter(function(r){return st(r)!=="verified"});
      if(!rules.length||!left.length)return ready(z);
      var i=Z.vi==null?rules.indexOf(left[0]):Math.max(0,Math.min(rules.length-1,Z.vi));Z.vi=i;
      var r=rules[i],c=by[r.check_type]||{},status=st(r),sc=r.requirement_scope||"unclassified",label=LABEL[r.check_type]||r.check_type.replace(/_/g," ");
      var why=sc==="commercial"?"Your "+(e.plan_name||"")+" plan includes this check. It comes with the plan; it is not a rule for every Everneed seller.":"This is required by regional rules before a store can open in "+((CFG.countries||{})[s.country]||s.country)+".";
      var cls=status==="verified"?"ok":status==="pending"?"info":status==="needs_attention"||status==="expired"?"bad":"";
      var action=status==="verified"?"This check is complete.":status==="pending"?"This check is with the verification provider. The result appears here when it arrives."
        :status==="needs_attention"||status==="expired"?"This check needs attention. "+(c.safe_note||"")+" Contact support and we will help you finish it."
        :"This check cannot be started from this page yet, because the verification provider is not connected here. Contact support if you need help.";
      var bars=rules.map(function(x,k){return'<i class="'+(st(x)==="verified"?"done":k===i?"on":"")+'"></i>'}).join("");
      var html='<div class="sf-wrap"><p class="skick">Verification · step '+(i+1)+" of "+rules.length+'</p><h1>'+esc(label)+'</h1><div class="sf-steps" aria-hidden="true">'+bars+'</div>'
        +'<div class="sf-card"><p>'+esc(why)+"</p>"+(r.help_text?'<p class="sm">'+esc(r.help_text)+"</p>":"")
        +'<dl class="sf-state"><dt>Status</dt><dd>'+pill(status.replace(/_/g," "),cls)+"</dd><dt>Provider</dt><dd>"+esc(c.provider||"Not started")+"</dd></dl><p class=\"m\" style=\"margin-top:12px\">"+esc(action)+'</p>'
        +'<div class="sf-acts">'+(i>0?'<button class="btn o" type="button" data-act="sfvgo" data-i="'+(i-1)+'">Back</button>':"")+(i<rules.length-1?'<button class="btn o" type="button" data-act="sfvgo" data-i="'+(i+1)+'">Next check</button>':"")
        +'<button class="btn" type="button" data-act="sfopen">Check again</button><a class="btn o" href="/inbox">Contact support</a></div></div></div>';
      return{layout:"setup",active:"portal",title:"Your store",html:html};
    });
  }
  A.sfvgo=function(b){Z.vi=+b.getAttribute("data-i");again()};

  /* ---------- live overview ---------- */
  function isLow(p){var v=p.sizes||[],st=p.stocks||{};if(v.length)return v.some(function(l){return st[l]!=null&&Number(st[l])<=2});return p.stock!=null&&p.stock<=5}
  function row(title,sub,href,go){
    var inner='<span><b>'+esc(title)+"</b>"+(sub?"<small>"+esc(sub)+"</small>":"")+"</span>"+(go?'<span class="ov-go">'+esc(go)+"</span>":"");
    return href?'<a class="ov-row" href="'+href+'">'+inner+"</a>":'<div class="ov-row">'+inner+"</div>";
  }
  function overview(z){
    var s=z.store,e=z.ent,id=enc(s.id);Z.storeId=s.id;
    return Promise.all([
      Supa.get("products?select=id,name,status,stock,sizes,stocks&store_id=eq."+id).catch(soft),
      Supa.rpc("my_seller_orders",{}).then(unwrap).catch(soft),
      Supa.get("product_private?select=product_id,review_note").catch(soft),
      Supa.get("notifications?select=*&order=created_at.desc&limit=3").catch(soft)
    ]).then(function(a){
      var prods=(a[0]||[]).filter(function(p){return p.status!=="archived"}),orders=Array.isArray(a[1])?a[1]:[],pn={};(a[2]||[]).forEach(function(x){pn[x.product_id]=x});
      var cnt=function(st){return prods.filter(function(p){return p.status===st}).length};
      var fresh=orders.filter(function(o){return o.status==="pending"}),active=orders.filter(function(o){return ACTIVE.indexOf(o.status)>-1}),done=orders.filter(function(o){return o.status==="delivered"});
      var sum=function(l){return l.reduce(function(n,o){return n+Number(o.earning||0)},0)};
      var tasks=[];
      if(fresh.length){var due=fresh.map(function(o){return o.accept_by}).filter(Boolean).sort()[0];tasks.push(row(fresh.length+" new order"+(fresh.length>1?"s":"")+" waiting",due?"Respond by "+C.when(due):"Respond promptly"))}
      prods.filter(function(p){return p.status==="rejected"}).slice(0,3).forEach(function(p){tasks.push(row(p.name,(pn[p.id]&&pn[p.id].review_note)||"Needs changes","/portal/product/"+enc(p.id),"Fix"))});
      prods.filter(function(p){return p.status==="published"&&isLow(p)}).slice(0,3).forEach(function(p){tasks.push(row(p.name,"Running low","/portal/product/"+enc(p.id),"Restock"))});
      if(cnt("draft"))tasks.push(row(cnt("draft")+" draft"+(cnt("draft")>1?"s":"")+" not sent yet","Send them for review to go live","/portal/products","Review"));
      if(!prods.length)tasks.push(row("Add your first product","It goes live after review","/portal/product/new","Add"));
      var meter="",cap=null;
      if(e&&e.configured===true){
        var used=e.active_products||0,lim=e.active_products_unlimited?null:e.active_product_limit,pct=lim?Math.min(100,Math.round(used/lim*100)):0;
        if(lim&&pct>=80)tasks.push(row("You are using "+used+" of "+lim+" products","Upgrade for more room","/portal/plan","Plans"));
        var dl=e.daily_new_products_unlimited?"":'<p class="ov-quiet">Today: '+(e.daily_new_products_used||0)+" of "+e.daily_new_product_limit+" new listings</p>";
        meter='<div class="ov-card"><h3>'+esc(e.plan_name||"Plan")+'</h3><p class="ov-quiet">'+(lim?used+" of "+lim+" products":used+" products, no limit")+'</p>'+(lim?'<div class="ov-meter'+(pct>=80?" hot":"")+'" role="img" aria-label="'+pct+' percent of your product limit used"><i style="width:'+pct+'%"></i></div>':"")+dl+'<a class="ov-go" href="/portal/plan" style="display:inline-block;margin-top:10px">Plans</a></div>';
      }
      var recent=orders.slice(0,5).map(function(o){var m=SO[o.status]||[o.status,""];return row((o.customer_name||"Customer")+" · "+C.money(o.subtotal),m[0]+" · "+C.ago(o.created_at)+(o.customer_city?" · "+o.customer_city:""))}).join("");
      var notes=(a[3]||[]).length?'<div class="ov-card"><h3>Messages</h3>'+(a[3]||[]).map(function(n){return row(n.title,n.body||"","/inbox")}).join("")+"</div>":"";
      var html='<div class="ov-head"><h1>'+esc(s.name)+'</h1><span>'+pill("Live","ok")+(s.slug?' <a class="ov-go" href="/store/'+esc(s.slug)+'">View store</a>':"")+'</span></div>'
        +'<div class="ov-grid"><div class="ov-stat"><b>'+num(fresh.length)+'</b><small>New orders</small></div><div class="ov-stat"><b>'+num(active.length)+'</b><small>In progress</small></div><div class="ov-stat"><b>'+num(cnt("published"))+'</b><small>Live products</small></div><div class="ov-stat"><b>'+C.money(sum(done))+'</b><small>Earned from delivered orders</small></div></div>'
        +'<div class="row" style="margin-bottom:6px"><a class="btn" href="/portal/product/new">Add product</a><a class="btn o" href="/portal/products">Products</a></div>'
        +'<div class="ov-cols"><div style="display:grid;gap:16px;align-content:start"><div class="ov-card"><h3>To do</h3>'+(tasks.length?tasks.join(""):'<p class="ov-quiet">You are all caught up.</p>')+"</div>"
        +'<div class="ov-card"><h3>Recent orders</h3>'+(recent||'<p class="ov-quiet">Orders appear here as shoppers buy.</p>')+"</div></div>"
        +'<div style="display:grid;gap:16px;align-content:start">'+meter
        +'<div class="ov-card"><h3>Earnings</h3><div class="ov-row"><span><b>'+C.money(sum(active))+'</b><small>In progress, not yet delivered</small></span></div><p class="ov-quiet">Withdrawals are not available yet.</p></div>'+notes+"</div></div>";
      return{layout:"portal",active:"portal",title:"Dashboard",html:html};
    });
  }
})();
