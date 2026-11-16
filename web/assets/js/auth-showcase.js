/* Sign-in / create-account showcase: transparent product art drawn in SVG (no hot-linked photos, no square backgrounds)
   and one big animated word that follows the highlighted product. Wraps Core.V.login, so it needs no change to site.js.
   Everything here is decorative: aria-hidden art, one text alternative on the wrapper. */
(function(){
  "use strict";
  var C=window.Core;
  if(!C||!C.V||typeof C.V.login!=="function")return;
  var timer=null,reduce=false;
  try{reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}

  var INK="#17221e";
  var ART={
    serum:'<ellipse class="ae-sh" cx="60" cy="143" rx="30" ry="4"/>'
      +'<rect x="50" y="6" width="20" height="28" rx="10" fill="'+INK+'"/>'
      +'<rect x="42" y="31" width="36" height="12" rx="3" class="k2"/>'
      +'<rect x="26" y="48" width="68" height="94" rx="15" class="k1"/>'
      +'<rect x="57" y="43" width="6" height="42" rx="3" fill="#fff" opacity=".28"/>'
      +'<rect x="34" y="58" width="7" height="76" rx="3.5" fill="#fff" opacity=".35"/>'
      +'<rect x="42" y="88" width="42" height="36" rx="5" fill="#fff" opacity=".93"/>'
      +'<rect x="48" y="96" width="28" height="5" rx="2.5" class="k1"/>'
      +'<rect x="48" y="106" width="20" height="3" rx="1.5" fill="'+INK+'" opacity=".5"/>'
      +'<rect x="48" y="113" width="25" height="3" rx="1.5" fill="'+INK+'" opacity=".3"/>',
    audio:'<ellipse class="ae-sh" cx="60" cy="143" rx="34" ry="4"/>'
      +'<path d="M27 76V64C27 32 42 17 60 17s33 15 33 47v12" fill="none" stroke="'+INK+'" stroke-width="9" stroke-linecap="round"/>'
      +'<path d="M27 76V64C27 32 42 17 60 17s33 15 33 47v12" fill="none" class="k3s" stroke-width="4" stroke-linecap="round"/>'
      +'<rect x="14" y="68" width="26" height="54" rx="13" class="k1"/>'
      +'<rect x="80" y="68" width="26" height="54" rx="13" class="k1"/>'
      +'<rect x="35" y="77" width="9" height="36" rx="4.5" fill="'+INK+'"/>'
      +'<rect x="76" y="77" width="9" height="36" rx="4.5" fill="'+INK+'"/>'
      +'<ellipse cx="25" cy="95" rx="5" ry="15" class="k2" opacity=".75"/>'
      +'<ellipse cx="95" cy="95" rx="5" ry="15" class="k2" opacity=".75"/>',
    watch:'<ellipse class="ae-sh" cx="60" cy="144" rx="28" ry="4"/>'
      +'<rect x="40" y="4" width="40" height="46" rx="9" class="k3"/>'
      +'<rect x="40" y="100" width="40" height="44" rx="9" class="k3"/>'
      +'<circle cx="60" cy="120" r="2.2" fill="'+INK+'" opacity=".45"/><circle cx="60" cy="130" r="2.2" fill="'+INK+'" opacity=".45"/>'
      +'<rect x="94" y="69" width="8" height="12" rx="2.5" class="k2"/>'
      +'<circle cx="60" cy="75" r="37" fill="'+INK+'"/>'
      +'<circle cx="60" cy="75" r="32" class="k2"/>'
      +'<circle cx="60" cy="75" r="27" fill="#f8f6ef"/>'
      +'<rect x="58.8" y="52" width="2.4" height="6" rx="1.2" fill="'+INK+'"/><rect x="58.8" y="92" width="2.4" height="6" rx="1.2" fill="'+INK+'"/>'
      +'<rect x="37" y="73.8" width="6" height="2.4" rx="1.2" fill="'+INK+'"/><rect x="77" y="73.8" width="6" height="2.4" rx="1.2" fill="'+INK+'"/>'
      +'<path d="M60 75V59M60 75l13 5" stroke="'+INK+'" stroke-width="3" stroke-linecap="round" fill="none"/>'
      +'<path d="M60 75L49 65" class="k1s" stroke-width="1.6" stroke-linecap="round" fill="none"/>'
      +'<circle cx="60" cy="75" r="3" class="k1"/>',
    sneaker:'<ellipse class="ae-sh" cx="60" cy="143" rx="40" ry="4"/>'
      +'<g transform="translate(0 16)">'
      +'<path d="M10 104V78Q10 70 18 68L40 62Q46 46 58 42L68 54Q80 70 100 76Q114 80 114 94V104Z" class="k1"/>'
      +'<path d="M92 74Q114 80 114 94V104H88Q92 90 92 74Z" class="k3"/>'
      +'<path d="M10 78Q10 70 18 68L26 66V104H10Z" class="k3"/>'
      +'<path d="M40 62L46 44Q50 38 58 40L58 46Q50 48 46 60Z" class="k2"/>'
      +'<path d="M56 56l6 6M64 60l6 6M72 64l6 6" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none"/>'
      +'<path d="M28 90Q50 80 72 93" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".85"/>'
      +'<rect x="4" y="102" width="112" height="13" rx="6.5" fill="#f4f2ea"/>'
      +'<rect x="7" y="113" width="106" height="6" rx="3" fill="'+INK+'"/></g>'
  };
  var ITEMS=[["serum","Skincare"],["audio","Electronics"],["watch","Accessories"],["sneaker","Fashion"]];

  function letters(word,extra){
    return String(word).split("").map(function(ch,i){return'<span class="ae-l" style="--i:'+(i+(extra||0))+'">'+C.esc(ch)+"</span>"}).join("");
  }
  function showcase(){
    var title=["Everyday","finds"],n=0;
    var h=title.map(function(w){var s='<span class="ae-wd">'+letters(w,n)+"</span>";n+=w.length+1;return s}).join(" ");
    var items=ITEMS.map(function(x,i){
      return'<div class="ae-item ae-'+x[0]+(i===0?" is-on":"")+'"><div class="ae-art"><svg viewBox="0 0 120 150" aria-hidden="true" focusable="false">'+ART[x[0]]+"</svg></div></div>";
    }).join("");
    var words=ITEMS.map(function(x,i){return'<span class="ae-w ae-'+x[0]+(i===0?" is-on":"")+'">'+letters(x[1])+"</span>"}).join("");
    return'<div class="ae-show" role="img" aria-label="Everneed: find skincare, electronics, accessories and fashion from independent stores">'
      +'<h1 class="ae-title" aria-hidden="true">'+h+"</h1>"
      +'<div class="ae-stage" aria-hidden="true"><svg class="ae-wave" viewBox="0 0 900 120" preserveAspectRatio="none"><path d="M8 62C110 62 120 12 225 12S340 108 450 108 565 12 675 12 790 62 892 62"/></svg>'+items+"</div>"
      +'<div class="ae-word" aria-hidden="true">'+words+"</div></div>";
  }
  function start(){
    stop();
    var root=document.querySelector(".ae-show");if(!root||reduce)return;
    var items=root.querySelectorAll(".ae-item"),words=root.querySelectorAll(".ae-w"),cur=0;
    timer=setInterval(function(){
      if(!document.body.contains(root)){stop();return}
      if(document.hidden)return;
      var next=(cur+1)%words.length;
      words[cur].classList.remove("is-on");words[cur].classList.add("is-out");
      items[cur].classList.remove("is-on");
      words[next].classList.remove("is-out");words[next].classList.add("is-on");
      items[next].classList.add("is-on");
      var old=words[cur];setTimeout(function(){old.classList.remove("is-out")},700);
      cur=next;
    },2400);
  }
  function stop(){if(timer){clearInterval(timer);timer=null}}
  function fix(page){
    if(!page||typeof page.html!=="string")return page;
    var re=/(<section class="auth-intro-area">)[\s\S]*?(<\/section><section class="auth-form-area">)/;
    if(!re.test(page.html))return page;
    page.html=page.html.replace(re,function(m,a,b){return a+showcase()+b});
    var prev=page.after;
    page.after=function(){if(typeof prev==="function")prev.apply(this,arguments);start()};
    return page;
  }
  var orig=C.V.login;
  C.V.login=function(){
    var r=orig.apply(this,arguments);
    return r&&typeof r.then==="function"?r.then(fix):fix(r);
  };
})();
