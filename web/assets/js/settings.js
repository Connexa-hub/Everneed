/* Seller settings, for approved stores. Answers /portal/settings and /portal/settings/<section>.
   This is where the store page text lives once a store exists: opening hours, returns and exchanges, delivery information.
   (They are deliberately not part of registration.) Each section saves on its own.

   Saved where:
     profile   stores: name, tagline, about, accent (palette id), logo_url, cover_url; storefront_details: contact links
     hours     stores.storefront_details: hours_schedule, opening_hours (sentence)
     returns   stores.storefront_details: returns (choices), returns_summary (sentence)
     delivery  stores.storefront_details: delivery (choices), delivery_summary (sentence); store_private: pickup_address, direct_delivery_enabled, delivery_zones
     payout    read only. Bank details are changed by the Everneed team, on purpose.
   Owners may edit these because the stores_guard trigger only locks owner, slug, approval, demo and official flags, and status. */
(function(){
  var C=Core,esc=C.esc,$=C.$,V=C.V,A=C.A,F=C.F,enc=encodeURIComponent,base=V.portal;
  var T={uid:null,store:null,priv:null,app:null,at:0,h:null,r:null,d:null,zones:[],accent:"emerald"};
  var SECTIONS=[
    ["profile","Store profile","Name, logo, cover, colour, contact and social links"],
    ["hours","Opening hours","The days and times you are open"],
    ["returns","Returns and exchanges","Your return rules, explained in plain words"],
    ["delivery","Delivery and pickup","Preparation time, pickup address and delivery areas"],
    ["payout","Payout account","Where your earnings are paid"]
  ];

  /* ---------- helpers ---------- */
  function clean(v,n){return String(v==null?"":v).replace(/\s+/g," ").trim().slice(0,n||200)}
  function area(v,n){return String(v==null?"":v).replace(/\r/g,"").trim().slice(0,n||2000)}
  function need(l){for(var i=0;i<l.length;i++){if(!l[i][0]){C.toast(l[i][1],true);return true}}return false}
  function taken(e){if(!e)return false;var t=[e.message,e.details,e.hint,e.constraint,e.code].filter(Boolean).join(" ");return/stores_name_normalized_key/i.test(t)}
  function fail(e){C.toast(taken(e)?"That store name is already taken. Choose a different name.":(e&&e.message||"That did not work"),true)}
  function again(){C.go(location.pathname,true)}
  function toggle(arr,v,on){var i=arr.indexOf(v);if(on&&i<0)arr.push(v);if(!on&&i>-1)arr.splice(i,1)}
  function join(a){return a.length<2?a.join(""):a.slice(0,-1).join(", ")+" and "+a[a.length-1]}
  function initial(n){return(String(n||"S").trim().charAt(0)||"S").toUpperCase()}
  function setText(id,t){var el=document.getElementById(id);if(el)el.textContent=t}
  function busy(f,on){[].slice.call(f.querySelectorAll("button[type=submit]")).forEach(function(b){b.disabled=on;if(on){b.setAttribute("data-t",b.textContent);b.textContent="Saving…"}else if(b.getAttribute("data-t")){b.textContent=b.getAttribute("data-t")}})}
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
  /* Uses the hardened uploader (clear errors, retries, timeout) when it is loaded, and the old path otherwise. */
  function uploadImage(file,folder){var U=window.EVUpload;if(U&&U.prepare)return U.prepare(file).then(function(b){return U.put(b,folder)});return shrink(file).then(function(f){return Supa.upload(f,folder)})}

  /* ---------- opening hours, returns and delivery: choices in, plain sentences out ---------- */
  var DAYS=[["mon","Monday","Mon"],["tue","Tuesday","Tue"],["wed","Wednesday","Wed"],["thu","Thursday","Thu"],["fri","Friday","Fri"],["sat","Saturday","Sat"],["sun","Sunday","Sun"]];
  function t12(v){if(v==="24:00")return"12:00 am (midnight)";var p=v.split(":"),h=+p[0],hh=h%12||12;return hh+":"+p[1]+" "+(h>=12?"pm":"am")}
  function t12s(v){if(v==="24:00")return"midnight";var p=v.split(":"),h=+p[0],hh=h%12||12;return hh+(p[1]==="00"?"":":"+p[1])+" "+(h>=12?"pm":"am")}
  function timeOptions(sel,closing){var out="";for(var i=0;i<48;i++){var h=Math.floor(i/2),v=(h<10?"0":"")+h+":"+(i%2?"30":"00");out+='<option value="'+v+'"'+(v===sel?" selected":"")+">"+t12(v)+"</option>"}if(closing)out+='<option value="24:00"'+(sel==="24:00"?" selected":"")+">"+t12("24:00")+"</option>";return out}
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
  function hoursOk(){return DAYS.every(function(d){var v=T.h[d[0]];return!v||v.c==="24:00"||v.c>v.o})}
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
    if(!force&&T.uid===uid&&Date.now()-T.at<15000)return Promise.resolve();
    var soft=function(){return[]};
    return Supa.get("stores?select=*&owner_id=eq."+enc(uid)).then(function(a){
      T.uid=uid;T.store=a&&a[0]||null;T.priv=null;T.app=null;
      if(!T.store)return;
      var id=enc(T.store.id);
      return Promise.all([Supa.get("store_private?select=*&store_id=eq."+id).catch(soft),Supa.get("store_applications?select=*&store_id=eq."+id).catch(soft)]).then(function(b){T.priv=b[0][0]||null;T.app=b[1][0]||null});
    }).then(function(){
      T.at=Date.now();
      var d=(T.store&&T.store.storefront_details)||{};
      T.h=d.hours_schedule&&typeof d.hours_schedule==="object"?d.hours_schedule:sched("09:00","18:00",["mon","tue","wed","thu","fri","sat"]);
      T.r=Object.assign(defaultReturns(),d.returns||{});if(!Array.isArray(T.r.cond))T.r.cond=[];if(!Array.isArray(T.r.excl))T.r.excl=[];
      T.d=Object.assign(defaultDelivery(),d.delivery||{});
      T.zones=((T.priv&&T.priv.delivery_zones)||[]).slice();
      T.accent=(T.store&&T.store.accent)||"emerald";
    });
  }
  function details(extra){return Object.assign({},(T.store&&T.store.storefront_details)||{},extra)}
  function saveStore(body){return Supa.patch("stores",T.store.id,body).then(function(){return load(true)})}
  function upsertPrivate(row){
    if(!T.priv)return Supa.insert("store_private",Object.assign({store_id:T.store.id},row));
    return Supa.patchBy("store_private","store_id",T.store.id,row);
  }

  /* ---------- page ---------- */
  V.portal=function(p){
    if(p[0]!=="settings"||!Supa.uid())return base(p);
    return load(false).then(function(){
      var s=T.store;
      if(!s||s.status!=="approved")return{redirect:"/portal"};
      var sec=p[1]||"";
      if(sec&&!SECTIONS.some(function(x){return x[0]===sec}))sec="";
      return{layout:"portal",active:"portal/settings",title:"Settings",html:sec?section(sec):index(),after:sec?function(){bind(sec)}:null};
    });
  };
  A.setgo=function(b){C.go(b.getAttribute("data-to"))};
  function index(){
    return'<div class="sech"><h1 style="font-size:2.2rem">Settings</h1></div><p class="m">Manage how your store looks and works. Changes appear on your store page right away.</p>'
      +'<div class="g2" style="margin-top:16px">'+SECTIONS.map(function(s){return'<a class="card" style="display:block;text-decoration:none;color:inherit" href="/portal/settings/'+s[0]+'"><h3 style="margin:0 0 4px">'+esc(s[1])+'</h3><p class="sm" style="margin:0">'+esc(s[2])+"</p></a>"}).join("")+'<div class="card" aria-disabled="true" style="opacity:.8"><h3 style="margin:0 0 4px">Holiday mode</h3><p class="sm" style="margin:0 0 8px">Pause new orders while you are away.</p><span class="chip">Not available yet</span><p class="sm" style="margin:8px 0 0">It needs a store pause feature on the Everneed side, which is not built yet. Nothing changes on your store.</p></div></div>';
  }
  function head(sec){
    var cur=SECTIONS.filter(function(x){return x[0]===sec})[0];
    return'<p class="sm"><a href="/portal/settings">‹ Settings</a></p><h1 style="font-size:2rem;margin:4px 0 14px">'+esc(cur[1])+"</h1>"
      +'<div class="tabs">'+SECTIONS.map(function(x){return'<button type="button" data-act="setgo" data-to="/portal/settings/'+x[0]+'" class="'+(x[0]===sec?"on":"")+'">'+esc(x[1])+"</button>"}).join("")+"</div>";
  }
  function card(title,desc,inner){return'<section class="card scard"><h3>'+esc(title)+"</h3>"+(desc?'<p class="sd">'+esc(desc)+"</p>":"")+inner+"</section>"}
  function fld(name,label,value,o){o=o||{};return'<label class="lb">'+esc(label)+'<input name="'+name+'" value="'+esc(value==null?"":value)+'"'+(o.max?' maxlength="'+o.max+'"':"")+(o.ph?' placeholder="'+esc(o.ph)+'"':"")+(o.mode?' inputmode="'+o.mode+'"':"")+(o.req?" required":"")+"></label>"}
  function ta(name,label,value,max,o){o=o||{};return'<label class="lb">'+esc(label)+'<textarea name="'+name+'" rows="'+(o.rows||3)+'" maxlength="'+max+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':"")+">"+esc(value||"")+"</textarea></label>"}
  function upload(name,label,hint,url){return'<label class="upl"><input type="file" name="'+name+'" accept="image/*"><span class="upl-prev" data-prev="'+name+'"'+(url?' style="background-image:url(&quot;'+esc(url)+'&quot;)"':"")+">"+(url?"":"+")+"</span><span><b>"+esc(label)+"</b><small>"+esc(hint)+"</small></span></label>"}
  function rc(name,val,title,sub,checked,attr){return'<label class="rcard"><input type="radio" name="'+name+'" value="'+val+'" '+attr+(checked?" checked":"")+"><span><b>"+esc(title)+"</b>"+(sub?"<small>"+esc(sub)+"</small>":"")+"</span></label>"}
  function save(){return'<div class="actbar"><button class="btn" type="submit">Save changes</button></div>'}
  function palettes(){return(window.Theme&&Theme.palettes)||[]}
  function pvHex(){var p=palettes().filter(function(x){return x[0]===T.accent})[0];return p?p[3]:"#1fa971"}

  function section(sec){
    var body={profile:bodyProfile,hours:bodyHours,returns:bodyReturns,delivery:bodyDelivery,payout:bodyPayout}[sec]();
    return head(sec)+'<form data-form="set_'+sec+'" id="setform" novalidate>'+body+(sec==="payout"?"":save())+"</form>";
  }

  /* profile */
  function bodyProfile(){
    var s=T.store,d=s.storefront_details||{};
    return card("Store identity","Shoppers see this on your store page in the app.",fld("name","Store name",s.name,{max:80,req:1})+'<p class="m" style="margin:-6px 0 12px;font-size:.85rem">Each store name is unique on Everneed. Your store web address stays the same if you rename.</p>'+fld("tagline","Short tagline (optional)",s.tagline,{max:120})+ta("about","About your store (optional)",s.about,2000,{rows:4}))
      +card("Logo, cover and colour","",upload("logo","Logo","A square image works best",s.logo_url)+upload("cover","Cover photo","A wide image, shown at the top",s.cover_url)
        +'<p class="slab">Store colour</p><div class="accs" role="radiogroup" aria-label="Store colour">'+palettes().map(function(p){return'<label><input type="radio" name="accent" value="'+esc(p[0])+'"'+(p[0]===T.accent?" checked":"")+'><span class="sw2" title="'+esc(p[1])+'"><i style="background:'+esc(p[3])+'"></i></span></label>'}).join("")+"</div>"
        +'<div class="bpv" id="bpv" style="--pv:'+pvHex()+';margin-top:14px"><div class="bpv-cover" id="pvcover"'+(s.cover_url?' style="background-image:url(&quot;'+esc(s.cover_url)+'&quot;)"':"")+'></div><div class="bpv-body"><div class="bpv-logo" id="pvlogo"'+(s.logo_url?' style="background-image:url(&quot;'+esc(s.logo_url)+'&quot;)"':"")+">"+(s.logo_url?"":esc(initial(s.name)))+'</div><h4 id="pvname">'+esc(s.name)+'</h4><p id="pvtag">'+esc(s.tagline||"Your tagline appears here")+'</p><button class="bpv-btn" type="button" tabindex="-1">Visit store</button></div></div>')
      +card("Contact","Shoppers can use these to reach your store.",'<div class="row2">'+fld("support_email","Support email",d.support_email,{max:160,mode:"email"})+fld("website","Website (optional)",d.website,{max:240,ph:"yourstore.com"})+"</div>"+Geo.phoneField("whatsapp","WhatsApp number (optional)",d.whatsapp,s.country||"NG"))
      +card("Social media","Optional. A username or a link both work.",'<div class="row2">'+fld("instagram","Instagram",d.instagram,{max:120,ph:"@yourstore"})+fld("tiktok","TikTok",d.tiktok,{max:120,ph:"@yourstore"})+"</div>"+fld("facebook","Facebook page",d.facebook,{max:240,ph:"facebook.com/yourstore"}));
  }
  function fixUrl(u){if(!u)return"";if(/^https?:\/\//i.test(u))return u;if(/^[^\s.\/]+\.[^\s]+$/.test(u))return"https://"+u;return u}
  F.set_profile=function(f,d){
    var name=clean(d.name,80),wa=Geo.readPhone(d,"whatsapp",false),mail=clean(d.support_email,160),site=fixUrl(clean(d.website,240));
    if(need([[name.length>=2,"Enter your store name (at least 2 characters)."],[wa!==null,"That WhatsApp number does not look right. Type it without the country code, or leave it blank."],[!mail||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail),"Enter a valid support email, or leave it blank."],[!site||/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(site),"Enter a website like yourstore.com, or leave it blank."]]))return;
    var body={name:name,tagline:clean(d.tagline,120)||null,about:area(d.about,2000)||null,accent:d.accent||T.accent,
      storefront_details:details({support_email:mail||null,website:site||null,whatsapp:wa||null,instagram:clean(d.instagram,120)||null,facebook:clean(d.facebook,240)||null,tiktok:clean(d.tiktok,120)||null})};
    var logo=f.logo.files[0],cover=f.cover.files[0];busy(f,true);
    Promise.all([logo?uploadImage(logo,"stores/"+T.store.id):null,cover?uploadImage(cover,"stores/"+T.store.id):null]).then(function(u){
      if(u[0])body.logo_url=u[0];if(u[1])body.cover_url=u[1];return saveStore(body);
    }).then(function(){C.toast("Saved");busy(f,false);again()}).catch(function(e){busy(f,false);fail(e)});
  };
  function bindProfile(f){
    var bpv=$("#bpv");
    f.name.addEventListener("input",function(){setText("pvname",clean(f.name.value,80)||"Your store");var l=$("#pvlogo");if(l&&!l.style.backgroundImage)l.textContent=initial(f.name.value)});
    f.tagline.addEventListener("input",function(){setText("pvtag",clean(f.tagline.value,120)||"Your tagline appears here")});
    f.addEventListener("change",function(e){
      var t=e.target;
      if(t.name==="accent"){T.accent=t.value;if(bpv)bpv.style.setProperty("--pv",pvHex());return}
      if((t.name==="logo"||t.name==="cover")&&t.files&&t.files[0]){
        var url=URL.createObjectURL(t.files[0]),prev=f.querySelector('[data-prev="'+t.name+'"]');
        if(prev){prev.style.backgroundImage='url("'+url+'")';prev.textContent=""}
        var target=document.getElementById(t.name==="logo"?"pvlogo":"pvcover");
        if(target){target.style.backgroundImage='url("'+url+'")';if(t.name==="logo")target.textContent=""}
      }
    });
  }

  /* hours */
  function hoursRows(){
    return DAYS.map(function(d){
      var k=d[0],v=T.h[k];
      return'<div class="hrow"><label class="hday"><input type="checkbox" data-hopen="'+k+'"'+(v?" checked":"")+"><span>"+d[1]+"</span></label>"
        +(v?'<div class="htimes"><select data-ho="'+k+'" aria-label="'+d[1]+' opens">'+timeOptions(v.o,false)+'</select><span>to</span><select data-hc="'+k+'" aria-label="'+d[1]+' closes">'+timeOptions(v.c,true)+"</select></div>":'<div class="hclosed">Closed</div>')+"</div>";
    }).join("");
  }
  function bodyHours(){
    var cur=presetOf(T.h),opts='<option value="custom"'+(cur==="custom"?" selected":"")+">Custom</option>"+Object.keys(PRESETS).map(function(k){return'<option value="'+k+'"'+(cur===k?" selected":"")+">"+PRESETS[k][0]+"</option>"}).join("");
    return card("When are you open?","Tick the days you are open, then choose when you open and close. Times are in your local time.",
        '<div class="hbar"><label class="lb">Quick schedule<select data-hpreset>'+opts+'</select></label><button class="btn o s" type="button" data-act="hcopy2">Copy first open day to all open days</button></div><div id="hrows">'+hoursRows()+"</div>")
      +card("What shoppers will see","",'<div class="pvcard"><div class="pvrow"><span>🕒</span><div><b>Opening hours</b><p id="pv-h"></p></div></div></div>');
  }
  A.hcopy2=function(){
    var first=DAYS.filter(function(d){return T.h[d[0]]})[0];if(!first)return;
    var src=T.h[first[0]];DAYS.forEach(function(d){if(T.h[d[0]])T.h[d[0]]={o:src.o,c:src.c}});
    var rows=$("#hrows");if(rows)rows.innerHTML=hoursRows();sync();
  };
  F.set_hours=function(f){
    if(need([[hoursOk(),"A closing time must be later than the opening time."]]))return;
    busy(f,true);
    saveStore({storefront_details:details({hours_schedule:T.h,opening_hours:hoursSummary(T.h)})}).then(function(){C.toast("Saved");busy(f,false);again()}).catch(function(e){busy(f,false);fail(e)});
  };

  /* returns */
  function bodyReturns(){
    var r=T.r;
    return card("Do you accept returns?","Choose what applies. We write it in plain words for your shoppers.",
        '<div class="rcards">'+rc("r_accept","1","Yes","Shoppers can send items back",r.accept,'data-r="accept"')+rc("r_accept","0","No returns","All sales are final",!r.accept,'data-r="accept"')+"</div>"
        +'<div id="rdet"'+(r.accept?"":" hidden")+'><label class="lb">Return window<select data-r="days">'+[3,7,14,30].map(function(n){return'<option value="'+n+'"'+(r.days===n?" selected":"")+">"+n+" days after delivery</option>"}).join("")+"</select></label>"
        +'<p class="slab">Items must be</p><div class="tchips">'+COND.map(function(c){return'<label class="tchip"><input type="checkbox" data-rc="'+c[0]+'"'+(r.cond.indexOf(c[0])>-1?" checked":"")+"><span>"+c[1]+"</span></label>"}).join("")+"</div>"
        +'<p class="slab">Who pays for return delivery?</p><div class="rcards">'+rc("r_who","buyer","The shopper","",r.who==="buyer",'data-r="who"')+rc("r_who","faulty","Store, if faulty","Shopper pays otherwise",r.who==="faulty",'data-r="who"')+rc("r_who","seller","The store","",r.who==="seller",'data-r="who"')+"</div>"
        +'<p class="slab">How do shoppers get their money back?</p><div class="rcards">'+rc("r_refund","original","Original payment","Back to the card or account used",r.refund==="original",'data-r="refund"')+rc("r_refund","credit","Store credit","For a future order",r.refund==="credit",'data-r="refund"')+rc("r_refund","exchange","Exchange only","No refunds",r.refund==="exchange",'data-r="refund"')+"</div>"
        +'<div id="rexrow"'+(r.refund==="exchange"?" hidden":"")+'><label class="rcard" style="display:block"><input type="checkbox" data-r="exchange"'+(r.exchange?" checked":"")+"><span><b>Exchanges are accepted</b><small>Shoppers can swap for another size or item</small></span></label></div>"
        +'<p class="slab">Not returnable</p><div class="tchips">'+EXCL.map(function(x){return'<label class="tchip"><input type="checkbox" data-rx="'+x[0]+'"'+(r.excl.indexOf(x[0])>-1?" checked":"")+"><span>"+x[1]+"</span></label>"}).join("")+"</div>"
        +'<label class="lb">Anything else shoppers should know? (optional)<input data-r="note" maxlength="120" value="'+esc(r.note||"")+'" placeholder="For example: Gift cards cannot be returned"></label></div>')
      +card("What shoppers will see","",'<div class="pvcard"><div class="pvrow"><span>↩️</span><div><b>Returns and exchanges</b><p id="pv-r"></p></div></div></div>');
  }
  F.set_returns=function(f){
    busy(f,true);
    saveStore({storefront_details:details({returns:T.r,returns_summary:returnsSummary(T.r)})}).then(function(){C.toast("Saved");busy(f,false);again()}).catch(function(e){busy(f,false);fail(e)});
  };

  /* delivery */
  function zoneChoices(){
    var s=T.store||{},list=[];
    if(s.state)list.push(s.state);
    Geo.cities(s.country||"NG",s.state).forEach(function(c){list.push(c)});
    T.zones.forEach(function(z){list.push(z)});
    var seen={};return list.filter(function(z){var k=z.toLowerCase();if(seen[k])return false;seen[k]=1;return true});
  }
  function zonesHtml(){
    return'<p class="slab">Areas you deliver to</p><div class="tchips">'+zoneChoices().map(function(z){return'<label class="tchip"><input type="checkbox" data-z="'+esc(z)+'"'+(T.zones.indexOf(z)>-1?" checked":"")+"><span>"+esc(z)+"</span></label>"}).join("")+'</div><div class="zadd"><input id="zin" maxlength="40" placeholder="Add another area" aria-label="Add another area"><button class="btn o" type="button" data-act="zadd2">Add</button></div>';
  }
  A.zadd2=function(){
    var i=$("#zin");if(!i)return;var v=clean(i.value,40);if(!v)return;
    if(T.zones.map(function(z){return z.toLowerCase()}).indexOf(v.toLowerCase())<0)T.zones.push(v);
    var w=$("#zwrap");if(w)w.innerHTML=zonesHtml();
  };
  function bodyDelivery(){
    var d=T.d,p=T.priv||{};
    return card("Preparing orders","How quickly you get an order ready after it is paid.",
        '<label class="lb">Preparation time<select data-d="prep">'+[["same","On the same day"],["1","Within 1 day"],["2","Within 2 days"],["3","Within 3 to 5 days"],["7","Within a week"]].map(function(o){return'<option value="'+o[0]+'"'+(d.prep===o[0]?" selected":"")+">"+o[1]+"</option>"}).join("")+"</select></label>"
        +'<label class="rcard" style="display:block"><input type="checkbox" data-d="pickup"'+(d.pickup?" checked":"")+"><span><b>Shoppers can collect from my store</b><small>Optional. Delivery is still arranged through Everneed.</small></span></label>")
      +card("Where your items are kept","Everneed collects orders from this address. Shoppers do not see it.",ta("pickup","Pickup address",p.pickup_address,300,{rows:3,ph:"House number, street, area, city"}))
      +card("Deliver it yourself?","Optional. Offer direct delivery for orders that only contain your items.",
        '<label class="rcard" style="display:block"><input type="checkbox" name="direct" value="1" id="dd"'+(p.direct_delivery_enabled?" checked":"")+"><span><b>I can deliver myself</b><small>Choose the areas you cover.</small></span></label><div id=\"zwrap\""+(p.direct_delivery_enabled?"":" hidden")+">"+zonesHtml()+"</div>")
      +card("What shoppers will see","",'<div class="pvcard"><div class="pvrow"><span>🚚</span><div><b>Delivery</b><p id="pv-d"></p></div></div></div>');
  }
  F.set_delivery=function(f,d){
    var pk=area(d.pickup,300),dr=!!d.direct,zones=T.zones.slice(0,30);
    if(need([[pk,"Enter the address where your items are kept."],[!dr||zones.length,"Choose the areas you deliver to, or turn off direct delivery."]]))return;
    busy(f,true);
    upsertPrivate({pickup_address:pk,direct_delivery_enabled:dr,delivery_zones:dr?zones:[]}).then(function(){
      return saveStore({storefront_details:details({delivery:T.d,delivery_summary:deliverySummary(T.d)})});
    }).then(function(){C.toast("Saved");busy(f,false);again()}).catch(function(e){busy(f,false);fail(e)});
  };

  /* payout (read only) */
  function bodyPayout(){
    var a=T.app||{},last=String(a.account_number||"").slice(-4);
    return card("Bank account","Your earnings are paid here after the holding period.",
        a.bank_name?'<div class="rvl"><div><span>Bank</span><b>'+esc(a.bank_name)+"</b></div><div><span>Account name</span><b>"+esc(a.account_name||"")+"</b></div><div><span>Account number</span><b>•••• "+esc(last)+"</b></div></div>":'<p class="m">No bank account on file.</p>')
      +card("Changing your bank details","For your security, bank details can only be changed by the Everneed team. This protects your earnings if someone ever gets into your account.",'<a class="btn o" href="/inbox">Message Everneed support</a>');
  }

  /* ---------- live preview and change handling ---------- */
  function sync(){
    var det=$("#rdet"),ex=$("#rexrow");
    if(det)det.hidden=!T.r.accept;
    if(ex)ex.hidden=(T.r.refund==="exchange");
    setText("pv-h",hoursSummary(T.h));setText("pv-r",returnsSummary(T.r));setText("pv-d",deliverySummary(T.d));
  }
  function onDetail(e){
    var t=e.target,k;
    if(!t||!t.getAttribute)return;
    var r=T.r,d=T.d;
    if(t.hasAttribute("data-hpreset")){
      if(t.value!=="custom"){T.h=PRESETS[t.value][1]();var rows=$("#hrows");if(rows)rows.innerHTML=hoursRows()}
    }else if((k=t.getAttribute("data-hopen"))){
      T.h[k]=t.checked?{o:"09:00",c:"18:00"}:null;var rows2=$("#hrows");if(rows2)rows2.innerHTML=hoursRows();var ps=$("[data-hpreset]");if(ps)ps.value=presetOf(T.h);
    }else if((k=t.getAttribute("data-ho"))){
      T.h[k].o=t.value;if(T.h[k].c!=="24:00"&&T.h[k].c<=T.h[k].o){T.h[k].c=plus1h(T.h[k].o);var sel=$('[data-hc="'+k+'"]');if(sel)sel.value=T.h[k].c}
      var ps2=$("[data-hpreset]");if(ps2)ps2.value=presetOf(T.h);
    }else if((k=t.getAttribute("data-hc"))){
      T.h[k].c=t.value;var ps3=$("[data-hpreset]");if(ps3)ps3.value=presetOf(T.h);
    }else if((k=t.getAttribute("data-r"))){
      if(k==="accept")r.accept=t.value==="1";
      else if(k==="days")r.days=+t.value;
      else if(k==="who"||k==="refund")r[k]=t.value;
      else if(k==="exchange")r.exchange=t.checked;
      else if(k==="note")r.note=clean(t.value,120);
    }else if((k=t.getAttribute("data-rc"))){toggle(r.cond,k,t.checked)}
    else if((k=t.getAttribute("data-rx"))){toggle(r.excl,k,t.checked)}
    else if((k=t.getAttribute("data-z"))){toggle(T.zones,k,t.checked);return}
    else if((k=t.getAttribute("data-d"))){if(k==="prep")d.prep=t.value;else if(k==="pickup")d.pickup=t.checked}
    else return;
    sync();
  }
  function bind(sec){
    var f=$("#setform");if(!f)return;
    f.addEventListener("change",onDetail);f.addEventListener("input",onDetail);
    if(sec==="profile")bindProfile(f);
    if(sec==="profile"&&window.Geo)Geo.bind(f,{detect:false});
    if(sec==="delivery"){
      var dd=$("#dd"),w=$("#zwrap");
      if(dd)dd.addEventListener("change",function(){if(w)w.hidden=!dd.checked});
      f.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target&&e.target.id==="zin"){e.preventDefault();A.zadd2()}});
    }
    sync();
  }
})();
