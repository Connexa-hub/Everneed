/* Seller store setup: a six-step guided flow (Shopify style).
   Answers /portal/apply. Everything else on /portal stays with portal.js and workspace.js.
   Each step saves when the seller presses Save and continue, so they can leave and come back.

   What is saved where (same database rules as before):
     step 1  stores: name, tagline, about, accent (a palette id such as "emerald"), logo_url, cover_url
     step 2  stores: categories, country, state, city      store_private: phone (international format)
     step 3  stores.storefront_details (public, under 8 KB): contact links, hours_schedule, opening_hours (sentence),
             returns (choices), returns_summary (sentence), delivery (choices), delivery_summary (sentence), saved_at
     step 4  store_private: pickup_address, direct_delivery_enabled, delivery_zones
     step 5  store_applications: bank_name, account_number, account_name
     step 6  store_applications: business_name; policy acceptance (accept_policy); submit_store
   An owner may add store_id when a row is created but may never change it, so updates never send it. */
(function(){
  var C=Core,esc=C.esc,$=C.$,V=C.V,A=C.A,F=C.F,enc=encodeURIComponent,base=V.portal;
  var S={uid:null,store:null,priv:null,app:null,cats:[],pol:[],step:0,at:0,h:null,r:null,d:null,zones:[],accent:"emerald"};

  var STEPS=[["Your store","Name and look"],["About you","Categories and location"],["Store page","What shoppers see"],["Delivery","Pickup and areas"],["Payout","Where we pay you"],["Review","Business and policies"]];
  var HEAD=[null,
    ["Let’s set up your store","Choose a name, add your logo and pick a colour. Shoppers see this first."],
    ["Tell us about your business","Pick what you sell and where you are. We use this to show your store to the right shoppers."],
    ["Build your store page","Opening hours, returns and delivery, explained clearly so shoppers know what to expect."],
    ["Pickup and delivery areas","Tell us where your items are kept and which areas you can deliver to."],
    ["Where should we pay you?","Add the bank account for your earnings. Only the Everneed team can see it."],
    ["Review and send","Check everything, accept the seller policies and send your store for review."]];

  /* ---------- helpers ---------- */
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
  function join(a){return a.length<2?a.join(""):a.slice(0,-1).join(", ")+" and "+a[a.length-1]}
  function initial(n){return(String(n||"S").trim().charAt(0)||"S").toUpperCase()}
  function busy(f,on){[].slice.call(f.querySelectorAll("button[type=submit]")).forEach(function(b){b.disabled=on;if(on){b.setAttribute("data-t",b.textContent);b.textContent="Saving…"}else if(b.getAttribute("data-t")){b.textContent=b.getAttribute("data-t")}})}
  function setText(id,t){var el=document.getElementById(id);if(el)el.textContent=t}

  /* Photos: made smaller in the browser, then uploaded */
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

  /* ---------- opening hours ---------- */
  var DAYS=[["mon","Monday","Mon"],["tue","Tuesday","Tue"],["wed","Wednesday","Wed"],["thu","Thursday","Thu"],["fri","Friday","Fri"],["sat","Saturday","Sat"],["sun","Sunday","Sun"]];
  function t12(v){if(v==="24:00")return"12:00 am (midnight)";var p=v.split(":"),h=+p[0],hh=h%12||12;return hh+":"+p[1]+" "+(h>=12?"pm":"am")}
  function t12s(v){if(v==="24:00")return"midnight";var p=v.split(":"),h=+p[0],hh=h%12||12;return hh+(p[1]==="00"?"":":"+p[1])+" "+(h>=12?"pm":"am")}
  function timeOptions(sel,closing){
    var out="";
    for(var i=0;i<48;i++){var h=Math.floor(i/2),v=(h<10?"0":"")+h+":"+(i%2?"30":"00");out+='<option value="'+v+'"'+(v===sel?" selected":"")+">"+t12(v)+"</option>"}
    if(closing)out+='<option value="24:00"'+(sel==="24:00"?" selected":"")+">"+t12("24:00")+"</option>";
    return out;
  }
  function plus1h(v){var h=+v.split(":")[0]+1;return h>=24?"24:00":(h<10?"0":"")+h+":"+v.split(":")[1]}
  function sched(o,c,days){var h={};DAYS.forEach(function(d){h[d[0]]=days.indexOf(d[0])>-1?{o:o,c:c}:null});return h}
  var PRESETS={
    weekdays:["Monday to Friday, 9 am to 5 pm",function(){return sched("09:00","17:00",["mon","tue","wed","thu","fri"])}],
    sixdays:["Monday to Saturday, 9 am to 6 pm",function(){return sched("09:00","18:00",["mon","tue","wed","thu","fri","sat"])}],
    daily:["Every day, 8 am to 8 pm",function(){return sched("08:00","20:00",["mon","tue","wed","thu","fri","sat","sun"])}],
    all:["Open 24 hours, every day",function(){return sched("00:00","24:00",["mon","tue","wed","thu","fri","sat","sun"])}]
  };
  function same(a,b){if(!a&&!b)return true;if(!a||!b)return false;return a.o===b.o&&a.c===b.c}
  function presetOf(h){for(var k in PRESETS){var p=PRESETS[k][1]();if(DAYS.every(function(d){return same(p[d[0]],h[d[0]])}))return k}return"custom"}
  /* "Mon to Fri 9 am to 6 pm · Sat 10 am to 4 pm · Sun closed" */
  function hoursSummary(h){
    if(DAYS.every(function(d){return h[d[0]]&&h[d[0]].o==="00:00"&&h[d[0]].c==="24:00"}))return"Open 24 hours, every day";
    var segs=[],i=0;
    while(i<7){
      var v=h[DAYS[i][0]],j=i;
      while(j+1<7&&same(h[DAYS[j+1][0]],v))j++;
      var label=i===j?DAYS[i][2]:(j===i+1?DAYS[i][2]+" and "+DAYS[j][2]:DAYS[i][2]+" to "+DAYS[j][2]);
      segs.push(label+" "+(v?(v.o==="00:00"&&v.c==="24:00"?"open 24 hours":t12s(v.o)+" to "+t12s(v.c)):"closed"));
      i=j+1;
    }
    return segs.join(" · ");
  }
  function hoursOk(){return DAYS.every(function(d){var v=S.h[d[0]];return!v||v.c==="24:00"||v.c>v.o})}

  /* ---------- returns and delivery: choices in, plain sentences out ---------- */
  var COND=[["unused","Unused","unused"],["pack","In original packaging","in their original packaging"],["tags","Tags still on","with the tags still on"],["proof","With proof of purchase","accompanied by proof of purchase"]];
  var EXCL=[["hygiene","Underwear and swimwear","underwear and swimwear"],["perishable","Perishable goods","perishable goods"],["custom","Custom-made items","custom-made items"],["opened","Opened beauty and skincare","opened beauty and skincare products"],["sale","Sale items","sale items"]];
  function defaultReturns(){return{accept:true,days:7,cond:["unused","pack"],who:"buyer",refund:"original",exchange:true,excl:[],note:""}}
  function defaultDelivery(){return{prep:"2",pickup:false}}
  function returnsSummary(r){
    if(!r.accept)return"This store does not accept returns. If something is wrong with your order, contact the store.";
    var out=["You can return items within "+r.days+" days of delivery."];
    var cond=COND.filter(function(c){return r.cond.indexOf(c[0])>-1}).map(function(c){return c[2]});
    if(cond.length)out.push("Items must be "+join(cond)+".");
    out.push({buyer:"You pay for return delivery.",seller:"The store pays for return delivery.",faulty:"The store pays for return delivery if the item is faulty or not as described. Otherwise you pay."}[r.who]||"");
    out.push({original:"Refunds go back to your original payment method.",credit:"You receive store credit instead of a refund.",exchange:"Items can be exchanged for another item, but not refunded."}[r.refund]||"");
    if(r.refund!=="exchange")out.push(r.exchange?"Exchanges are also accepted.":"Exchanges are not offered.");
    var ex=EXCL.filter(function(x){return r.excl.indexOf(x[0])>-1}).map(function(x){return x[2]});
    if(ex.length)out.push("Not returnable: "+join(ex)+".");
    if(r.note)out.push(/[.!?]$/.test(r.note)?r.note:r.note+".");
    return out.filter(Boolean).join(" ");
  }
  function deliverySummary(d){
    var when={same:"The store prepares orders on the same day you pay.","1":"The store prepares orders within 1 day after you pay.","2":"The store prepares orders within 2 days after you pay.","3":"The store prepares orders within 3 to 5 days after you pay.","7":"The store prepares orders within a week after you pay."}[d.prep]||"";
    return[when,"Delivery is arranged through Everneed, and the delivery fee is shown at checkout before you pay.",d.pickup?"You can also collect your order from the store.":"","Every order has a 4-digit delivery code. Share it only when your items arrive."].filter(Boolean).join(" ");
  }

  /* ---------- data ---------- */
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
      var d=(S.store&&S.store.storefront_details)||{};
      S.h=d.hours_schedule&&typeof d.hours_schedule==="object"?d.hours_schedule:sched("09:00","18:00",["mon","tue","wed","thu","fri","sat"]);
      S.r=Object.assign(defaultReturns(),d.returns||{});if(!Array.isArray(S.r.cond))S.r.cond=[];if(!Array.isArray(S.r.excl))S.r.excl=[];
      S.d=Object.assign(defaultDelivery(),d.delivery||{});
      S.zones=((S.priv&&S.priv.delivery_zones)||[]).slice();
      S.accent=(S.store&&S.store.accent)||S.accent||"emerald";
    });
  }
  function done(n){
    var s=S.store,p=S.priv||{},a=S.app||{},d=(s&&s.storefront_details)||{};
    if(n===1)return!!s;
    if(n===2)return!!(s&&s.categories&&s.categories.length&&s.state&&s.city&&p.phone);
    if(n===3)return!!d.saved_at;
    if(n===4)return!!p.pickup_address;
    if(n===5)return!!(a.account_number&&a.bank_name&&a.account_name);
    return!!s&&s.status!=="draft"&&s.status!=="rejected";
  }
  function canGo(k){for(var j=1;j<k;j++){if(!done(j))return false}return true}
  function firstOpen(){for(var k=1;k<=6;k++){if(!done(k))return k}return 6}

  /* ---------- page frame ---------- */
  V.portal=function(p){
    if(p[0]!=="apply"||!Supa.uid())return base(p);
    return load(false).then(function(){
      var s=S.store;
      if(s&&s.status!=="draft"&&s.status!=="rejected")return{redirect:"/portal"};
      if(!S.step)S.step=firstOpen();
      var n=Math.max(1,Math.min(6,S.step));if(n>1&&!s)n=1;
      S.step=n;
      return{layout:"setup",active:"portal/apply",title:"Store setup",html:frame(n,[null,body1,body2,body3,body4,body5,body6][n]()),after:function(){bind(n)}};
    });
  };
  function brand(){
    var s=S.store||{};
    return'<div class="sbrand"><span class="av">'+(s.logo_url?'<img alt="" src="'+esc(s.logo_url)+'">':esc(initial(s.name)))+'</span><span><b>'+esc(s.name||"Your new store")+'</b><small>Setting up</small></span></div>';
  }
  function frame(n,inner){
    var pct=Math.round(n/6*100);
    return'<div class="sshell"><aside class="srail">'+brand()+'<ol class="slist">'+STEPS.map(function(x,i){
        var k=i+1,cls=(done(k)&&k!==n?" done":"")+(k===n?" on":"")+(canGo(k)?"":" locked");
        return'<li><button type="button" class="sstep'+cls+'" data-act="sgo" data-n="'+k+'"'+(k===n?' aria-current="step"':"")+'><span class="n">'+(done(k)&&k!==n?"✓":k)+"</span><span><b>"+esc(x[0])+"</b><small>"+esc(x[1])+"</small></span></button></li>";
      }).join("")+'</ol><p class="ssave">Your answers are saved each time you continue, so you can come back later.</p></aside>'
      +'<div class="smain"><div class="sprog"><div class="t"><span>Step '+n+" of 6 · "+esc(STEPS[n-1][0])+"</span><span>"+pct+'%</span></div><div class="m"><i style="width:'+pct+'%"></i></div></div>'
      +'<div class="scene">'+SetupArt.scene(n)+'</div><p class="skick">Step '+n+' of 6</p><h1 class="stitle">'+esc(HEAD[n][0])+'</h1><p class="ssub">'+esc(HEAD[n][1])+"</p>"
      +'<form data-form="ss'+n+'" id="ssform" novalidate>'+inner
      +'<div class="actbar">'+(n>1?'<button class="btn o" type="button" data-act="sback">Back</button>':"")+'<button class="btn" type="submit">'+(n===6?"Send for review":"Save and continue")+"</button></div></form></div></div>";
  }
  A.sgo=function(b){var n=+b.getAttribute("data-n");if(canGo(n)&&n!==S.step){S.step=n;again()}};
  A.sback=function(){S.step=Math.max(1,S.step-1);again()};

  /* ---------- field builders ---------- */
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
  function rc(name,val,title,sub,checked,attr){return'<label class="rcard"><input type="radio" name="'+name+'" value="'+val+'" '+attr+(checked?" checked":"")+"><span><b>"+esc(title)+"</b>"+(sub?"<small>"+esc(sub)+"</small>":"")+"</span></label>"}

  /* ---------- step 1: your store ---------- */
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
    function name(){setText("pvname",clean(f.name.value,80)||"Your store name");var l=$("#pvlogo");if(l&&!l.style.backgroundImage)l.textContent=initial(f.name.value)}
    f.name.addEventListener("input",name);
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

  /* ---------- step 2: about you ---------- */
  function body2(){
    var s=S.store||{},have=s.categories||[],cc=s.country||"NG";
    var chips=S.cats.map(function(c,i){var nm=c.name||"";return'<label class="tchip"><input type="checkbox" name="cat" value="'+esc(nm)+'"'+(have.indexOf(nm)>-1?" checked":"")+"><span>"+esc((c.icon||"")+" "+nm)+"</span></label>"}).join("");
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

  /* ---------- step 3: store page details ---------- */
  function hoursRows(){
    return DAYS.map(function(d){
      var k=d[0],v=S.h[k];
      return'<div class="hrow"><label class="hday"><input type="checkbox" data-hopen="'+k+'"'+(v?" checked":"")+"><span>"+d[1]+"</span></label>"
        +(v?'<div class="htimes"><select data-ho="'+k+'" aria-label="'+d[1]+' opens">'+timeOptions(v.o,false)+'</select><span>to</span><select data-hc="'+k+'" aria-label="'+d[1]+' closes">'+timeOptions(v.c,true)+"</select></div>":'<div class="hclosed">Closed</div>')+"</div>";
    }).join("");
  }
  function hoursHtml(){
    var cur=presetOf(S.h),opts='<option value="custom"'+(cur==="custom"?" selected":"")+">Custom</option>"+Object.keys(PRESETS).map(function(k){return'<option value="'+k+'"'+(cur===k?" selected":"")+">"+PRESETS[k][0]+"</option>"}).join("");
    return'<div class="hbar"><label class="lb">Quick schedule<select data-hpreset>'+opts+'</select></label><button class="btn o s" type="button" data-act="hcopy">Copy first open day to all open days</button></div><div id="hrows">'+hoursRows()+'</div><p class="hint">Tick the days you are open, then choose when you open and close. Times are in your local time.</p>';
  }
  A.hcopy=function(){
    var first=DAYS.filter(function(d){return S.h[d[0]]})[0];if(!first)return;
    var src=S.h[first[0]];DAYS.forEach(function(d){if(S.h[d[0]])S.h[d[0]]={o:src.o,c:src.c}});
    var rows=$("#hrows");if(rows)rows.innerHTML=hoursRows();syncDetail();
  };
  function returnsHtml(){
    var r=S.r;
    return'<p class="slab" style="margin-top:0">Do you accept returns?</p><div class="rcards">'+rc("r_accept","1","Yes","Shoppers can send items back",r.accept,'data-r="accept"')+rc("r_accept","0","No returns","All sales are final",!r.accept,'data-r="accept"')+"</div>"
      +'<div id="rdet"'+(r.accept?"":" hidden")+'><label class="lb">Return window<select data-r="days">'+[3,7,14,30].map(function(n){return'<option value="'+n+'"'+(r.days===n?" selected":"")+">"+n+" days after delivery</option>"}).join("")+"</select></label>"
      +'<p class="slab">Items must be</p><div class="tchips">'+COND.map(function(c){return'<label class="tchip"><input type="checkbox" data-rc="'+c[0]+'"'+(r.cond.indexOf(c[0])>-1?" checked":"")+"><span>"+c[1]+"</span></label>"}).join("")+"</div>"
      +'<p class="slab">Who pays for return delivery?</p><div class="rcards">'+rc("r_who","buyer","The shopper","",r.who==="buyer",'data-r="who"')+rc("r_who","faulty","Store, if faulty","Shopper pays otherwise",r.who==="faulty",'data-r="who"')+rc("r_who","seller","The store","",r.who==="seller",'data-r="who"')+"</div>"
      +'<p class="slab">How do shoppers get their money back?</p><div class="rcards">'+rc("r_refund","original","Original payment","Back to the card or account used",r.refund==="original",'data-r="refund"')+rc("r_refund","credit","Store credit","For a future order",r.refund==="credit",'data-r="refund"')+rc("r_refund","exchange","Exchange only","No refunds",r.refund==="exchange",'data-r="refund"')+"</div>"
      +'<div id="rexrow"'+(r.refund==="exchange"?" hidden":"")+'><label class="rcard" style="display:block"><input type="checkbox" data-r="exchange"'+(r.exchange?" checked":"")+"><span><b>Exchanges are accepted</b><small>Shoppers can swap for another size or item</small></span></label></div>"
      +'<p class="slab">Not returnable</p><div class="tchips">'+EXCL.map(function(x){return'<label class="tchip"><input type="checkbox" data-rx="'+x[0]+'"'+(r.excl.indexOf(x[0])>-1?" checked":"")+"><span>"+x[1]+"</span></label>"}).join("")+"</div>"
      +'<label class="lb">Anything else shoppers should know? (optional)<input data-r="note" maxlength="120" value="'+esc(r.note||"")+'" placeholder="For example: Gift cards cannot be returned"></label></div>';
  }
  function deliveryHtml(){
    var d=S.d;
    return'<label class="lb">How quickly do you prepare an order after it is paid?<select data-d="prep">'+[["same","On the same day"],["1","Within 1 day"],["2","Within 2 days"],["3","Within 3 to 5 days"],["7","Within a week"]].map(function(o){return'<option value="'+o[0]+'"'+(d.prep===o[0]?" selected":"")+">"+o[1]+"</option>"}).join("")+"</select></label>"
      +'<label class="rcard" style="display:block"><input type="checkbox" data-d="pickup"'+(d.pickup?" checked":"")+"><span><b>Shoppers can collect from my store</b><small>Optional. Delivery is still arranged through Everneed.</small></span></label>";
  }
  function body3(){
    var dt=(S.store&&S.store.storefront_details)||{};
    return card("Contact","Shoppers can use these to reach your store.",
        '<div class="row2">'+fld("support_email","Support email",dt.support_email,{max:160,ph:"help@yourstore.com",mode:"email",ac:"email"})+fld("website","Website (optional)",dt.website,{max:240,ph:"yourstore.com"})+"</div>"
        +Geo.phoneField("whatsapp","WhatsApp number (optional)",dt.whatsapp,(S.store&&S.store.country)||"NG"))
      +card("Social media","Optional. A username or a link both work.",'<div class="row2">'+fld("instagram","Instagram",dt.instagram,{max:120,ph:"@yourstore"})+fld("tiktok","TikTok",dt.tiktok,{max:120,ph:"@yourstore"})+"</div>"+fld("facebook","Facebook page",dt.facebook,{max:240,ph:"facebook.com/yourstore"}))
      +card("Opening hours","Choose your days and times. Shoppers see a short sentence, not a form.",hoursHtml())
      +card("Returns and exchanges","Choose what applies. We write it in plain words for your shoppers.",returnsHtml())
      +card("Delivery","What shoppers should expect after they order.",deliveryHtml())
      +card("What shoppers will see","This is the text we show on your store page. It follows your choices above.",
        '<div class="pvcard"><div class="pvrow"><span>🕒</span><div><b>Opening hours</b><p id="pv-h"></p></div></div><div class="pvrow"><span>↩️</span><div><b>Returns and exchanges</b><p id="pv-r"></p></div></div><div class="pvrow"><span>🚚</span><div><b>Delivery</b><p id="pv-d"></p></div></div></div>');
  }
  function syncDetail(){
    var det=$("#rdet"),ex=$("#rexrow");
    if(det)det.hidden=!S.r.accept;
    if(ex)ex.hidden=(S.r.refund==="exchange");
    setText("pv-h",hoursSummary(S.h));setText("pv-r",returnsSummary(S.r));setText("pv-d",deliverySummary(S.d));
  }
  function onDetail(e){
    var t=e.target,k;
    if(!t||!t.getAttribute)return;
    var r=S.r,d=S.d;
    if(t.hasAttribute("data-hpreset")){
      if(t.value!=="custom"){S.h=PRESETS[t.value][1]();var rows=$("#hrows");if(rows)rows.innerHTML=hoursRows()}
    }else if((k=t.getAttribute("data-hopen"))){
      S.h[k]=t.checked?{o:"09:00",c:"18:00"}:null;var rows2=$("#hrows");if(rows2)rows2.innerHTML=hoursRows();var ps=$("[data-hpreset]");if(ps)ps.value=presetOf(S.h);
    }else if((k=t.getAttribute("data-ho"))){
      S.h[k].o=t.value;if(S.h[k].c!=="24:00"&&S.h[k].c<=S.h[k].o){S.h[k].c=plus1h(S.h[k].o);var sel=$('[data-hc="'+k+'"]');if(sel)sel.value=S.h[k].c}
      var ps2=$("[data-hpreset]");if(ps2)ps2.value=presetOf(S.h);
    }else if((k=t.getAttribute("data-hc"))){
      S.h[k].c=t.value;var ps3=$("[data-hpreset]");if(ps3)ps3.value=presetOf(S.h);
    }else if((k=t.getAttribute("data-r"))){
      if(k==="accept")r.accept=t.value==="1";
      else if(k==="days")r.days=+t.value;
      else if(k==="who"||k==="refund")r[k]=t.value;
      else if(k==="exchange")r.exchange=t.checked;
      else if(k==="note")r.note=clean(t.value,120);
    }else if((k=t.getAttribute("data-rc"))){toggle(r.cond,k,t.checked)}
    else if((k=t.getAttribute("data-rx"))){toggle(r.excl,k,t.checked)}
    else if((k=t.getAttribute("data-d"))){
      if(k==="prep")d.prep=t.value;else if(k==="pickup")d.pickup=t.checked;
    }else return;
    syncDetail();
  }
  function bind3(f){
    f.addEventListener("change",onDetail);f.addEventListener("input",onDetail);
    syncDetail();
  }
  function fixUrl(u){if(!u)return"";if(/^https?:\/\//i.test(u))return u;if(/^[^\s.\/]+\.[^\s]+$/.test(u))return"https://"+u;return u}
  F.ss3=function(f,d){
    var wa=Geo.readPhone(d,"whatsapp",false),mail=clean(d.support_email,160),site=fixUrl(clean(d.website,240));
    if(need([[wa!==null,"That WhatsApp number does not look right. Type it without the country code, or leave it blank."],[!mail||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail),"Enter a valid support email, or leave it blank."],[!site||/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(site),"Enter a website like yourstore.com, or leave it blank."],[hoursOk(),"A closing time must be later than the opening time."]]))return;
    var old=(S.store&&S.store.storefront_details)||{};
    var detail=Object.assign({},old,{
      support_email:mail||null,website:site||null,whatsapp:wa||null,instagram:clean(d.instagram,120)||null,facebook:clean(d.facebook,240)||null,tiktok:clean(d.tiktok,120)||null,
      hours_schedule:S.h,opening_hours:hoursSummary(S.h),returns:S.r,returns_summary:returnsSummary(S.r),delivery:S.d,delivery_summary:deliverySummary(S.d),saved_at:new Date().toISOString()
    });
    busy(f,true);
    Supa.patch("stores",S.store.id,{storefront_details:detail}).then(function(){S.step=4;return load(true)}).then(again).catch(function(e){busy(f,false);fail(e)});
  };

  /* ---------- step 4: pickup and delivery ---------- */
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
  function body4(){
    var p=S.priv||{};
    return card("Where your items are kept","Everneed collects your orders from this address. Shoppers do not see it.",ta("pickup","Pickup address",p.pickup_address,300,{rows:3,ph:"House number, street, area, city"}))
      +card("Deliver it yourself?","Optional. Offer direct delivery for orders that only contain your items.",
        '<label class="rcard" style="display:block"><input type="checkbox" name="direct" value="1" id="dd"'+(p.direct_delivery_enabled?" checked":"")+"><span><b>I can deliver myself</b><small>Choose the areas you cover.</small></span></label><div id="zwrap"'+(p.direct_delivery_enabled?"":" hidden")+">"+zonesHtml()+"</div>");
  }
  function bind4(f){
    var dd=$("#dd"),w=$("#zwrap");
    if(dd)dd.addEventListener("change",function(){if(w)w.hidden=!dd.checked});
    f.addEventListener("change",function(e){var z=e.target.getAttribute&&e.target.getAttribute("data-z");if(z)toggle(S.zones,z,e.target.checked)});
    f.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target&&e.target.id==="zin"){e.preventDefault();A.zadd()}});
  }
  F.ss4=function(f,d){
    var pk=area(d.pickup,300),dr=!!d.direct,zones=S.zones.slice(0,30);
    if(need([[pk,"Enter the address where your items are kept."],[!dr||zones.length,"Choose the areas you deliver to, or turn off direct delivery."]]))return;
    busy(f,true);
    upsert("store_private","store_id",!!S.priv,{store_id:S.store.id,pickup_address:pk,direct_delivery_enabled:dr,delivery_zones:dr?zones:[]}).then(function(){S.step=5;return load(true)}).then(again).catch(function(e){busy(f,false);fail(e)});
  };

  /* ---------- step 5: payout ---------- */
  function body5(){
    var a=S.app||{},cc=(S.store&&S.store.country)||"NG",banks=window.Geo&&Geo.banks[cc],ng=cc==="NG";
    var bank=banks?'<label class="lb">Bank<select name="bank" required><option value="">Choose your bank</option>'+(a.bank_name&&banks.indexOf(a.bank_name)<0?"<option selected>"+esc(a.bank_name)+"</option>":"")+banks.map(function(b){return"<option"+(b===a.bank_name?" selected":"")+">"+esc(b)+"</option>"}).join("")+"</select></label>":fld("bank","Bank name",a.bank_name,{max:80,req:1});
    return card("Bank account","Your earnings are paid to this account after the holding period.",
        bank+'<div class="row2">'+fld("acct",ng?"Account number (10 digits)":"Account number",a.account_number,{mode:"numeric",max:ng?10:20,req:1,ph:ng?"0123456789":""})+fld("acname","Account name",a.account_name,{max:120,req:1,ph:"Name on the account"})+"</div>")
      +card("Keep it matching","The account name must match the name on your bank account. Payouts to a different name are held for review.","");
  }
  F.ss5=function(f,d){
    var cc=(S.store&&S.store.country)||"NG",b=clean(d.bank,80),a=String(d.acct||"").replace(/\s+/g,""),n=clean(d.acname,120),ok=cc==="NG"?/^[0-9]{10}$/.test(a):/^[0-9]{8,20}$/.test(a);
    if(need([[b,"Choose your bank."],[ok,cc==="NG"?"A Nigerian account number has exactly 10 digits.":"Enter your account number (digits only)."],[n,"Enter the account name."]]))return;
    busy(f,true);
    upsert("store_applications","store_id",!!S.app,{store_id:S.store.id,bank_name:b,account_number:a,account_name:n}).then(function(){S.step=6;return load(true)}).then(again).catch(function(e){busy(f,false);fail(e)});
  };

  /* ---------- step 6: review and send ---------- */
  var POLICY_TYPES=["seller_terms","seller_privacy","marketplace_rules","returns_refunds"];
  function latest(t){return S.pol.filter(function(d){return d.policy_type===t}).sort(function(x,y){return String(y.effective_at).localeCompare(String(x.effective_at))})[0]}
  function body6(){
    var s=S.store||{},p=S.priv||{},a=S.app||{},dt=s.storefront_details||{},docs=POLICY_TYPES.map(latest).filter(Boolean),missing=POLICY_TYPES.filter(function(t){return!latest(t)});
    var rows=[["Store",s.name],["Categories",(s.categories||[]).join(", ")],["Location",[s.city,s.state,(CFG.countries||{})[s.country]].filter(Boolean).join(", ")],["Contact phone",p.phone],["Opening hours",dt.opening_hours],["Pickup address",p.pickup_address],["Delivery",p.direct_delivery_enabled?"You deliver to "+(p.delivery_zones||[]).join(", ")+", and Everneed handles the rest":"Everneed collects and delivers"],["Payout",a.bank_name?a.bank_name+" · ends "+String(a.account_number||"").slice(-4):""]];
    return card("Check your details","If something is wrong, use the steps on the left (or Back) to change it.",'<div class="rvl">'+rows.map(function(r){return"<div><span>"+esc(r[0])+"</span><b>"+esc(r[1]||"Not added")+"</b></div>"}).join("")+"</div>")
      +card("Business","Everneed reviews your application. Identity and address checks are a separate step before your store can go live.",fld("biz","Business or trading name",a.business_name||s.name,{max:120,req:1}))
      +card("Seller policies for "+((CFG.countries||{})[s.country]||s.country||"your country"),"Read each policy, then accept it.",
        docs.map(function(d){var url=String(d.content_url||""),safe=/^(https:\/\/|\/)/i.test(url)?url:"";return'<label class="rcard" style="display:block;margin-bottom:10px"><input type="checkbox" name="policy" value="'+esc(d.id)+'"><span><b>'+esc(d.title||d.policy_type.replace(/_/g," "))+"</b><small>Version "+esc(d.version)+" · "+esc(d.locale||"en")+(safe?' · <a href="'+esc(safe)+'" target="_blank" rel="noopener">Read the policy</a>':"")+"</small></span></label>"}).join("")
        +(missing.length?'<div class="note err"><span><b>Seller registration is not yet available in this region</b>Everneed has not published these required policies: '+esc(missing.join(", "))+". Please contact support. You cannot send your application until they are published.</span></div>":""));
  }
  F.ss6=function(f,d){
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

  /* ---------- shared ---------- */
  /* Save a row that may or may not exist yet. updates leave store_id out (the database refuses to let an owner change it, on purpose). */
  function upsert(t,key,exists,row){
    if(!exists)return Supa.insert(t,row).then(function(r){return r&&r[0]||row});
    var body=Object.assign({},row);delete body[key];
    return Supa.patchBy(t,key,row[key],body).then(function(r){return r&&r[0]||row});
  }
  function bind(n){
    var f=$("#ssform");if(!f)return;
    if(n===1)bind1(f);
    if(n===2&&window.Geo)Geo.bind(f,{detect:true});
    if(n===3){if(window.Geo)Geo.bind(f,{detect:false});bind3(f)}
    if(n===4)bind4(f);
  }
})();
