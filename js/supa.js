/* Minimal Supabase client (Auth, REST, Storage) over fetch. Inactive until url and key are set in config.js. */
window.Supa=(function(){
  var C=CFG.supabase||{},U=(C.url||"").replace(/\/$/,""),K=C.key||"",sess=S.get("sess",null);
  function on(){return!!(U&&K)}
  function setSess(j){if(j&&j.access_token){sess={access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Date.now()+(j.expires_in||3600)*1000,uid:(j.user&&j.user.id)||(sess&&sess.uid)};S.set("sess",sess)}return j}
  function raw(path,o){o=o||{};var h={apikey:K,"Content-Type":"application/json",Authorization:"Bearer "+((o.anon!==true&&sess&&sess.access_token)||K)};for(var k in (o.h||{}))h[k]=o.h[k];
    return fetch(U+path,{method:o.m||"GET",headers:h,body:o.b===undefined?undefined:JSON.stringify(o.b)}).then(function(r){return r.text().then(function(t){var j=null;try{j=t?JSON.parse(t):null}catch(e){}if(!r.ok)throw new Error((j&&(j.msg||j.message||j.error_description||j.error))||"Request failed ("+r.status+")");return j})})}
  function ready(){if(!sess||sess.expires_at-Date.now()>60000)return Promise.resolve();return raw("/auth/v1/token?grant_type=refresh_token",{m:"POST",b:{refresh_token:sess.refresh_token},anon:true}).then(setSess).catch(function(){sess=null;S.set("sess",null)})}
  function api(path,o){return ready().then(function(){return raw(path,o)})}
  return{
    on:on,ready:ready,sess:function(){return sess},uid:function(){return sess&&sess.uid||null},
    signUp:function(e,p,meta){return raw("/auth/v1/signup",{m:"POST",b:{email:e,password:p,data:meta},anon:true}).then(function(j){if(j&&j.access_token){setSess(j);return j}return{confirm:true}})},
    signIn:function(e,p){return raw("/auth/v1/token?grant_type=password",{m:"POST",b:{email:e,password:p},anon:true}).then(setSess)},
    otp:function(phone){return raw("/auth/v1/otp",{m:"POST",b:{phone:phone},anon:true})},
    verify:function(phone,code){return raw("/auth/v1/verify",{m:"POST",b:{type:"sms",phone:phone,token:code},anon:true}).then(setSess)},
    out:function(){if(sess)raw("/auth/v1/logout",{m:"POST"}).catch(function(){});sess=null;S.set("sess",null)},
    profile:function(){return api("/rest/v1/profiles?id=eq."+sess.uid+"&select=*").then(function(r){return r[0]||{}})},
    patchProfile:function(p){return api("/rest/v1/profiles?id=eq."+sess.uid,{m:"PATCH",b:p})},
    rpc:function(fn,args){return raw("/rest/v1/rpc/"+fn,{m:"POST",b:args,anon:true})},
    emailOtp:function(email){return raw("/auth/v1/otp",{m:"POST",b:{email:email,create_user:true},anon:true})},
    verifyEmail:function(email,code){return raw("/auth/v1/verify",{m:"POST",b:{type:"email",email:email,token:code},anon:true}).then(setSess)},
    upsert:function(t,o,conf,ignore){return api("/rest/v1/"+t+"?on_conflict="+conf,{m:"POST",b:o,h:{Prefer:(ignore?"resolution=ignore-duplicates":"resolution=merge-duplicates")+",return=representation"}})},
    fn:function(n,b){return api("/functions/v1/"+n,{m:"POST",b:b})},
    q:function(p,m){return api(p,{m:m||"GET"})},
    list:function(t){return api("/rest/v1/"+t+"?select=*&order=at.desc")},
    insert:function(t,o){return api("/rest/v1/"+t,{m:"POST",b:o,h:{Prefer:"return=representation"}})},
    patch:function(t,id,p){return api("/rest/v1/"+t+"?id=eq."+encodeURIComponent(id),{m:"PATCH",b:p})},
    del:function(t,id){return api("/rest/v1/"+t+"?id=eq."+encodeURIComponent(id),{m:"DELETE"})},
    upload:function(dataUrl){var b=atob(dataUrl.split(",")[1]),u=new Uint8Array(b.length),i,path=(sess?sess.uid:"x")+"/"+Date.now()+".jpg";for(i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
      return ready().then(function(){return fetch(U+"/storage/v1/object/media/"+path,{method:"POST",headers:{apikey:K,Authorization:"Bearer "+(sess?sess.access_token:K),"Content-Type":"image/jpeg"},body:u})}).then(function(r){if(!r.ok)throw new Error("Image upload failed");return U+"/storage/v1/object/public/media/"+path})}
  };
})();
