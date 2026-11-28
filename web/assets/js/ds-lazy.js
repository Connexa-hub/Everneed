/* Loads heavy or preview-only screens on demand so the first load stays small. Placed where ds-editor.js used to be in index.html.
   - ds-editor.js: only when a product editor page (/portal/product/…) opens (about 8 KB gzipped).
   - ds-team.js: the team/staff PREVIEW (sample data), only with the flag ?proto=roles (remembered for the tab, ?proto=off clears it).
   - app-handoff.js + app-handoff.css: the public /shop page (WEB-M10), only when /shop opens.
   If a file cannot be loaded the normal page still opens. Files load from the same folder as this script (works under /seller/assets/). */
(function(){
  var C=window.Core;if(!C||!C.V||!C.V.portal)return;
  var me=document.currentScript&&document.currentScript.src,base=me?me.replace(/ds-lazy\.js.*$/,""):"/assets/js/",got={},pend={};
  function proto(){try{if(/[?&]proto=(1|on|roles)\b/.test(location.search))sessionStorage.setItem("ev-proto","1");if(/[?&]proto=off\b/.test(location.search))sessionStorage.removeItem("ev-proto");return sessionStorage.getItem("ev-proto")==="1"}catch(e){return false}}
  proto(); /* read the flag once at load, before the router rewrites the address */
  function load(f){
    if(got[f])return Promise.resolve();if(pend[f])return pend[f];
    return pend[f]=new Promise(function(ok,no){var s=document.createElement("script");s.src=base+f;s.onload=function(){got[f]=1;ok()};s.onerror=function(){delete pend[f];no(new Error(f))};document.head.appendChild(s)});
  }
  function need(kind,p){
    if(!p)return"";
    if(kind==="portal"){if(p[0]==="product")return"ds-editor.js";if(p[0]==="team"&&proto())return"ds-team.js"}
    if(kind==="admin"&&proto()){if(p[0]==="staff")return"ds-team.js";if(p[0]==="dispatch")return"ds-dispatch.js"}
    return"";
  }
  ["portal","admin"].forEach(function(k){
    var old=C.V[k];if(!old)return;
    C.V[k]=function(p){
      var f=need(k,p);if(!f||got[f])return old(p);
      return load(f).then(function(){return C.V[k](p)},function(){return old(p)});
    };
  });
  /* Public /shop (WEB-M10): the app handoff page and its stylesheet load only when /shop opens. If either file fails, the plain /shop page opens. */
  function loadCss(f){
    if(got[f])return Promise.resolve();if(pend[f])return pend[f];
    return pend[f]=new Promise(function(ok,no){var l=document.createElement("link");l.rel="stylesheet";l.href=base.replace(/js\/$/,"css/")+f;l.onload=function(){got[f]=1;ok()};l.onerror=function(){delete pend[f];no(new Error(f))};document.head.appendChild(l)});
  }
  var shop=C.V.shop;
  if(typeof shop==="function")C.V.shop=function(){
    var a=arguments;
    if(got["app-handoff.js"])return shop.apply(this,a);
    return Promise.all([loadCss("app-handoff.css"),load("app-handoff.js")]).then(function(){return C.V.shop.apply(null,a)},function(){return shop.apply(null,a)});
  };
  window.EVLazy={editor:function(){return load("ds-editor.js")},team:function(){return load("ds-team.js")},dispatch:function(){return load("ds-dispatch.js")}};
})();
