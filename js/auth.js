/* Email-first sign-in: email, then password or code, then profile. Never reveals whether an email is registered. */
window.Auth=(function(){
  var esc=A.esc,ico=A.ico,notify=A.notify,busy=false;
  function shell(ic,t,d,body){return'<div class="onb"><div class="eb big">'+ico(ic,52)+"</div><h1>"+t+'</h1><p class="m">'+d+"</p>"+body+"</div>"}
  var back='<button class="lnk" data-act="aback">Use a different email</button>';
  function googleButton(){return'<button type="button" class="btn o w" data-act="google" style="display:flex;align-items:center;justify-content:center;gap:10px"><svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.7c3.9-3.6 6-8.9 6-14.9z"/><path fill="#34A853" d="M24 44c5.6 0 10.3-1.9 13.7-5.1l-6.7-5c-1.9 1.3-4.2 2.1-7 2.1-5.4 0-10-3.7-11.6-8.7H3.5v5.2C7 39.4 15 44 24 44z"/><path fill="#FBBC05" d="M12.4 27.3a12 12 0 0 1 0-6.6v-5.2H3.5a20 20 0 0 0 0 17z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.2 5.8 29.5 4 24 4 15 4 7 8.6 3.5 15.5l8.9 5.2c1.6-5 6.2-8.6 11.6-8.6z"/></svg>Continue with Google</button><div class="or"><span>or continue with email</span></div>'}
  function b64url(bytes){var s="";for(var i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"")}
  function google(){if(!Supa.on()){notify("Sign-in is unavailable while offline.","err");return}
    if(!window.crypto||!crypto.subtle||!crypto.getRandomValues||!window.TextEncoder){notify("Secure Google sign-in isn't supported by this browser. Update your browser and try again.","err");return}
    var native=window.Capacitor&&Capacitor.getPlatform&&Capacitor.getPlatform()!=="web",redirect=native?"com.everneed.store://auth/callback":location.origin+location.pathname;
    var bytes=new Uint8Array(32);crypto.getRandomValues(bytes);var verifier=b64url(bytes);
    crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier)).then(function(hash){var challenge=b64url(new Uint8Array(hash));S.set("oauth_pkce",{verifier:verifier,created:Date.now()});var url=Supa.oauthUrl("google",redirect,challenge);
      if(native){var B=Capacitor.Plugins&&Capacitor.Plugins.Browser;if(!B||!B.open){S.set("oauth_pkce",null);notify("Google sign-in is not available in this build yet.","err");return}B.open({url:url}).catch(function(e){S.set("oauth_pkce",null);A.netErr(e)})}
      else location.href=url;
    }).catch(function(e){notify("Could not start secure Google sign-in. Please try again.","err");A.netErr(e)});
  }
  function page(){var a=A.au(),c=A.ctx();
    if(a.step==="code")return shell("mail","Check your email","We sent a 6-digit code to <b>"+esc(a.email)+"</b>.",googleButton()+'<form class="act" data-form="acode" novalidate><input class="otp" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="······"><button class="btn w">Verify</button></form><button class="lnk" data-act="aresend">Resend code</button><button class="lnk" data-act="apw">Use a password instead</button>'+back);
    if(a.step==="pass")return shell("lock","Sign in","Enter your password to continue.",googleButton()+'<form class="act" data-form="apass" novalidate><input name="password" type="password" placeholder="Password" autocomplete="current-password"><button class="btn w">Sign in</button></form><button class="lnk" data-act="anew">New here? Create an account</button>'+back);
    if(a.step==="create")return shell("lock","Create your account","Set a password and tell us a little about you.",googleButton()+'<form class="act" data-form="acreate" novalidate><input name="name" placeholder="Full name" autocomplete="name"><input name="dob" placeholder="Date of birth (DD/MM/YYYY)" inputmode="numeric"><input name="password" type="password" placeholder="Password (6+ characters)" autocomplete="new-password">'+A.field("country","Country",c.code)+A.fileBtn("Add a photo (optional)")+'<button class="btn w">Create account</button></form>'+back);
    if(a.step==="profile")return shell("me","Tell us about you","A few details to finish your account.",'<form class="act" data-form="aprof" novalidate><input name="name" placeholder="Full name" autocomplete="name" value="'+esc(a.name||"")+'"><input name="dob" placeholder="Date of birth (DD/MM/YYYY)" inputmode="numeric">'+A.field("country","Country",c.code)+A.fileBtn("Add a photo (optional)")+'<button class="btn w">Finish</button></form>');
    var phone=c.auth.indexOf("phone")>-1&&Supa.on();
    return shell("me","Welcome to "+esc(CFG.name),"Enter your email to sign in or create an account.",googleButton()+'<form class="act" data-form="aemail" novalidate><input name="email" type="email" placeholder="Email address" autocomplete="email" value="'+esc(a.email||"")+'"><button class="btn w">Continue</button></form>'+(phone?'<div class="or"><span>or</span></div><div class="act"><button class="btn o w" data-act="otp">Continue with phone</button></div>':"")+'<p class="m sm" style="margin-top:18px">'+A.legal()+"</p>");
  }
  function dob(s){s=(s||"").trim();var m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/),y,mo,da;
    if(m){da=+m[1];mo=+m[2];y=+m[3]}else{m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return null;y=+m[1];mo=+m[2];da=+m[3]}
    var dt=new Date(y,mo-1,da);if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==da||dt>new Date())return null;
    return{iso:y+"-"+("0"+mo).slice(-2)+"-"+("0"+da).slice(-2),age:Math.floor((Date.now()-dt)/31557600000)}}
  function authErr(e){var m=String(e&&e.message||e);if(/network|fetch|offline|timeout|failed to/i.test(m))return A.netErr(e);notify("Check your email or password.","err")}
  function send(em,quiet){return Supa.emailOtp(em).then(function(){A.au({step:"code",email:em});if(!quiet)A.refresh();notify("Code sent to "+em)}).catch(A.netErr)}
  function submit(k,f,d){
    var a=A.au();
    if(k==="aemail"){var em=(d.email||"").trim().toLowerCase();if(!/.+@.+\..+/.test(em)){notify("Enter a valid email address.","err");return true}
      if(CFG.emailCodes)send(em);else{A.au({step:"pass",email:em});A.refresh()}return true}
    if(k==="apass"){if(!d.password){notify("Enter your password.","err");return true}Supa.signIn(a.email,d.password).then(A.authed).catch(authErr);return true}
    if(k==="acode"){var cd=(d.code||"").trim();if(cd.length<6){notify("Enter the 6-digit code from your email.","err");return true}
      Supa.verifyEmail(a.email,cd).then(function(){return Supa.profile()}).then(function(p){if(p.name&&p.dob)return A.authed();A.au({step:"profile",email:a.email,name:p.name||""});A.refresh()}).catch(A.netErr);return true}
    if(k==="acreate"){var n2=(d.name||"").trim(),b2=dob(d.dob),m2=CFG.minAge||18;
      if(!n2){notify("Enter your full name.","err");return true}
      if(!b2){notify("Enter a valid date of birth, like 14/05/1998.","err");return true}
      if(b2.age<m2){notify("You must be "+m2+" or older to create an account.","err");return true}
      if((d.password||"").length<6){notify("Use at least 6 characters for the password.","err");return true}
      if(busy)return true;busy=true;
      var f2=f.file.files[0],g2=function(ph){Ctx.set(d.country);Supa.signUp(a.email,d.password,{name:n2,country:d.country}).then(function(r){if(r&&r.confirm){notify("Check your email to confirm your account, then sign in.");return}var p={name:n2,dob:b2.iso,country:d.country};if(ph)p.photo=ph;return Supa.patchProfile(p).then(A.authed)}).catch(function(e){var m=String(e&&e.message||e);if(/network|fetch|offline|timeout|failed to/i.test(m))return A.netErr(e);notify("We could not create that account. Check your details, or sign in if you already have one.","err")}).then(function(){busy=false})};
      f2?A.shrink(f2,200,g2):g2("");return true}
    if(k==="aprof"){var n=(d.name||"").trim(),b=dob(d.dob),min=CFG.minAge||18;
      if(!n){notify("Enter your full name.","err");return true}
      if(!b){notify("Enter a valid date of birth, like 14/05/1998.","err");return true}
      if(b.age<min){notify("You must be "+min+" or older to create an account.","err");return true}
      var fl=f.file.files[0],go=function(ph){Ctx.set(d.country);var p={name:n,dob:b.iso,country:d.country};if(ph)p.photo=ph;Supa.patchProfile(p).then(A.authed).catch(A.netErr)};
      fl?A.shrink(fl,200,go):go("");return true}
    return false}
  function act(k,d){
    if(k==="google"){google();return true}
    if(k==="aback"){A.au({step:"email"});A.refresh();return true}
    if(k==="aresend"){send(A.au().email,true);return true}
    if(k==="anew"){A.au({step:"create",email:A.au().email});A.refresh();return true}
    if(k==="apw"){A.au({step:"pass",email:A.au().email});A.refresh();return true}
    return false}
  function fixDob(v,del){var d=v.replace(/\D/g,"").slice(0,8);
    if(d.length&&+d[0]>3)d=("0"+d).slice(0,8);
    if(d.length>=2){var dd=+d.slice(0,2);if(dd>31)d="31"+d.slice(2);else if(dd===0)d="01"+d.slice(2)}
    if(d.length>=3&&+d[2]>1)d=(d.slice(0,2)+"0"+d.slice(2)).slice(0,8);
    if(d.length>=4){var mm=+d.slice(2,4);if(mm>12)d=d.slice(0,2)+"12"+d.slice(4);else if(mm===0)d=d.slice(0,2)+"01"+d.slice(4)}
    if(d.length>=5&&"12".indexOf(d[4])<0)d=d.slice(0,4);
    if(d.length===8){var mx=new Date(+d.slice(4),+d.slice(2,4),0).getDate();if(+d.slice(0,2)>mx)d=("0"+mx).slice(-2)+d.slice(2)}
    var o=d.slice(0,2)+(d.length>2?"/"+d.slice(2,4):"")+(d.length>4?"/"+d.slice(4):"");
    if(!del&&(d.length===2||d.length===4))o+="/";return o}
  document.addEventListener("input",function(e){var t=e.target;if(t.name!=="dob")return;var prev=t.dataset.p||"",o=fixDob(t.value,t.value.length<prev.length);t.value=o;t.dataset.p=o});
  return{page:page,submit:submit,act:act};
})();
