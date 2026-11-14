/* How it works: one page, two journeys. Shoppers go to the app; sellers learn the path. Opening a store is never required to have an account. */
(function(){
  var C=Core,V=C.V,esc=C.esc;
  var SHOP=[
    ["Create your account","One Everneed account works on the website and in the app. You do not need to sell anything to have one."],
    ["Get the app","Browse independent stores, compare products, pay securely and track every order in the Everneed mobile app."],
    ["Confirm with a code","Every delivery has a four-digit code. Share it only when your items arrive, and the order is complete."]
  ];
  var SELL=[
    ["Use the same account","Sellers are Everneed customers too. There is no second account to create."],
    ["Apply for a store","Tell us about your store, where you are and how you deliver. The Everneed team reviews it."],
    ["Verify and go live","Complete the checks required for your country. Approved products then go live for shoppers."],
    ["Run your store","Manage products, orders and earnings from your seller workspace, on the website or in the app."]
  ];
  function steps(list){return'<ol class="steps">'+list.map(function(s){return"<li><div><b>"+esc(s[0])+"</b><br><small>"+esc(s[1])+"</small></div></li>"}).join("")+"</ol>"}
  V["how-it-works"]=function(){
    return{layout:"pub",active:"how-it-works",title:"How it works",html:
      '<section class="sec"><div class="w"><span class="pillx"><i></i>How Everneed works</span><h1 style="margin-top:18px;max-width:20ch">One account. Two ways to use Everneed.</h1>'
      +'<p class="lead" style="max-width:60ch">Everneed is a marketplace of independent stores. Shoppers use the mobile app. Sellers run their stores with the same account.</p>'
      +'<div class="g2" style="margin-top:28px"><div class="card"><h3>If you want to shop</h3>'+steps(SHOP)+'<div class="row" style="margin-top:18px"><a class="btn" href="/shop">Get the app</a><a class="btn o" href="/create-account">Create account</a></div></div>'
      +'<div class="card"><h3>If you want to sell</h3>'+steps(SELL)+'<div class="row" style="margin-top:18px"><a class="btn" href="/sell">For sellers</a><a class="btn o" href="/pricing">See plans</a></div></div></div></div></section>'};
  };
})();
