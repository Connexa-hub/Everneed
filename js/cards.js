/* Card payments through the Supabase "paystack" function. Card numbers never touch this app or our database.
   Recovery rules (SHOP-01): each order has ONE idempotency key kept on this device. Every retry of the same attempt
   reuses it, so the server hands back the existing attempt instead of opening a second payment. A new key is used only
   after the server or Paystack says that attempt is over. Only the server decides "paid". */
window.Cards=(function(){
  var $=A.$,esc=A.esc,notify=A.notify,sheet=A.sheet,pend=S.get("pay",null),currentOrder=null,inflight=false;
  var X='<button class="x" data-act="close" aria-label="Close">✕</button>';
  var DEAD=["failed","cancelled","reversed"],STALE=2*864e5;
  var q=function(){return Supa.q("/rest/v1/cards?select=id,brand,last4,exp,bank&order=at.desc")};
  var nm=function(c){return(c.brand||"Card").replace(/^./,function(x){return x.toUpperCase()})+" •••• "+c.last4};
  var btn=function(act,t,prim,o){return'<button class="btn '+(prim?"":"o ")+'w" data-act="'+act+'"'+(o?' data-o="'+esc(o)+'"':"")+">"+t+"</button>"};
  var keyName=function(order){return"pay_idem_"+order};
  var isNet=function(m){return/fetch|network|load failed|timeout|offline/i.test(m)};
  function makeKey(order,fresh){
    var k=fresh?null:S.get(keyName(order),null);
    if(!k){k="enpay_"+(window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));S.set(keyName(order),k)}
    return k
  }
  function release(){inflight=false}
  function done(){
    if(!pend)return;
    var o=pend.order;S.set("pay",null);if(o)S.set(keyName(o),null);pend=null;
    A.clearCart();
    S.load().then(function(){A.refresh();sheet('<h3>Payment received</h3><p class="m">Thank you. Your order is confirmed and is being prepared.</p><button class="btn w" data-act="close">Done</button>')})
  }
  /* Shows a state we are NOT sure about, or one the server has ended. retry=true means the server/Paystack ended it. */
  function wait(order,ref,status,retry){
    pend={ref:ref,order:order,status:status||"pending",retryable:!!retry,at:Date.now()};S.set("pay",pend);
    var msg=status==="initializing"?"We are still confirming the payment session. Please do not pay twice.":
      status==="abandoned"?"The payment was not completed. You can continue it, or check again if you have just paid.":
      retry?"This payment attempt did not succeed. You can safely start another attempt.":
      "Your payment is not confirmed yet. If you have paid, check the status again.";
    sheet(X+"<h3>"+(retry?"Payment did not go through":"Confirming payment")+'</h3><p class="m">'+msg+"</p>"+
      (retry?btn("cnew","Try payment again",1,order)+btn("cchk","Check payment status"):
       status==="abandoned"?btn("cnew","Continue payment",1,order)+btn("cchk","Check payment status"):
       btn("cchk","Check payment status",1))+
      '<button class="lnk" data-act="cback">Return to cart</button>'+(ref?'<p class="m sm">Reference '+esc(ref)+". Keep it if you need help.</p>":""))
  }
  /* silent: no toasts. soft: only react to "paid" (used on app start so an old pending payment never pops a sheet). */
  function check(silent,soft){
    var p=pend;if(!p||!p.ref)return Promise.resolve(false);
    return Supa.fn("paystack",{action:"verify",reference:p.ref},silent).then(function(r){
      if(!pend||pend.ref!==p.ref)return false;
      if(r.paid){done();return true}
      if(soft)return false;
      var st=String(r.status||"").toLowerCase();
      if(DEAD.indexOf(st)>-1){wait(p.order,p.ref,st,true);if(!silent)notify("This payment attempt did not succeed. You can start another attempt.","err");return false}
      if(st==="abandoned"){wait(p.order,p.ref,st,false);return false}
      if(!silent)notify("Not confirmed yet. If you have paid, wait a moment and check again.","err");
      return false
    }).catch(function(e){if(!silent)A.netErr(e);return false})
  }
  function fallbackOpen(url){
    var w=window.open(url,"_blank");
    if(w){try{w.opener=null}catch(e){}return}
    notify("Could not open the secure checkout. Allow pop-ups, then tap Continue payment.","err")
  }
  function pop(r){
    var open=function(){
      if(r.access_code&&window.PaystackPop){new window.PaystackPop().resumeTransaction(r.access_code,{onSuccess:function(){check(false)},onCancel:function(){sheet(null);notify("Payment cancelled. Your cart is safe.");A.toCart()}});return}
      if(!r.url){wait(pend&&pend.order,pend&&pend.ref,"initializing",false);return}
      var BR=window.Capacitor&&Capacitor.getPlatform&&Capacitor.getPlatform()!=="web"&&Capacitor.Plugins&&Capacitor.Plugins.Browser;
      if(BR&&BR.open){BR.open({url:r.url}).catch(function(){fallbackOpen(r.url)});return}
      fallbackOpen(r.url)
    };
    if(window.PaystackPop||!r.access_code)return open();
    var s=document.createElement("script");s.src="https://js.paystack.co/v2/inline.js";s.onload=open;s.onerror=open;document.head.appendChild(s)
  }
  /* init: server returns {paid} | {url[,access_code],reference} (new OR reused attempt) | {status,reference,...} 202 | error. */
  function launch(order,fresh){
    if(inflight)return;inflight=true;
    var idem=makeKey(order,!!fresh),dead=pend&&pend.retryable&&pend.order===order?pend.ref:null;
    Supa.fn("paystack",{action:"init",order_id:order,idempotency_key:idem}).then(function(r){
      if(r.paid){pend={order:order};done();return}
      /* Paystack said this attempt failed but our database may not have closed it yet, so the server hands the same
         attempt back. Never reopen a dead session: tell the shopper we are still closing it. */
      if(dead&&r.reference===dead){
        sheet(X+"<h3>Still closing the previous attempt</h3><p class=\"m\">The earlier payment did not succeed and we are closing it on our side. Wait a minute, then try again. If you already paid, do not pay again.</p>"+btn("cnew","Try again",1,order)+btn("cchk","Check payment status")+btn("cback","Back to cart"));
        return
      }
      if(r.url){
        pend={ref:r.reference,order:order,attempt:r.attempt_id,status:r.status||"pending",at:Date.now()};S.set("pay",pend);
        sheet(X+'<h3>Complete your payment</h3><p class="m">Finish paying in Paystack’s secure checkout. We will confirm it automatically.</p>'+btn("cchk","I have paid — check now",1)+btn("cback","Back to cart"));
        pop(r);return
      }
      if(r.reference&&(r.status||r.verify_required)){wait(order,r.reference,r.status||"pending",false);check(true);return}
      throw new Error(r.error||"Payment session could not be started.")
    }).catch(function(e){
      var m=String(e&&e.message||e),over=/payment attempt is terminal/i.test(m);
      /* Network failure = outcome unknown: retry with the SAME key. Only a server-confirmed end gets a new key. */
      var text=over?"That payment attempt has ended. Start a new one.":isNet(m)?"We could not reach the payment service. Check your connection and try again. If you already paid, do not pay again.":(m||"Please try again.");
      sheet(X+"<h3>Payment could not start</h3><p class=\"m\">"+esc(text)+"</p>"+(over?btn("cretry","Start a new payment",1,order):btn("cnew","Try again",1,order))+btn("cback","Back to cart"))
    }).then(release,release)
  }
  function charge(order,card){
    if(inflight)return;inflight=true;
    Supa.fn("paystack",{action:"charge",order_id:order,card_id:card,idempotency_key:makeKey(order,false)}).then(function(r){
      if(r.paid){pend={order:order};done();return}
      var st=String(r.status||"").toLowerCase();
      if(DEAD.indexOf(st)>-1){S.set(keyName(order),null);/* the server recorded this attempt as failed in the same request */notify(r.message||"The payment did not go through. Try another card.","err");if(currentOrder)start(currentOrder);return}
      if(r.reference&&(r.verify_required||r.status)){wait(order,r.reference,r.status||"pending",false);check(true);return}
      notify(r.message||"The payment did not go through. Try another card.","err")
    }).catch(function(e){var m=String(e&&e.message||e);notify(isNet(m)?"We could not reach the payment service. If you already paid, do not pay again. Check your connection and try again.":m,"err")}).then(release,release)
  }
  function start(o){currentOrder=o;q().catch(function(){return[]}).then(function(l){
    sheet(X+'<h3>Pay by card</h3><p class="m">Order total '+A.fmt(o.total)+'. Paystack handles your card securely.</p>'+l.map(function(c){return'<button class="btn w" data-act="cpay" data-o="'+o.id+'" data-id="'+c.id+'">Pay with '+esc(nm(c))+"</button>"}).join("")+'<button class="btn '+(l.length?"o ":"")+'w" data-act="cnew" data-o="'+o.id+'">'+(l.length?"Use a different card or bank":"Continue to payment")+"</button>")})}
  function act(k,d){
    if(k==="cnew"){launch(d.o,false);return true}
    if(k==="cretry"){launch(d.o,true);return true}
    if(k==="cpay"){charge(d.o,d.id);return true}
    if(k==="cback"){sheet(null);A.toCart();return true}
    if(k==="cchk"){check(false);return true}
    if(k==="cdelc"){Supa.q("/rest/v1/cards?id=eq."+encodeURIComponent(d.id),"DELETE").then(fill).catch(A.netErr);return true}
    return false}
  function fill(){var b=$("#cardsbox");if(!b||!Supa.on()||!Supa.sess())return;q().then(function(l){b.innerHTML='<div class="sec"><h3>Saved cards</h3></div>'+(l.length?l.map(function(c){return'<div class="rw"><span><b>'+esc(nm(c))+"</b><small>Expires "+esc(c.exp||"")+'</small></span><button class="btn s o" data-act="cdelc" data-id="'+c.id+'">Remove</button></div>'}).join(""):'<p class="m">No saved cards. A card is saved after your first card payment, so next time you can pay in one tap.</p>')}).catch(function(){})}
  /* Return from Paystack: the page becomes visible, the app resumes, or the in-app browser closes. Ask the server. */
  function resume(soft){
    if(!pend||!pend.ref||!Supa.on()||!Supa.sess())return;
    if(pend.at&&Date.now()-pend.at>STALE){S.set("pay",null);pend=null;return}
    check(true,soft)
  }
  document.addEventListener("visibilitychange",function(){if(!document.hidden)resume(false)});
  var CAP=window.Capacitor&&Capacitor.Plugins||{};
  if(CAP.App&&CAP.App.addListener)CAP.App.addListener("appStateChange",function(s){if(s&&s.isActive)resume(false)});
  if(CAP.Browser&&CAP.Browser.addListener)CAP.Browser.addListener("browserFinished",function(){resume(false)});
  setTimeout(function(){resume(true)},2000);
  return{start:start,act:act,fill:fill};
})();
