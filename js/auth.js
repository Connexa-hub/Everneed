/* Email-first sign-in: email, then code (customers) or password (admins), then profile. */
window.Auth=(function(){
  var esc=A.esc,ico=A.ico,notify=A.notify,busy=false;
  var IDV={NG:"NIN",GH:"Ghana Card",KE:"National ID",ZA:"South African ID"};
  function shell(ic,t,d,body){return'<div class="onb"><div class="eb big">'+ico(ic,52)+"</div><h1>"+t+'</h1><p class="m">'+d+"</p>"+body+"</div>"}
  var back='<button class="lnk" data-act="aback">Use a different email</button>';
  function page(){var a=A.au(),c=A.ctx();
    if(a.step==="code")return shell("mail","Check your email","We sent a 6-digit code to <b>"+esc(a.email)+"</b>.",'<form class="act" data-form="acode" novalidate><input class="otp" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="······"><button class="btn w">Verify</button></form><button class="lnk" data-act="aresend">Resend code</button>'+back);
    if(a.step==="pass")return shell("lock","Welcome back","Enter your password to continue.",'<form class="act" data-form="apass" novalidate><input name="password" type="password" placeholder="Password" autocomplete="current-password"><button class="btn w">Sign in</button></form><button class="lnk" data-act="anew">New here? Create an account</button>'+back);
    if(a.step==="create")return shell("lock","Create your account","Set a password and tell us a little about you.",'<form class="act" data-form="acreate" novalidate><input name="name" placeholder="Full name" autocomplete="name"><input name="dob" placeholder="Date of birth (DD/MM/YYYY)" inputmode="numeric"><input name="password" type="password" placeholder="Password (6+ characters)" autocomplete="new-password">'+A.field("country","Country",c.code)+A.fileBtn("Add a photo (optional)")+(IDV[c.code]?'<div class="rw dis"><span><b>Verify with '+IDV[c.code]+'</b><small>Trusted badge and faster checkout. Coming soon.</small></span></div>':"")+'<button class="btn w">Create account</button></form>'+back);
    if(a.step==="profile")return shell("me","Tell us about you","A few details to finish your account.",'<form class="act" data-form="aprof" novalidate><input name="name" placeholder="Full name" autocomplete="name" value="'+esc(a.name||"")+'"><input name="dob" placeholder="Date of birth (DD/MM/YYYY)" inputmode="numeric">'+A.field("country","Country",c.code)+A.fileBtn("Add a photo (optional)")+(IDV[c.code]?'<div class="rw dis"><span><b>Verify with '+IDV[c.code]+'</b><small>Trusted badge and faster checkout. Coming soon.</small></span></div>':"")+'<button class="btn w">Finish</button></form>');
    var phone=c.auth.indexOf("phone")>-1&&Supa.on(),nin=c.auth.indexOf("nin")>-1;
    return shell("me","Welcome to "+esc(CFG.name),"Enter your email to sign in or create an account.",'<form class="act" data-form="aemail" novalidate><input name="email" type="email" placeholder="Email address" autocomplete="email" value="'+esc(a.email||"")+'"><button class="btn w">Continue</button></form><div class="or"><span>or</span></div><div class="act"><button class="btn o w" data-act="gsoon" data-n="Google"><span class="gi">G</span>Continue with Google</button>'+(phone?'<button class="btn o w" data-act="otp">Continue with phone</button>':"")+(nin?'<button class="btn o w" data-act="gsoon" data-n="NIN">Continue with NIN</button>':"")+'</div><p class="m sm" style="margin-top:18px">'+A.legal()+"</p>");
  }
  function dob(s){s=(s||"").trim();var m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/),y,mo,da;
    if(m){da=+m[1];mo=+m[2];y=+m[3]}else{m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return null;y=+m[1];mo=+m[2];da=+m[3]}
    var dt=new Date(y,mo-1,da);if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==da||dt>new Date())return null;
    return{iso:y+"-"+("0"+mo).slice(-2)+"-"+("0"+da).slice(-2),age:Math.floor((Date.now()-dt)/31557600000)}}
  function send(em,quiet){return Supa.emailOtp(em).then(function(){A.au({step:"code",email:em});if(!quiet)A.refresh();notify("Code sent to "+em)}).catch(A.netErr)}
  function submit(k,f,d){
    var a=A.au();
    if(k==="aemail"){var em=(d.email||"").trim().toLowerCase();if(!/.+@.+\..+/.test(em)){notify("Enter a valid email address.","err");return true}
      if(CFG.emailCodes){send(em);return true}A.au({step:"pass",email:em});A.refresh();return true}
    if(k==="apass"){if(!d.password){notify("Enter your password.","err");return true}Supa.signIn(a.email,d.password).then(A.authed).catch(function(){notify("That email and password do not match.","err")});return true}
    if(k==="acode"){var cd=(d.code||"").trim();if(cd.length<6){notify("Enter the 6-digit code from your email.","err");return true}
      Supa.verifyEmail(a.email,cd).then(function(){return Supa.profile()}).then(function(p){if(p.name&&p.dob)return A.authed();A.au({step:"profile",email:a.email,name:p.name||""});A.refresh()}).catch(A.netErr);return true}
    if(k==="acreate"){var n2=(d.name||"").trim(),b2=dob(d.dob),m2=CFG.minAge||18;
      if(!n2){notify("Enter your full name.","err");return true}
      if(!b2){notify("Enter a valid date of birth, like 14/05/1998.","err");return true}
      if(b2.age<m2){notify("You must be "+m2+" or older to create an account.","err");return true}
      if((d.password||"").length<6){notify("Use at least 6 characters for the password.","err");return true}
      if(busy)return true;busy=true;
      var f2=f.file.files[0],g2=function(ph){Ctx.set(d.country);Supa.signUp(a.email,d.password,{name:n2,country:d.country}).then(function(r){if(r&&r.confirm){notify("Check your email to confirm your account, then sign in.");return}var p={name:n2,dob:b2.iso,country:d.country};if(ph)p.photo=ph;return Supa.patchProfile(p).then(A.authed)}).catch(A.netErr).then(function(){busy=false})};
      f2?A.shrink(f2,200,g2):g2("");return true}
    if(k==="aprof"){var n=(d.name||"").trim(),b=dob(d.dob),min=CFG.minAge||18;
      if(!n){notify("Enter your full name.","err");return true}
      if(!b){notify("Enter a valid date of birth, like 14/05/1998.","err");return true}
      if(b.age<min){notify("You must be "+min+" or older to create an account.","err");return true}
      var fl=f.file.files[0],go=function(ph){Ctx.set(d.country);var p={name:n,dob:b.iso,country:d.country};if(ph)p.photo=ph;Supa.patchProfile(p).then(A.authed).catch(A.netErr)};
      fl?A.shrink(fl,200,go):go("");return true}
    return false}
  function act(k,d){
    if(k==="aback"){A.au({step:"email"});A.refresh();return true}
    if(k==="aresend"){send(A.au().email,true);return true}
    if(k==="anew"){A.au({step:"create",email:A.au().email});A.refresh();return true}
    if(k==="gsoon"){notify(d.n+" sign-in is coming soon.");return true}
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
