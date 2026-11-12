/* Help articles. Used by the support center, the chat widget (to answer before a person is needed) and search. */
window.KB=[
["Getting started","What is Everneed?","Everneed is a marketplace. Sellers open a store and manage it on the web or in the app. Shoppers browse, pay and track deliveries in the Everneed app."],
["Getting started","Can I shop on the website?","Not at launch. Shoppers use the Everneed app. The website is for sellers and the Everneed team."],
["Getting started","When does Everneed open in my country?","Join the early-access list and choose your country. We email you once, when your country opens."],
["Selling","How do I open a store?","Create a seller account, then complete the five-step application: store, location, delivery, payout and business details. Progress saves as you go."],
["Selling","How long does review take?","An admin reviews every store and product. If something needs changing you will see the reason in your dashboard and can resubmit."],
["Selling","What can I sell?","Groceries, electricals, accessories and skincare at launch, with more categories coming. Some products need a registration number, such as NAFDAC."],
["Delivery and orders","How does the delivery code work?","Every order has a four-digit code. The buyer shares it with the rider only when the items arrive. That confirms delivery and starts the release of your earnings."],
["Delivery and orders","Can sellers deliver themselves?","Yes. Turn on direct delivery in your store setup and list the areas you cover. Otherwise items go through the Everneed hub."],
["Payouts and plans","When do I get paid?","Earnings release after a holding period that protects buyers. Payouts are then sent to the bank account on your application."],
["Payouts and plans","What does it cost?","Stores pay a plan rental plus commission on each sale. New stores get a free trial. See the Pricing page for current plans."],
["Payouts and plans","What support do I get on my plan?","Every plan includes support. Higher plans get a faster reply target, shown on the Pricing page."],
["Safety","Is it safe to pay a seller directly?","No. Keep payment and delivery inside Everneed. Paying outside the app removes buyer protection. Everneed Shield warns you when a chat heads that way."],
["Safety","Why was a number hidden in my message?","Everneed Shield hides four-digit codes shared in chat so nobody can misuse a delivery code. Share it only when your items arrive."],
["Account","I cannot sign in.","Check your email and password. If you still cannot get in, start a chat with us and we will help."]
];
window.KBSearch=function(q,n){q=String(q||"").toLowerCase().split(/\s+/).filter(function(w){return w.length>2});if(!q.length)return[];
  return KB.map(function(a){var t=(a[1]+" "+a[2]+" "+a[0]).toLowerCase(),s=0;q.forEach(function(w){if(t.indexOf(w)>-1)s+=a[1].toLowerCase().indexOf(w)>-1?3:1});return[s,a]}).filter(function(x){return x[0]>0}).sort(function(a,b){return b[0]-a[0]}).slice(0,n||3).map(function(x){return x[1]})};
