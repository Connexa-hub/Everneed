/* Seller store setup: a short, four-screen store creation. Answers /portal/apply.
   Owner-approved direction: docs/PRODUCT/SELLER_ONBOARDING_SIMPLIFICATION_AND_PLAN_SELECTOR.md.
   No bank, identity, face, address or tax collection happens here, and no verification checklist or explainer is shown.
   Saved where:
     step 1  stores: name, tagline, about, accent (palette id), logo_url, cover_url
     step 2  stores: categories, country, state, city      store_private: phone (international format)
     step 3  plan: rpc choose_plan (authenticated, server-side). The price and limits shown come from the backend and the
             client never sends a price. The choice is read back from store_applications.plan_id before moving on.
     step 4  store_applications: business_name; one consent to the current seller policies (accept_policy per document); submit_store
   An owner may add store_id when a row is created but never change it, so updates never send it.
   Approval, plan-specific screens and activation happen after submission (seller-flow.js). The server decides when a store is live. */
(function(){
  var C=Core,esc=C.esc,$=C.$,V=C.V,A=C.A,F=C.F,enc=encodeURIComponent,base=V.portal;
  var S={uid:null,store:null,priv:null,app:null,cats:[],pol:[],plans:null,step:0,at:0,accent:"emerald",focus:null};
  var STEPS=[["Your store","Name and look"],["What you sell","Categories and place"],["Plan","Choose how to start"],["Send","Review and submit"]];
  var HEAD=[null,
    ["Create your store","A name shoppers will remember. The look is optional and easy to change later."],
    ["What do you sell?","Pick your categories and where you are based."],
    ["Choose your plan","Start free or pick a plan that fits. Nothing is charged now."],
    ["Review and send","Check your details and send your store for review."]];
  var N=STEPS.length;

  function clean(v,n){return String(v==null?"":v).replace(/\s+/g," ").trim().slice(0,n||200)}
  function area(v,n){return String(v==null?"":v).replace(/\r/g,"").trim().slice(0,n||2000)}
  function need(l){for(var i=0;i<l.length;i++){if(!l[i][0]){C.toast(l[i][1],true);return true}}return false}
  function fail(e){
    var m=e&&e.message||"That did not work";
    if(/permission denied/i.test(m))m="Everneed could not save this part yet. Please try again in a few minutes, and contact support if it continues.";
    C.toast(m,true);
  }
  function again(){C.go(location.pathname,true)}
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
      if(!S.store)return;
      return Plans.load().then(function(p){S.plans=p&&p.length?p:null},function(){S.plans=null});
    }).then(function(){
      S.at=Date.now();
      S.accent=(S.store&&S.store.accent)||S.accent||"emerald";
    });
  }
  function done(n){
    var s=S.store,p=S.priv||{},a=S.app||{};
    if(n===1)return!!s;
    if(n===2)return!!(s&&s.categories&&s.categories.length&&s.state&&s.city&&p.phone);
    if(n===3)return!!a.plan_id;
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
      return{layout:"setup",active:"portal/apply",title:"Create your store",html:frame(n,[null,body1,body2,body3,body4][n]()),after:function(){bind(n)}};
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
      }).join("")+'</ol><p class="ssave">Saved each time you continue, so you can come back later.</p></aside>'
      +'<div class="smain"><div class="sprog"><div class="t"><span>Step '+n+" of "+N+" · "+esc(STEPS[n-1][0])+"</span><span>"+pct+'%</span></div><div class="m"><i style="width:'+pct+'%"></i></div></div>'
      +(n===1?'<div class="scene">'+SetupArt.scene(0)+"</div>":"")+'<p class="skick">Step '+n+" of "+N+'</p><h1 class="stitle">'+esc(HEAD[n][0])+'</h1><p class="ssub">'+esc(HEAD[n][1])+"</p>"
      +'<form data-form="ss'+n+'" id="ssform" novalidate>'+inner
      +'<div class="actbar">'+(n>1?'<button class="btn o" type="button" data-act="ssback">Back</button>':"")+'<button class="btn" type="submit">'+(n===N?"Send for review":n===3?"Choose a plan":"Continue")+"</button></div></form></div></div>";
  }
  A.sgo=function(b){var n=+b.getAttribute("data-n");if(canGo(n)&&n!==S.step){S.step=n;again()}};
  A.ssback=function(){S.step=Math.max(1,S.step-1);again()};
  A.splretry=function(){load(true).then(again).catch(fail)};

  function card(title,desc,inner){return'<section class="card scard"><h3>'+esc(title)+"</h3>"+(desc?'<p class="sd">'+esc(desc)+"</p>":"")+inner+"</section>"}
  function fld(name,label,value,o){
    o=o||{};
    return'<label class="lb">'+esc(label)+'<input name="'+name+'" value="'+esc(value==null?"":value)+'"'+(o.max?' maxlength="'+o.max+'"':"")+(o.ph?' placeholder="'+esc(o.ph)+'"':"")+(o.req?" required":"")+">"+(o.hint?'<span class="hint">'+esc(o.hint)+"</span>":"")+"</label>";
  }
  function upload(name,label,hint,url){
    return'<label class="upl"><input type="file" name="'+name+'" accept="image/*"><span class="upl-prev" data-prev="'+name+'"'+(url?' style="background-image:url(&quot;'+esc(url)+'&quot;)"':"")+">"+(url?"":"+")+"</span><span><b>"+esc(label)+"</b><small>"+esc(hint)+"</small></span></label>";
  }
  function palettes(){return(window.Theme&&Theme.palettes)||[]}
  function pvHex(){var p=palettes().filter(function(x){return x[0]===S.accent})[0];return p?p[3]:"#1fa971"}

  function body1(){
    var s=S.store||{};
    return card("Your store","",fld("name","Store name",s.name,{max:80,req:1,ph:"Ada’s Pantry"})+fld("tagline","Tagline (optional)",s.tagline,{max:120,ph:"Fresh groceries from Lagos"})
        +'<label class="lb">Short description (optional)<textarea name="about" rows="3" maxlength="500" placeholder="What you sell and what makes it special.">'+esc(s.about||"")+"</textarea></label>")
      +card("Look (optional)","Logo, cover and colour appear on your store page.",
        upload("logo","Logo","A square image works best",s.logo_url)+upload("cover","Cover photo","A wide image",s.cover_url)
        +'<p class="slab">Brand colour</p><div class="accs" role="radiogroup" aria-label="Brand colour">'+palettes().map(function(p){return'<label><input type="radio" name="accent" value="'+esc(p[0])+'"'+(p[0]===S.accent?" checked":"")+'><span class="sw2" title="'+esc(p[1])+'"><i style="background:'+esc(p[3])+'"></i></span></label>'}).join("")+"</div>")
      +'<div class="bpv" id="bpv" style="--pv:'+pvHex()+'"><div class="bpv-cover" id="pvcover"'+(s.cover_url?' style="background-image:url(&quot;'+esc(s.cover_url)+'&quot;)"':"")+'></div><div class="bpv-body"><div class="bpv-logo" id="pvlogo"'+(s.logo_url?' style="background-image:url(&quot;'+esc(s.logo_url)+'&quot;)"':"")+">"+(s.logo_url?"":esc(initial(s.name)))+'</div><h4 id="pvname">'+esc(s.name||"Your store name")+'</h4><p id="pvtag">'+esc(s.tagline||"Your tagline appears here")+"</p></div></div>";
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
    var body={name:name,tagline:clean(d.tagline,120)||null,about:area(d.about,500)||null,accent:d.accent||S.accent||"emerald"},logo=f.logo.files[0],cover=f.cover.files[0];
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
    return card("Categories","Choose up to six.",'<div class="tchips">'+(chips||'<p class="note">Seller categories are not available yet. Please try again later.</p>')+"</div>")
      +card("Where are you based?","",Geo.locationFields({country:cc,state:s.state,city:s.city}))
      +card("Contact phone","Everneed uses this to reach you about orders. Shoppers do not see it.",Geo.phoneField("phone","Working phone number",S.priv&&S.priv.phone,cc,{required:true}));
  }
  F.ss2=function(f,d){
    var cats=new FormData(f).getAll("cat"),cc=Geo.countries[d.country]?d.country:"NG",st=clean(d.state,60),ct=clean(d.city,60),ph=Geo.readPhone(d,"phone",true),pc=Geo.countries[d.phone_cc];
    if(need([[cats.length>0&&cats.length<=6,"Choose between one and six categories."],[st,"Choose your "+Geo.stateLabel(cc).toLowerCase()+"."],[ct,"Enter your city or town."],[ph,"Enter a valid "+(pc?pc.name+" ":"")+"phone number, without the country code."]]))return;
    busy(f,true);
    Supa.patch("stores",S.store.id,{categories:cats,country:cc,state:st,city:ct}).then(function(){
      return upsert("store_private","store_id",!!S.priv,{store_id:S.store.id,phone:ph});
    }).then(function(){S.step=3;return load(true)}).then(again).catch(function(e){busy(f,false);fail(e)});
  };

  /* Step 3: plan carousel. Plans are read from the backend; if they cannot be loaded nothing is invented. */
  function body3(){
    if(!S.plans)return card("Plans are not available right now","Your answers are saved. Please try again in a moment.",'<button class="btn o" type="button" data-act="splretry">Try again</button>');
    var chosen=S.app&&S.app.plan_id||"";
    return Plans.html({plans:S.plans,chosen:chosen,focus:S.focus||chosen})+'<input type="hidden" name="plan" value=""><p class="pcnote">You are not charged when you choose a plan.</p>';
  }
  function bind3(f){
    if(!S.plans)return;
    var btn=f.querySelector(".actbar button[type=submit]");
    Plans.bind(f,{plans:S.plans,chosen:S.app&&S.app.plan_id||"",focus:S.focus||(S.app&&S.app.plan_id)||"",onFocus:function(p){f.plan.value=p.id;S.focus=p.id;if(btn&&!btn.disabled)btn.textContent="Choose "+p.name}});
  }
  F.ss3=function(f,d){
    var plan=(S.plans||[]).filter(function(x){return x.id===d.plan})[0];
    if(need([[plan,"Swipe to a plan, then choose it."]]))return;
    busy(f,true);
    (S.app?Promise.resolve():Supa.insert("store_applications",{store_id:S.store.id,business_name:clean(S.store.name,120)}))
      .then(function(){return Supa.rpc("choose_plan",{p_plan:plan.id})})
      .then(function(){return Supa.get("store_applications?select=plan_id&store_id=eq."+enc(S.store.id))})
      .then(function(r){
        if(!(r&&r[0]&&r[0].plan_id===plan.id))throw new Error("Your plan could not be saved. Your current choice is unchanged. Please try again.");
        S.focus=plan.id;S.step=4;return load(true);
      }).then(again).catch(function(e){busy(f,false);fail(e)});
  };

  var POLICY_TYPES=["seller_terms","seller_privacy","marketplace_rules","returns_refunds"];
  function latest(t){return S.pol.filter(function(d){return d.policy_type===t}).sort(function(x,y){return String(y.effective_at).localeCompare(String(x.effective_at))})[0]}
  function safeUrl(u){u=String(u||"");return/^(https:\/\/|\/)/i.test(u)?u:""}
  function body4(){
    var s=S.store||{},p=S.priv||{},a=S.app||{},docs=POLICY_TYPES.map(latest).filter(Boolean),missing=POLICY_TYPES.filter(function(t){return!latest(t)}),
      plan=(S.plans||[]).filter(function(x){return x.id===a.plan_id})[0],
      rows=[["Store",s.name],["Sells",(s.categories||[]).join(", ")],["Based in",[s.city,s.state,(CFG.countries||{})[s.country]].filter(Boolean).join(", ")],["Contact",p.phone],["Plan",plan?plan.name+" · "+Plans.price(plan)+(Number(plan.price)>0?" a month":""):"Not chosen"]];
    var links=docs.map(function(d){var u=safeUrl(d.content_url),t=d.title||String(d.policy_type).replace(/_/g," ");return u?'<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(t)+"</a>":esc(t)}).join(" · ");
    return card("Your store","",'<div class="rvl">'+rows.map(function(r){return"<div><span>"+esc(r[0])+"</span><b>"+esc(r[1]||"Not added")+"</b></div>"}).join("")+"</div>")
      +card("Business name","Used on your seller records. Shoppers see your store name.",fld("biz","Business or trading name",a.business_name||s.name,{max:120,req:1}))
      +card("Seller policies","",(docs.length?'<label class="rcard" style="display:block"><input type="checkbox" name="agree" value="1"><span><b>I agree to the Everneed seller policies</b><small>'+links+"</small></span></label>":"")
        +(missing.length?'<div class="note err"><span><b>Seller registration is not yet available in this region</b>Everneed has not published the required seller policies. Please contact support. You cannot send your application until they are published.</span></div>':""));
  }
  F.ss4=function(f,d){
    var biz=clean(d.biz,120),docs=POLICY_TYPES.map(latest),missing=docs.filter(function(x){return!x});
    if(need([[biz,"Enter your business or trading name."],[missing.length===0,"Seller policies are not published for your region yet."],[d.agree,"Please agree to the seller policies to continue."],[S.app&&S.app.plan_id,"Choose a plan first."]]))return;
    busy(f,true);
    Supa.patchBy("store_applications","store_id",S.store.id,{business_name:biz}).then(function(){
      return docs.reduce(function(p,doc){return p.then(function(){return Supa.rpc("accept_policy",{p_document_id:doc.id,p_country:S.store.country})})},Promise.resolve());
    }).then(function(){return Supa.rpc("submit_store",{p_store:S.store.id})}).then(function(){
      C.toast("Application sent. We will message you when your store is reviewed.");
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
