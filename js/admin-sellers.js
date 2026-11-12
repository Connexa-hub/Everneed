/* Admin: review seller applications, review submitted products, and manage store status.
   Approvals, rejections and suspensions are database functions that check the caller is an admin, notify the seller and write the audit log. */
window.AdmS=(function(){
  var esc=A.esc,notify=A.notify,sheet=A.sheet;
  var C={},loading={};
  var TABS=[["","Applications"],["review","Product review"],["stores","Stores"]];
  function enc(v){return encodeURIComponent(v)}
  function q(p){return Supa.q(p,"GET",true)}
  function one(x){return Array.isArray(x)?x[0]||null:x||null}
  function when(t){return t?new Date(t).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):""}
  function fetchTab(tab){
    if(tab==="review")return q("/rest/v1/products?select=*,stores(name,slug),product_private(compliance_ref)&status=eq.pending_review&order=at.asc");
    if(tab==="stores")return q("/rest/v1/stores?select=*,store_subscriptions(status,current_period_end),store_private(status_note)&order=created_at.desc");
    return q("/rest/v1/stores?select=*,store_applications(*),store_private(*)&status=eq.pending&order=created_at.asc").then(function(rows){
      rows=rows||[];var ids=rows.map(function(r){return r.owner_id}).filter(Boolean);if(!ids.length)return rows;
      return q("/rest/v1/profiles?select=id,name,email,phone&id=in.("+ids.map(enc).join(",")+")").then(function(ps){var by={};(ps||[]).forEach(function(p){by[p.id]=p});rows.forEach(function(r){r._owner=by[r.owner_id]||null});return rows})})}
  function ensure(tab){
    var c=C[tab];if(c&&Date.now()-c.at<30000)return c;
    if(!loading[tab]){loading[tab]=true;fetchTab(tab).then(function(d){C[tab]={at:Date.now(),data:d||[],err:""}},function(e){C[tab]={at:Date.now(),data:[],err:e.message||"Could not load"}}).then(function(){loading[tab]=false;A.refresh()})}
    return c||null}
  function nav(tab){return'<div class="chips" style="margin:6px 0 4px">'+TABS.map(function(t){return'<a class="chip'+(t[0]===tab?" on":"")+'" href="#/a/sellers'+(t[0]?"/"+t[0]:"")+'">'+t[1]+"</a>"}).join("")+"</div>"}
  function view(sub){
    var tab=(sub||"").split("/")[0];if(["","review","stores"].indexOf(tab)<0)tab="";
    var c=ensure(tab),h=nav(tab);
    if(!c)return h+'<div class="skel-card" style="aspect-ratio:3/1;margin:14px 0"></div>';
    if(c.err)return h+A.empty("Could not load",esc(c.err));
    return h+(tab==="review"?review(c.data):tab==="stores"?stores(c.data):apps(c.data))}
  function dl(rows){return"<dl>"+rows.filter(function(r){return r[1]}).map(function(r){return"<dt>"+r[0]+"</dt><dd>"+esc(r[1])+"</dd>"}).join("")+"</dl>"}
  function apps(list){
    if(!list.length)return A.empty("No applications waiting","New seller applications will appear here.");
    return'<p class="m sm">'+list.length+" waiting for a decision</p>"+list.map(function(s){
      var a=one(s.store_applications)||{},p=one(s.store_private)||{},o=s._owner||{};
      return'<div class="queue"><h3>'+esc(s.name)+'</h3><small class="m">'+esc([s.city,s.state].filter(Boolean).join(", "))+(a.submitted_at?" · sent "+when(a.submitted_at):"")+"</small>"
        +dl([["Owner",[o.name,o.email,o.phone].filter(Boolean).join(" · ")],["Business",a.business_name],["ID",[a.id_type,a.id_ref].filter(Boolean).join(" · ")],["Bank",[a.bank_name,a.account_number,a.account_name].filter(Boolean).join(" · ")],
          ["Categories",(s.categories||[]).join(", ")],["Phone",p.phone],["Pickup",p.pickup_address],["Delivery",p.direct_delivery_enabled?"Direct to: "+((p.delivery_zones||[]).join(", ")||"no areas listed"):"Via the EverNeed hub only"],["About",s.about]])
        +'<div class="acts"><button class="btn s" data-act="sapprove" data-id="'+esc(s.id)+'" data-name="'+esc(s.name)+'">Approve</button><button class="btn o s danger" data-act="sreject" data-id="'+esc(s.id)+'" data-name="'+esc(s.name)+'">Reject</button></div></div>'}).join("")}
  function review(list){
    if(!list.length)return A.empty("Nothing to review","Products submitted by sellers will appear here.");
    return'<p class="m sm">'+list.length+" waiting</p>"+list.map(function(p){var st=one(p.stores)||{},pp=one(p.product_private)||{};
      return'<div class="queue">'+(p.img?'<img class="pimg" alt="" loading="lazy" src="'+esc(p.img)+'">':"")+"<h3>"+esc(p.name)+'</h3><small class="m">'+esc(st.name||"")+" · "+esc(p.col)+"</small>"
        +dl([["Price",A.base(p.price)+(p.old?" (was "+A.base(p.old)+")":"")],["Stock",p.stock==null?"No limit":String(p.stock)],["Registration no.",pp.compliance_ref],["Description",(p.descr||"").slice(0,300)]])
        +'<div class="acts" style="clear:both"><button class="btn s" data-act="rpub" data-id="'+esc(p.id)+'">Publish</button><button class="btn o s danger" data-act="rrej" data-id="'+esc(p.id)+'" data-name="'+esc(p.name)+'">Ask for changes</button></div></div>'}).join("")}
  var SL={approved:"Live",pending:"In review",draft:"Draft",rejected:"Rejected",suspended:"Suspended"};
  function stores(list){
    if(!list.length)return A.empty("No stores yet","");
    return list.map(function(s){var sub=one(s.store_subscriptions)||{},cls=s.status==="approved"?"ok":s.status==="suspended"||s.status==="rejected"?"bad":"info";
      var act=s.is_official?"":s.status==="approved"?'<button class="btn o s danger" data-act="ssuspend" data-id="'+esc(s.id)+'" data-name="'+esc(s.name)+'">Suspend</button>':s.status==="suspended"?'<button class="btn s" data-act="sreinstate" data-id="'+esc(s.id)+'">Reinstate</button>':"";
      return'<div class="queue"><h3>'+esc(s.name)+(s.is_official?" (EverNeed)":"")+'</h3><i class="pill '+cls+'">'+(SL[s.status]||s.status)+"</i>"
        +dl([["Link","/store/"+s.slug],["Location",[s.city,s.state].filter(Boolean).join(", ")],["Rental",sub.status?sub.status+(sub.current_period_end&&!s.is_official?" until "+when(sub.current_period_end):""):""],["Note",(one(s.store_private)||{}).status_note]])+'<div class="acts">'+act+"</div></div>"}).join("")}
  function ask(title,sub,name,field,required,id,form,btn){
    sheet('<button class="x" data-act="close" aria-label="Close">✕</button><h3>'+esc(title)+"</h3><p class=\"m\">"+esc(name||"")+'</p><form data-form="'+form+'" novalidate><input type="hidden" name="id" value="'+esc(id)+'"><label class="lb" for="s-note">'+esc(sub)+'</label><textarea id="s-note" name="note" rows="4" maxlength="300"'+(required?" required":"")+'></textarea><button class="btn w" type="submit" style="margin-top:14px">'+esc(btn)+"</button></form>")}
  function done(msg){sheet(null);C={};notify(msg);A.refresh()}
  function rpc(fn,args,msg){return Supa.rpcAuth(fn,args).then(function(){done(msg)}).catch(function(e){notify(e.message||"That did not work","err")})}
  function act(k,d,a,e){
    if(k==="sapprove"){ask("Approve this store?","Note to the seller (optional)",d.name,"note",false,d.id,"sappr","Approve store");return true}
    if(k==="sreject"){ask("Reject this application","Tell the seller what to fix",d.name,"note",true,d.id,"srej","Send rejection");return true}
    if(k==="rrej"){ask("Ask for changes","Tell the seller what to fix",d.name,"note",true,d.id,"rrejf","Send to seller");return true}
    if(k==="ssuspend"){ask("Suspend this store?","Reason (the seller will see it)",d.name,"note",true,d.id,"ssuspf","Suspend store");return true}
    if(k==="rpub"){rpc("review_product",{p_product:d.id,p_decision:"publish",p_note:null},"Product published");return true}
    if(k==="sreinstate"){rpc("approve_store",{p_store:d.id,p_note:"Reinstated"},"Store reinstated");return true}
    return false}
  function submit(k,f,d){
    var note=String(d.note||"").trim();
    if(k==="sappr"){rpc("approve_store",{p_store:d.id,p_note:note||null},"Store approved");return true}
    if(k==="srej"||k==="rrejf"||k==="ssuspf"){if(note.length<3){notify("Please write a short reason.","err");return true}
      if(k==="srej")rpc("reject_store",{p_store:d.id,p_reason:note},"Application rejected");
      else if(k==="rrejf")rpc("review_product",{p_product:d.id,p_decision:"reject",p_note:note},"Sent back to the seller");
      else rpc("suspend_store",{p_store:d.id,p_reason:note},"Store suspended");return true}
    return false}
  return{view:view,act:act,submit:submit}
})();
