/* Everneed design system runtime (window.DS). Loads after appshell.js and before every screen that uses it.
   Dependency free. Provides: icon sprite, category art, toast, banner, sheet, confirm, action sheet, picker, segmented tabs,
   skeleton, empty state, gate, stat, row, ring, avatar, plan badge, and motion (stagger, count-up, view transitions).
   Existing screens are upgraded without edits: native <select> becomes a sheet picker, .tabs and .so-tabs become scroll-snap
   controls with edge fades, Core.toast and Core.ask use the new feedback system, Core.empty draws an illustrated empty state.
   Motion is transform and opacity only and is switched off by prefers-reduced-motion. See docs/PRODUCT/DESIGN_SYSTEM.md. */
(function(){
  var C=window.Core,doc=document,html=doc.documentElement;
  var esc=C&&C.esc?C.esc:function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
  var DS={};
  function rm(){try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}}
  function fine(){try{return matchMedia("(pointer:fine)").matches}catch(e){return false}}
  function wide(){try{return matchMedia("(min-width:720px)").matches}catch(e){return false}}
  function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||"null");localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}}
  DS.rm=rm;
  /* money for tiles: full value under a million, compact (2.45M) from a million, so a number never clips on a 360px phone */
  DS.money=function(n){n=Number(n)||0;if(n>=1e6&&C&&C.money){var m=n/1e6,t=(Math.round(m*100)/100).toString();return C.money(0).replace(/[\d.,\s]+$/,"").replace(/0+$/,"")+t+"M"}return C&&C.money?C.money(n):String(n)};

  /* ---------- icons: one 24 grid line set, 1.8 stroke. Extends the shared set (shared/icons.js). ---------- */
  var X={
    plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',dot:'<circle cx="12" cy="12" r="3"/>',
    alert:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    okc:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',errc:'<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    chevr:'<path d="M9 6l6 6-6 6"/>',chevl:'<path d="M15 6l-6 6 6 6"/>',chevu:'<path d="M6 15l6-6 6 6"/>',
    filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',sort:'<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',download:'<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    star:'<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.8l-5.2 2.9 1-5.9L3.5 9.7l5.9-.8z"/>',
    layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    list:'<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    undo:'<path d="M9 7L4 12l5 5"/><path d="M4 12h9a4.5 4.5 0 0 1 0 9H9"/>',
    flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
    wallet:'<path d="M4 7a2 2 0 0 1 2-2h11v4"/><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M16 13.5h2"/>',
    box:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    chat:'<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
    bell:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    chart:'<path d="M5 20V11M12 20V4M19 20v-6"/>',clip:'<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9.5 13l2 2 3.5-4"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    percent:'<path d="M5 19L19 5"/><circle cx="7" cy="7" r="2.3"/><circle cx="17" cy="17" r="2.3"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5"/>',
    swap:'<path d="M7 7h11l-3-3M17 17H6l3 3"/>',crown:'<path d="M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z"/>',
    briefcase:'<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    headset:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/>',
    inbox:'<path d="M4 13l2-8h12l2 8v6H4z"/><path d="M4 13h5a3 3 0 0 0 6 0h5"/>',
    grid:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>'
  };
  var IC={},base=(window.Ico&&window.Ico.IC)||{},k;
  for(k in base)IC[k]=base[k];for(k in X)IC[k]=X[k];
  DS.IC=IC;
  function mountSprite(){
    if(!doc.body||doc.getElementById("dsi-sprite"))return;
    doc.body.insertAdjacentHTML("afterbegin",'<svg id="dsi-sprite" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>'+Object.keys(IC).map(function(n){return'<symbol id="dsi-'+n+'" viewBox="0 0 24 24">'+IC[n]+"</symbol>"}).join("")+"</defs></svg>");
  }
  DS.icon=function(n,s,c){s=s||20;return'<svg class="dsi'+(c?" "+c:"")+'" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false"><use href="#dsi-'+(IC[n]?n:"dot")+'"/></svg>'};
  /* duotone for large empty states: soft tile plus the icon */
  DS.duo=function(n,s){return'<span class="ds-duo" aria-hidden="true">'+DS.icon(n,s||44)+"</span>"};

  /* ---------- original category art: 64 grid, transparent, theme coloured (a soft fill, b line, c accent) ---------- */
  var ART={
    apparel:'<path class="a" d="M22 9L8 17l5 9 7-3.5V55h24V22.5L51 26l5-9-14-8c-1.6 3.6-5.4 5.6-10 5.6S23.6 12.6 22 9z"/><circle class="c" cx="32" cy="38" r="4.5"/>',
    shoes:'<path class="a" d="M6 40c0-5 3-8 8-8l6-12c5 6 12 8 20 9 6 1 10 4 10 11v4H6z"/><path class="b" d="M6 45h48M24 28l3 5M31 30l3 5"/>',
    bags:'<path class="a" d="M12 24h40l3 30H9z"/><path class="b" d="M22 24v-6a10 10 0 0 1 20 0v6"/><circle class="c" cx="32" cy="38" r="3.5"/>',
    phones:'<rect class="a" x="19" y="6" width="26" height="52" rx="6"/><path class="b" d="M28 11h8M29 52h6"/><circle class="c" cx="32" cy="30" r="6"/>',
    computers:'<rect class="a" x="12" y="12" width="40" height="28" rx="4"/><path class="b" d="M6 48h52l-4 4H10z"/><circle class="c" cx="32" cy="26" r="4"/>',
    audio:'<path class="b" d="M10 38v-6a22 22 0 0 1 44 0v6"/><rect class="a" x="8" y="36" width="12" height="18" rx="5"/><rect class="a" x="44" y="36" width="12" height="18" rx="5"/><circle class="c" cx="32" cy="48" r="4"/>',
    home:'<path class="a" d="M10 30a6 6 0 0 1 6-6h32a6 6 0 0 1 6 6v14H10z"/><path class="b" d="M6 36a4 4 0 0 1 8 0v8M50 36a4 4 0 0 1 8 0v8M12 44h40v6H12zM18 50v4M46 50v4"/>',
    kitchen:'<path class="a" d="M12 26h40v18a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10z"/><path class="b" d="M6 30h6M52 30h6M26 18c-2-3 2-5 0-8M38 18c-2-3 2-5 0-8"/>',
    beauty:'<rect class="a" x="22" y="30" width="20" height="24" rx="4"/><path class="c" d="M27 30V12l10 6v12z"/>',
    hair:'<path class="a" d="M12 34c0-14 8-24 20-24s20 10 20 24c0 8-2 16-6 22-2-8-6-12-14-14-8 2-12 6-14 14-4-6-6-14-6-22z"/><path class="b" d="M20 22c6 2 12 2 18-2"/>',
    health:'<path class="a" d="M32 54S8 40 8 24a12 12 0 0 1 24-3 12 12 0 0 1 24 3c0 16-24 30-24 30z"/><path class="b" d="M32 24v14M25 31h14"/>',
    grocery:'<path class="a" d="M10 28h44l-5 26H15z"/><path class="b" d="M20 28l8-14M44 28l-8-14"/><circle class="c" cx="32" cy="40" r="5"/>',
    food:'<path class="a" d="M8 28h48a24 24 0 0 1-48 0z"/><path class="b" d="M22 56h20M24 20c-2-3 2-5 0-8M34 20c-2-3 2-5 0-8M44 20c-2-3 2-5 0-8"/>',
    baby:'<rect class="a" x="22" y="22" width="20" height="32" rx="7"/><path class="b" d="M26 22v-5h12v5M29 14c0-4 6-4 6 0M22 34h20"/>',
    toys:'<rect class="a" x="8" y="32" width="22" height="22" rx="3"/><rect class="a" x="34" y="32" width="22" height="22" rx="3"/><rect class="c" x="21" y="10" width="22" height="22" rx="3"/>',
    sports:'<circle class="a" cx="32" cy="32" r="22"/><path class="b" d="M10 32h44M32 10c-8 8-8 36 0 44M32 10c8 8 8 36 0 44"/>',
    auto:'<path class="a" d="M8 38l5-14a6 6 0 0 1 5.6-4h26.8a6 6 0 0 1 5.6 4l5 14v10H8z"/><circle class="c" cx="19" cy="48" r="5"/><circle class="c" cx="45" cy="48" r="5"/><path class="b" d="M14 36h36"/>',
    tools:'<path class="a" d="M42 8a12 12 0 0 0-10 16L10 46a5 5 0 0 0 7 7l22-22a12 12 0 0 0 16-10l-8 5-6-2-2-6z"/>',
    books:'<rect class="a" x="10" y="10" width="14" height="44" rx="3"/><rect class="c" x="26" y="14" width="14" height="40" rx="3"/><path class="a" d="M42 16l12-3 8 38-12 3z"/>',
    office:'<path class="a" d="M12 52l3-12L44 10l10 10L24 49z"/><path class="b" d="M38 16l10 10M12 52l12-3"/>',
    pets:'<ellipse class="a" cx="32" cy="42" rx="12" ry="10"/><circle class="c" cx="16" cy="28" r="5"/><circle class="c" cx="27" cy="18" r="5"/><circle class="c" cx="39" cy="18" r="5"/><circle class="c" cx="49" cy="28" r="5"/>',
    jewellery:'<circle class="a" cx="32" cy="38" r="16"/><circle class="b" cx="32" cy="38" r="9"/><path class="c" d="M24 16l4-6h8l4 6-8 8z"/>',
    art:'<path class="a" d="M32 8a24 24 0 1 0 0 48c4 0 5-3 3.5-6-1.5-3.4.5-6 4.2-6H46a10 10 0 0 0 10-10C56 18 46 8 32 8z"/><circle class="c" cx="20" cy="30" r="3.5"/><circle class="c" cx="28" cy="19" r="3.5"/><circle class="c" cx="41" cy="20" r="3.5"/>',
    garden:'<path class="a" d="M18 40h28l-4 16H22z"/><path class="b" d="M32 40V22M32 30c-8 0-12-6-12-12 8 0 12 4 12 12zM32 26c0-8 5-12 12-12 0 8-5 12-12 12z"/>',
    other:'<path class="a" d="M32 8l22 12v24L32 56 10 44V20z"/><path class="b" d="M10 20l22 12 22-12M32 32v24"/>'
  };
  DS.ART=ART;
  DS.art=function(key,s){s=s||48;return'<svg class="ds-art" viewBox="0 0 64 64" width="'+s+'" height="'+s+'" fill="none" aria-hidden="true" focusable="false">'+(ART[key]||ART.other)+"</svg>"};
  var AF=[[/jewel|accessor|ring|watch/i,"jewellery"],[/\bauto|\bcars?\b|vehicle|motor/i,"auto"],[/baby|kid|child|infant/i,"baby"],[/bag|luggage/i,"bags"],[/hair|wig/i,"hair"],
    [/beauty|skin|cosmetic|personal care/i,"beauty"],[/book|station|school/i,"books"],[/tool|build|hardware/i,"tools"],[/computer|laptop|pc\b/i,"computers"],[/phone|tablet|mobile/i,"phones"],
    [/electronic|audio|headphone|speaker/i,"audio"],[/fashion|cloth|apparel|wear|dress/i,"apparel"],[/shoe|sneaker|footwear/i,"shoes"],[/food|drink|beverage|snack|meal/i,"food"],
    [/grocer|supermarket/i,"grocery"],[/kitchen|cook/i,"kitchen"],[/furniture|sofa|living|home|decor/i,"home"],[/office|supply|business/i,"office"],[/pet|dog|cat/i,"pets"],
    [/sport|fitness|gym/i,"sports"],[/toy|game/i,"toys"],[/health|medical|pharma|well/i,"health"],[/garden|plant|outdoor/i,"garden"],[/art|craft|paint/i,"art"]];
  DS.artFor=function(name){var n=String(name||"");for(var i=0;i<AF.length;i++)if(AF[i][0].test(n))return AF[i][1];return"other"};

  /* ---------- small builders ---------- */
  DS.chip=function(label,tone,icon,n){return'<span class="ds-chip'+(tone?" "+tone:"")+'">'+(icon?DS.icon(icon,14):"")+esc(label)+(n!=null?' <span class="n">'+esc(n)+"</span>":"")+"</span>"};
  DS.plan=function(name,official){var k=official?"official":String(name||"").toLowerCase().replace(/[^a-z]/g,"");return'<span class="ds-plan '+(k==="free"||k===""?"":k)+'">'+esc(official?"Official":(name||"No plan"))+"</span>"};
  DS.avatar=function(name,photo,s){var ini=(String(name||"?").trim().charAt(0)||"?").toUpperCase();return'<span class="ds-av"'+(s?' style="width:'+s+"px;height:"+s+'px"':"")+">"+(photo?'<img alt="" loading="lazy" src="'+esc(photo)+'">':esc(ini))+"</span>"};
  DS.avatars=function(list,max){max=max||3;list=list||[];var shown=list.slice(0,max).map(function(p){return DS.avatar(p.name,p.photo)}).join(""),more=list.length-max;
    return'<span class="ds-avs">'+shown+(more>0?'<span class="ds-av">+'+more+"</span>":"")+"</span>"};
  DS.ring=function(pct,tone,label){pct=Math.max(0,Math.min(100,Math.round(pct||0)));var c=113.1;
    return'<span class="ds-ring'+(tone?" "+tone:"")+'" role="img" aria-label="'+esc(label||pct+"%")+'"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="t" cx="22" cy="22" r="18" fill="none" stroke-width="4"/><circle class="v" cx="22" cy="22" r="18" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+(c*(1-pct/100)).toFixed(1)+'"/></svg><span>'+pct+"</span></span>"};
  DS.stat=function(o){var tag=o.href?"a":"div",cnt=typeof o.value==="number"?' data-count="'+o.value+'"'+(o.money?' data-fmt="money"':""):"",txt=typeof o.value==="number"?(o.money?DS.money(o.value):String(o.value)):esc(o.value);
    return"<"+tag+' class="ds-stat'+(o.tone?" "+o.tone:"")+(o.href?" ds-press":"")+'"'+(o.href?' href="'+esc(o.href)+'"':"")+">"+(o.icon?'<span class="ds-ico">'+DS.icon(o.icon,18)+"</span>":"")+"<b"+cnt+(o.money?' title="'+esc(C&&C.money?C.money(o.value):o.value)+'"':"")+">"+txt+"</b><small>"+esc(o.label)+"</small></"+tag+">"};
  DS.row=function(o){var tag=o.href?"a":(o.act?"button":"div");return"<"+tag+' class="ds-row'+(o.tone?" "+o.tone:"")+'"'+(o.href?' href="'+esc(o.href)+'"':"")+(o.act?' type="button" data-act="'+esc(o.act)+'"'+(o.id?' data-id="'+esc(o.id)+'"':""):"")+">"
    +(o.icon?'<span class="ds-ico">'+DS.icon(o.icon,20)+"</span>":"")+'<span class="ds-grow"><b>'+esc(o.title)+"</b>"+(o.sub?"<small>"+esc(o.sub)+"</small>":"")+'</span><span class="ds-end">'+(o.end||"")+((o.href||o.act)?DS.icon("chevr",18):"")+"</span></"+tag+">"};
  DS.skel=function(kind,n){var o="";n=n||1;for(var i=0;i<n;i++)o+='<div class="ds-skel '+(kind||"card")+'"></div>';return'<div class="ds-stack" role="status" aria-label="Loading">'+o+"</div>"};
  DS.empty=function(o){var a=o.action;return'<div class="ds-empty">'+DS.duo(o.icon||"sparkle")+"<h3>"+esc(o.title)+"</h3>"+(o.text?"<p>"+esc(o.text)+"</p>":"")
    +(a?(a.href?'<a class="ds-btn s" href="'+esc(a.href)+'">'+esc(a.label)+"</a>":'<button type="button" class="ds-btn s" data-act="'+esc(a.act)+'">'+esc(a.label)+"</button>"):"")+"</div>"};
  /* plan-gated module: shown only when the backend entitlement flag is false */
  DS.gate=function(o){return'<div class="ds-gate"><span class="ds-ico">'+DS.icon(o.icon||"lock",20)+'</span><div><b>'+esc(o.title)+"</b><p>"+esc(o.text)+"</p>"+(o.action?'<a class="ds-btn s o" href="'+esc(o.action.href)+'">'+esc(o.action.label)+"</a>":"")+"</div></div>"};
  DS.success=function(){return'<div class="ds-done">'+DS.icon("okc",36)+"</div>"};
  DS.progress=function(p){return'<div class="ds-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(p*100)+'"><i style="--p:'+p+'"></i></div>'};
  DS.banner=function(kind,title,text,action){kind=kind||"info";var ic={info:"info",success:"okc",warning:"alert",error:"errc"}[kind]||"info";
    return'<div class="ds-banner '+kind+'" role="'+(kind==="error"?"alert":"status")+'">'+DS.icon(ic,20)+'<div class="g"><b>'+esc(title)+"</b>"+(text?"<p>"+esc(text)+"</p>":"")+"</div>"
      +(action?(action.href?'<a class="ds-btn s o" href="'+esc(action.href)+'">'+esc(action.label)+"</a>":'<button type="button" class="ds-btn s o" data-act="'+esc(action.act)+'"'+(action.id?' data-id="'+esc(action.id)+'"':"")+">"+esc(action.label)+"</button>"):"")+"</div>"};
  DS.seg=function(items,label){return'<div class="ds-segw"><nav class="ds-seg" aria-label="'+esc(label||"Sections")+'">'+items.map(function(t){
    var on=t.on?' aria-current="page" class="on"':"";return t.href?'<a href="'+esc(t.href)+'"'+on+">"+esc(t.label)+(t.n!=null?' <span class="n">'+esc(t.n)+"</span>":"")+"</a>":'<button type="button"'+(t.act?' data-act="'+esc(t.act)+'"':"")+(t.id?' data-id="'+esc(t.id)+'"':"")+on+">"+esc(t.label)+(t.n!=null?' <span class="n">'+esc(t.n)+"</span>":"")+"</button>"}).join("")+"</nav></div>"};

  /* ---------- toast ---------- */
  var tR=null,tList=[],lastMsg="",lastAt=0;
  function region(){if(!tR){tR=doc.createElement("div");tR.className="ds-toasts";tR.setAttribute("aria-live","polite");tR.setAttribute("aria-relevant","additions");doc.body.appendChild(tR)}return tR}
  function lift(){if(tR)tR.classList.toggle("top",stack.length>0)}
  DS.toast=function(msg,o){
    o=o||{};msg=String(msg==null?"":msg);if(!msg)return null;
    var now=Date.now();if(msg===lastMsg&&now-lastAt<1000)return null;lastMsg=msg;lastAt=now;
    var kind=o.kind||"info",dur=o.duration||(o.undo?7000:kind==="error"?6500:4000),el=doc.createElement("div"),ic={success:"okc",error:"errc",warning:"alert",info:"info"}[kind]||"info",done=false,tm=0;
    el.className="ds-toast "+kind;el.setAttribute("role",kind==="error"?"alert":"status");
    el.innerHTML=DS.icon(ic,22)+'<div class="t">'+esc(msg)+"</div>"+(o.undo?'<button type="button" class="u">'+esc(o.undoLabel||"Undo")+"</button>":"")+(rm()?"":'<i class="bar"></i>');
    region().appendChild(el);lift();tList.push(el);
    while(tList.length>3)kill(tList[0],0);
    requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.add("in");var b=el.querySelector(".bar");if(b){b.style.transition="transform "+dur+"ms linear";b.style.transform="scaleX(0)"}})});
    function kill(n,dx){if(n._done)return;n._done=true;var i=tList.indexOf(n);if(i>-1)tList.splice(i,1);clearTimeout(n._tm);n.classList.remove("drag");if(dx)n.style.setProperty("--x",dx+"px");n.classList.add("out");setTimeout(function(){if(n.parentNode)n.parentNode.removeChild(n)},rm()?0:220)}
    el._tm=tm=setTimeout(function(){kill(el,0)},dur);
    var u=el.querySelector(".u");if(u)u.addEventListener("click",function(){try{o.undo()}catch(e){}kill(el,0)});
    var sx=0,dx=0,drag=false;
    el.addEventListener("pointerdown",function(e){if(e.target.closest(".u"))return;drag=true;sx=e.clientX;dx=0;clearTimeout(el._tm);el.classList.add("drag");try{el.setPointerCapture(e.pointerId)}catch(x){}});
    el.addEventListener("pointermove",function(e){if(!drag)return;dx=e.clientX-sx;el.style.setProperty("--x",dx+"px");el.style.opacity=String(Math.max(.2,1-Math.abs(dx)/260))});
    function up(){if(!drag)return;drag=false;el.classList.remove("drag");if(Math.abs(dx)>70){kill(el,dx>0?420:-420)}else{el.style.setProperty("--x","0px");el.style.opacity="";el._tm=setTimeout(function(){kill(el,0)},2500)}}
    el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up);
    return{dismiss:function(){kill(el,0)}};
  };

  /* ---------- sheet: drag handle, snap points, focus trap, scroll lock ---------- */
  var stack=[],uid=0;
  var FOC='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function focusables(el){return Array.prototype.filter.call(el.querySelectorAll(FOC),function(n){return n.offsetParent!==null||n===doc.activeElement})}
  DS.sheet=function(o){
    o=o||{};var prev=doc.activeElement,id="dsh"+(++uid),w=doc.createElement("div"),closed=false,resolve,res;
    var p=new Promise(function(r){resolve=r});
    w.className="ds-sw";
    w.innerHTML='<div class="ds-scrim"></div><div class="ds-sheet" role="dialog" aria-modal="true" aria-labelledby="'+id+'" tabindex="-1"><div class="ds-grab"><i></i></div><div class="ds-sh"><h2 id="'+id+'">'+esc(o.title||"")+'</h2><button type="button" class="x" aria-label="Close">'+DS.icon("x",22)+'</button></div><div class="ds-sb"></div></div>';
    var sh=w.querySelector(".ds-sheet"),bd=w.querySelector(".ds-sb");
    if(o.html!=null)bd.innerHTML=o.html;if(o.node)bd.appendChild(o.node);
    var below=stack.length?stack[stack.length-1].w:doc.getElementById("root");if(below)below.setAttribute("inert","");
    doc.body.appendChild(w);html.classList.add("ds-lock");
    var snaps=[0],cur=0;
    function setY(y,anim){sh.classList.toggle("drag",!anim);sh.style.setProperty("--sy",y+"px");cur=y}
    requestAnimationFrame(function(){
      var h=sh.offsetHeight,vh=innerHeight;
      if(!wide()&&o.snap&&h>vh*.6)snaps=[0,Math.round(h-vh*.55)];
      if(o.start==="half"&&snaps.length>1)cur=snaps[1];
      sh.style.setProperty("--sy",cur+"px");w.classList.add("in");
      var f=o.focus?sh.querySelector(o.focus):null;if(!f&&(fine()||!o.search)){var fs=focusables(bd);f=fs[0]}if(!f)f=sh;try{f.focus({preventScroll:true})}catch(e){}
    });
    var dragging=false,sy=0,base=0,st=0;
    function down(e){if(wide()||e.target.closest(".x"))return;dragging=true;sy=e.clientY;base=cur;st=Date.now();sh.classList.add("drag");try{e.currentTarget.setPointerCapture(e.pointerId)}catch(x){}}
    function move(e){if(!dragging)return;setY(Math.max(0,base+e.clientY-sy),false)}
    function up(e){if(!dragging)return;dragging=false;var dy=e.clientY-sy,v=dy/Math.max(1,Date.now()-st),proj=cur+v*160,last=snaps[snaps.length-1];
      if(proj>last+Math.min(110,sh.offsetHeight*.25))return close();
      var best=snaps[0];snaps.forEach(function(s){if(Math.abs(s-proj)<Math.abs(best-proj))best=s});setY(best,true)}
    ["pointerdown","pointermove","pointerup","pointercancel"].forEach(function(ev,i){var fn=[down,move,up,up][i];w.querySelector(".ds-grab").addEventListener(ev,fn);w.querySelector(".ds-sh").addEventListener(ev,fn)});
    function close(val){
      if(closed)return;closed=true;res=val;var i=stack.indexOf(api);if(i>-1)stack.splice(i,1);
      doc.removeEventListener("keydown",key,true);w.classList.remove("in");sh.classList.remove("drag");sh.style.removeProperty("--sy");
      var b=stack.length?stack[stack.length-1].w:doc.getElementById("root");if(b)b.removeAttribute("inert");
      if(!stack.length)html.classList.remove("ds-lock");lift();
      setTimeout(function(){if(w.parentNode)w.parentNode.removeChild(w);try{if(prev&&prev.focus&&doc.contains(prev))prev.focus({preventScroll:true})}catch(e){}resolve(res);if(o.onClose)o.onClose(res)},rm()?0:240);
    }
    function key(e){
      if(stack[stack.length-1]!==api)return;
      if(e.key==="Escape"){e.stopPropagation();e.preventDefault();close()}
      else if(e.key==="Tab"){var fs=focusables(sh);if(!fs.length){e.preventDefault();return}var a=fs[0],z=fs[fs.length-1];
        if(e.shiftKey&&(doc.activeElement===a||doc.activeElement===sh)){e.preventDefault();z.focus()}else if(!e.shiftKey&&doc.activeElement===z){e.preventDefault();a.focus()}}
    }
    doc.addEventListener("keydown",key,true);
    w.querySelector(".ds-scrim").addEventListener("click",function(){close()});
    w.querySelector(".x").addEventListener("click",function(){close()});
    var api={w:w,el:sh,body:bd,close:close,done:p,title:function(t){w.querySelector("h2").textContent=t}};
    stack.push(api);lift();return api;
  };
  DS.closeAll=function(){stack.slice().forEach(function(s){s.close()})};

  /* confirm: yes or no, or a reason (input). Resolves true, the reason text, or null when dismissed. */
  DS.confirm=function(o){
    var inp=o.input,sh=DS.sheet({title:o.title,html:(o.text?'<p class="lead">'+esc(o.text)+"</p>":"")+(inp?'<label class="ds-field"><span>'+esc(inp.label||"")+'</span><textarea maxlength="300"'+(inp.placeholder?' placeholder="'+esc(inp.placeholder)+'"':"")+'></textarea></label><p class="ds-sr" id="dscerr" role="alert"></p>':"")
      +'<div class="ds-foot"><button type="button" class="ds-btn o" data-c="0">'+esc(o.cancel||"Cancel")+'</button><button type="button" class="ds-btn'+(o.danger?" d":"")+'" data-c="1">'+esc(o.ok||"Continue")+"</button></div>",focus:inp?"textarea":".ds-btn.o"});
    sh.body.addEventListener("click",function(e){var b=e.target.closest("[data-c]");if(!b)return;
      if(b.getAttribute("data-c")==="0")return sh.close(null);
      if(inp){var t=sh.body.querySelector("textarea"),v=t.value.trim();if(inp.required&&v.length<3){t.setAttribute("aria-invalid","true");t.focus();var er=sh.body.querySelector("#dscerr");er.className="";er.style.color="var(--danger)";er.textContent="Please add a few words.";return}return sh.close(v)}
      sh.close(true)});
    return sh.done.then(function(v){return v===undefined?null:v});
  };
  /* action sheet: a list of actions, long-press or the more button */
  DS.actions=function(o){
    var sh=DS.sheet({title:o.title||"Actions",html:'<div class="ds-rows">'+o.items.map(function(it,i){return'<button type="button" class="ds-row'+(it.tone?" "+it.tone:"")+'" data-i="'+i+'">'+(it.icon?'<span class="ds-ico">'+DS.icon(it.icon,20)+"</span>":"")+'<span class="ds-grow"><b>'+esc(it.label)+"</b>"+(it.sub?"<small>"+esc(it.sub)+"</small>":"")+"</span></button>"}).join("")+"</div>"});
    sh.body.addEventListener("click",function(e){var b=e.target.closest("[data-i]");if(!b)return;var it=o.items[+b.getAttribute("data-i")];sh.close();setTimeout(function(){if(it.run)it.run()},rm()?0:250)});
    return sh;
  };

  /* ---------- picker: searchable, icons, descriptions, recents, tiles with art, hierarchy, multi-select chips ---------- */
  /* option: {value,label,desc,icon,art,group,parent,disabled}. tiles:true draws category tiles. Resolves the value (array when multi) or null. */
  DS.pick=function(o){
    var opts=(o.options||[]).filter(function(x){return!x.hidden}),multi=!!o.multi,sel={},view=null,q="",rk=o.recents?"ds_rc_"+o.recents:null,recents=rk?(store(rk)||[]):[];
    (multi?(o.values||[]):(o.value!=null&&o.value!==""?[o.value]:[])).forEach(function(v){sel[v]=1});
    var by={};opts.forEach(function(x){by[x.value]=x});
    var kids={};opts.forEach(function(x){if(x.parent){(kids[x.parent]=kids[x.parent]||[]).push(x)}});
    var tiles=!!o.tiles,search=o.search!==undefined?o.search:opts.length>9,sh;
    function count(v){var n=0;(kids[v]||[]).forEach(function(c){if(sel[c.value])n++});return n}
    function optHtml(x){var on=sel[x.value];return'<button type="button" class="ds-opt" role="option" aria-selected="'+(on?"true":"false")+'" data-v="'+esc(x.value)+'"'+(x.disabled?" disabled":"")+">"
      +(x.art?DS.art(x.art,36):x.icon?'<span class="ds-ico">'+DS.icon(x.icon,18)+"</span>":"")+'<span class="g"><b>'+esc(x.label)+"</b>"+(x.desc?"<small>"+esc(x.desc)+"</small>":"")+'</span>'+(kids[x.value]&&!multi?DS.icon("chevr",18):'<span class="tick">'+DS.icon("check",14)+"</span>")+"</button>"}
    function tileHtml(x){var n=kids[x.value]?count(x.value):(sel[x.value]?1:0);return'<button type="button" class="ds-tile'+(n?" has":"")+'" role="option" aria-selected="'+(sel[x.value]||n?"true":"false")+'" data-v="'+esc(x.value)+'">'+DS.art(x.art||DS.artFor(x.label),48)+"<span>"+esc(x.label)+'</span><i class="cnt">'+n+"</i></button>"}
    function render(){
      var list=opts.filter(function(x){return view?x.parent===view:!x.parent});
      if(q){var ql=q.toLowerCase();list=opts.filter(function(x){return(x.label+" "+(x.desc||"")+" "+(x.group||"")).toLowerCase().indexOf(ql)>-1&&(!kids[x.value]||!multi)})}
      var h="";
      if(view&&!q)h+='<button type="button" class="ds-crumb ds-opt" data-back="1" style="width:auto">'+DS.icon("chevl",18)+esc((by[view]||{}).label||"Back")+"</button>";
      if(multi){var chosen=Object.keys(sel).filter(function(v){return by[v]});if(chosen.length)h+='<div class="ds-sel">'+chosen.map(function(v){return'<button type="button" class="ds-chip on" data-x="'+esc(v)+'" aria-label="Remove '+esc(by[v].label)+'">'+esc(by[v].label)+DS.icon("x",14)+"</button>"}).join("")+"</div>"}
      if(!q&&!view&&recents.length&&opts.length>8){var rc=recents.filter(function(v){return by[v]&&!kids[v]}).slice(0,4);if(rc.length)h+='<div class="ds-recent"><small>Recent</small><div class="ds-chips">'+rc.map(function(v){return'<button type="button" class="ds-chip" data-v="'+esc(v)+'">'+esc(by[v].label)+"</button>"}).join("")+"</div></div>"}
      if(!list.length)h+='<p class="lead" role="status">Nothing matches "'+esc(q)+'".</p>';
      else if(tiles&&!q)h+='<div class="ds-tiles" role="listbox" aria-label="'+esc(o.title||"Options")+'">'+list.map(tileHtml).join("")+"</div>";
      else{var g="",out="";list.forEach(function(x){if(x.group&&x.group!==g){g=x.group;out+='<div class="ds-optg" role="presentation">'+esc(g)+"</div>"}out+=optHtml(x)});h+='<div class="ds-opts" role="listbox" aria-label="'+esc(o.title||"Options")+'"'+(multi?' aria-multiselectable="true"':"")+">"+out+"</div>"}
      body.innerHTML=h;
      var f=sh.body.querySelector(".ds-foot");if(f){var n=Object.keys(sel).filter(function(v){return by[v]}).length;f.querySelector("[data-done]").textContent=n?"Done ("+n+")":"Done"}
    }
    var body=doc.createElement("div");
    var wrap=doc.createElement("div");
    wrap.innerHTML=(search?'<div class="ds-search">'+DS.icon("search",20)+'<input type="search" placeholder="'+esc(o.placeholder||"Search")+'" aria-label="Search" autocomplete="off"></div>':"");
    wrap.appendChild(body);
    if(multi){var ft=doc.createElement("div");ft.className="ds-foot";ft.innerHTML='<button type="button" class="ds-btn o" data-clear>Clear</button><button type="button" class="ds-btn" data-done>Done</button>';wrap.appendChild(ft)}
    sh=DS.sheet({title:o.title||"Choose",node:wrap,snap:true,search:search});
    render();
    function remember(v){if(!rk)return;recents=[v].concat(recents.filter(function(r){return r!==v})).slice(0,6);store(rk,recents)}
    var inp=wrap.querySelector("input");if(inp)inp.addEventListener("input",function(){q=inp.value.trim();render()});
    wrap.addEventListener("click",function(e){
      if(e.target.closest("[data-back]")){view=null;render();return}
      var x=e.target.closest("[data-x]");if(x){delete sel[x.getAttribute("data-x")];render();return}
      if(e.target.closest("[data-clear]")){sel={};render();return}
      if(e.target.closest("[data-done]")){var vals=Object.keys(sel).filter(function(v){return by[v]});vals.forEach(remember);sh.close(vals);return}
      var b=e.target.closest("[data-v]");if(!b||b.disabled)return;var v=b.getAttribute("data-v");
      if(kids[v]&&!q){view=v;render();var s=sh.body;if(s.scrollTo)s.scrollTo(0,0);return}
      if(multi){if(sel[v])delete sel[v];else sel[v]=1;render();return}
      sel={};sel[v]=1;remember(v);render();setTimeout(function(){sh.close(v)},rm()?0:140);
    });
    return sh.done.then(function(v){return v===undefined?null:v});
  };

  /* ---------- upgrade native selects into sheet pickers (the native select stays in the form, hidden) ---------- */
  function selOptions(sel){
    var out=[],cat=sel.name==="col"||sel.hasAttribute("data-ds-cat");
    Array.prototype.forEach.call(sel.children,function(n){
      if(n.tagName==="OPTGROUP")Array.prototype.forEach.call(n.children,function(op){out.push(mk(op,n.label))});else if(n.tagName==="OPTION")out.push(mk(n,""))});
    function mk(op,group){return{value:op.hasAttribute("value")?op.value:op.text,label:op.text,desc:op.getAttribute("data-desc")||"",icon:op.getAttribute("data-icon")||"",group:group,disabled:op.disabled,art:cat&&op.value!==""?DS.artFor(op.text):""}}
    return{list:out,cat:cat};
  }
  function syncSel(sel,btn){
    var op=sel.options[sel.selectedIndex],txt=op?op.text:"",empty=!op||op.value==="";
    var cat=sel.name==="col"||sel.hasAttribute("data-ds-cat"),lead=cat&&!empty?DS.art(DS.artFor(txt),28):"";
    var h=lead+'<span class="v'+(empty?" ph":"")+'">'+esc(txt||"Choose")+"</span>"+DS.icon("chevd",18);
    if(btn._h!==h){btn._h=h;btn.innerHTML=h}
    if(btn.disabled!==sel.disabled)btn.disabled=sel.disabled;
    var iv=sel.getAttribute("aria-invalid")||"false";if(btn.getAttribute("aria-invalid")!==iv)btn.setAttribute("aria-invalid",iv);
  }
  function upgradeSelects(root){
    Array.prototype.forEach.call(root.querySelectorAll("select"),function(sel){
      if(sel.hasAttribute("data-ds-native")||sel.multiple||sel.size>1)return;
      if(sel._dsb){syncSel(sel,sel._dsb);return}
      var btn=doc.createElement("button");btn.type="button";btn.className="ds-pick-btn"+((sel.closest(".htimes")||sel.hasAttribute("data-ho")||sel.hasAttribute("data-hc")||sel.hasAttribute("data-hpreset"))?" inline":"");
      var lab=sel.getAttribute("aria-label");if(lab)btn.setAttribute("aria-label",lab);btn.setAttribute("aria-haspopup","dialog");
      sel._dsb=btn;sel.classList.add("dsns");sel.tabIndex=-1;sel.setAttribute("aria-hidden","true");sel.parentNode.insertBefore(btn,sel.nextSibling);syncSel(sel,btn);
      function open(){
        var m=selOptions(sel),label=(sel.closest("label")&&(sel.closest("label").firstChild&&sel.closest("label").firstChild.textContent||"").trim())||lab||"Choose";
        var options=m.list.filter(function(x){return x.value!==""||!sel.required}).map(function(x){if(x.value==="")x.icon=x.icon||"close";return x});
        DS.pick({title:label,options:options,value:sel.value,tiles:m.cat,search:options.length>9,recents:m.cat?"category":null}).then(function(v){
          if(v==null)return;sel.value=v;syncSel(sel,btn);sel.dispatchEvent(new Event("input",{bubbles:true}));sel.dispatchEvent(new Event("change",{bubbles:true}));try{btn.focus({preventScroll:true})}catch(e){}});
      }
      btn.addEventListener("click",open);sel.addEventListener("click",function(){open()});sel.addEventListener("change",function(){syncSel(sel,btn)});
    });
  }

  /* ---------- segmented tabs: snap, edge fades, active tab scrolled into view, sheet switcher past four ---------- */
  function activeOf(el){return el.querySelector('.on,[aria-current="page"],[aria-selected="true"]')}
  function fades(el,host){var l=el.scrollLeft>2,r=el.scrollLeft+el.clientWidth<el.scrollWidth-2;host.classList.toggle("l",l);host.classList.toggle("r",r)}
  function intoView(el){var a=activeOf(el);if(!a)return;var x=a.offsetLeft-(el.clientWidth-a.offsetWidth)/2;try{el.scrollTo({left:Math.max(0,x),behavior:"auto"})}catch(e){el.scrollLeft=Math.max(0,x)}}
  function upgradeTabs(root){
    Array.prototype.forEach.call(root.querySelectorAll(".ds-seg,.so-tabs,.tabs"),function(el){
      if(el.hasAttribute("data-dse"))return;el.setAttribute("data-dse","1");
      var legacy=!el.classList.contains("ds-seg"),host;
      if(legacy){host=doc.createElement("div");host.className="ds-tabhost";el.parentNode.insertBefore(host,el);host.appendChild(el)}else host=el;
      var wrapForBtn=legacy?host:el.parentNode;
      var all=null;
      function items(){return Array.prototype.slice.call(el.children).filter(function(n){return n.tagName==="A"||n.tagName==="BUTTON"})}
      function refresh(){fades(el,host);var n=items().length;
        if(n>4&&!all){all=doc.createElement("button");all.type="button";all.className="ds-segall";all.setAttribute("aria-label","All sections");all.setAttribute("aria-haspopup","dialog");all.innerHTML=DS.icon("grid",20);wrapForBtn.appendChild(all);
          all.addEventListener("click",function(){var its=items();DS.actions({title:"Sections",items:its.map(function(t){var on=t.classList.contains("on")||t.getAttribute("aria-current")==="page";return{label:t.textContent.replace(/\s+/g," ").trim(),icon:on?"check":"",run:function(){t.click()}}})})})}
        else if(n<=4&&all){all.parentNode.removeChild(all);all=null}}
      var tk=0;el.addEventListener("scroll",function(){if(tk)return;tk=requestAnimationFrame(function(){tk=0;fades(el,host)})},{passive:true});
      try{new MutationObserver(function(){refresh();intoView(el)}).observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:["class","aria-current","aria-selected"]})}catch(e){}
      refresh();intoView(el);requestAnimationFrame(function(){refresh();intoView(el)});
    });
  }

  /* ---------- motion ---------- */
  function stagger(root){
    if(rm())return;
    Array.prototype.forEach.call(root.querySelectorAll(".ds-grid,.ds-rows,.ds-stats,.ds-stack[data-stg]"),function(g){
      var i=0;Array.prototype.forEach.call(g.children,function(c){if(c.classList.contains("dsin")||c.getAttribute("data-nostg"))return;c.style.setProperty("--i",Math.min(i++,10));c.classList.add("dsin")})})}
  function countUp(root){
    Array.prototype.forEach.call(root.querySelectorAll("[data-count]"),function(el){
      if(el.hasAttribute("data-cd"))return;el.setAttribute("data-cd","1");
      var to=Number(el.getAttribute("data-count"))||0,money=el.getAttribute("data-fmt")==="money";
      function fmt(n){n=Math.round(n);return money?DS.money(n):(function(){try{return new Intl.NumberFormat().format(n)}catch(e){return String(n)}})()}
      el.textContent=fmt(0);var tn=el.firstChild;
      if(rm()||to===0){tn.nodeValue=fmt(to);return}
      var t0=0,dur=Math.min(900,400+String(to).length*60);
      function step(t){if(!t0)t0=t;var p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);tn.nodeValue=fmt(to*e);if(p<1)requestAnimationFrame(step);else tn.nodeValue=fmt(to)}
      requestAnimationFrame(step);
    });
  }
  /* long-press a card with .ds-acts to open its actions in a sheet (touch friendly; the buttons stay visible too) */
  var lpT=0,lpX=0,lpY=0;
  doc.addEventListener("pointerdown",function(e){
    if(e.pointerType==="mouse")return;var card=e.target.closest&&e.target.closest("[data-lp]");if(!card||e.target.closest("button,a,input,select,textarea"))return;
    lpX=e.clientX;lpY=e.clientY;clearTimeout(lpT);
    lpT=setTimeout(function(){var bs=card.querySelectorAll(".ds-acts [data-act]");if(!bs.length)return;if(navigator.vibrate)try{navigator.vibrate(12)}catch(x){}
      DS.actions({title:card.getAttribute("data-lp")||"Actions",items:Array.prototype.map.call(bs,function(b){return{label:b.getAttribute("aria-label")||b.textContent.trim(),icon:b.getAttribute("data-ico")||"",tone:b.classList.contains("d")?"bad":"",run:function(){b.click()}}})})},520);
  },{passive:true});
  ["pointerup","pointercancel","scroll"].forEach(function(ev){doc.addEventListener(ev,function(){clearTimeout(lpT)},{passive:true,capture:true})});
  doc.addEventListener("pointermove",function(e){if(lpT&&(Math.abs(e.clientX-lpX)>8||Math.abs(e.clientY-lpY)>8))clearTimeout(lpT)},{passive:true});

  /* instant feedback on navigation: the tapped tab turns active at once and a thin progress bar runs until the next page is drawn.
     (No page transition: it froze the screen while the next page loaded, which felt slow.) */
  doc.addEventListener("click",function(e){
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    var a=e.target.closest&&e.target.closest(".ax-tabs a[href],.ax-rail a[href]");if(!a||a.classList.contains("on"))return;
    Array.prototype.forEach.call(doc.querySelectorAll(".ax-tabs a.on,.ax-rail a.on"),function(n){n.classList.remove("on");n.removeAttribute("aria-current")});
    var href=a.getAttribute("href");
    Array.prototype.forEach.call(doc.querySelectorAll('.ax-tabs a[href="'+href+'"],.ax-rail a[href="'+href+'"]'),function(n){n.classList.add("on");n.setAttribute("aria-current","page")});
    var m=doc.getElementById("main");if(m)m.setAttribute("aria-busy","true");
    html.classList.add("ds-navbusy");setTimeout(function(){html.classList.remove("ds-navbusy")},8000);
  },true);

  /* ---------- upgrade whatever the router just drew ---------- */
  var raf=0;
  function enhance(){
    raf=0;var root=doc.getElementById("root");if(!root)return;
    if(html.classList.contains("ds-navbusy")&&!(doc.getElementById("main")||{getAttribute:function(){}}).getAttribute("aria-busy"))html.classList.remove("ds-navbusy");
    html.classList.toggle("ds-hastabs",!!doc.querySelector(".ax-tabs"));
    upgradeSelects(root);upgradeTabs(root);stagger(root);countUp(root);
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(enhance)}
  DS.enhance=enhance;

  /* ---------- hook into Core ---------- */
  function guess(t){t=String(t||"");
    return/message|inbox|conversation|chat/i.test(t)?"chat":/product|catalogue|stock/i.test(t)?"box":/order/i.test(t)?"receipt":/store|seller|application/i.test(t)?"store":/review/i.test(t)?"clip":/waitlist|signup|people|member/i.test(t)?"users":/notif/i.test(t)?"bell":/verif|case/i.test(t)?"shield":/not available|not set up|could not|went wrong|not found/i.test(t)?"alert":"sparkle"}
  if(C){
    C.toast=function(m,err){return DS.toast(m,{kind:err?"error":"success"})};
    C.ask=function(title,label,required){
      var t=String(title||""),danger=/reject|suspend|decline|delete|remove/i.test(t),ok=/^approve/i.test(t)?"Approve":/^reject/i.test(t)?"Reject":/^suspend/i.test(t)?"Suspend":/changes/i.test(t)?"Send to seller":"Continue";
      return DS.confirm({title:t,input:{label:label,required:!!required},ok:ok,danger:danger}).then(function(v){return v===null||v===false?null:(v===true?"":v)})};
    C.empty=function(t,s){return DS.empty({icon:guess(t),title:t,text:s})};
    C.ds=DS;
  }
  function boot(){
    mountSprite();
    var root=doc.getElementById("root");
    if(root&&window.MutationObserver)new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var ad=ms[i].addedNodes;for(var k=0;k<ad.length;k++)if(ad[k].nodeType===1){schedule();return}}}).observe(root,{childList:true,subtree:true});
    schedule();
  }
  if(doc.body)boot();else doc.addEventListener("DOMContentLoaded",boot);
  window.DS=DS;
})();
