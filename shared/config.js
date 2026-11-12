/* Shared by the website (and later the app). Public keys are public by design; database rules protect the data.
   Two databases exist (see docs/WORKFLOW/ENVIRONMENTS.md):
     live     Everneed01          zpgasfweaixwsktlueje   real users, served from main
     staging  Everneed-staging    vjiadqygpyebpisxslbx   testing, served from preview builds
   The page picks one by its address. Anything not recognised as a preview address gets LIVE, so a custom domain
   or a new production host can never end up on staging by mistake. */
(function(){
  /* Preview-only staging switch. Production hosts (everneed.pages.dev and custom domains) remain LIVE. */
  var STAGING_READY=true;

  var LIVE={url:"https://zpgasfweaixwsktlueje.supabase.co",key:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZ2FzZndlYWl4d3NrdGx1ZWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMDE5NjQsImV4cCI6MjEwODc3Nzk2NH0.X6bf9sp2RC5q_icqcN3BUQyJVmIKF9H5pglpYeqPMZM"};
  var STAGING={url:"https://vjiadqygpyebpisxslbx.supabase.co",key:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqaWFkcXlncHllYnBpc3hzbGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0ODMzNzksImV4cCI6MjExMDA1OTM3OX0.DKdQaz5TKu5I2Le9m4Bq40h3_q9J5oYqXEn3IZZsKIU"};
  var host=(typeof location!=="undefined"&&location.hostname)||"";
  /* Only *.everneed.pages.dev previews and local development can select staging. */
  var preview=/^(localhost|127\\.0\\.0\\.1)$/.test(host)||/^[a-z0-9-]+\\.everneed\\.pages\\.dev$/.test(host);
  var env=(STAGING_READY&&preview)?"staging":"live";
  window.CFG={name:"Everneed",baseCurrency:"NGN",env:env,turnstileSitekey:"0x4AAAAAAF-beiMNGf6-z7Eq",
    supabase:env==="staging"?STAGING:LIVE,
    collections:["Groceries","Electricals","Accessories","Skincare"],
    countries:{NG:"Nigeria",GH:"Ghana",KE:"Kenya",ZA:"South Africa",GB:"United Kingdom",US:"United States"}};
  /* Make the environment impossible to miss: a small ribbon on every staging page. */
  if(env==="staging"&&typeof document!=="undefined"){
    var tag=function(){
      if(document.getElementById("env-ribbon"))return;
      var d=document.createElement("div");d.id="env-ribbon";d.textContent="STAGING: test data only";
      d.style.cssText="position:fixed;left:50%;bottom:calc(8px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:99998;padding:5px 12px;border-radius:99px;background:#f5b301;color:#1a1300;font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.04em;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.3)";
      document.body.appendChild(d);
    };
    if(document.body)tag();else document.addEventListener("DOMContentLoaded",tag);
  }
})();