/* Card payments through the Supabase "paystack" function. Card numbers never touch this app or our database. */
window.Cards=(function(){
  var $=A.$,esc=A.esc,notify=A.notify,sheet=A.sheet,pend=S.get("pay",null);
  var X='<button class="x" data-act="close" aria-label="Close">✕</button>';
  var q=function(){return Supa.q("/rest/v1/cards?select=id,brand,last4,exp,bank&order=at.desc")};
  var nm=function(c){return(c.brand||"Card").replace(/^./,function(x){return x.toUpperCase()})+" •••• "+c.last4};
  function keyName(order){return"pay_idem_"+order}
  function makeKey(order,fresh){
    var k=fresh?null:S.get(keyName(order),null);
    if(!k){k="enpay_"+(window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));S.set(keyName(order),k)}
    return k
  }
  function done(){S.set("pay",null);S.set("payorder",null);S.set(keyName(pend&&pend.order),null);pend=null;A.clearCart();S.load().then(function(){A.refresh();sheet('<h3>Payment received</h3><p class="m">Thank you. Your order is confirmed and is being prepared.</p><button class="btn w" data-act="close">Done</button>')})}
  function wait(order,ref,status,retry){
    pend={ref:ref,order:order,status:status||"pending",retryable:!!retry};S.set("pay",pend);
    sheet(X+'<h3>Confirming payment</h3><p class="m">'+(status==="initializing"?"We are still confirming the payment session. Please do not pay twice.":"Your payment is not confirmed yet. If you have paid, check the status again.")+'</p><button class="btn w" data-act="cchk">Check payment status</button>'+(retry?'<button class="btn o w" data-act="cretry" data-o="'+esc(order)+'">Try payment again</button>':'')+'<button class="lnk" data-act="cback">Return to cart</button>')
  }
  function check(silent){
    if(!pend||!pend.ref)return Promise.resolve(false);
    return Supa.fn("paystack",{action:"verify",reference:pend.ref}).then(function(r){
      if(r.paid){done();return true}
      var st=String(r.status||"").toLowerCase();
      if(["failed","abandoned","cancelled"].indexOf(st)>=0){wait(pend.order,pend.ref,st,true);if(!silent)notify("This payment attempt did not succeed. You can safely start another attempt.","err");return false}
      if(!silent)notify("Not confirmed yet. If you have paid, wait a moment and check again.","err");
      return false
    }).catch(function(e){if(!silent)A.netErr(e);return false})
  }
  function launch(order,fresh){
    if(fresh)makeKey(order,true);
    var idem=makeKey(order,false);
    Supa.fn("paystack",{action:"init",order_id:order,idempotency_key:idem}).then(function(r){
      if(r.paid){pend={order:order};done();return}
      if(r.url&&r.access_code){
        pend={ref:r.reference,order:order,attempt:r.attempt_id,status:r.status||"pending"};S.set("pay",pend);
        sheet(X+'<h3>Complete your payment</h3><p class="m">Finish paying in Paystack’s secure checkout. We will confirm automatically.</p><button class="btn w" data-act="cchk">I have paid — check now</button><button class="btn o w" data-act="cback">Back to cart</button>');
        pop(r);return
      }
      if(r.reference&&(r.status||r.verify_required)){wait(order,r.reference,r.status||"initializing",false);check(true);return}
      throw new Error(r.error||"Payment session could not be started.")
    }).catch(function(e){pend={order:order,retryable:true};S.set("pay",pend);sheet(X+'<h3>Payment could not start</h3><p class="m">'+esc(e.message||"Please try again.")+'</p><button class="btn w" data-act="cretry" data-o="'+esc(order)+'">Try again</button><button class="btn o w" data-act="cback">Back to cart</button>')})
  }
  function start(o){q().catch(function(){return[]}).then(function(l){
    sheet(X+'<h3>Pay by card</h3><p class="m">Order total '+A.fmt(o.total)+'. Paystack handles your card securely.</p>'+l.map(function(c){return'<button class="btn w" data-act="cpay" data-o="'+o.id+'" data-id="'+c.id+'">Pay with '+esc(nm(c))+"</button>"}).join("")+'<button class="btn '+(l.length?"o ":"")+'w" data-act="cnew" data-o="'+o.id+'">'+(l.length?"Use a different card or bank":"Continue to payment")+"</button>")})}
  function pop(r){
    var go=function(){if(r.access_code&&window.PaystackPop){new window.PaystackPop().resumeTransaction(r.access_code,{onSuccess:function(){check(false)},onCancel:function(){sheet(null);notify("Payment cancelled. Your cart is safe.");A.toCart()}});return}if(r.url){var w=window.open(r.url,"_blank","noopener");if(!w)notify("Open the secure Paystack checkout link from your browser's popup notice.","err");return}wait(pend.order,pend.ref,"initializing",false)};
    if(window.PaystackPop)return go();
    if(r.access_code){var s=document.createElement("script");s.src="https://js.paystack.co/v2/inline.js";s.onload=go;s.onerror=function(){go()};document.head.appendChild(s);return}
    go()
  }
  function act(k,d){
    if(k==="cnew"){launch(d.o,false);return true}
    if(k==="cretry"){launch(d.o,true);return true}
    if(k==="cpay"){Supa.fn("paystack",{action:"charge",order_id:d.o,card_id:d.id}).then(function(r){if(r.paid){pend={order:d.o};done()}else if(r.reference&&(r.verify_required||r.status)){wait(d.o,r.reference,r.status||"pending",false);check(true)}else{notify(r.message||"The payment did not go through. Try again.","err");start({id:d.o,total:(S.orders().filter(function(x){return x.id===d.o})[0]||{}).total})}}).catch(function(e){A.netErr(e)});return true}
    if(k==="cback"){sheet(null);A.toCart();return true}
    if(k==="cchk"){check(false);return true}
    if(k==="cdelc"){Supa.q("/rest/v1/cards?id=eq."+encodeURIComponent(d.id),"DELETE").then(fill).catch(A.netErr);return true}
    return false
  }
  function fill(){var b=$("#cardsbox");if(!b||!Supa.on()||!Supa.sess())return;q().then(function(l){b.innerHTML='<div class="sec"><h3>Saved cards</h3></div>'+(l.length?l.map(function(c){return'<div class="rw"><span><b>'+esc(nm(c))+"</b><small>Expires "+esc(c.exp||"")+'</small></span><button class="btn s o" data-act="cdelc" data-id="'+c.id+'">Remove</button></div>'}).join(""):'<p class="m">No saved cards. A card is saved after your first card payment, so next time you can pay in one tap.</p>')}).catch(function(){})}
  document.addEventListener("visibilitychange",function(){if(!document.hidden&&pend&&pend.ref)check(true)});
  return{start:start,act:act,fill:fill};
})();
