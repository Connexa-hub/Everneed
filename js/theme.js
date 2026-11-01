/* Theme engine: mode (system, light, dark), AMOLED, six palettes. Stored on the device, mirrored to the profile when signed in. */
window.Theme=(function(){
  var PAL=[["emerald","Emerald","Heritage, trustworthy","#0F6B4F","#3FD39A"],["indigo","Indigo","Modern, techy","#4F46E5","#8E8CFF"],["rose","Rose","Warm, fashion-forward","#E11D48","#FF6B88"],
    ["violet","Violet","Creative, beauty","#7C3AED","#B18CFF"],["ocean","Ocean","Calm, clean","#0E7490","#34D3EE"],["gold","Gold","Premium, luxe","#A16207","#F2C14E"]];
  var root=document.documentElement,mq=window.matchMedia?matchMedia("(prefers-color-scheme: dark)"):null;
  function get(k,d){try{var v=localStorage.getItem("en_"+k);return v==null?d:v}catch(e){return d}}
  function put(k,v){try{localStorage.setItem("en_"+k,v)}catch(e){}}
  function mode(){var m=get("mode",null);if(!m){try{m=JSON.parse(get("theme","null"))}catch(e){}}return m==="light"||m==="dark"?m:"system"}
  function palette(){var p=get("palette","emerald");return PAL.some(function(x){return x[0]===p})?p:"emerald"}
  function amoled(){return get("amoled","0")==="1"}
  function isDark(){var m=mode();return m==="dark"||(m==="system"&&!!mq&&mq.matches)}
  function resolved(){return!isDark()?"light":amoled()?"amoled":"dark"}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function icon(){return isDark()
    ?'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    :'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'}
  function chrome(){
    var bg=getComputedStyle(root).getPropertyValue("--bg").trim(),meta=document.querySelector('meta[name="theme-color"]');
    if(meta&&bg)meta.setAttribute("content",bg);
    try{var SB=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.StatusBar;
      if(SB){SB.setStyle({style:isDark()?"DARK":"LIGHT"});SB.setBackgroundColor({color:bg})}}catch(e){}
  }
  function apply(){
    root.setAttribute("data-mode",resolved());root.setAttribute("data-palette",palette());
    var q=document.querySelectorAll("[data-tact=quick]");for(var i=0;i<q.length;i++)q[i].innerHTML=icon();
    chrome();
  }
  function save(){
    if(window.Supa&&Supa.uid&&Supa.uid()){Supa.patchProfile({settings:{mode:mode(),palette:palette(),amoled:amoled()}}).catch(function(){})}
  }
  function set(k,v){put(k,v);apply();save();paint()}
  function fromProfile(p){
    var s=p&&p.settings;if(!s||typeof s!=="object")return;
    if(s.mode)put("mode",s.mode);if(s.palette)put("palette",s.palette);if(s.amoled!=null)put("amoled",s.amoled?"1":"0");apply();
  }
  function summary(){var m={system:"System",light:"Light",dark:"Dark"}[mode()],p=PAL.filter(function(x){return x[0]===palette()})[0][1];return m+(isDark()&&amoled()?" (AMOLED)":"")+", "+p}
  function inner(){
    var m=mode(),p=palette(),dark=isDark();
    var seg='<div class="seg" role="radiogroup" aria-label="Mode">'+[["system","System"],["light","Light"],["dark","Dark"]].map(function(o){
      return'<input type="radio" name="tmode" id="tm-'+o[0]+'" value="'+o[0]+'"'+(m===o[0]?" checked":"")+' data-tact="mode"><label for="tm-'+o[0]+'">'+o[1]+"</label>"}).join("")+"</div>";
    var sw='<div class="sw"><span><b>AMOLED black</b><small class="m" style="display:block">'+(dark?"Pure black background to save battery on OLED screens.":"Available when the app is in dark mode.")+'</small></span><button type="button" role="switch" aria-label="AMOLED black" aria-checked="'+(amoled()&&dark)+'" data-tact="amoled"'+(dark?"":" disabled")+"></button></div>";
    var grid='<div class="swgrid" role="radiogroup" aria-label="Colour">'+PAL.map(function(x){
      return'<button type="button" class="swatch" role="radio" aria-checked="'+(p===x[0])+'" data-tact="pal" data-v="'+x[0]+'"><span class="dots2"><i style="background:'+x[3]+'"></i><i style="background:'+x[4]+'"></i></span><span><b>'+x[1]+"</b><small class=\"m\">"+esc(x[2])+"</small></span></button>"}).join("")+"</div>";
    var prev='<div class="surface preview"><div class="pv"><div class="pimgx"></div><div><b style="font-family:var(--font-display);font-size:16px">Linen tote bag</b><div class="pr" style="margin:2px 0">\u20A612,500 <s>\u20A615,000</s></div><span class="pill info">Urban Finds</span></div></div><div class="acts"><button class="btn s" type="button">Add to cart</button><button class="btn o s" type="button">Save</button><span class="chip on">Fashion</span></div></div>';
    return'<div class="sec"><h3>Mode</h3></div>'+seg+sw+'<div class="sec"><h3>Colour</h3></div>'+grid+'<div class="sec"><h3>Preview</h3></div>'+prev
      +'<p class="m sm">Your choice is saved on this phone'+(window.Supa&&Supa.uid&&Supa.uid()?" and to your account.":". Sign in to keep it on every device.")+'</p><p class="m sm" style="opacity:.8">'+esc(window.buildLabel?buildLabel():"")+"</p>";
  }
  function paint(){var el=document.getElementById("appr");if(el)el.innerHTML=inner()}
  function page(){return'<div id="appr">'+inner()+"</div>"}
  document.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-tact]");if(!b||b.disabled)return;var a=b.getAttribute("data-tact");
    if(a==="quick"){set("mode",isDark()?"light":"dark")}
    else if(a==="pal"){set("palette",b.getAttribute("data-v"))}
    else if(a==="amoled"){set("amoled",amoled()?"0":"1")}
  });
  document.addEventListener("change",function(e){var t=e.target;if(t&&t.getAttribute&&t.getAttribute("data-tact")==="mode")set("mode",t.value)});
  if(mq){var f=function(){if(mode()==="system")apply()};mq.addEventListener?mq.addEventListener("change",f):mq.addListener&&mq.addListener(f)}
  apply();
  return{apply:apply,page:page,summary:summary,icon:icon,fromProfile:fromProfile,mode:mode,palette:palette,resolved:resolved,palettes:PAL};
})();
