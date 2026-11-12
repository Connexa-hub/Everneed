/* Admin console: applications, product review, stores, waitlist. Every decision is a database function that checks the caller is an admin, notifies the seller and writes the audit log. */
(function(){
  var C=Core,esc=C.esc,V=C.V,A=C.A,enc=encodeURIComponent,q=function(p){return Supa.get(p)};
  var WL=[];
  function one(x){return Array.isArray(x)?x[0]||null:x||null}
  function dl(rows){return"<dl>"+rows.filter(function(r){return r[1]}).map(function(r){return"<dt>"+r[0]+"</dt><dd>"+esc(r[1])+"</dd>"}).join("")+"</dl>"}
  function fail(e){C.toast(e&&e.message||"That did not work",true)}
  function again(){window.dispatchEvent(new Event("hashchange"))}
  function rpc(fn,args,msg){return Supa.rpc(fn,args).then(function(){C.toast(msg);again()}).catch(fail)}
  function head(t,sub){return'<h1 style="font-size:2.2rem">'+t+"</h1>"+(sub?'<p class="m">'+sub+"</p>":"")}
  function fetchTab(t){
    if(t==="review")return q("products?select=*,stores(name,slug),product_private(compliance_ref)&status=eq.pending_review&order=at.asc");
    if(t==="stores")return q("stores?select=*,store_subscriptions(status,current_period_end),store_private(status_note)&order=created_at.desc");
    return q("stores?select=*,store_applications(*),store_private(*)&status=eq.pending&order=created_at.asc").then(function(rows){rows=rows||[];var ids=rows.map(function(r){return r.owner_id}).filter(Boolean);if(!ids.length)return rows;
      return q("profiles?select=id,name,email,phone&id=in.("+ids.map(enc).join(",")+")").then(function(ps){var by={};(ps||[]).forEach(function(p){by[p.id]=p});rows.forEach(function(r){r._owner=by[r.owner_id]||null});return rows})})}
  V.admin=function(p){if(!Supa.uid())return{redirect:"#/login"};var me=C.me();if(!me||me.role!=="admin")return{layout:"portal",active:"",html:head("Admin only","This area is for the Everneed team. Seller tools are in your portal."),title:"Admin"};
    var sub=p[0]||"";function out(h,t){return{layout:"admin",active:"admin"+(sub?"/"+sub:""),html:h,title:t||"Admin"}}
    if(sub==="appearance")return out(head("Appearance")+'<div id="apprw" style="margin-top:20px">'+C.appearance()+"</div>");
    if(sub==="waitlist")return q("waitlist?select=*&order=created_at.desc&limit=500").then(function(r){WL=r||[];return out(waitlist(WL),"Waitlist")},function(){WL=[];return out(head("Waitlist")+C.empty("Waitlist is not set up yet","Apply shared/sql/011_website_sync.sql in the Supabase SQL editor, then reload."),"Waitlist")});
    if(sub==="")return Promise.all([fetchTab(""),fetchTab("review"),fetchTab("stores"),q("waitlist?select=id").catch(function(){return null})]).then(function(a){var live=a[2].filter(function(s){return s.status==="approved"}).length;
      var kp=function(n,l,h){return'<a href="'+h+'"><b>'+n+"</b><small>"+l+"</small></a>"};return out(head("Overview","What needs a decision today.")+'<div class="kpis">'+kp(a[0].length,"Applications waiting","#/admin/applications")+kp(a[1].length,"Products to review","#/admin/review")+kp(live,"Live stores","#/admin/stores")+kp(a[3]?a[3].length:"-","Waitlist signups","#/admin/waitlist")+"</div>")});
    var tab=sub==="applications"?"":sub;if(tab!==""&&tab!=="review"&&tab!=="stores")tab="";
    return fetchTab(tab).then(function(d){return out(tab==="review"?review(d):tab==="stores"?stores(d):apps(d))})};
  function apps(l){return head("Applications",l.length+" waiting for a decision")+(l.length?l.map(function(s){var a=one(s.store_applications)||{},p=one(s.store_private)||{},o=s._owner||{};
      return'<div class="queue"><h3>'+esc(s.name)+"</h3><small>"+esc([s.city,s.state].filter(Boolean).join(", "))+(a.submitted_at?" · sent "+C.when(a.submitted_at):"")+"</small>"
        +dl([["Owner",[o.name,o.email,o.phone].filter(Boolean).join(" · ")],["Business",a.business_name],["ID",[a.id_type,a.id_ref].filter(Boolean).join(" · ")],["Bank",[a.bank_name,a.account_number,a.account_name].filter(Boolean).join(" · ")],["Categories",(s.categories||[]).join(", ")],["Phone",p.phone],["Pickup",p.pickup_address],["Delivery",p.direct_delivery_enabled?"Direct to: "+((p.delivery_zones||[]).join(", ")||"no areas listed"):"Via the Everneed hub only"],["About",s.about]])
        +'<div class="acts"><button class="btn s" data-act="aappr" data-id="'+esc(s.id)+'">Approve</button><button class="btn o s danger" data-act="arej" data-id="'+esc(s.id)+'">Reject</button></div></div>'}).join(""):C.empty("No applications waiting","New seller applications appear here."))}
  function review(l){return head("Product review",l.length+" waiting")+(l.length?l.map(function(x){var st=one(x.stores)||{},pp=one(x.product_private)||{};
      return'<div class="queue"><div class="row">'+(x.img?'<img class="pprev" alt="" loading="lazy" src="'+esc(x.img)+'" style="margin:0">':"")+'<div><h3>'+esc(x.name)+"</h3><small>"+esc(st.name||"")+" · "+esc(x.col)+"</small></div></div>"
        +dl([["Price",C.money(x.price)+(x.old?" (was "+C.money(x.old)+")":"")],["Stock",x.stock==null?"No limit":String(x.stock)],["Registration no.",pp.compliance_ref],["Description",(x.descr||"").slice(0,300)]])
        +'<div class="acts"><button class="btn s" data-act="rpub" data-id="'+esc(x.id)+'">Publish</button><button class="btn o s danger" data-act="rchg" data-id="'+esc(x.id)+'">Ask for changes</button></div></div>'}).join(""):C.empty("Nothing to review","Submitted products appear here."))}
  var SL={approved:"Live",pending:"In review",draft:"Draft",rejected:"Rejected",suspended:"Suspended"};
  function stores(l){return head("Stores",l.length+" in total")+(l.length?l.map(function(s){var sub=one(s.store_subscriptions)||{},cls=s.status==="approved"?"ok":s.status==="suspended"||s.status==="rejected"?"bad":"info";
      var act=s.is_official?"":s.status==="approved"?'<button class="btn o s danger" data-act="ssus" data-id="'+esc(s.id)+'">Suspend</button>':s.status==="suspended"?'<button class="btn s" data-act="sback" data-id="'+esc(s.id)+'">Reinstate</button>':"";
      return'<div class="queue"><h3>'+esc(s.name)+(s.is_official?" (Everneed)":"")+'</h3><span class="pill '+cls+'">'+(SL[s.status]||esc(s.status))+"</span>"
        +dl([["Link","/store/"+s.slug],["Location",[s.city,s.state].filter(Boolean).join(", ")],["Rental",sub.status?sub.status+(sub.current_period_end&&!s.is_official?" until "+C.when(sub.current_period_end):""):""],["Note",(one(s.store_private)||{}).status_note]])+'<div class="acts">'+act+"</div></div>"}).join(""):C.empty("No stores yet"))}
  function waitlist(l){var by={};l.forEach(function(x){var k=x.country||"?";by[k]=(by[k]||0)+1});
    return'<div class="sech"><div>'+head("Waitlist",l.length+" signups")+'</div><button class="btn o s" data-act="wcsv">Export CSV</button></div><div class="chips" style="margin-bottom:16px">'+Object.keys(by).map(function(k){return'<span class="pill info">'+esc(CFG.countries[k]||k)+" "+by[k]+"</span>"}).join("")+"</div>"
      +(l.length?'<div class="tw"><table><thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Country</th><th>Interest</th><th>Joined</th></tr></thead><tbody>'+l.map(function(x){return"<tr><td>"+esc(x.email)+"</td><td>"+esc(x.name||"")+"</td><td>"+esc(x.role)+"</td><td>"+esc(x.country||"")+"</td><td>"+esc(x.interest||"")+"</td><td>"+C.when(x.created_at)+"</td></tr>"}).join("")+"</tbody></table></div>":C.empty("No signups yet"))}
  A.wcsv=function(){var rows=[["email","name","role","country","interest","status","created_at"]].concat(WL.map(function(x){return[x.email,x.name,x.role,x.country,x.interest,x.status,x.created_at]}));
    var csv=rows.map(function(r){return r.map(function(v){return'"'+String(v==null?"":v).replace(/"/g,'""')+'"'}).join(",")}).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="everneed-waitlist.csv";a.click()};
  function id(b){return b.getAttribute("data-id")}
  A.aappr=function(b){C.ask("Approve this store?","Note to the seller (optional)",false).then(function(n){if(n!==null)rpc("approve_store",{p_store:id(b),p_note:n||null},"Store approved")})};
  A.arej=function(b){C.ask("Reject this application","Tell the seller what to fix",true).then(function(n){if(n)rpc("reject_store",{p_store:id(b),p_reason:n},"Application rejected")})};
  A.rpub=function(b){rpc("review_product",{p_product:id(b),p_decision:"publish",p_note:null},"Product published")};
  A.rchg=function(b){C.ask("Ask for changes","Tell the seller what to fix",true).then(function(n){if(n)rpc("review_product",{p_product:id(b),p_decision:"reject",p_note:n},"Sent back to the seller")})};
  A.ssus=function(b){C.ask("Suspend this store?","Reason (the seller will see it)",true).then(function(n){if(n)rpc("suspend_store",{p_store:id(b),p_reason:n},"Store suspended")})};
  A.sback=function(b){rpc("approve_store",{p_store:id(b),p_note:"Reinstated"},"Store reinstated")};
})();
