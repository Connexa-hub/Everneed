/* Orders monitor (WEB-AD08 part 2, Claude 4). Platform admins see recent orders and their payment state, open one order, and use the two actions the backend allows.
   Loaded on demand by ds-admin-sections.js. Reads orders, seller_orders, deliveries, stores, profiles. Writes only through admin_confirm_payment(p_order) and cancel_order(p_order,p_reason), both audited by the backend.
   Safety rules, from reading private.confirm_payment_core and private.cancel_order_core on staging (25 Nov 2026):
   - confirm_payment_core marks ANY unpaid, uncancelled order paid and credits seller ledgers; it does not check the payment method. So Confirm is offered only when the payment state is awaiting_transfer or payment_reported (a bank transfer waiting for staff). Card payments are confirmed by the provider, never from here.
   - cancel_order_core cancels a paid order without starting a refund. So Cancel is offered only before payment; a paid order explains why it cannot be cancelled here.
   Both gaps are BACKEND REQUESTS in the handoff. Nothing is invented: no totals beyond the loaded rows, and no action for a state the backend does not support. */
(function(){
  var C=window.Core,D=window.DS,S=window.AdminSections;if(!C||!D||!S)return;
  var esc=C.esc,A=C.A,enc=encodeURIComponent,LIMIT=100,ARM={},ORIG={};
  var PAID=["paid","partially_refunded","refunded"],TRANSFER=["awaiting_transfer","payment_reported"],PREPAY=["awaiting_payment","awaiting_transfer","payment_reported"],DONE=["cancelled","delivered"];
  var PAY={awaiting_payment:["Awaiting payment","info","clock"],awaiting_transfer:["Awaiting bank transfer","warn","clock"],payment_reported:["Transfer reported","warn","alert"],paid:["Paid","ok","okc"],partially_refunded:["Partly refunded","warn","wallet"],refunded:["Refunded","","wallet"]};
  function soft(){return[]}
  function one(x){return Array.isArray(x)?x[0]||null:x||null}
  function has(a,v){return a.indexOf(v)>-1}
  function words(s){return String(s==null||s===""?"unknown":s).replace(/_/g," ")}
  function again(){window.dispatchEvent(new Event("hashchange"))}
  function dec(s){try{return decodeURIComponent(s)}catch(e){return s}}
  function iso(ms){var n=Number(ms);if(!n)return"";try{return new Date(n).toISOString()}catch(e){return""}}
  function when(ms){var s=iso(ms);return s?C.when(s):""}
  function ago(ms){var s=iso(ms);return s?C.ago(s):""}
  function money(o,n){var v=n==null?o.total:n;if(!o.currency||o.currency==="NGN")return C.money(v);var x=Number(v||0);try{x=x.toLocaleString()}catch(e){}return o.currency+" "+x}
  function head(sub){return'<h1 class="ds-title">Orders</h1>'+(sub?'<p class="ds-sub">'+esc(sub)+"</p>":"")}
  function back(){return'<p><a class="ds-btn s o" href="/admin/orders">All orders</a></p>'}
  function fact(v,l){return v===""||v==null?"":'<div class="ds-fact"><b>'+esc(v)+"</b><small>"+esc(l)+"</small></div>"}
  function payChip(o){var m=PAY[o.payment_status]||[words(o.payment_status),"","clock"];return D.chip(m[0],m[1],m[2])}
  function statChip(o){var s=o.status;return D.chip(words(s),s==="cancelled"||s==="disputed"?"bad":s==="delivered"?"ok":"info",s==="cancelled"?"errc":s==="delivered"?"okc":"truck")}

  /* ---- what staff may do, decided from the payment state ---- */
  function canConfirm(o){return has(TRANSFER,o.payment_status)&&!has(DONE,o.status)}
  function canCancel(o){return has(PREPAY,o.payment_status)&&!has(DONE,o.status)}
  function confirmWhy(o){
    if(has(PAID,o.payment_status))return"This order is already paid.";
    if(o.status==="cancelled")return"This order was cancelled.";
    if(o.status==="delivered")return"This order is already delivered.";
    if(o.payment_status==="awaiting_payment")return"Card payments are confirmed by the payment provider. Staff cannot confirm them here.";
    return"Staff can only confirm bank transfers, and this payment state is not one.";
  }
  function cancelWhy(o){
    if(has(PAID,o.payment_status))return"A paid order cannot be cancelled from here. The buyer's money has to be refunded first, and refunds are not available on this screen yet.";
    if(has(DONE,o.status))return"This order is already "+o.status+".";
    return"Cancelling is only available before payment, and this payment state is not one.";
  }
  function kinds(o){
    var k=["all"];
    if(o.status==="cancelled")k.push("cancelled");
    else{if(canConfirm(o))k.push("action");if(o.status==="disputed")k.push("issues");k.push(has(PAID,o.payment_status)?"paid":"unpaid")}
    return k.join(" ");
  }

  /* ---- list ---- */
  var CHIPS=[["all","All"],["action","Needs action"],["unpaid","Unpaid"],["paid","Paid"],["issues","Disputed"],["cancelled","Cancelled"]];
  function row(o,by){
    var p=by[o.user_id]||{},b=p.name||p.email||"";
    return'<div data-k="'+kinds(o)+'" data-n="'+esc((o.id+" "+b+" "+(p.email||"")).toLowerCase())+'"><a class="ds-row" href="/admin/orders/'+enc(o.id)+'"><span class="ds-ico">'+D.icon("receipt",20)+'</span><span class="ds-grow"><b>'+esc(o.id)+"</b><small>"+esc([b,ago(o.at)].filter(Boolean).join(" · "))+'</small></span><span class="ds-end">'+payChip(o)+"<b>"+esc(money(o))+"</b></span></a></div>";
  }
  function list(){
    return Supa.get("orders?select=id,user_id,total,currency,status,payment_status,at&order=at.desc&limit="+LIMIT).then(function(rows){
      rows=rows||[];
      var ids=[];rows.forEach(function(o){if(o.user_id&&ids.indexOf(o.user_id)<0)ids.push(o.user_id)});
      var prof=ids.length?Supa.get("profiles?select=id,name,email&id=in.("+ids.map(enc).join(",")+")").catch(soft):Promise.resolve([]);
      return prof.then(function(ps){
        var by={},n={};(ps||[]).forEach(function(p){by[p.id]=p});
        rows.forEach(function(o){kinds(o).split(" ").forEach(function(k){n[k]=(n[k]||0)+1})});
        var capped=rows.length>=LIMIT;
        if(!rows.length)return head()+D.empty({icon:"receipt",title:"No orders yet",text:"Orders appear here as soon as shoppers check out."});
        return head(capped?"The latest "+LIMIT+" orders.":rows.length+(rows.length===1?" order.":" orders."))
          +'<div class="ds-search">'+D.icon("search",20)+'<input type="search" data-ordq placeholder="Search the orders shown" aria-label="Search the orders shown" autocomplete="off"></div>'
          +'<div class="ds-chips ds-ordfilt" role="group" aria-label="Filter orders">'+CHIPS.map(function(c,i){return'<button type="button" class="ds-chip'+(i===0?" on":"")+'" data-act="ds-ord-f" data-id="'+c[0]+'" aria-pressed="'+(i===0?"true":"false")+'">'+c[1]+(c[0]!=="all"&&n[c[0]]?' <span class="n">'+n[c[0]]+"</span>":"")+"</button>"}).join("")+"</div>"
          +'<div class="ds-rows" id="ds-orders" style="margin-top:12px">'+rows.map(function(o){return row(o,by)}).join("")+"</div>"
          +'<p class="ds-faint" id="ds-ordnone" hidden role="status">No orders match.</p>'
          +(capped?'<p class="ds-faint" style="margin-top:12px;font-size:var(--ds-t-s)">Older orders are not shown. A searchable order directory needs a backend request (B3).</p>':"");
      });
    });
  }
  function filter(){
    var box=document.getElementById("ds-orders");if(!box)return;
    var on=document.querySelector(".ds-ordfilt .on"),k=on?on.getAttribute("data-id"):"all",inp=document.querySelector("[data-ordq]"),qv=((inp&&inp.value)||"").trim().toLowerCase(),shown=0;
    Array.prototype.forEach.call(box.children,function(c){var ok=(" "+c.getAttribute("data-k")+" ").indexOf(" "+k+" ")>-1&&(!qv||c.getAttribute("data-n").indexOf(qv)>-1);c.hidden=!ok;if(ok)shown++});
    var none=document.getElementById("ds-ordnone");if(none)none.hidden=shown>0;
  }
  A["ds-ord-f"]=function(b){Array.prototype.forEach.call(document.querySelectorAll(".ds-ordfilt .ds-chip"),function(c){var on=c===b;c.classList.toggle("on",on);c.setAttribute("aria-pressed",on?"true":"false")});filter()};
  document.addEventListener("input",function(e){var t=e.target;if(t&&t.hasAttribute&&t.hasAttribute("data-ordq"))filter()});

  /* ---- detail ---- */
  function off(label,why,n){return'<div class="ds-acts"><button type="button" class="ds-btn s o" disabled aria-disabled="true" aria-describedby="ds-why'+n+'">'+label+'</button></div><p class="ds-faint" id="ds-why'+n+'" style="font-size:var(--ds-t-s)">'+esc(why)+"</p>"}
  function actions(o){
    var id=esc(o.id),h='<div class="ds-h"><h2>Actions</h2></div>';
    h+=canConfirm(o)
      ?'<div class="ds-acts"><button type="button" class="ds-btn s" data-act="ds-ord-confirm" data-id="'+id+'">'+D.icon("check",16)+'Confirm payment received</button></div><p class="ds-faint" id="ds-ordmsg" role="status" style="font-size:var(--ds-t-s)">Only confirm once the money is in the Everneed bank account. Confirming tells the sellers to start and credits their earnings.</p>'
      :off("Confirm payment received",confirmWhy(o),1);
    h+=canCancel(o)
      ?'<div class="ds-acts"><button type="button" class="ds-btn s o d" data-act="ds-ord-cancel" data-id="'+id+'">Cancel order</button></div>'
      :off("Cancel order",cancelWhy(o),2);
    return h;
  }
  function detail(id){
    return Supa.get("orders?select=id,user_id,total,currency,pm,status,payment_status,at,paid_at,ref,payment_note,route,delivery_fee,discount,coupon,received_at&id=eq."+enc(id)).then(function(r){
      var o=one(r);
      if(!o)return head()+back()+D.empty({icon:"receipt",title:"Order not found",text:"It may have been removed, or the link is wrong."});
      return Promise.all([
        Supa.get("seller_orders?select=id,store_id,status,subtotal,released,accept_by,rejected_reason,created_at&order_id=eq."+enc(id)+"&order=created_at.asc").catch(soft),
        Supa.get("deliveries?select=id,mode,status,courier_name,dispatched_at,delivered_at,proof&order_id=eq."+enc(id)).catch(soft),
        o.user_id?Supa.get("profiles?select=id,name,email&id=eq."+enc(o.user_id)).then(one).catch(function(){return null}):Promise.resolve(null)
      ]).then(function(a){
        var sos=a[0]||[],ds=a[1]||[],pr=a[2]||{},sids=[];
        sos.forEach(function(s){if(s.store_id&&sids.indexOf(s.store_id)<0)sids.push(s.store_id)});
        var stp=sids.length?Supa.get("stores?select=id,name&id=in.("+sids.map(enc).join(",")+")").catch(soft):Promise.resolve([]);
        return stp.then(function(st){
          var nm={};(st||[]).forEach(function(s){nm[s.id]=s.name});
          return head()+back()
            +'<article class="ds-card"><div class="ds-top"><h2 class="ds-name">Order '+esc(o.id)+'</h2><div class="ds-chips">'+payChip(o)+statChip(o)+"</div></div>"
            +'<p class="ds-meta">'+esc([pr.name||pr.email,when(o.at)].filter(Boolean).join(" · "))+"</p>"
            +'<div class="ds-facts">'+fact(money(o),"Total")+(Number(o.delivery_fee)>0?fact(money(o,o.delivery_fee),"Delivery fee"):"")+(Number(o.discount)>0?fact("-"+money(o,o.discount),o.coupon?"Discount ("+o.coupon+")":"Discount"):"")+fact(o.pm?words(o.pm):"","Payment method")+fact(o.route?words(o.route):"","Delivery route")+fact(when(o.paid_at),"Paid")+fact(when(o.received_at),"Received by buyer")+"</div></article>"
            +((o.ref||o.payment_note)?'<div class="ds-h"><h2>What the buyer reported</h2><small>Typed by the buyer. Not verified.</small></div><div class="ds-facts">'+fact(o.ref,"Reference")+fact(o.payment_note,"Note")+"</div>":"")
            +actions(o)
            +'<div class="ds-h"><h2>Seller packages</h2></div>'
            +(sos.length?'<div class="ds-rows">'+sos.map(function(s){var late=s.status==="pending"&&s.released&&s.accept_by?" · accept by "+stamp(s.accept_by):"";return'<div class="ds-row"><span class="ds-grow"><b>'+esc(nm[s.store_id]||"Store")+"</b><small>"+esc(words(s.status)+late+(s.rejected_reason?" · "+s.rejected_reason:""))+'</small></span><span class="ds-end"><b>'+esc(money(o,s.subtotal))+"</b></span></div>"}).join("")+"</div>"
              :D.empty({icon:"box",title:"No seller packages",text:"None are recorded for this order."}))
            +'<div class="ds-h"><h2>Delivery</h2></div>'
            +(ds.length?'<div class="ds-rows">'+ds.map(function(d){return'<div class="ds-row"><span class="ds-grow"><b>'+esc(words(d.mode)+" delivery")+"</b><small>"+esc([words(d.status),d.courier_name,d.delivered_at?"delivered "+stamp(d.delivered_at):d.dispatched_at?"dispatched "+stamp(d.dispatched_at):""].filter(Boolean).join(" · "))+"</small></span></div>"}).join("")+"</div>"
              :D.empty({icon:"truck",title:"No delivery yet",text:"A delivery appears here once the order is dispatched."}));
        });
      });
    });
  }
  function stamp(t){return t?C.when(t):""}

  /* ---- actions ---- */
  function reset(b,id){if(ARM[id]){clearTimeout(ARM[id]);delete ARM[id]}if(ORIG[id]!=null){b.innerHTML=ORIG[id];delete ORIG[id]}b.removeAttribute("data-armed")}
  function run(b,id,fn,args,msg){
    b.setAttribute("data-busy","1");b.disabled=true;
    return Supa.rpc(fn,args).then(function(r){C.toast(r==="already"?"This order was already paid.":msg);again()}).catch(function(e){b.disabled=false;b.removeAttribute("data-busy");reset(b,id);C.toast(e&&e.message||"That did not work",true)});
  }
  /* Confirming a payment moves money rules, so it takes two deliberate taps. */
  A["ds-ord-confirm"]=function(b){
    var id=b.getAttribute("data-id");if(!id||b.getAttribute("data-busy")==="1")return;
    if(b.getAttribute("data-armed")!=="1"){
      ORIG[id]=b.innerHTML;b.setAttribute("data-armed","1");b.innerHTML="Tap again to confirm";
      var m=document.getElementById("ds-ordmsg");if(m)m.textContent="Tap again to confirm this payment is in the bank account.";
      ARM[id]=setTimeout(function(){reset(b,id)},6000);return;
    }
    if(ARM[id]){clearTimeout(ARM[id]);delete ARM[id]}
    return run(b,id,"admin_confirm_payment",{p_order:id},"Payment confirmed");
  };
  A["ds-ord-cancel"]=function(b){
    var id=b.getAttribute("data-id");if(!id||b.getAttribute("data-busy")==="1")return;
    return C.ask("Cancel this order?","Reason, kept in the audit log",true).then(function(n){if(n)return run(b,id,"cancel_order",{p_order:id,p_reason:n},"Order cancelled")});
  };

  S.register({key:"orders",render:function(p){
    return(p[0]?detail(dec(p[0])):list()).then(function(h){return{layout:"admin",active:"admin/orders",html:h,title:"Orders"}});
  }});
})();
