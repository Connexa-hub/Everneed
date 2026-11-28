/* WEB-M10: web-to-app handoff on /shop. No web catalogue, cart or checkout.
   Shows only verified, published download destinations. While DESTINATIONS is empty the page says, truthfully,
   that the app is not published yet and points to early access. Wraps Core.V.shop (same pattern as auth-showcase.js)
   and falls back to the original page if anything here throws. Decorative art is aria-hidden SVG. */
(function(){
  "use strict";
  var C=window.Core;
  if(!C||!C.V||typeof C.V.shop!=="function")return;

  /* Verified, published destinations ONLY. Add an entry once the listing is live AND the owner has confirmed it:
       {id:"play",   url:"https://play.google.com/store/apps/details?id=com.everneed.store", verified:"YYYY-MM-DD"}
       {id:"github", url:"https://github.com/Connexa-hub/Everneed/releases/tag/<approved-tag>", verified:"YYYY-MM-DD"}
     Anything that is not on the allow-list below (host, path, package id, https) is dropped, never rendered. */
  var DESTINATIONS=[];

  var ALLOWED={
    play:{label:"Get it on Google Play",host:"play.google.com",path:"/store/apps/details",pkg:"com.everneed.store"},
    github:{label:"Download the APK (GitHub release)",host:"github.com",prefix:"/Connexa-hub/Everneed/releases"}
  };
  var ORDER=["play","github"];

  /* Returns [{id,label,url}] for entries that pass every rule, Google Play first, one per platform. */
  function visible(list){
    var seen={},out=[];
    (Array.isArray(list)?list:[]).forEach(function(d){
      try{
        if(!d||typeof d!=="object"||typeof d.url!=="string"||d.url.length>300)return;
        var rule=Object.prototype.hasOwnProperty.call(ALLOWED,d.id)?ALLOWED[d.id]:null;
        if(!rule||seen[d.id])return;
        if(typeof d.verified!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(d.verified))return;
        var u=new URL(d.url);
        if(u.protocol!=="https:"||u.hostname!==rule.host||u.username||u.password)return;
        if(rule.path&&(u.pathname!==rule.path||u.searchParams.get("id")!==rule.pkg))return;
        if(rule.prefix&&u.pathname.indexOf(rule.prefix)!==0)return;
        seen[d.id]=1;out.push({id:d.id,label:rule.label,url:u.href});
      }catch(e){}
    });
    out.sort(function(a,b){return ORDER.indexOf(a.id)-ORDER.indexOf(b.id)});
    return out;
  }

  var SCENE='<svg class="ah-scene" viewBox="0 0 360 240" aria-hidden="true" focusable="false">'
    +'<ellipse class="ah-glow" cx="180" cy="116" rx="146" ry="98"/>'
    +'<g class="ah-phone"><rect class="ah-ph-body" x="124" y="16" width="112" height="176" rx="22"/>'
    +'<rect class="ah-ph-screen" x="132" y="28" width="96" height="152" rx="14"/>'
    +'<rect class="ah-tile ah-t1" x="140" y="40" width="36" height="42" rx="8"/><rect class="ah-tile ah-t2" x="184" y="40" width="36" height="42" rx="8"/>'
    +'<rect class="ah-tile ah-t3" x="140" y="90" width="36" height="42" rx="8"/><rect class="ah-tile ah-t4" x="184" y="90" width="36" height="42" rx="8"/>'
    +'<rect class="ah-bar" x="140" y="142" width="80" height="10" rx="5"/><rect class="ah-bar2" x="140" y="159" width="52" height="7" rx="3.5"/></g>'
    +'<g class="ah-p ah-p1"><rect class="ah-box ah-b1" x="40" y="84" width="42" height="36" rx="5"/><rect class="ah-tape" x="58" y="84" width="6" height="36"/></g>'
    +'<g class="ah-p ah-p2"><rect class="ah-box ah-b2" x="280" y="58" width="38" height="32" rx="5"/><rect class="ah-tape" x="296" y="58" width="6" height="32"/></g>'
    +'<g class="ah-p ah-p3"><rect class="ah-box ah-b3" x="270" y="132" width="32" height="28" rx="5"/><rect class="ah-tape" x="283" y="132" width="6" height="28"/></g>'
    +'<line class="ah-road" x1="0" y1="216" x2="360" y2="216"/>'
    +'<g class="ah-van"><rect class="ah-van-body" x="0" y="182" width="62" height="30" rx="5"/><path class="ah-van-cab" d="M62 192h14l10 10v10H62z"/>'
    +'<rect class="ah-van-win" x="68" y="195" width="9" height="8" rx="1"/><rect class="ah-van-stripe" x="10" y="190" width="28" height="6" rx="2"/>'
    +'<circle class="ah-wheel" cx="16" cy="214" r="7"/><circle class="ah-wheel" cx="70" cy="214" r="7"/></g>'
    +'</svg>';

  function steps(){
    return[["Browse stores","Discover products from independent stores in one place."],
      ["Pay in the app","One cart can hold items from several sellers."],
      ["Track your delivery","Follow each order and confirm arrival with your delivery code."]]
      .map(function(s){return'<div class="card"><h3>'+C.esc(s[0])+"</h3><p>"+C.esc(s[1])+"</p></div>"}).join("");
  }

  function actions(dest,signedIn){
    var second=signedIn?'<a class="btn o" href="/account">My account</a>':'<a class="btn o" href="/create-account">Create an account</a>';
    if(!dest.length){
      return'<div class="note ah-note"><span><b>Not published yet</b>The Everneed app has not been released on any store. When an official download is published and verified, it will appear here. Join early access and we will email you when your country opens.</span></div>'
        +'<div class="row" style="margin-top:22px"><a class="btn" href="/early-access">Get early access</a>'+second+"</div>";
    }
    return'<div class="ah-dest">'+dest.map(function(d,i){
      return'<a class="btn ah-dl'+(i?" o":"")+'" data-ah="'+C.esc(d.id)+'" href="'+C.esc(d.url)+'" target="_blank" rel="noopener noreferrer">'+C.esc(d.label)+"</a>";
    }).join("")+"</div>"+'<div class="row" style="margin-top:18px">'+second+"</div>";
  }

  function page(list){
    var dest=visible(list===undefined?DESTINATIONS:list),signedIn=!!(C.me&&C.me());
    return{layout:"pub",active:"",title:"Shop in the app",html:
      '<section class="sec"><div class="w ah-hero"><div class="ah-copy"><span class="pillx"><i></i>Everneed mobile app</span>'
      +'<h1 style="margin-top:18px">The marketplace lives in the app.</h1>'
      +'<p class="lead">Browse stores, fill your cart, pay and follow every delivery in the Everneed app. Sign in to the app with the same Everneed account you use on this website.</p>'
      +actions(dest,signedIn)+'</div><div class="ah-art">'+SCENE+"</div></div></section>"
      +'<section class="sec alt"><div class="w"><h2>From tap to doorstep</h2><div class="g3">'+steps()+"</div></div></section>"
      +'<section class="sec"><div class="w"><div class="band"><h2>Selling instead?</h2><p>Open a store on the website and manage products, orders and earnings from your portal.</p><a class="btn" href="/sell">For sellers</a></div></div></section>'};
  }

  var orig=C.V.shop;
  C.V.shop=function(){
    try{return page()}catch(e){return orig.apply(this,arguments)}
  };
  window.EVAppHandoff={visible:visible,page:page};
})();
