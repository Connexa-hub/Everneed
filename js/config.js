/* App configuration. Test/preview builds use staging; only main release builds use live. */
(function(){
function C(n,s,l,d,tz,auth,cur){return{name:n,symbol:s,locale:l,dial:d,tz:tz,auth:auth,cur:cur,fee:0,freeFrom:0,whatsapp:"",bank:{name:"",number:"",holder:""},terms:"",privacy:""}}
var LIVE={url:"https://zpgasfweaixwsktlueje.supabase.co",key:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZ2FzZndlYWl4d3NrdGx1ZWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMDE5NjQsImV4cCI6MjEwODc3Nzk2NH0.X6bf9sp2RC5q_icqcN3BUQyJVmIKF9H5pglpYeqPMZM"};
var STAGING={url:"https://vjiadqygpyebpisxslbx.supabase.co",key:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqaWFkcXlncHllYnBpc3hzbGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0ODMzNzksImV4cCI6MjExMDA1OTM3OX0.DKdQaz5TKu5I2Le9m4Bq40h3_q9J5oYqXEn3IZZsKIU"};
/* build.js is stamped by CI before this file is loaded. Unknown/local branches fail safely to staging. */
var branch=(window.BUILD&&window.BUILD.branch)||"local",env=branch==="main"?"live":"staging";
window.CFG={
  name:"EverNeed",adminEmail:"",minAge:18,env:env,googleWebClientId:"659136945947-dlum233ke4ruu48uk9ir0bli0nvfcs60.apps.googleusercontent.com",
  ads:{enabled:false,test:true,appId:"ca-app-pub-3940256099942544~3347511713",bannerId:"ca-app-pub-3940256099942544/6300978111"},
  baseCurrency:"NGN",emailCodes:false,supabase:env==="live"?LIVE:STAGING,defaultCountry:"NG",
  collections:["Groceries","Electricals","Accessories","Skincare"],
  countries:{
    NG:C("Nigeria","₦","en-NG","+234",["Africa/Lagos"],["email","phone"],"NGN"),
    GH:C("Ghana","GH₵","en-GH","+233",["Africa/Accra"],["email","phone"],"GHS"),
    KE:C("Kenya","KSh","en-KE","+254",["Africa/Nairobi"],["email","phone"],"KES"),
    ZA:C("South Africa","R","en-ZA","+27",["Africa/Johannesburg"],["email","phone"],"ZAR"),
    GB:C("United Kingdom","£","en-GB","+44",["Europe/London"],["email"],"GBP"),
    US:C("United States","$","en-US","+1",["America/New_York","America/Chicago","America/Denver","America/Los_Angeles"],["email"],"USD")
  }
};
/* A test APK must visibly identify itself so testers do not confuse staging with live. */
if(env==="staging"&&typeof document!=="undefined"){
  var tag=function(){
    if(document.getElementById("env-ribbon"))return;
    var d=document.createElement("div");d.id="env-ribbon";d.textContent="STAGING · TEST DATA ONLY";
    d.style.cssText="position:fixed;left:50%;bottom:calc(8px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:99998;padding:5px 12px;border-radius:99px;background:#f5b301;color:#1a1300;font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.04em;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.3)";
    document.body.appendChild(d);
  };
  if(document.body)tag();else document.addEventListener("DOMContentLoaded",tag);
}
})();
