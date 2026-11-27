/* Shopping / My store switch for the app (see docs/WORKFLOW/SELLER_APP_EXPERIENCE_SPEC.md).
   Shopping lives only in the app, so the switch lives here. "My store" opens the seller workspace that the Android build bundles
   under /seller/. It uses the same signed-in session (en_sess): nothing is passed in a link and nobody signs in twice.
   Shown only in the native app (or with ?mode=1 for testing). */
window.Mode=(function(){
  var KEY="en_mode",ENTRY="/seller/index.html",st={done:false,store:null,admin:false,p:null};
  function nat(){try{return!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform())||/[?&]mode=1\b/.test(location.search)}catch(e){return false}}
  function get(){try{return localStorage.getItem(KEY)||"shop"}catch(e){return"shop"}}
  function set(m){try{localStorage.setItem(KEY,m)}catch(e){}}
  function signed(){return!!(window.Supa&&Supa.on()&&Supa.uid())}
  function lookup(){
    if(st.p)return st.p;
    if(!signed())return Promise.resolve(st);
    st.p=Promise.all([Supa.q("/rest/v1/stores?select=id,activation_status&owner_id=eq."+encodeURIComponent(Supa.uid()),"GET",true).catch(function(){return[]}),Supa.profile().catch(function(){return{}})]).then(function(a){
      st.store=(a[0]||[])[0]||null;st.admin=(a[1]||{}).role==="admin";st.done=true;
      var b=document.querySelector("[data-mode=work]");if(b)b.textContent=label();return st}).catch(function(){st.p=null;return st});
    return st.p;
  }
  function label(){return st.admin?"Admin":st.store?"My store":st.done?"Sell":"My store"}
  function enter(){set("seller");location.assign(ENTRY)}
  function work(){
    lookup().then(function(s){
      if(s.admin||s.store){enter();return}
      location.hash="#/m"; /* no store yet: the existing open-a-store flow */
    });
  }
  document.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-mode]");if(!b)return;
    if(b.getAttribute("data-mode")==="work"){e.preventDefault();e.stopPropagation();work()}
  },true);
  /* Reopen in the workspace the person was last using, once per app launch, so a missing or broken seller bundle can never trap them. */
  function boot(){
    try{
      if(!nat()||get()!=="seller"||!signed()||sessionStorage.getItem("en_mode_boot"))return;
      sessionStorage.setItem("en_mode_boot","1");location.replace(ENTRY);
    }catch(e){}
  }
  boot();
  return{
    card:function(){
      if(!nat()||!signed())return"";
      lookup();
      return'<div class="mode" role="group" aria-label="How do you want to use Everneed?"><button type="button" class="on" aria-pressed="true" data-mode="shop">Shopping</button><button type="button" aria-pressed="false" data-mode="work">'+label()+"</button></div>";
    },
    get:get,set:set
  };
})();
