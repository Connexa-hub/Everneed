/* Payment providers. Each provider: {id,label,note,on(),run(order)} and optionally
   tokenize(), charge(token,amount) for saved cards. Stage 3 registers Paystack here:
   it tokenizes the card (we never see card numbers), stores only the provider's
   authorization token, and charge() bills it later from the server. */
window.Pay=(function(){
  var reg={},m=function(n){return Ctx.money(n)};
  function add(p){reg[p.id]=p}
  add({id:"bank",label:"Bank transfer",note:"Pay to our account, then confirm",
    on:function(){return!!(Ctx.get().bank&&Ctx.get().bank.number)},
    run:function(o){return{status:"awaiting_transfer",lines:["Bank: "+Ctx.get().bank.name,"Account number: "+Ctx.get().bank.number,"Account name: "+Ctx.get().bank.holder,"Amount: "+m(o.total),"Use reference "+o.id.toUpperCase()+" as the narration."]}}});
  add({id:"whatsapp",label:"Order on WhatsApp",note:"Confirm and pay with us in chat",
    on:function(){return!!Ctx.get().whatsapp},
    run:function(o){var t="New "+CFG.name+" order "+o.id.toUpperCase()+"\n\n"+o.items.map(function(i){return i.qty+" x "+i.name+" - "+m(i.price*i.qty)}).join("\n")+"\n\nTotal: "+m(o.total)+"\nName: "+o.cust.name+"\nPhone: "+o.cust.phone+"\nAddress: "+o.cust.addr;
      return{status:"sent",lines:["Tap the button to send your order."],url:"https://wa.me/"+Ctx.get().whatsapp+"?text="+encodeURIComponent(t)}}});
  add({id:"card",label:"Card, bank or USSD",note:"Secure checkout by Paystack",on:function(){return Supa.on()&&!!Ctx.get().paystack},run:function(){return{status:"awaiting_payment",lines:[]}}});
  return{register:add,methods:function(){return Object.keys(reg).map(function(k){return reg[k]})},run:function(id,o){return reg[id].run(o)}};
})();
