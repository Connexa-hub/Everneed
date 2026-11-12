/* Explicit Cloudflare Turnstile loader for the public waitlist and guest-support forms.
   The browser only obtains a one-use token; the public-forms Edge Function validates it server-side. */
window.Turnstile=(function(){
  var loading=null;
  function load(){
    if(window.turnstile&&typeof window.turnstile.render==="function")return Promise.resolve();
    if(loading)return loading;
    loading=new Promise(function(resolve,reject){
      var s=document.createElement("script");
      s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async=true;s.defer=true;
      s.onload=function(){if(window.turnstile&&typeof window.turnstile.render==="function")resolve();else{loading=null;reject(new Error("Security check could not start"))}};
      s.onerror=function(){loading=null;reject(new Error("Security check could not load"))};
      document.head.appendChild(s);
    });
    return loading;
  }
  function mount(el,action){
    if(!el)return Promise.reject(new Error("Security check is unavailable"));
    if(!window.CFG||!CFG.turnstileSitekey)return Promise.reject(new Error("Security check is not configured"));
    return load().then(function(){
      return new Promise(function(resolve,reject){
        var token=null,id=null,removed=false;
        try{
          id=window.turnstile.render(el,{
            sitekey:CFG.turnstileSitekey,action:action,theme:"auto",size:"flexible",
            callback:function(value){token=value},
            "expired-callback":function(){token=null},
            "error-callback":function(){token=null}
          });
          resolve({
            take:function(){if(removed||!token)throw new Error("Complete the security check first");var value=token;token=null;return value},
            reset:function(){token=null;if(!removed&&window.turnstile)window.turnstile.reset(id)},
            remove:function(){token=null;if(!removed&&window.turnstile){window.turnstile.remove(id);removed=true}}
          });
        }catch(e){reject(e)}
      });
    });
  }
  return{mount:mount};
})();
