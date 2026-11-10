/* Small Supabase client (Auth, REST, Storage) for the website. Same project and same rules as the app. */
(function(){
  var C=CFG.supabase,U=C.url.replace(/\/$/,""),K=C.key,sess=null,KEY="en_web_sess";
  try{sess=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
  function save(j){if(j&&j.access_token){sess={access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Date.now()+(j.expires_in||3600)*1000,uid:(j.user&&j.user.id)||(sess&&sess.uid)};try{localStorage.setItem(KEY,JSON.stringify(sess))}catch(e){}}return j}
  function raw(path,o){o=o||{};var h={apikey:K,"Content-Type":"application/json",Authorization:"Bearer "+((!o.anon&&sess&&sess.access_token)||K)};for(var k in (o.h||{}))h[k]=o.h[k];
    return fetch(U+path,{method:o.m||"GET",headers:h,body:o.b===undefined?undefined:JSON.stringify(o.b)}).then(function(r){return r.text().then(function(t){var j=null;try{j=t?JSON.parse(t):null}catch(e){}
      if(!r.ok)throw new Error((j&&(j.msg||j.message||j.error_description||j.error))||"Request failed ("+r.status+")");return j})})}
  function ready(){if(!sess||sess.expires_at-Date.now()>60000)return Promise.resolve();
    return raw("/auth/v1/token?grant_type=refresh_token",{m:"POST",b:{refresh_token:sess.refresh_token},anon:1}).then(save).catch(function(){sess=null;try{localStorage.removeItem(KEY)}catch(e){}})}
  function api(p,o){return ready().then(function(){return raw(p,o)})}
  var REP={Prefer:"return=representation"};
  window.Supa={
    uid:function(){return sess&&sess.uid||null},
    signIn:function(e,p){return raw("/auth/v1/token?grant_type=password",{m:"POST",b:{email:e,password:p},anon:1}).then(save)},
    signUp:function(e,p,meta){return raw("/auth/v1/signup",{m:"POST",b:{email:e,password:p,data:meta},anon:1}).then(function(j){return j&&j.access_token?save(j):{confirm:true}})},
    out:function(){sess=null;try{localStorage.removeItem(KEY)}catch(e){}},
    get:function(p){return api("/rest/v1/"+p)},
    insert:function(t,o){return api("/rest/v1/"+t,{m:"POST",b:o,h:REP})},
    patch:function(t,id,p){return api("/rest/v1/"+t+"?id=eq."+encodeURIComponent(id),{m:"PATCH",b:p,h:REP})},
    patchBy:function(t,c,v,p){return api("/rest/v1/"+t+"?"+c+"=eq."+encodeURIComponent(v),{m:"PATCH",b:p,h:REP})},
    rpc:function(f,a){return api("/rest/v1/rpc/"+f,{m:"POST",b:a})},
    rpcAnon:function(f,a){return raw("/rest/v1/rpc/"+f,{m:"POST",b:a,anon:1})},
    profile:function(){return api("/rest/v1/profiles?id=eq."+sess.uid+"&select=*").then(function(r){return r[0]||{}})},
    patchProfile:function(p){return api("/rest/v1/profiles?id=eq."+sess.uid,{m:"PATCH",b:p})},
    upload:function(file,folder){if(file.size>4e6)return Promise.reject(new Error("Image is larger than 4 MB"));
      var ext=(file.type.split("/")[1]||"jpg").replace("jpeg","jpg"),path=folder+"/"+Date.now()+"."+ext;
      return ready().then(function(){return fetch(U+"/storage/v1/object/media/"+path,{method:"POST",headers:{apikey:K,Authorization:"Bearer "+(sess?sess.access_token:K),"Content-Type":file.type||"image/jpeg"},body:file})})
        .then(function(r){if(!r.ok)throw new Error("Image upload failed");return U+"/storage/v1/object/public/media/"+path})}
  };
})();
