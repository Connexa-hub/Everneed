/* Admin disputes: queue and case detail (WEB-AD11, Claude 7). READ-ONLY.
   Loaded on demand by ds-lazy.js when an admin opens /admin/disputes. It wraps V.admin, so admin.js and ds-admin.js stay untouched.
   Reads only (the admin's own RLS applies): disputes, orders, seller_orders, stores, profiles, refunds, conversations, audit_log.
   Staging audit (25 Nov 2026): there is no function to investigate, resolve or reject a dispute and no admin UPDATE policy on disputes,
   so this page has no decision buttons. They stay hidden until a backend contract exists (backend request BR-AD11-01 in the PR handoff).
   Nothing is invented: a section that cannot be read says so, and money or status is shown only as recorded. Actions are prefixed dsp-. */
(function(){
  var C=window.Core,D=window.DS;
  if(!C||!D||!C.V||!C.V.admin)return;
  var esc=C.esc,V=C.V,A=C.A,old=V.admin,enc=encodeURIComponent;
  var CAP=200,COUNT_CAP=1000,NONE=Promise.resolve({ok:true,rows:[]}); /* a resolved read with no rows, safe to reuse */
  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var ST={open:["Open","warn","alert"],investigating:["Investigating","info","clock"],resolved:["Resolved","ok","okc"],rejected:["Rejected","","errc"]};
  var TABS=[["","Needs action","open,investigating"],["resolved","Resolved","resolved"],["rejected","Rejected","rejected"],["all","All",""]];

  function snip(s,n){s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n-1).trim()+"…":s}
  function short(id){return String(id||"").slice(0,10)}
  function words(s){return String(s||"").replace(/_/g," ")}
  function uniq(a){var seen={},o=[];a.forEach(function(x){if(x&&!seen[x]){seen[x]=1;o.push(x)}});return o}
  function by(rows,k){var m={};rows.forEach(function(r){m[r[k]]=r});return m}
  function inList(a){return"in.("+a.map(function(x){return enc('"'+String(x).replace(/"/g,"")+'"')}).join(",")+")"}
  /* A read that may fail on its own: the page still draws and says what is missing. */
  function soft(p){return Supa.get(p).then(function(r){return{ok:true,rows:Array.isArray(r)?r:[]}},function(){return{ok:false,rows:[]}})}
  function chip(s){var m=ST[s]||[words(s||"unknown"),"","dot"];return D.chip(m[0],m[1],m[2])}
  function who(p){return p?(p.name||p.email||""):""}
  function out(h,t){return{layout:"admin",active:"admin/disputes",html:h,title:t||"Disputes"}}
  function ctxBar(){return'<div class="ds-ctxbar"><button type="button" class="ds-ctx" data-act="ds-ctx" aria-haspopup="dialog">'+D.icon("globe",18)+"<span>Platform</span>"+D.icon("chevd",16)+"</button></div>"}
  function head(t,sub){return ctxBar()+'<h1 class="ds-title">'+esc(t)+"</h1>"+(sub?'<p class="ds-sub">'+esc(sub)+"</p>":"")}
  function fail(e){return D.banner("error","This page could not load",e&&e.message||"Please try again in a moment.",{label:"Try again",act:"dsp-reload"})}
  A["dsp-reload"]=function(){window.dispatchEvent(new Event("hashchange"))};

  /* ---------- queue ---------- */
  function list(tab){
    var t=TABS[0],i;for(i=0;i<TABS.length;i++)if(TABS[i][0]===tab)t=TABS[i];
    var q="disputes?select=id,order_id,seller_order_id,opened_by,reason,status,created_at,resolved_at"+(t[2]?"&status=in.("+t[2]+")":"")+"&order=created_at."+(t[0]===""?"asc":"desc")+"&limit="+CAP;
    return Promise.all([soft("disputes?select=status&limit="+COUNT_CAP),Supa.get(q)]).then(function(a){
      var c={open:0,investigating:0,resolved:0,rejected:0},capped=a[0].rows.length>=COUNT_CAP,rows=a[1]||[];
      a[0].rows.forEach(function(r){if(c[r.status]!=null)c[r.status]++});
      var n=a[0].ok?{"":c.open+c.investigating,resolved:c.resolved,rejected:c.rejected,all:a[0].rows.length}:{};
      var seg=D.seg(TABS.map(function(x){return{href:"/admin/disputes"+(x[0]?"/"+x[0]:""),label:x[1],on:x[0]===t[0],n:n[x[0]]!=null?n[x[0]]+(capped?"+":""):null}}),"Disputes");
      var sids=uniq(rows.map(function(r){return r.seller_order_id})),uids=uniq(rows.map(function(r){return r.opened_by}));
      return Promise.all([sids.length?soft("seller_orders?select=id,store_id&id="+inList(sids)):NONE,uids.length?soft("profiles?select=id,name,email&id="+inList(uids)):NONE]).then(function(b){
        var stIds=uniq(b[0].rows.map(function(x){return x.store_id}));
        return(stIds.length?soft("stores?select=id,name&id="+inList(stIds)):NONE).then(function(s){
          var so=by(b[0].rows,"id"),pr=by(b[1].rows,"id"),st=by(s.rows,"id"),partial=!(b[0].ok&&b[1].ok&&s.ok);
          var sub=t[0]===""&&rows.length?rows.length+(rows.length>=CAP?"+":"")+" waiting for a decision, oldest first":"";
          return head("Disputes",sub)+seg
            +(partial?D.banner("warning","Some details could not be loaded","Customer or store names may be missing below. The disputes themselves are shown as recorded.",null):"")
            +(rows.length?'<div class="ds-rows">'+rows.map(function(r){
              var s1=r.seller_order_id&&so[r.seller_order_id],store=s1&&st[s1.store_id];
              return D.row({icon:"alert",title:snip(r.reason,80)||"No reason given",sub:[who(pr[r.opened_by]),"Order "+short(r.order_id),store?store.name:(r.seller_order_id?"":"Whole order"),"opened "+C.ago(r.created_at)].filter(Boolean).join(" · "),href:"/admin/disputes/"+r.id,end:chip(r.status)});
            }).join("")+"</div>"+(rows.length>=CAP?'<p class="ds-faint" style="margin-top:12px;font-size:var(--ds-t-s)">Showing '+CAP+" disputes. Narrow the list with the tabs above.</p>":"")
            :D.empty({icon:t[0]===""?"okc":"alert",title:t[0]===""?"No disputes need action":"No disputes here",text:"Disputes that customers open on an order appear here."}));
        });
      });
    }).catch(function(e){return head("Disputes")+fail(e)});
  }

  /* ---------- case detail ---------- */
  function back(){return'<p><a class="ds-btn s o" href="/admin/disputes">'+D.icon("chevl",16)+"All disputes</a></p>"}
  function fact(v,l){return v==null||v===""?"":'<div class="ds-fact"><b>'+esc(v)+"</b><small>"+esc(l)+"</small></div>"}
  function detail(id){
    return Supa.get("disputes?select=*&id=eq."+enc(id)+"&limit=1").then(function(r){
      var d=r&&r[0];
      if(!d)return head("Dispute")+back()+D.empty({icon:"alert",title:"Dispute not found",text:"It may have been removed, or this account may not have access to it."});
      var ppl=uniq([d.opened_by,d.resolved_by]);
      return Promise.all([
        soft("orders?select=id,total,status,payment_status&id=eq."+enc(d.order_id)+"&limit=1"),
        d.seller_order_id?soft("seller_orders?select=id,store_id,status,subtotal&id=eq."+enc(d.seller_order_id)+"&limit=1"):NONE,
        ppl.length?soft("profiles?select=id,name,email,phone&id="+inList(ppl)):NONE,
        soft("refunds?select=id,amount,status,reason,created_at&order_id=eq."+enc(d.order_id)+"&order=created_at.desc&limit=20"),
        soft("conversations?select=id,subject,status,last_message_at&order_id=eq."+enc(d.order_id)+"&order=last_message_at.desc&limit=10"),
        soft("audit_log?select=action,at,actor_id,after&target_id=eq."+enc(d.id)+"&order=at.desc&limit=20")
      ]).then(function(a){
        var so=a[1].rows[0];
        return(so&&so.store_id?soft("stores?select=id,name&id=eq."+enc(so.store_id)+"&limit=1"):NONE).then(function(s){
          var o=a[0].rows[0],P=by(a[2].rows,"id"),store=s.rows[0],opener=P[d.opened_by],closer=P[d.resolved_by];
          var partial=[a[0],a[1],a[2],a[3],a[4],a[5],s].some(function(x){return!x.ok}),closed=d.status==="resolved"||d.status==="rejected";
          return head("Dispute","Opened "+C.ago(d.created_at))+back()
            +'<div class="ds-chips" style="margin-bottom:12px">'+chip(d.status)+"</div>"
            +(partial?D.banner("warning","Some details could not be loaded","Missing sections below could not be read from the database. The dispute itself is shown as recorded.",null):"")
            +'<div class="ds-h"><h2>What was reported</h2></div><div class="ds-card"><p class="ds-about" style="white-space:pre-wrap">'+esc(d.reason||"No reason was recorded.")+"</p></div>"
            +'<div class="ds-h"><h2>Order</h2></div><div class="ds-facts">'
              +fact(d.order_id&&"#"+short(d.order_id),"Order")+fact(who(opener),"Opened by")+fact(d.created_at&&C.when(d.created_at),"Opened")
              +(o?fact(C.money(o.total),"Order total")+fact(words(o.status),"Order status")+fact(words(o.payment_status),"Payment"):"")
              +(store?fact(store.name,"Store"):"")+(so?fact(words(so.status),"Seller package"):(d.seller_order_id?"":fact("Whole order","Scope")))
            +"</div>"
            +(closed?'<div class="ds-h"><h2>Outcome</h2></div><div class="ds-card"><p class="ds-about" style="white-space:pre-wrap">'+esc(d.resolution||"No resolution note was recorded.")+'</p><p class="ds-faint" style="font-size:var(--ds-t-s)">'+esc([chipText(d.status),who(closer),d.resolved_at?C.when(d.resolved_at):""].filter(Boolean).join(" · "))+"</p></div>":"")
            +'<div class="ds-h"><h2>Refunds on this order</h2></div>'
            +(a[3].ok?(a[3].rows.length?'<div class="ds-rows">'+a[3].rows.map(function(f){return D.row({icon:"wallet",title:C.money(f.amount),sub:[words(f.status),snip(f.reason,60)].filter(Boolean).join(" · "),end:f.created_at?"<small>"+esc(C.ago(f.created_at))+"</small>":""})}).join("")+'</div><p class="ds-faint" style="margin-top:8px;font-size:var(--ds-t-s)">Refund status is the platform record. It does not confirm that the payment provider returned the money.</p>':'<p class="ds-faint">No refunds recorded for this order.</p>'):'<p class="ds-faint">Refunds could not be read.</p>')
            +'<div class="ds-h"><h2>Conversations</h2></div>'
            +(a[4].ok?(a[4].rows.length?'<div class="ds-rows">'+a[4].rows.map(function(c){return D.row({icon:"chat",title:c.subject||"Conversation",sub:words(c.status),href:"/inbox/"+c.id})}).join("")+"</div>":'<p class="ds-faint">No conversations are linked to this order.</p>'):'<p class="ds-faint">Conversations could not be read.</p>')
            +'<div class="ds-h"><h2>History</h2></div>'
            +(a[5].ok?(a[5].rows.length?'<div class="ds-rows">'+a[5].rows.map(function(h){var af=h.after&&typeof h.after==="object"?h.after:{},why=af.reason||af.note||af.resolution||"";return D.row({icon:"clock",title:words(h.action),sub:[C.when(h.at),h.actor_id?short(h.actor_id):"system",snip(why,80)].filter(Boolean).join(" · ")})}).join("")+"</div>":'<p class="ds-faint">No recorded activity yet.</p>'):'<p class="ds-faint">History could not be read.</p>')
            +'<div class="ds-h"><h2>Decisions</h2></div>'
            +D.banner("info","Decisions are not available yet","Moving a dispute to investigating, resolving or rejecting it, and any refund that follows, need backend functions that do not exist yet. This page never changes a dispute.",null);
        });
      });
    }).catch(function(e){return head("Dispute")+back()+fail(e)});
  }
  function chipText(s){return(ST[s]||[words(s)])[0]}

  /* ---------- router ---------- */
  V.admin=function(p){
    var me=C.me();
    if(p[0]!=="disputes"||!Supa.uid()||!me||me.role!=="admin"||(C.adminCtx&&C.adminCtx()==="store"))return old(p);
    var t=p[1]||"";
    if(UUID.test(t))return detail(t).then(function(h){return out(h,"Dispute")});
    return list(t).then(function(h){return out(h,"Disputes")});
  };
})();
