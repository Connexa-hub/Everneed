/* Country context. Stage 1 guesses from device region and timezone, and the user confirms at sign-up.
   Stage 2 adds a server-side check so a country cannot be faked. */
window.Ctx=(function(){
  function guess(){var C=CFG.countries,r=((navigator.language||"").split("-")[1]||"").toUpperCase(),z="";
    if(C[r])return r;try{z=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}
    for(var k in C)if((C[k].tz||[]).indexOf(z)>-1)return k;return CFG.defaultCountry}
  return{
    guess:guess,
    code:function(){var c=S.get("cty",null);return CFG.countries[c]?c:guess()},
    set:function(c){if(CFG.countries[c])S.set("cty",c)},
    get:function(){var k=this.code(),o=CFG.countries[k],r={code:k};for(var i in o)r[i]=o[i];return r}
  };
})();
