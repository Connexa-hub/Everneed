/* Admin console: overview, Seller operations (applications, stores and plans, plan limits, verification cases), product review, waitlist.
   Every decision is a database function that checks the caller is an admin, notifies the seller and writes the audit log.
   The overview counts a store as live only when the server says it is operationally live (status approved and activation_status live),
   never merely because an application was approved. Verification is not an overview metric; case detail lives under Seller operations. */
(function(){
  var C=Core,esc=C.esc,V=C.V,A=C.A,F=C.F,enc=encodeURIComponent,q=function(p){return Supa.get(p)};
  var WL=[];
  var CAP=1000;
  var CHECKS=["phone","identity","face_liveness","business_address"];
  var LABEL={phone:"Phone number",identity:"Identity document",face_liveness:"Face check",business_address:"Business address"};
  function soft(){return[]}
  function one(x){return Array.isArray(x)?x[0]||null:x||null}
  function dl(rows){return"<dl>"+rows.filter(function(r){return r[1]}).map(function(r){return"<dt>"+r[0]+"</dt><dd>"+esc(r[1])+"</dd>"}).join("")+"</dl>"}
  function fail(e){C.toast(e&&e.message||"That did not work",true)}
  function again(){window.dispatchEvent(new Event("hashchange"))}
  function rpc(fn,args,msg){return Supa.rpc(fn,args).then(function(){C.toast(msg);again()}).catch(fail)}
  function head(t,sub){return'<h1 style="font-size:2.2rem">'+t+"</h1>"+(sub?'<p class="m">'+sub+"</p>":"")}
  function num(n,capped){try{return new Intl.NumberFormat().format(n||0)+(capped?"+":"")}catch(e){return String(n||0)+(capped?"+":"")}}
  function pill(l,c){return'<span class="pill '+(c||"")+'">'+esc(l)+"</span>"}

  /* ---------- overview: business and operations ---------- */
  function overview(){
    return Promise.all([
      q("stores?select=id,status,activation_status,is_official").catch(soft),
      q("products?select=id&status=eq.pending_review").catch(soft),
      q("orders?select=total,payment_status&limit="+CAP).catch(soft),
      q("seller_orders?select=commission,status&limit="+CAP).catch(soft),
      q("disputes?select=id&status=in.(open,investigating)").catch(soft),
      q("deliveries?select=id&status=eq.failed").catch(soft),
      q("support_queue?select=id&status=eq.waiting").catch(soft),
      q("waitlist?select=id").catch(function(){return null})
    ]).then(function(a){
      var stores=(a[0]||[]).filter(function(s){return!s.is_official}),live=stores.filter(function(s){return s.status==="approved"&&s.activation_status==="live"}).length,
        waiting=stores.filter(function(s){return s.status==="pending"}).length,
        approvedNotLive=stores.filter(function(s){return s.status==="approved"&&s.activation_status!=="live"}).length,
        orders=a[2]||[],paid=orders.filter(function(o){return o.payment_status==="paid"||o.payment_status==="partially_refunded"}),
        gmv=paid.reduce(function(n,o){return n+Number(o.total||0)},0),so=a[3]||[],
        revenue=so.filter(function(o){return o.status==="delivered"}).reduce(function(n,o){return n+Number(o.commission||0)},0),
        issues=so.filter(function(o){return o.status==="issue"}).length+(a[5]||[]).length,
        capO=orders.length>=CAP,
        kp=function(n,l,h){return(h?'<a href="'+h+'">':"<div>")+"<b>"+n+"</b><small>"+l+"</small>"+(h?"</a>":"</div>")};
      return head("Overview","The business at a glance.")
        +'<div class="sech"><h3>Stores and catalogue</h3></div><div class="kpis">'+kp(num(live),"Live stores","/admin/sellers/stores")+kp(num(waiting),"Applications waiting","/admin/sellers")+kp(num(approvedNotLive),"Approved, not yet live","/admin/sellers/stores")+kp(num((a[1]||[]).length),"Products to review","/admin/review")+"</div>"
        +'<div class="sech"><h3>Sales and operations</h3></div><div class="kpis">'+kp(num(paid.length,capO),"Paid orders")+kp(C.money(gmv)+(capO?"+":""),"Sales (GMV)")+kp(C.money(revenue),"Platform revenue, delivered orders")+kp(num((a[4]||[]).length),"Open disputes")+kp(num(issues),"Delivery exceptions")+kp(num((a[6]||[]).length),"Support waiting","/inbox")+kp(a[7]?num(a[7].length):"-","Waitlist signups","/admin/waitlist")+"</div>"
        +(capO?'<p class="sm">Order totals cover the latest '+num(CAP)+" orders.</p>":"");
    });
  }

  /* ---------- seller operations ---------- */
  var TABS=[["","Applications"],["stores","Stores and plans"],["plans","Plan limits"],["verification","Verification cases"]];
  function tabs(cur){return'<nav class="so-tabs" aria-label="Seller operations">'+TABS.map(function(t){return'<a href="/admin/sellers'+(t[0]?"/"+t[0]:"")+'"'+(t[0]===cur?' class="on" aria-current="page"':"")+">"+t[1]+"</a>"}).join("")+"</nav>"}
  function planMap(){return q("store_plans?select=id,name,price,product_limit&order=price.asc").catch(soft).then(function(r){var m={};(r||[]).forEach(function(p){m[p.id]=p});return{list:r||[],by:m}})}
  function sellers(tab){
    var body=tab==="stores"?storesTab():tab==="plans"?plansTab():tab==="verification"?verificationTab():appsTab();
    return body.then(function(h){return head("Seller operations")+tabs(tab)+h});
  }
  function appsTab(){
    return Promise.all([q("stores?select=*,store_applications(*),store_private(*)&status=eq.pending&order=created_at.asc"),planMap()]).then(function(a){
      var rows=a[0]||[],ids=rows.map(function(r){return r.owner_id}).filter(Boolean),by=a[1].by;
      var owners=ids.length?q("profiles?select=id,name,email,phone&id=in.("+ids.map(enc).join(",")+")").catch(soft):Promise.resolve([]);
      return owners.then(function(ps){
        var o={};(ps||[]).forEach(function(p){o[p.id]=p});
        return'<p class="m">'+rows.length+" waiting for a decision</p>"+(rows.length?rows.map(function(s){var ap=one(s.store_applications)||{},p=one(s.store_private)||{},ow=o[s.owner_id]||{},pl=by[ap.plan_id];
          return'<div class="queue"><h3>'+esc(s.name)+"</h3><small>"+esc([s.city,s.state].filter(Boolean).join(", "))+(ap.submitted_at?" · sent "+C.when(ap.submitted_at):"")+"</small>"
            +dl([["Owner",[ow.name,ow.email,ow.phone].filter(Boolean).join(" · ")],["Business",ap.business_name],["Plan",pl?pl.name:""],["Categories",(s.categories||[]).join(", ")],["Phone",p.phone],["About",s.about]])
            +'<div class="acts"><button class="btn s" data-act="aappr" data-id="'+esc(s.id)+'">Approve</button><button class="btn o s danger" data-act="arej" data-id="'+esc(s.id)+'">Reject</button></div></div>'}).join(""):C.empty("No applications waiting","New seller applications appear here."));
      });
    });
  }
  var SL={approved:"Approved",pending:"In review",draft:"Draft",rejected:"Rejected",suspended:"Suspended"};
  function storeState(s){
    if(s.is_official)return["Official","ok"];
    if(s.status==="approved")return s.activation_status==="live"?["Live","ok"]:["Approved, not live","info"];
    return[SL[s.status]||s.status,s.status==="suspended"||s.status==="rejected"?"bad":"info"];
  }
  function storesTab(){
    return Promise.all([q("stores?select=*,store_subscriptions(status,current_period_end,plan_id),store_private(status_note)&order=created_at.desc"),planMap()]).then(function(a){
      var l=a[0]||[],by=a[1].by;
      return'<p class="m">'+l.length+" in total</p>"+(l.length?l.map(function(s){var sub=one(s.store_subscriptions)||{},st=storeState(s),pl=by[sub.plan_id];
        var act=s.is_official?"":s.status==="approved"?'<button class="btn o s danger" data-act="ssus" data-id="'+esc(s.id)+'">Suspend</button>':s.status==="suspended"?'<button class="btn s" data-act="sback" data-id="'+esc(s.id)+'">Reinstate</button>':"";
        return'<div class="queue"><h3>'+esc(s.name)+(s.is_official?" (Everneed)":"")+"</h3>"+pill(st[0],st[1])
          +dl([["Link","/store/"+s.slug],["Location",[s.city,s.state].filter(Boolean).join(", ")],["Plan",sub.plan_id?(pl?pl.name:sub.plan_id):s.is_official?"":"Not selected"],["Subscription",sub.status?sub.status+(sub.current_period_end&&!s.is_official?" until "+C.when(sub.current_period_end):""):""],["Activation",s.status==="approved"&&!s.is_official?s.activation_status:""],["Note",(one(s.store_private)||{}).status_note]])+'<div class="acts">'+act+"</div></div>"}).join(""):C.empty("No stores yet"));
    });
  }

  /* Plan limits: only the Free plan is editable here (owner decision). Other plans are shown read-only. The backend validates, enforces and audits. */
  function plansTab(){
    return Promise.all([planMap(),q("seller_plan_entitlements?select=*").then(function(r){return r||[]},function(){return null})]).then(function(a){
      var plans=a[0].list,ents=a[1];
      if(ents===null)return C.empty("Plan limits are not available","The plan entitlement table could not be read in this environment.");
      var by={};ents.forEach(function(e){by[e.plan_id]=e});
      return plans.map(function(p){
        var e=by[p.id];if(!e)return"";
        var free=p.id==="plan-free",lim=e.active_products_unlimited?"Unlimited":(e.active_product_limit==null?"Not configured":e.active_product_limit),dl2=e.daily_new_products_unlimited?"No daily limit":(e.daily_new_product_limit==null?"Not configured":e.daily_new_product_limit+" a day");
        var head2='<h3>'+esc(p.name)+"</h3><small>"+(Number(p.price)>0?C.money(p.price)+" a month":"Free")+" · "+esc(String(lim))+" products · "+esc(String(dl2))+" · "+(e.verification_included?"verification included":"verification optional")+"</small>";
        if(!free)return'<div class="so-case so-plan">'+head2+'<p class="sm" style="margin-top:6px">Set by Everneed. Changes to this plan go through the backend owner.</p></div>';
        return'<div class="so-case so-plan">'+head2+'<form data-form="aplan" novalidate><input type="hidden" name="plan" value="'+esc(p.id)+'"><div class="fgrid">'
          +'<div><label class="lb">Active products<input name="limit" inputmode="numeric" value="'+esc(e.active_product_limit==null?"":e.active_product_limit)+'"'+(e.active_products_unlimited?" disabled":"")+' placeholder="Not configured"></label><label class="so-ck"><input type="checkbox" name="unl" value="1" data-so="limit"'+(e.active_products_unlimited?" checked":"")+"> Unlimited</label></div>"
          +'<div><label class="lb">New listings a day<input name="dlimit" inputmode="numeric" value="'+esc(e.daily_new_product_limit==null?"":e.daily_new_product_limit)+'"'+(e.daily_new_products_unlimited?" disabled":"")+' placeholder="Not configured"></label><label class="so-ck"><input type="checkbox" name="dunl" value="1" data-so="dlimit"'+(e.daily_new_products_unlimited?" checked":"")+"> No daily limit</label></div></div>"
          +'<label class="so-ck"><input type="checkbox" name="ver" value="1"'+(e.verification_included?" checked":"")+"> Verification included with this plan</label>"
          +'<label class="lb">Reason for this change<textarea name="reason" rows="2" maxlength="300" placeholder="Recorded in the audit log" required></textarea></label>'
          +'<p class="sm" id="aplanmsg" role="status"></p><div class="acts"><button class="btn s" type="submit">Save limits</button></div></form></div>';
      }).join("");
    });
  }
  F.aplan=function(f,d){
    var msg=document.getElementById("aplanmsg"),btn=f.querySelector("button[type=submit]");
    function stop(m){if(msg)msg.textContent=m;C.toast(m,true)}
    var unl=!!d.unl,dunl=!!d.dunl,lim=unl?null:Number(String(d.limit||"").trim()),dl=dunl?null:Number(String(d.dlimit||"").trim()),reason=String(d.reason||"").trim();
    if(!unl&&!(String(d.limit||"").trim()!==""&&Number.isInteger(lim)&&lim>=1))return stop("Enter a whole number of active products, or choose Unlimited.");
    if(!dunl&&!(String(d.dlimit||"").trim()!==""&&Number.isInteger(dl)&&dl>=1))return stop("Enter a whole number of new listings a day, or choose No daily limit.");
    if(reason.length<3)return stop("Add a short reason. It is kept in the audit log.");
    if(msg)msg.textContent="";btn.disabled=true;btn.textContent="Saving…";
    Supa.rpc("admin_set_plan_entitlements",{p_plan_id:d.plan,p_active_product_limit:lim,p_active_products_unlimited:unl,p_daily_new_product_limit:dl,p_daily_new_products_unlimited:dunl,p_verification_included:!!d.ver,p_reason:reason})
      .then(function(){C.toast("Plan limits saved");again()})
      .catch(function(e){btn.disabled=false;btn.textContent="Save limits";stop(e&&e.message||"Could not save the limits.")});
  };

  /* Verification cases: plan-required checks and confirmed mandatory compliance, per store, read-only with audit history.
     Results are recorded by the provider or an authorised review, never from this screen. */
  function nextAction(st){return({not_started:"Waiting for the seller or the provider connection",pending:"Waiting for the provider",verified:"None",needs_attention:"Contact the seller",expired:"Seller must verify again",skipped:"None"})[st]||"Review"}
  function verificationTab(){
    return Promise.all([
      q("stores?select=id,name,country,status,activation_status,is_official&is_official=eq.false&status=in.(pending,approved)&order=created_at.desc").catch(soft),
      q("store_subscriptions?select=store_id,plan_id,status").catch(soft),
      q("seller_plan_entitlements?select=*").catch(soft),
      q("seller_verification_rules?select=*&enabled=eq.true").catch(soft),
      q("store_verification_checks?select=*&order=updated_at.desc").catch(soft),
      planMap()
    ]).then(function(a){
      var sub={},ent={},chk={};(a[1]||[]).forEach(function(s){sub[s.store_id]=s});(a[2]||[]).forEach(function(e){ent[e.plan_id]=e});
      (a[4]||[]).forEach(function(c){(chk[c.store_id]=chk[c.store_id]||{})[c.check_type]=c});
      var cases=[];
      (a[0]||[]).forEach(function(s){
        var sb=sub[s.id],e=sb&&ent[sb.plan_id];
        var req=(a[3]||[]).filter(function(r){
          if(r.country!==s.country||!r.required)return false;var sc=r.requirement_scope||"unclassified";
          return sc==="mandatory_compliance"||sc==="unclassified"||(sc==="commercial"&&e&&e.verification_required_to_activate);
        }).sort(function(x,y){return CHECKS.indexOf(x.check_type)-CHECKS.indexOf(y.check_type)});
        if(!req.length)return;
        var st=function(r){return chk[s.id]&&chk[s.id][r.check_type]&&chk[s.id][r.check_type].status||"not_started"};
        cases.push({s:s,plan:sb?(a[5].by[sb.plan_id]||{}).name||sb.plan_id:"Not selected",req:req,st:st,open:req.filter(function(r){return st(r)!=="verified"}).length,chk:chk[s.id]||{}});
      });
      cases.sort(function(x,y){return y.open-x.open});
      return '<p class="m">'+cases.length+" store"+(cases.length===1?"":"s")+" with plan-required or mandatory checks. Results are recorded by the provider or an authorised review, never from this screen.</p>"
        +(cases.length?cases.map(function(c){
          return'<div class="so-case"><h3>'+esc(c.s.name)+"</h3><small>"+esc(c.plan)+" plan · "+esc(storeState(c.s)[0])+" · "+(c.open?c.open+" open":"complete")+"</small>"
            +c.req.map(function(r){var st=c.st(r),k=c.chk[r.check_type]||{},cls=st==="verified"?"ok":st==="pending"?"info":st==="needs_attention"||st==="expired"?"bad":"",sc=r.requirement_scope==="commercial"?"Plan":"Mandatory";
              return'<div class="so-chk"><span><b>'+esc(LABEL[r.check_type]||r.check_type)+"</b> · "+sc+"<small>"+esc("Provider: "+(k.provider||"none")+" · Reviewer: "+(k.reviewed_by?String(k.reviewed_by).slice(0,8):"provider")+(k.updated_at?" · Updated "+C.when(k.updated_at):"")+(k.safe_note?" · "+k.safe_note:"")+" · Next: "+nextAction(st))+"</small></span>"+pill(st.replace(/_/g," "),cls)+"</div>"}).join("")
            +'<div class="acts"><button class="btn o s" type="button" data-act="avhist" data-id="'+esc(c.s.id)+'">Audit history</button></div><div class="so-hist" id="h-'+esc(c.s.id)+'" hidden></div></div>'}).join(""):C.empty("No verification cases","Stores whose plan or regional rules require checks appear here."));
    });
  }
  A.avhist=function(b){
    var id=b.getAttribute("data-id"),box=document.getElementById("h-"+id);if(!box)return;
    if(!box.hidden){box.hidden=true;return}
    box.hidden=false;box.textContent="Loading…";
    q("audit_log?select=action,at,actor_id,after&target_id=eq."+enc(id)+"&order=at.desc&limit=15").then(function(r){
      box.innerHTML=(r&&r.length)?r.map(function(x){var why=x.after&&x.after.reason||x.after&&x.after.note||"";return"<div><b>"+esc(String(x.action).replace(/_/g," "))+"</b> · "+C.when(x.at)+" · "+esc(x.actor_id?String(x.actor_id).slice(0,8):"system")+(why?" · "+esc(why):"")+"</div>"}).join(""):"No recorded activity yet.";
    }).catch(function(e){box.textContent=e&&e.message||"Could not load the history."});
  };


  /* ---------- other admin pages (unchanged behaviour) ---------- */
  function review(l){return head("Product review",l.length+" waiting")+(l.length?l.map(function(x){var st=one(x.stores)||{},pp=one(x.product_private)||{};
      return'<div class="queue"><div class="row">'+(x.img?'<img class="pprev" alt="" loading="lazy" src="'+esc(x.img)+'" style="margin:0">':"")+'<div><h3>'+esc(x.name)+"</h3><small>"+esc(st.name||"")+" · "+esc(x.col)+"</small></div></div>"
        +dl([["Price",C.money(x.price)+(x.old?" (was "+C.money(x.old)+")":"")],["Stock",x.stock==null?"No limit":String(x.stock)],["Registration no.",pp.compliance_ref],["Description",(x.descr||"").slice(0,300)]])
        +'<div class="acts"><button class="btn s" data-act="rpub" data-id="'+esc(x.id)+'">Publish</button><button class="btn o s danger" data-act="rchg" data-id="'+esc(x.id)+'">Ask for changes</button></div></div>'}).join(""):C.empty("Nothing to review","Submitted products appear here."))}
  function waitlist(l){var by={};l.forEach(function(x){var k=x.country||"?";by[k]=(by[k]||0)+1});
    return'<div class="sech"><div>'+head("Waitlist",l.length+" signups")+'</div><button class="btn o s" data-act="wcsv">Export CSV</button></div><div class="chips" style="margin-bottom:16px">'+Object.keys(by).map(function(k){return'<span class="pill info">'+esc(CFG.countries[k]||k)+" "+by[k]+"</span>"}).join("")+"</div>"
      +(l.length?'<div class="tw"><table><thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Country</th><th>Interest</th><th>Joined</th></tr></thead><tbody>'+l.map(function(x){return"<tr><td>"+esc(x.email)+"</td><td>"+esc(x.name||"")+"</td><td>"+esc(x.role)+"</td><td>"+esc(x.country||"")+"</td><td>"+esc(x.interest||"")+"</td><td>"+C.when(x.created_at)+"</td></tr>"}).join("")+"</tbody></table></div>":C.empty("No signups yet"))}

  V.admin=function(p){if(!Supa.uid())return{redirect:"#/login"};var me=C.me();if(!me||me.role!=="admin")return{layout:"portal",active:"",html:head("Admin only","This area is for the Everneed team. Seller tools are in your portal."),title:"Admin"};
    var sub=p[0]||"";function out(h,t,active){return{layout:"admin",active:active||"admin"+(sub?"/"+sub:""),html:h,title:t||"Admin"}}
    if(sub==="appearance")return out(head("Appearance")+'<div id="apprw" style="margin-top:20px">'+C.appearance()+"</div>");
    if(sub==="waitlist")return q("waitlist?select=*&order=created_at.desc&limit=500").then(function(r){WL=r||[];return out(waitlist(WL),"Waitlist")},function(){WL=[];return out(head("Waitlist")+C.empty("Waitlist is not set up yet","Apply shared/sql/011_website_sync.sql in the Supabase SQL editor, then reload."),"Waitlist")});
    if(sub==="applications")return{redirect:"/admin/sellers"};
    if(sub==="stores")return{redirect:"/admin/sellers/stores"};
    if(sub==="sellers"){var tab=p[1]||"";if(tab!==""&&tab!=="stores"&&tab!=="plans"&&tab!=="verification")tab="";
      return sellers(tab).then(function(h){return out(h,"Seller operations","admin/sellers")}).catch(function(e){return out(head("Seller operations")+C.empty("Could not load this page",e&&e.message||"Please try again."),"Seller operations","admin/sellers")})}
    if(sub==="review")return q("products?select=*,stores(name,slug),product_private(compliance_ref)&status=eq.pending_review&order=at.asc").then(function(d){return out(review(d),"Product review")});
    return overview().then(function(h){return out(h,"Overview","admin")});
  };
  A.wcsv=function(){var rows=[["email","name","role","country","interest","status","created_at"]].concat(WL.map(function(x){return[x.email,x.name,x.role,x.country,x.interest,x.status,x.created_at]}));
    var csv=rows.map(function(r){return r.map(function(v){return'"'+String(v==null?"":v).replace(/"/g,'""')+'"'}).join(",")}).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="everneed-waitlist.csv";a.click()};
  function id(b){return b.getAttribute("data-id")}
  A.aappr=function(b){C.ask("Approve this store?","Note to the seller (optional)",false).then(function(n){if(n!==null)rpc("approve_store",{p_store:id(b),p_note:n||null},"Store approved")})};
  A.arej=function(b){C.ask("Reject this application","Tell the seller what to fix",true).then(function(n){if(n)rpc("reject_store",{p_store:id(b),p_reason:n},"Application rejected")})};
  A.rpub=function(b){rpc("review_product",{p_product:id(b),p_decision:"publish",p_note:null},"Product published")};
  A.rchg=function(b){C.ask("Ask for changes","Tell the seller what to fix",true).then(function(n){if(n)rpc("review_product",{p_product:id(b),p_decision:"reject",p_note:n},"Sent back to the seller")})};
  A.ssus=function(b){C.ask("Suspend this store?","Reason (the seller will see it)",true).then(function(n){if(n)rpc("suspend_store",{p_store:id(b),p_reason:n},"Store suspended")})};
  A.sback=function(b){rpc("approve_store",{p_store:id(b),p_note:"Reinstated"},"Store reinstated")};
  /* Free-limit checkboxes switch their number field on and off. */
  document.addEventListener("change",function(e){var t=e.target;if(!t.getAttribute||!t.getAttribute("data-so"))return;var f=t.form,inp=f&&f[t.getAttribute("data-so")];if(inp){inp.disabled=t.checked;if(t.checked)inp.value=""}});
})();
