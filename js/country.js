/* Region context and currency. Product prices are stored in the base currency (CFG.baseCurrency) and converted for the shopper's region.
   Rates come from open.er-api.com (free, no key), cached for 12 hours. Without rates the app shows the base currency instead of guessing. */
window.Ctx=(function(){
  var rt=S.get("fx",null);
  function base(){return CFG.baseCurrency||"NGN"}
  function find(cur){var C=CFG.countries;for(var k in C)if(C[k].cur===cur)return C[k];return null}
  function dig(cur){return cur==="NGN"||cur==="KES"?0:2}
  function guess(){var C=CFG.countries,r=((navigator.language||"").split("-")[1]||"").toUpperCase(),z="";
    if(C[r])return r;try{z=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}
    for(var k in C)if((C[k].tz||[]).indexOf(z)>-1)return k;return CFG.defaultCountry}
  return{
    guess:guess,base:base,
    loadRates:function(){if(rt&&Date.now()-rt.t<432e5)return Promise.resolve();
      return fetch("https://open.er-api.com/v6/latest/"+base()).then(function(r){return r.json()}).then(function(j){if(j&&j.rates){rt={t:Date.now(),rates:j.rates};S.set("fx",rt)}}).catch(function(){})},
    code:function(){var c=S.get("cty",null);return CFG.countries[c]?c:guess()},
    set:function(c){if(CFG.countries[c])S.set("cty",c)},
    get:function(){var k=this.code(),o=CFG.countries[k],r={code:k};for(var i in o)r[i]=o[i];
      var rate=r.cur===base()?1:(rt&&rt.rates&&rt.rates[r.cur]);
      if(rate)r.fx=true;else{var b=find(base());r.cur=base();r.symbol=b?b.symbol:"";r.locale=b?b.locale:"en-US";rate=1;r.fx=false}
      r.rate=rate;return r},
    conv:function(n){var c=this.get(),k=Math.pow(10,dig(c.cur));return Math.round(n*c.rate*(1+(c.fxMarkup||0)/100)*k)/k},
    money:function(n,cur){cur=cur||this.get().cur;var f=find(cur),d=dig(cur);
      try{return new Intl.NumberFormat(f?f.locale:"en-US",{style:"currency",currency:cur,minimumFractionDigits:d,maximumFractionDigits:d}).format(n)}catch(e){return cur+" "+Number(n).toFixed(d)}}
  };
})();
