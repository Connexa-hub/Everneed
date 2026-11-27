/* Admin section registry (WEB-AD08 part 1, Claude 4). Lets several people add admin pages in their own files without editing ds-admin.js or admin.js.
   To add a section: (1) write web/assets/js/ds-admin-<name>.js; it ends with AdminSections.register({key:"<name>",render:function(p){...}});
   (2) add ONE line to SECTIONS below. The file loads the first time someone opens /admin/<key>, so it adds nothing to the first load.
   render(p) gets the path segments after /admin/<key> and returns what V.admin returns ({layout:"admin",active:"admin/<key>",html,title}), a promise of it, or {redirect:"/..."}.
   Rules: platform workspace only (the Everneed Store workspace never shows these), signed-in admins only, and nothing here writes to the database.
   A file that fails to load, or a render that throws, shows a "Try again" page for that section; it never shows a different page in its place.
   nav:true adds a tab to the platform navigation (phone tab bar and desktop rail). Keep that to what fits on a 360 px bar; nav:false sections are reached by link. */
(function(){
  var C=window.Core;if(!C||!C.V||!C.V.admin)return;
  var cs=document.currentScript&&document.currentScript.src,base=cs?cs.replace(/ds-admin-sections\.js.*$/,""):"/assets/js/",SEC={},got={},pend={};
  /* One line per section. */
  var SECTIONS=[
    {key:"orders",title:"Orders",label:"Orders",icon:"receipt",nav:true,src:"ds-admin-orders.js"}
  ];
  /* Routes that admin.js or ds-admin.js already own. */
  var RESERVED=["appearance","applications","sellers","stores","review","store","waitlist","staff","dispatch"];
  function load(f){
    if(got[f])return Promise.resolve();if(pend[f])return pend[f];
    return pend[f]=new Promise(function(ok,no){var s=document.createElement("script");s.src=base+f;s.onload=function(){got[f]=1;ok()};s.onerror=function(){delete pend[f];no(new Error("The "+f+" file could not be loaded."))};document.head.appendChild(s)});
  }
  function reg(def){
    if(!def||!/^[a-z][a-z0-9-]*$/.test(def.key||"")||RESERVED.indexOf(def.key)>-1)return false;
    var s=SEC[def.key]||(SEC[def.key]={key:def.key});
    ["title","label","icon","nav","src"].forEach(function(k){if(def[k]!==undefined)s[k]=def[k]});
    if(typeof def.render==="function")s.render=def.render;
    var nav=C.adminNav&&C.adminNav.platform;
    if(s.nav&&!s.navDone&&nav){
      s.navDone=true;var item=["admin/"+s.key,s.label||s.title||s.key,s.icon||"clip","/admin/"+s.key];
      if(!nav.some(function(n){return n[0]===item[0]}))nav.splice(Math.max(nav.length-1,0),0,item);
    }
    return true;
  }
  function page(s,html){return{layout:"admin",active:"admin/"+s.key,html:html,title:s.title||"Admin"}}
  function failed(s,e){
    var D=window.DS,m=e&&e.message?e.message:"Please try again in a moment.";
    return page(s,'<h1 class="ds-title">'+C.esc(s.title||"Admin")+"</h1>"+(D&&D.banner?D.banner("error","This page could not load",m,{label:"Try again",act:"ds-sec-reload"}):'<p class="m">This page could not load. '+C.esc(m)+"</p>"));
  }
  function run(s,p){return Promise.resolve().then(function(){return s.render(p.slice(1))}).catch(function(e){return failed(s,e)})}
  C.A["ds-sec-reload"]=function(){window.dispatchEvent(new Event("hashchange"))};
  var prev=C.V.admin;
  C.V.admin=function(p){
    p=p||[];var s=SEC[p[0]],u=C.me&&C.me();
    if(!s||!Supa.uid()||!u||u.role!=="admin"||(C.adminCtx&&C.adminCtx()==="store"))return prev(p);
    if(s.render)return run(s,p);
    if(!s.src)return Promise.resolve(failed(s,new Error("This section has no page yet.")));
    return load(s.src).then(function(){return s.render?run(s,p):failed(s,new Error("The page did not register itself."))},function(e){return failed(s,e)});
  };
  window.AdminSections={register:reg,list:function(){return Object.keys(SEC)}};
  SECTIONS.forEach(reg);
})();
