/* Loads ds-editor.js only when the product editor page is opened (it is about 8 KB gzipped and nothing else uses it).
   Place this where ds-editor.js used to be in index.html. If the file cannot be loaded, the plain editor page still opens. */
(function(){
  var C=window.Core;if(!C||!C.V||!C.V.portal)return;
  var old=C.V.portal,done=false,q=null,me=document.currentScript&&document.currentScript.src;
  var src=me?me.replace(/ds-lazy\.js.*$/,"ds-editor.js"):"/assets/js/ds-editor.js";
  function load(){
    if(q)return q;
    q=new Promise(function(ok,no){var s=document.createElement("script");s.src=src;s.onload=function(){done=true;ok()};s.onerror=function(){q=null;no(new Error("editor"))};document.head.appendChild(s)});
    return q;
  }
  C.V.portal=function(p){
    if(done||!p||p[0]!=="product")return old(p);
    return load().then(function(){return C.V.portal(p)},function(){return old(p)});
  };
  window.EVLazy={editor:load};
})();
