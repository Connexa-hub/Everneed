/* Seller store setup: a five-step guided registration (Shopify style). Answers /portal/apply.
   Registration only asks for what Everneed needs to review a store. Opening hours, returns, delivery text and
   contact links are managed after approval in Settings (settings.js), not here.
   Saved where:
     step 1  stores: name, tagline, about, accent (palette id), logo_url, cover_url
     step 2  stores: categories, country, state, city      store_private: phone (international format)
     step 3  store_private: pickup_address, direct_delivery_enabled, delivery_zones
     step 4  store_applications: bank_name, account_number, account_name
     step 5  store_applications: business_name; policy acceptance (accept_policy); submit_store
   An owner may add store_id when a row is created but never change it, so updates never send it. */
(function(){
  var C=Core,esc=C.esc,$=C.$,V=C.V,A=C.A,F=C.F,enc=encodeURIComponent,base=V.portal;
  var S={uid:null,store:null,priv:null,app:null,cats:[],pol:[],step:0,at:0,zones:[],accent:"emerald"};
  var STEPS=[["Your store","Name and look"],["About you","Categories and location"],["Pickup","Where items are kept"],["Payout","Where we pay you"],["Review","Business and policies"]];
  var SCENE=[0,1,2,4,5,6];
  var HEAD=[null,
    ["Let’s set up your store","Choose a name, add your logo and pick a colour. Shoppers see this first."],
    ["Tell us about your business","Pick what you sell and where you are, so we can show your store to the right shoppers."],
    ["Pickup and delivery areas","Tell us where your items are kept and which areas you can deliver to yourself."],
    ["Where should we pay you?","Add the bank account for your earnings. Only the Everneed team can see it."],
    ["Review and send","Check everything, accept the seller policies and send your store for review."]];
  var N=STEPS.length;

  function clean(v,n){return String(v==null?"":v).replace(/\s+/g," ").trim().slice(0,n||200)}
  function area(v,n){return String(v==null?"":v).replace(/\r/g,"").trim().slice(0,n||2000)}
  function need(l){for(var i=0;i<l.length;i++){if(!l[i][0]){C.toast(l[i][1],true);return true}}return false}
  function fail(e){
    var m=e&&e.message||"That did not work";
    if(/permission denied/i.test(m))m="Everneed could not save this part yet ("+m+"). Please try again in a few minutes, and contact support if it continues.";
    C.toast(m,true);
  }
  function again(){C.go(location.pathname,true)}
  function toggle(arr,v,on){var i=arr.indexOf(v);if(on&&i<0)arr.push(v);if(!on&&i>-1)arr.splice(i,1)}
  function initial(n){return(String(n||"S").trim().charAt(0)||"S").toUpperCase()}
  function busy(f,on){[].slice.call(f.querySelectorAll("button[type=submit]")).forEach(function(b){b.disabled=on;if(on){b.setAttribute("data-t",b.textContent);b.textContent="Saving…"}else if(b.getAttribute("data-t")){b.textContent=b.getAttribute("data-t")}})}
  function setText(id,t){var el=document.getElementById(id);if(el)el.textContent=t}

  function shrink(file){
    return new Promise(function(done){
      if(file.type==="image/gif"&&file.size<4e6)return done(file);
      var img=new Image(),url=URL.createObjectURL(file);
      img.onload=function(){
        var w=img.naturalWidth,h=img.naturalHeight,k=Math.min(1,1600/Math.max(w,h));
        if(k===1&&file.size<1500000){URL.revokeObjectURL(url);return done(file)}
        var cv=document.createElement("canvas");cv.width=Math.max(1,Math.round(w*k));cv.height=Math.max(1,Math.round(h*k));
        var cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(img,0,0,cv.width,cv.height);
        cv.toBlob(function(b){URL.revokeObjectURL(url);if(!b)return done(file);done(new File([b],(file.name||"photo").replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}))},"image/jpeg",0.85);
      };
      img.onerror=function(){URL.revokeObjectURL(url);done(file)};
      img.src=url;
    });
  }
  function uploadImage(file,folder){return shrink(file).then(function(f){return Supa.upload(f,folder)})}

  function load(force){
    var uid=Supa.uid();
    if(!force&&S.uid===uid&&Date.now()-S.at<20000)return Promise.resolve();
    var soft=function(){return[]};
    return Promise.all([Supa.get("stores?select=*&owner_id=eq."+enc(uid)),Supa.get("collections?select=name,grp,icon&order=name.asc").catch(soft)]).then(function(a){
      S.uid=uid;S.store=a[0]&&a[0][0]||null;S.cats=a[1]||[];S.priv=null;S.app=null;S.pol=[];
      if(!S.store)return;
      var id=enc(S.store.id),cc=enc(S.store.country||"NG");
      return Promise.all([
        Supa.get("store_private?select=*&store_id=eq."+id).catch(soft),
        Supa.get("store_applications?select=*&store_id=eq."+id).catch(soft),
        Supa.get("policy_documents?select=*&country=eq."+cc+"&published=eq.true&requires_acceptance=eq.true&locale=eq.en&effective_at=lte.now()").catch(soft)
      ]).then(function(b){S.priv=b[0][0]||null;S.app=b[1][0]||null;S.pol=b[2]||[]});
    }).then(function(){
      S.at=Date.now();
      S.zones=((S.priv&&S.priv.delivery_zones)||[]).slice();
      S.accent=(S.store&&S.store.accent)||S.accent||"emerald";
    });
  }
  function done(n){
    var s=S.store,p=S.priv||{},a=S.app||{};
    if(n===1)return!!s;
    if(n===2)return!!(s&&s.categories&&s.categories.length&&s.state&&s.city&&p.phone);
    if(n===3)return!!p.pickup_address;
    if(n===4)return!!(a.account_number&&a.bank_name&&a.account_name);
    return!!s&&s.status!=="draft"&&s.status!=="rejected";
  }
  function canGo(k){for(var j=1;j<k;j++){if(!done(j))return false}return true}
  function firstOpen(){for(var k=1;k<=N;k++){if(!done(k))return k}return N}

  V.portal=function(p){
    if(p[0]!=="apply"||!Supa.uid())return base(p);
    return load(false).then(function(){
      var s=S.store;
      if(s&&s.status!=="draft"&&s.status!=="rejected")return{redirect:"/portal"};
      if(!S.step)S.step=firstOpen();
      var n=Math.max(1,Math.min(N,S.step));if(n>1&&!s)n=1;
      S.step=n;
      return{layout:"setup",active:"portal/apply",title:"Store setup",html:frame(n,[null,body1,body2,body3,body4,body5][n]()),after:function(){bind(n)}};
    });
  };
  function brand(){
    var s=S.store||{};
    return'<div class="sbrand"><span class="av">'+(s.logo_url?'<img alt="" src="'+esc(s.logo_url)+'">':esc(initial(s.name)))+'</span><span><b>'+esc(s.name||"Your new store")+'</b><small>Setting up</small></span></div>';
  }
  function frame(n,inner){
    var pct=Math.round(n/N*100);
    return'<div class="sshell"><aside class="srail">'+brand()+'<ol class="slist">'+STEPS.map(function(x,i){
        var k=i+1,cls=(done(k)&&k!==n?" done":"")+(k===n?" on":"")+(canGo(k)?"":" locked");
        return'<li><button type="button" class="sstep'+cls+'" data-act="sgo" data-n="'+k+'"'+(k===n?' aria-current="step"':"")+'><span class="n">'+(done(k)&&k!==n?"✓":k)+"</span><span><b>"+esc(x[0])+"</b><small>"+esc(x[1])+"</small></span></button></li>";
      }).join("")+'</ol><p class="ssave">Your answers are saved each time you continue, so you can come back later.</p></aside>'
      +'<div class="smain"><div class="sprog"><div class="t"><span>Step '+n+" of "+N+" · "+esc(STEPS[n-1][0])+"</span><span>"+pct+'%</span></div><div class="m"><i style="width:'+pct+'%"></i></div></div>'
      +'<div class="scene">'+SetupArt.scene(SCENE[n])+'</div><p class="skick">Step '+n+" of "+N+'</p><h1 class="stitle">'+esc(HEAD[n][0])+'</h1><p class="ssub">'+esc(HEAD[n][1])+"</p>"
      +'<form data-form="ss'+n+'" id="ssform" novalidate>'+inner
      +'<div class="actbar">'+(n>1?'<button class="btn o" type="button" data-act="sback">Back</button>':"")+'<button class="btn" type="submit">'+(n===N?"Send for review":"Save and continue")+"</button></div></form></div></div>";
  }
  A.sgo=function(b){var n=+b.getAttribute("data-n");if(canGo(n)&&n!==S.step){S.step=n;again()}};
  A.sback=function(){S.step=Math.max(1,S.step-1);again()};

  function card(title,desc,inner){return'<section class="card scard"><h3>'+esc(title)+"</h3>"+(desc?'<p class="sd">'+esc(desc)+"</p>":"")+inner+"</section>"}
  function fld(name,label,value,o){
    o=o||{};
    return'<label class="lb">'+esc(label)+'<input name="'+name+'" value="'+esc(value==null?"":value)+'"'+(o.max?' maxlength="'+o.max+'"':"")+(o.ph?' placeholder="'+esc(o.ph)+'"':"")+(o.mode?' inputmode="'+o.mode+'"':"")+(o.ac?' autocomplete="'+o.ac+'"':"")+(o.req?" required":"")+">"+(o.hint?'<span class="hint">'+esc(o.hint)+"</span>":"")+"</label>";
  }
  function ta(name,label,value,max,o){o=o||{};return'<label class="lb">'+esc(label)+'<textarea name="'+name+'" rows="'+(o.rows||3)+'" maxlength="'+max+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':"")+">"+esc(value||"")+"</textarea></label>"}
  function upload(name,label,hint,url){
    return'<label class="upl"><input type="file" name="'+name+'" accept="image/*"><span class="upl-prev" data-prev="'+name+'"'+(url?' style="background-image:url(&quot;'+esc(url)+'&quot;)"':"")+">"+(url?"":"+")+"</span><span><b>"+esc(label)+"</b><small>"+esc(hint)+"</small></span></label>";
  }
  function palettes(){return(window.Theme&&Theme.palettes)||[]}
  function pvHex(){var p=palettes().filter(function(x){return x[0]===S.accent})[0];return p?p[3]:"#1fa971"}

  function body1(){
    var s=S.store||{};
    return card("Store identity","This is how shoppers meet your store.",
        fld("name","Store name",s.name,{max:80,req:1,ph:"Ada’s Pantry"})+fld("tagline","Short tagline (optional)",s.tagline,{max:120,ph:"Fresh groceries from Lagos"})+ta("about","About your store (optional)",s.about,2000,{rows:4,ph:"Tell shoppers what you sell and what makes it special."}))
      +card("Logo, cover and colour","These appear on your store page in the app.",
        upload("logo","Logo","A square image works best",s.logo_url)+upload("cover","Cover photo","A wide image, shown at the top",s.cover_url)
        +'<p class="slab">Store colour</p><div class="accs" role="radiogroup" aria-label="Store colour">'+palettes().map(function(p){return'<label><input type="radio" name="accent" value="'+esc(p[0])+'"'+(p[0]===S.accent?" checked":"")+'><span class="sw2" title="'+esc(p[1])+'"><i style="background:'+esc(p[3])+'"></i></span></label>'}).join("")+"</div>")
      +card("Preview","This is how your store card looks to shoppers. It updates as you type.",
        '<div class="bpv" id="bpv" style="--pv:'+pvHex()+'"><div class="bpv-cover" id="pvcover"'+(s.cover_url?' style="background-image:url(&quot;'+esc(s.cover_url)+'&quot;)"':"")+'></div><div class="bpv-body"><div class="bpv-logo" id="pvlogo"'+(s.logo_url?' style="background-image:url(&quot;'+esc(s.logo_url)+'&quot;)"':"")+">"+(s.logo_url?"":esc(initial(s.name)))+'</div><h4 id="pvname">'+esc(s.name||"Your store name")+'</h4><p id="pvtag">'+esc(s.tagline||"Your tagline appears here")+'</p><button class="bpv-btn" type="button" tabindex="-1">Visit store</button></div></div>');
  }
  function bind1(f){
    var bpv=$("#bpv");
    f.name.addEventListener("input",function(){setText("pvname",clean(f.name.value,80)||"Your store name");var l=$("#pvlogo");if(l&&!l.style.backgroundImage)l.textContent=initial(f.name.value)});
    f.tagline.addEventListener("input",function(){setText("pvtag",clean(f.tagline.value,120)||"Your tagline appears here")});
    f.addEventListener("change",function(e){
      var t=e.target;
      if(t.name==="accent"){S.accent=t.value;if(bpv)bpv.style.setProperty("--pv",pvHex());return}
      if((t.name==="logo"||t.name==="cover")&&t.files&&t.files[0]){
        var url=URL.createObjectURL(t.files[0]),prev=f.querySelector('[data-prev="'+t.name+'"]');
        if(prev){prev.style.backgroundImage='url("'+url+'")';prev.textContent=""}
        var target=document.getElementById(t.name==="logo"?"pvlogo":"pvcover");
        if(target){target.style.backgroundImage='url("'+url+'")';if(t.name==="logo")target.textContent=""}
      }
    });
  }
  F.ss1=function(f,d){
    var name=clean(d.name,80);
    if(need([[name.length>=2,"Enter your store name (at least 2 characters)."]]))return;
    var body={name:name,tagline:clean(d.tagline,120)||null,about:area(d.about,2000)||null,accent:d.accent||S.accent||"emerald"},logo=f.logo.files[0],cover=f.cover.files[0];
    busy(f,true);
    var p=S.store?Supa.patch("stores",S.store.id,body).then(function(r){return r&&r[0]||Object.assign({},S.store,body)}):Supa.insert("stores",Object.assign({owner_id:Supa.uid(),status:"draft"},body)).then(function(r){return r[0]});
    p.then(function(s){
      S.store=Object.assign({},S.store||{},s);
      var j=[];
      if(logo)j.push(uploadImage(logo,"stores/"+s.id).then(function(u){return Supa.patch("stores",s.id,{logo_url:u})}));
      if(cover)j.push(uploadImage(cover,"stores/"+s.id).then(function(u){return Supa.patch("stores",s.id,{cover_url:u})}));
      return Promise.all(j);
    }).then(function(){S.step=2;return load(true)}).then(again).catch(function(e){busy(f,false);fail(e)});
  };

  function body2(){
    var s=S.store||{},have=s.categories||[],cc=s.country||"NG";
    var chips=S.cats.map(function(c){var nm=c.name||"";return'<label class="tchip"><input type="checkbox" name="cat" value="'+esc(nm)+'"'+(have.indexOf(nm)>-1?" checked":"")+"><span>"+esc((c.icon||"")+" "+nm)+"</span></label>"}).join("");
    return card("What do you sell?","Choose up to six categories. Everneed manages this list so shoppers can find you.",'<div class="tchips">'+(chips||'<p class="note">Seller categories are not available yet. Please try again later.</p>')+"</div>")
      +card("Where are you based?","We filled this in from your connection. Change anything that is wrong.",Geo.locationFields({country:cc,state:s.state,city:s.city}))
      +card("Contact phone","Everneed uses this to reach you about orders. Shoppers do not see it.",Geo.phoneField("phone","Working phone number",S.priv&&S.priv.phone,cc,{required:true})+'<p class="hint" style="margin-top:-6px">Type it the way you normally would, without the country code. We add it for you.</p>');
  }
  F.ss2=function(f,d){
    var cats=new FormData(f).getAll("cat"),cc=Geo.countries[d.country]?d.country:"NG",st=clean(d.state,60),ct=clean(d.city,60),ph=Geo.readPhone(d,"phone",true),pc=Geo.countries[d.phone_cc];
    if(need([[cats.length>0&&cats.length<=6,"Choose between one and six categories."],[st,"Choose your "+Geo.stateLabel(cc).toLowerCase()+"."],[ct,"Enter your city or town."],[ph,"Enter a valid "+(pc?pc.name+" ":"")+"phone number, without the country code."]]))return;
    busy(f,true);
    Supa.patch("stores",S.store.id,{categories:cats,country:cc,state:st,city:ct}).then(function(){
      return upsert("store_private","store_id",!!S.priv,{store_id:S.store.id,phone:ph});
    }).then(function(){S.step=3;return load(true)}).then(again).catch(function(e){busy(f,false);fail(e)});
  };

  function zoneChoices(){
    var s=S.store||{},list=[];
    if(s.state)list.push(s.state);
    Geo.cities(s.country||"NG",s.state).forEach(function(c){list.push(c)});
    S.zones.forEach(function(z){list.push(z)});
    var seen={};return list.filter(function(z){var k=z.toLowerCase();if(seen[k])return false;seen[k]=1;return true});
  }
  function zonesHtml(){
    return'<p class="slab">Areas you deliver to</p><div class="tchips">'+zoneChoices().map(function(z){return'<label class="tchip"><input type="checkbox" data-z="'+esc(z)+'"'+(S.zones.indexOf(z)>-1?" checked":"")+"><span>"+esc(z)+"</span></label>"}).join("")+'</div><div class="zadd"><input id="zin" maxlength="40" placeholder="Add another area" aria-label="Add another area"><button class="btn o" type="button" data-act="zadd">Add</button></div>';
  }
  A.zadd=function(){
    var i=$("#zin");if(!i)return;var v=clean(i.value,40);if(!v)return;
    if(S.zones.map(function(z){return z.toLowerCase()}).indexOf(v.toLowerCase())<0)S.zones.push(v);
    var w=$("#zwrap");if(w)w.innerHTML=zonesHtml();
  };
  function body3(){
    var p=S.priv||{};
    return card("Where your items are kept","Everneed collects your orders from this address. Shoppers do not see it.",ta("pickup","Pickup address",p.pickup_address,300,{rows:3,ph:"House number, street, area, city"}))
      +card("Deliver it yourself?","Optional. Offer direct delivery for orders that only contain your items. You can change this later in Settings.",
        '<label class="rcard" style="display:block"><input type="checkbox" name="direct" value="1" id="dd"'+(p.direct_delivery_enabled?" checked":"")+"><span><b>I can deliver myself</b><small>Choose the areas you cover.</small></span></label><div id=\"zwrap\""+(p.direct_delivery_enabled?"":" hidden")+">"+zonesHtml()+"</div>");
  }
  function bind3(f){
    var dd=$("#dd"),w=$("#zwrap");
    if(dd)dd.addEventListener("change",function(){if(w)w.hidden=!dd.checked});
    f.addEventListener("change",function(e){var z=e.target.getAttribute&&e.target.getAttribute("data-z");if(z)toggle(S.zones,z,e.target.checked)});
    f.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target&&e.target.id==="zin"){e.preventDefault();A.zadd()}});
  }
  F.ss3=function(f,d){
    var pk=area(d.pickup,300),dr=!!d.direct,zones=S.zones.slice(0,30);
    if(need([[pk,"Enter the address where your items are kept."],[!dr||zones.length,"Choose the areas you deliver to, or turn off direct delivery."]]))return;
    busy(f,true);
    upsert("store_private","store_id",!!S.priv,{store_id:S.store.id,pickup_address:pk,direct_delivery_enabled:dr,delivery_zones:dr?zones:[]}).then(function(){S.step=4;return load(true)}).then(again).catch(function(e){busy(f,false);fail(e)});
  };

  function body4(){
    var a=S.app||{},cc=(S.store&&S.store.country)||"NG",banks=window.Geo&&Geo.banks[cc],ng=cc==="NG";
    var bank=banks?'<label class="lb">Bank<select name="bank" required><option value="">Choose your bank</option>'+(a.bank_name&&banks.indexOf(a.bank_name)<0?"<option selected>"+esc(a.bank_name)+"</option>":"")+banks.map(function(b){return"<option"+(b===a.bank_name?" selected":"")+">"+esc(b)+"</option>"}).join("")+"</select></label>":fld("bank","Bank name",a.bank_name,{max:80,req:1});
    return card("Bank account","Your earnings are paid to this account after the holding period.",
        bank+'<div class="row2">'+fld("acct",ng?"Account number (10 digits)":"Account number",a.account_number,{mode:"numeric",max:ng?10:20,req:1,ph:ng?"0123456789":""})+fld("acname","Account name",a.account_name,{max:120,req:1,ph:"Name on the account"})+"</div>")
      +card("Keep it matching","The account name must match the name on your bank account. Payouts to a different name are held for review.","");
  }
  F.ss4=function(f,d){
    var cc=(S.store&&S.store.country)||"NG",b=clean(d.bank,80),a=String(d.acct||"").replace(/\s+/g,""),n=clean(d.acname,120),ok=cc==="NG"?/^[0-9]{10}$/.test(a):/^[0-9]{8,20}$/.test(a);
    if(need([[b,"Choose your bank."],[ok,cc==="NG"?"A Nigerian account number has exactly 10 digits.":"Enter your account number (digits only)."],[n,"Enter the account name."]]))return;
    busy(f,true);
    upsert("store_applications","store_id",!!S.app,{store_id:S.store.id,bank_name:b,account_number:a,account_name:n}).then(function(){S.step=5;return load(true)}).then(again).catch(function(e){busy(f,false);fail(e)});
  };

  var POLICY_TYPES=["seller_terms","seller_privacy","marketplace_rules","returns_refunds"];
  function latest(t){return S.pol.filter(function(d){return d.policy_type===t}).sort(function(x,y){return String(y.effective_at).localeCompare(String(x.effective_at))})[0]}
  function body5(){
    var s=S.store||{},p=S.priv||{},a=S.app||{},docs=POLICY_TYPES.map(latest).filter(Boolean),missing=POLICY_TYPES.filter(function(t){return!latest(t)});
    var rows=[["Store",s.name],["Categories",(s.categories||[]).join(", ")],["Location",[s.city,s.state,(CFG.countries||{})[s.country]].filter(Boolean).join(", ")],["Contact phone",p.phone],["Pickup address",p.pickup_address],["Delivery",p.direct_delivery_enabled?"You deliver to "+(p.delivery_zones||[]).join(", ")+", and Everneed handles the rest":"Everneed collects and delivers"],["Payout",a.bank_name?a.bank_name+" · ends "+String(a.account_number||"").slice(-4):""]];
    return card("Check your details","If something is wrong, use the steps on the left (or Back) to change it.",'<div class="rvl">'+rows.map(function(r){return"<div><span>"+esc(r[0])+"</span><b>"+esc(r[1]||"Not added")+"</b></div>"}).join("")+"</div>")
      +card("Business","Everneed reviews your application. Identity and address checks are a separate step before your store can go live.",fld("biz","Business or trading name",a.business_name||s.name,{max:120,req:1}))
      +card("Seller policies for "+((CFG.countries||{})[s.country]||s.country||"your country"),"Read each policy, then accept it.",
        docs.map(function(d){var url=String(d.content_url||""),safe=/^(https:\/\/|\/)/i.test(url)?url:"";return'<label class="rcard" style="display:block;margin-bottom:10px"><input type="checkbox" name="policy" value="'+esc(d.id)+'"><span><b>'+esc(d.title||String(d.policy_type).replace(/_/g," "))+"</b><small>Version "+esc(d.version)+" · "+esc(d.locale||"en")+(safe?' · <a href="'+esc(safe)+'" target="_blank" rel="noopener">Read the policy</a>':"")+"</small></span></label>"}).join("")
        +(missing.length?'<div class="note err"><span><b>Seller registration is not yet available in this region</b>Everneed has not published these required policies: '+esc(missing.join(", "))+". Please contact support. You cannot send your application until they are published.</span></div>":""));
  }
  F.ss5=function(f,d){
    var biz=clean(d.biz,120),ids=new FormData(f).getAll("policy"),missing=POLICY_TYPES.filter(function(t){return!latest(t)});
    if(need([[biz,"Enter your business or trading name."],[missing.length===0,"Seller policies are not published for your region yet."],[ids.length===POLICY_TYPES.length,"Read and accept every seller policy to continue."]]))return;
    busy(f,true);
    upsert("store_applications","store_id",!!S.app,{store_id:S.store.id,business_name:biz}).then(function(){
      return ids.reduce(function(p,id){return p.then(function(){return Supa.rpc("accept_policy",{p_document_id:id,p_country:S.store.country})})},Promise.resolve());
    }).then(function(){return Supa.rpc("submit_store",{p_store:S.store.id})}).then(function(){
      C.toast("Application sent for review. Verification is a separate step before your store can go live.");
      S.step=0;return load(true);
    }).then(function(){C.go("/portal")}).catch(function(e){busy(f,false);fail(e)});
  };

  function upsert(t,key,exists,row){
    if(!exists)return Supa.insert(t,row).then(function(r){return r&&r[0]||row});
    var body=Object.assign({},row);delete body[key];
    return Supa.patchBy(t,key,row[key],body).then(function(r){return r&&r[0]||row});
  }
  function bind(n){
    var f=$("#ssform");if(!f)return;
    if(n===1)bind1(f);
    if(n===2&&window.Geo)Geo.bind(f,{detect:true});
    if(n===3)bind3(f);
  }
})();
