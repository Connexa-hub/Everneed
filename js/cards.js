/* Card payments through the Supabase "paystack" function. Card numbers never touch this app or our database. */
window.Cards=(function(){
  var $=A.$,esc=A.esc,notify=A.notify,sheet=A.sheet,pend=S.get("pay",null);
  var X='<button class="x" data-act="close" aria-label="Close">✕</button>';
  var q=function(){return Supa.q("/rest/v1/cards?select=id,brand,last4,exp,bank&order=at.desc")};
  var nm=function(c){return(c.brand||"Card").replace(/^./,function(x){return x.toUpperCase()})+" •••• "+c.last4};
  function done(){S.set("pay",null);pend=null;S.load().then(function(){A.refresh();sheet('<h3>Payment received</h3><p class="m">Thank you. Your order is confirmed and is being prepared.</p><button class="btn w" data-act="close">Done</button>')})}
  function check(silent){if(!pend)return;Supa.fn("paystack",{action:"verify",reference:pend.ref}).then(function(r){if(r.paid)done();else if(!silent)notify("Not confirmed yet. If you have paid, wait a moment and check again.","err")}).catch(function(e){if(!silent)A.netErr(e)})}
  function start(o){q().catch(function(){return[]}).then(function(l){
    sheet(X+'<h3>Pay by card</h3><p class="m">Order total '+A.fmt(o.total)+'. Paystack handles your card securely.</p>'+l.map(function(c){return'<button class="btn w" data-act="cpay" data-o="'+o.id+'" data-id="'+c.id+'">Pay with '+esc(nm(c))+"</button>"}).join("")+'<button class="btn '+(l.length?"o ":"")+'w" data-act="cnew" data-o="'+o.id+'">'+(l.length?"Use a different card or bank":"Continue to payment")+"</button>")})}
  function pop(r){var go=function(){new window.PaystackPop().resumeTransaction(r.access_code,{onSuccess:function(){check(false)},onCancel:function(){notify("Payment cancelled.")}})};
    if(window.PaystackPop)return go();var s=document.createElement("script");s.src="https://js.paystack.co/v2/inline.js";s.onload=go;s.onerror=function(){window.open(r.url,"_blank")};document.head.appendChild(s)}
  function act(k,d){
    if(k==="cnew"){Supa.fn("paystack",{action:"init",order_id:d.o}).then(function(r){if(r.paid){done();return}pend={ref:r.reference,order:d.o};S.set("pay",pend);sheet(X+'<h3>Complete your payment</h3><p class="m">Finish paying in the secure window. We confirm it automatically.</p><button class="btn w" data-act="cchk">I have paid, check now</button>');pop(r)}).catch(A.netErr);return true}
    if(k==="cpay"){Supa.fn("paystack",{action:"charge",order_id:d.o,card_id:d.id}).then(function(r){if(r.paid)done();else notify(r.message||"The payment did not go through. Try another card.","err")}).catch(A.netErr);return true}
    if(k==="cchk"){check(false);return true}
    if(k==="cdelc"){Supa.q("/rest/v1/cards?id=eq."+encodeURIComponent(d.id),"DELETE").then(fill).catch(A.netErr);return true}
    return false}
  function fill(){var b=$("#cardsbox");if(!b||!Supa.on()||!Supa.sess())return;q().then(function(l){b.innerHTML='<div class="sec"><h3>Saved cards</h3></div>'+(l.length?l.map(function(c){return'<div class="rw"><span><b>'+esc(nm(c))+"</b><small>Expires "+esc(c.exp||"")+'</small></span><button class="btn s o" data-act="cdelc" data-id="'+c.id+'">Remove</button></div>'}).join(""):'<p class="m">No saved cards. A card is saved after your first card payment, so next time you can pay in one tap.</p>')}).catch(function(){})}
  document.addEventListener("visibilitychange",function(){if(!document.hidden&&pend)check(true)});
  return{start:start,act:act,fill:fill};
})();
