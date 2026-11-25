/* Animated scenes, permission feedback and swipe-to-dismiss notifications for the app (see SELLER_APP_EXPERIENCE_SPEC.md, slice 6).
   Pure inline SVG + CSS animation: no images, no libraries. Every animation stops under prefers-reduced-motion. */
window.Motion=(function(){
  var W='<svg viewBox="0 0 240 190" aria-hidden="true" focusable="false">';
  var SC={
    deliver:{l:"A parcel travelling along a route to your door",s:W+'<circle class="bg" cx="120" cy="98" r="84"/><path class="road" d="M20 150C70 150 80 110 120 110S180 70 222 70"/><g class="sp"><path d="M44 120h22M30 134h18M58 140h14"/></g><g class="pn"><circle class="ring" cx="222" cy="70" r="8"/><circle class="ring r2" cx="222" cy="70" r="8"/><path class="pin" d="M222 52a12 12 0 0 1 12 12c0 9-12 22-12 22s-12-13-12-22a12 12 0 0 1 12-12z"/><circle class="dot" cx="222" cy="64" r="4.5"/></g><g class="pk"><rect class="box" x="-17" y="-17" width="34" height="34" rx="8"/><path class="tape" d="M-17-3h34M0-17v14"/></g><g class="st"><path d="M52 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/><path class="b" d="M190 28l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><circle class="c" cx="34" cy="86" r="3"/></g></svg>'},
    country:{l:"A globe with prices in different currencies",s:W+'<ellipse class="gsh" cx="120" cy="176" rx="46" ry="6"/><g class="gl"><circle class="bg" cx="120" cy="96" r="62"/><ellipse class="mer m1" cx="120" cy="96" rx="62" ry="62"/><ellipse class="mer m2" cx="120" cy="96" rx="62" ry="62"/><ellipse class="eq" cx="120" cy="96" rx="62" ry="20"/><path class="eq" d="M58 96h124"/><circle class="rim" cx="120" cy="96" r="62"/></g><g class="tg t1"><rect x="14" y="40" width="44" height="28" rx="9"/><text x="36" y="59" text-anchor="middle">₦</text></g><g class="tg t2"><rect x="184" y="62" width="44" height="28" rx="9"/><text x="206" y="81" text-anchor="middle">$</text></g><g class="tg t3"><rect x="24" y="118" width="44" height="28" rx="9"/><text x="46" y="137" text-anchor="middle">£</text></g></svg>'},
    checkout:{l:"A phone showing a card payment being confirmed",s:W+'<circle class="bg" cx="120" cy="98" r="84"/><rect class="ph" x="80" y="18" width="80" height="154" rx="16"/><rect class="scr" x="87" y="30" width="66" height="130" rx="10"/><g class="cd"><rect x="92" y="64" width="56" height="36" rx="7"/><path d="M92 76h56"/><path class="ln" d="M99 90h14"/></g><circle class="okc" cx="120" cy="128" r="14"/><path class="okt" d="M113 128l5 5 9-10"/><g class="cf"><circle cx="62" cy="52" r="4"/><circle class="b" cx="182" cy="76" r="3.5"/><circle class="c" cx="174" cy="132" r="4"/><circle class="d" cx="58" cy="120" r="3"/></g></svg>'},
    loc:{l:"A map pin dropping onto a map",s:W+'<rect class="map" x="30" y="34" width="180" height="128" rx="22"/><g class="grd"><path d="M30 78h180M30 120h180M90 34v128M150 34v128"/></g><path class="rd" d="M30 138C80 138 90 96 130 100S190 70 210 62"/><g class="rg"><circle class="ring" cx="120" cy="120" r="10"/><circle class="ring r2" cx="120" cy="120" r="10"/></g><ellipse class="psh" cx="120" cy="124" rx="12" ry="4"/><g class="pd"><path class="pin" d="M120 60a20 20 0 0 1 20 20c0 15-20 38-20 38s-20-23-20-38a20 20 0 0 1 20-20z"/><circle class="dot" cx="120" cy="80" r="7"/></g></svg>'},
    ntf:{l:"A bell ringing with a new notification",s:W+'<circle class="bg" cx="120" cy="98" r="84"/><g class="wv"><path d="M60 70c-8 12-8 28 0 40M48 62c-13 18-13 46 0 64"/><path d="M180 70c8 12 8 28 0 40M192 62c13 18 13 46 0 64"/></g><g class="bl"><path class="bd" d="M120 44c-24 0-38 18-38 40v22l-12 16h100l-12-16V84c0-22-14-40-38-40z"/><path class="cl" d="M108 138a12 12 0 0 0 24 0"/></g><g class="bg2"><circle cx="156" cy="58" r="14"/><path d="M156 52v7M156 63v1"/></g></svg>'},
    cam:{l:"A camera viewfinder scanning a barcode",s:W+'<circle class="bg" cx="120" cy="98" r="84"/><g class="bc"><path d="M80 70v50M88 70v50M97 70v50M104 70v50M114 70v50M122 70v50M132 70v50M139 70v50M148 70v50M156 70v50"/></g><g class="vf"><path d="M62 54v-12a8 8 0 0 1 8-8h12M158 34h12a8 8 0 0 1 8 8v12M62 136v12a8 8 0 0 0 8 8h12M158 156h12a8 8 0 0 0 8-8v-12"/></g><path class="scn" d="M70 96h100"/></svg>'},
    empty:{l:"An empty box",s:W+'<ellipse class="gsh" cx="120" cy="164" rx="48" ry="6"/><g class="eb2"><path class="bk" d="M70 84l50-22 50 22v54l-50 22-50-22z"/><path class="lid" d="M70 84l50 22 50-22M120 106v54"/><path class="fl l" d="M70 84l-18-16 50-20 18 14zM170 84l18-16-50-20-18 14z"/></g><g class="sps"><path d="M52 42l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/><path class="b" d="M190 54l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><circle class="c" cx="196" cy="118" r="3"/><circle class="d" cx="44" cy="112" r="2.5"/></g></svg>'},
    cart:{l:"An empty basket waiting for items",s:W+'<ellipse class="gsh" cx="120" cy="170" rx="50" ry="6"/><g class="itm"><circle class="i1" cx="100" cy="30" r="12"/><rect class="i2" x="128" y="18" width="24" height="24" rx="7"/><path class="i3" d="M170 30l10 16h-20z"/></g><g class="bk2"><path class="bs" d="M64 92h112l-12 66a10 10 0 0 1-10 8H86a10 10 0 0 1-10-8z"/><path class="hd2" d="M92 92c0-22 12-34 28-34s28 12 28 34"/></g></svg>'},
    search:{l:"A magnifying glass looking around",s:W+'<circle class="bg" cx="120" cy="98" r="72"/><g class="lens"><circle class="lc" cx="108" cy="88" r="34"/><path class="lh" d="M133 113l30 30"/><path class="lg" d="M92 76a22 22 0 0 1 14-9"/></g><g class="sps"><path d="M186 46l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><circle class="c" cx="48" cy="62" r="3"/></g></svg>'},
    orders:{l:"A receipt with a package on its way",s:W+'<circle class="bg" cx="120" cy="98" r="80"/><g class="rc"><path class="rp" d="M76 34h88v118l-14-9-15 9-15-9-15 9-15-9-14 9z"/><path class="rl" d="M92 62h56M92 82h56M92 102h32"/></g><circle class="okc2" cx="164" cy="140" r="16"/><path class="okt2" d="M156 140l6 6 10-12"/></svg>'},
    error:{l:"A cloud that lost its connection",s:W+'<circle class="bg" cx="120" cy="98" r="80"/><g class="cld"><path class="cp" d="M82 128a24 24 0 0 1 2-47 34 34 0 0 1 66 8 21 21 0 0 1-2 39z"/></g><g class="x"><path d="M106 96l28 28M134 96l-28 28"/></g></svg>'},
    guest:{l:"A friendly profile with shopping items floating around it",s:W+'<circle class="bg" cx="120" cy="98" r="62"/><g class="orb"><circle class="o1" cx="120" cy="22" r="11"/><rect class="o2" x="188" y="86" width="22" height="22" rx="7"/><path class="o3" d="M52 140l10-16 10 16z"/></g><g class="me"><circle class="hd" cx="120" cy="82" r="20"/><path class="bd" d="M80 146c0-22 18-34 40-34s40 12 40 34z"/></g></svg>'}
  };
  function scene(k,small){var c=SC[k]||SC.empty;return'<div class="mo mo-'+k+(small?" sm":"")+'" role="img" aria-label="'+c.l+'">'+c.s+'<span class="mo-b" aria-hidden="true"></span></div>'}
  /* Permission feedback: show "waiting" at once so nobody taps twice, then show the answer inside the screen instead of a banner. */
  function wait(){
    var b=document.querySelector('.onb [data-act="obnext"]');if(!b)return;
    b.disabled=true;b.setAttribute("aria-busy","true");b.dataset.t=b.textContent;
    b.innerHTML='<i class="mo-sp"></i><span>Waiting for your answer…</span>';
    var o=document.querySelector(".onb .mo");if(o)o.classList.add("is-wait")
  }
  function result(ok,note,next){
    var b=document.querySelector('.onb [data-act="obnext"]'),o=document.querySelector(".onb .mo"),m=document.querySelector(".onb p.m"),s=document.querySelector('.onb [data-act="obskip"]');
    if(o){o.classList.remove("is-wait");o.classList.add(ok?"is-ok":"is-no")}
    if(b){b.disabled=true;b.removeAttribute("aria-busy");b.classList.add(ok?"mo-yes":"mo-nope");b.innerHTML=ok?'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="mo-tk" d="M5 12.5l4.5 4.5L19 7"/></svg><span>Allowed</span>':"<span>Not turned on</span>"}
    if(s)s.style.visibility="hidden";
    if(m)m.textContent=ok?(note||"All set."):"You can turn this on later in Settings.";
    var rm=window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches;
    setTimeout(next,rm?300:ok?1100:1300)
  }
  /* Notifications: swipe up (or tap) to dismiss. */
  function swipe(){
    var box=document.getElementById("notes");if(!box)return;
    var y0=null,el=null;
    box.addEventListener("pointerdown",function(e){el=e.target.closest(".note");y0=el?e.clientY:null},{passive:true});
    box.addEventListener("pointermove",function(e){if(!el||y0===null)return;var d=Math.min(0,e.clientY-y0);el.style.transition="none";el.style.transform="translateY("+d+"px)";el.style.opacity=String(1+d/90)},{passive:true});
    function end(e){if(!el)return;var d=e.clientY-y0;el.style.transition="";if(d<-28){el.style.transform="translateY(-90px)";el.style.opacity="0";var n=el;setTimeout(function(){n.click()},0)}else{el.style.transform="";el.style.opacity=""}el=null;y0=null}
    box.addEventListener("pointerup",end,{passive:true});box.addEventListener("pointercancel",end,{passive:true})
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",swipe);else swipe();
  return{scene:scene,wait:wait,result:result}
})();
