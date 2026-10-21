/* Edit before you push. Each country has its own currency, delivery, payments, sign-in options and legal links. */
(function(){
function C(n,s,l,d,tz,auth){return{name:n,symbol:s,locale:l,dial:d,tz:tz,auth:auth,fee:0,freeFrom:0,whatsapp:"",bank:{name:"",number:"",holder:""},terms:"",privacy:""}}
window.CFG={
  name:"EverNeed",adminEmail:"",minAge:18,emailCodes:false,supabase:{url:"https://krpzbuoxozdyduszzlvb.supabase.co",key:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtycHpidW94b3pkeWR1c3p6bHZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0ODI3OTUsImV4cCI6MjEwODA1ODc5NX0.CPsQdyOpdwSGUHH0Fhx59GsHrGKAPfgp0TO5sbA3ls8"},defaultCountry:"NG",
  collections:["Groceries","Electricals","Accessories","Skincare"],
  countries:{
    NG:C("Nigeria","₦","en-NG","+234",["Africa/Lagos"],["email","phone","google","nin"]),
    GH:C("Ghana","GH₵","en-GH","+233",["Africa/Accra"],["email","phone","google"]),
    KE:C("Kenya","KSh","en-KE","+254",["Africa/Nairobi"],["email","phone","google"]),
    ZA:C("South Africa","R","en-ZA","+27",["Africa/Johannesburg"],["email","phone","google"]),
    GB:C("United Kingdom","£","en-GB","+44",["Europe/London"],["email","google"]),
    US:C("United States","$","en-US","+1",["America/New_York","America/Chicago","America/Denver","America/Los_Angeles"],["email","google"])
  }
};
})();
