/* Boot guard. Loads first. If a script fails to load, throws a syntax error or leaves the page blank,
   this shows a readable diagnostic instead of an empty page. It has no dependencies and uses inline
   styles on purpose, so it still works when the stylesheets or other scripts are the thing that broke. */
(function(){
  var errs=[],started=false,shown=false;
  var NEED=["CFG","Ico","Art","Supa","Theme","Core","Mock","Chat"];
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function short(u){try{return String(u).replace(location.origin,"")}catch(e){return String(u)}}
  function add(kind,msg,where){errs.push({kind:kind,msg:String(msg||"Unknown error"),where:where||"",at:new Date().toISOString()});if(started)check()}
  window.addEventListener("error",function(e){
    var t=e.target;
    if(t&&t!==window&&(t.tagName==="SCRIPT"||t.tagName==="LINK")){add("load","Could not load "+short(t.src||t.href),"");return}
    add("script",e.message||"Script error",short(e.filename)+(e.lineno?":"+e.lineno+(e.colno?":"+e.colno:""):""));
  },true);
  window.addEventListener("unhandledrejection",function(e){var r=e.reason;add("promise",r&&r.message?r.message:String(r||"Unhandled promise rejection"),"")});
  function blank(){var r=document.getElementById("root");return!r||!r.children.length||!r.querySelector("main,.top,.shell,section,.w")}
  function missing(){return NEED.filter(function(n){return typeof window[n]==="undefined"})}
  function details(){
    var m=missing(),out=["Everneed web diagnostics","Page: "+location.href,"Time: "+new Date().toISOString(),"Browser: "+navigator.userAgent];
    if(m.length)out.push("Missing: "+m.join(", "));
    errs.forEach(function(x,i){out.push((i+1)+". ["+x.kind+"] "+x.msg+(x.where?" at "+x.where:""))});
    return out.join("\n");
  }
  function panel(){
    if(shown)return;shown=true;
    var m=missing(),hint="";
    if(errs.some(function(x){return x.kind==="load"}))hint="A file did not download. If you just deployed, wait a minute and reload. If it keeps happening, the build step that copies the shared files may have failed.";
    else if(errs.some(function(x){return x.kind==="script"&&/syntax|unexpected|token|identifier/i.test(x.msg)}))hint="A script has a syntax error, so the browser skipped that whole file.";
    else if(m.length)hint="A required script did not finish loading ("+m.join(", ")+").";
    else hint="The page started but nothing was drawn.";
    var d=document.createElement("div");d.id="boot-panel";d.setAttribute("role","alert");
    d.style.cssText="position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:rgba(8,12,11,.92);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#eef3f1";
    d.innerHTML='<div style="width:min(560px,100%);max-height:100%;overflow:auto;background:#121a18;border:1px solid #2a3835;border-radius:20px;padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.5)">'
      +'<div style="font-weight:700;font-size:1.25rem;margin-bottom:6px">Everneed couldn’t load this page</div>'
      +'<p style="margin:0 0 14px;color:#b6c4c0">'+esc(hint)+'</p>'
      +'<pre id="boot-d" style="margin:0 0 16px;padding:12px;border-radius:12px;background:#0a0f0e;color:#9fb3ad;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;max-height:38vh;overflow:auto">'+esc(details())+'</pre>'
      +'<div style="display:flex;gap:10px;flex-wrap:wrap"><button id="boot-r" style="flex:1 1 140px;padding:12px 18px;border-radius:99px;border:0;background:#3fd39a;color:#04140d;font:inherit;font-weight:700;cursor:pointer">Reload</button>'
      +'<button id="boot-c" style="flex:1 1 140px;padding:12px 18px;border-radius:99px;border:1px solid #3a4a46;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer">Copy details</button></div></div>';
    document.body.appendChild(d);
    document.getElementById("boot-r").onclick=function(){location.reload()};
    document.getElementById("boot-c").onclick=function(){
      var t=details(),b=this;
      function ok(){b.textContent="Copied"}
      try{navigator.clipboard.writeText(t).then(ok,function(){var p=document.getElementById("boot-d");var r=document.createRange();r.selectNodeContents(p);var s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent="Selected, press copy"})}
      catch(e){ok()}
    };
  }
  function check(){
    if(shown){var p=document.getElementById("boot-d");if(p)p.textContent=details();return}
    var m=missing(),fatal=errs.some(function(x){return x.kind==="load"||x.kind==="script"});
    if(blank()||(m.length&&errs.length)||(fatal&&blank()))panel();
  }
  window.Boot={
    errors:function(){return errs.slice()},
    details:details,
    start:function(){
      started=true;
      var m=missing();
      if(typeof window.Core==="undefined"||typeof window.Core.start!=="function"){add("script","Core did not load"+(m.length?" (missing: "+m.join(", ")+")":""),"");panel();return}
      try{window.Core.start()}catch(e){add("script",e&&e.message?e.message:String(e),"Core.start")}
      /* Give the first route time to render (it may fetch data), then make sure something is on screen. */
      setTimeout(check,2500);setTimeout(check,6000);
    }
  };
})();
