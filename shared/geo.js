/* Shared location helpers: countries and dial codes, states or regions, city suggestions, phone formatting and automatic detection.
   Used by the website now and meant for the app later (see docs/WORKFLOW/WEBSITE_TRACKER.md, WEB-X05).
   Detection never asks for permission: it uses the visitor's connection (/api/geo, a Cloudflare function), then their time zone, then
   their browser language. Everything it fills in can be changed by the person. Nothing is stored unless they submit the form. */
(function(){
  var NG=["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Federal Capital Territory (Abuja)","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];
  var NGC={"Abia":["Umuahia","Aba","Arochukwu"],"Adamawa":["Yola","Mubi","Jimeta"],"Akwa Ibom":["Uyo","Eket","Ikot Ekpene"],"Anambra":["Awka","Onitsha","Nnewi"],"Bauchi":["Bauchi","Azare","Misau"],"Bayelsa":["Yenagoa","Sagbama","Brass"],"Benue":["Makurdi","Gboko","Otukpo"],"Borno":["Maiduguri","Bama","Biu"],"Cross River":["Calabar","Ikom","Ogoja"],"Delta":["Asaba","Warri","Sapele","Ughelli"],"Ebonyi":["Abakaliki","Afikpo"],"Edo":["Benin City","Ekpoma","Auchi"],"Ekiti":["Ado-Ekiti","Ikere-Ekiti","Ijero-Ekiti"],"Enugu":["Enugu","Nsukka","Agbani"],"Federal Capital Territory (Abuja)":["Abuja","Gwagwalada","Kuje","Bwari","Garki","Wuse","Maitama"],"Gombe":["Gombe","Kumo","Billiri"],"Imo":["Owerri","Orlu","Okigwe"],"Jigawa":["Dutse","Hadejia","Gumel"],"Kaduna":["Kaduna","Zaria","Kafanchan"],"Kano":["Kano","Wudil","Gaya"],"Katsina":["Katsina","Daura","Funtua"],"Kebbi":["Birnin Kebbi","Argungu","Zuru"],"Kogi":["Lokoja","Okene","Idah"],"Kwara":["Ilorin","Offa","Omu-Aran"],"Lagos":["Ikeja","Lekki","Victoria Island","Ikoyi","Surulere","Yaba","Ikorodu","Epe","Badagry","Ajah","Festac"],"Nasarawa":["Lafia","Keffi","Akwanga"],"Niger":["Minna","Suleja","Bida"],"Ogun":["Abeokuta","Ijebu-Ode","Sagamu","Ota"],"Ondo":["Akure","Ondo","Owo"],"Osun":["Osogbo","Ile-Ife","Ilesa"],"Oyo":["Ibadan","Ogbomoso","Oyo"],"Plateau":["Jos","Bukuru","Pankshin"],"Rivers":["Port Harcourt","Bonny","Obio-Akpor"],"Sokoto":["Sokoto","Tambuwal","Wurno"],"Taraba":["Jalingo","Wukari","Bali"],"Yobe":["Damaturu","Potiskum","Gashua"],"Zamfara":["Gusau","Kaura Namoda","Talata Mafara"]};
  var GHC={"Ahafo":["Goaso"],"Ashanti":["Kumasi","Obuasi","Ejisu"],"Bono":["Sunyani"],"Bono East":["Techiman"],"Central":["Cape Coast","Winneba"],"Eastern":["Koforidua"],"Greater Accra":["Accra","Tema","Madina","Kasoa"],"North East":["Nalerigu"],"Northern":["Tamale"],"Oti":["Dambai"],"Savannah":["Damongo"],"Upper East":["Bolgatanga"],"Upper West":["Wa"],"Volta":["Ho"],"Western":["Takoradi","Tarkwa"],"Western North":["Sefwi Wiawso"]};
  var KEC={"Baringo":["Kabarnet"],"Bomet":["Bomet"],"Bungoma":["Bungoma"],"Busia":["Busia"],"Elgeyo-Marakwet":["Iten"],"Embu":["Embu"],"Garissa":["Garissa"],"Homa Bay":["Homa Bay"],"Isiolo":["Isiolo"],"Kajiado":["Kitengela","Ngong","Kajiado"],"Kakamega":["Kakamega"],"Kericho":["Kericho"],"Kiambu":["Thika","Kiambu","Ruiru"],"Kilifi":["Kilifi","Malindi"],"Kirinyaga":["Kerugoya"],"Kisii":["Kisii"],"Kisumu":["Kisumu"],"Kitui":["Kitui"],"Kwale":["Kwale","Ukunda"],"Laikipia":["Nanyuki"],"Lamu":["Lamu"],"Machakos":["Machakos","Athi River"],"Makueni":["Wote"],"Mandera":["Mandera"],"Marsabit":["Marsabit"],"Meru":["Meru"],"Migori":["Migori"],"Mombasa":["Mombasa"],"Murang'a":["Murang'a"],"Nairobi":["Nairobi"],"Nakuru":["Nakuru","Naivasha"],"Nandi":["Kapsabet"],"Narok":["Narok"],"Nyamira":["Nyamira"],"Nyandarua":["Ol Kalou"],"Nyeri":["Nyeri"],"Samburu":["Maralal"],"Siaya":["Siaya"],"Taita-Taveta":["Voi"],"Tana River":["Hola"],"Tharaka-Nithi":["Chuka"],"Trans-Nzoia":["Kitale"],"Turkana":["Lodwar"],"Uasin Gishu":["Eldoret"],"Vihiga":["Mbale"],"Wajir":["Wajir"],"West Pokot":["Kapenguria"]};
  var ZAC={"Eastern Cape":["Gqeberha","East London","Mthatha"],"Free State":["Bloemfontein","Welkom"],"Gauteng":["Johannesburg","Pretoria","Soweto","Sandton","Midrand"],"KwaZulu-Natal":["Durban","Pietermaritzburg"],"Limpopo":["Polokwane"],"Mpumalanga":["Mbombela","Emalahleni"],"Northern Cape":["Kimberley"],"North West":["Mahikeng","Rustenburg"],"Western Cape":["Cape Town","Stellenbosch","George"]};
  var GBC={"England":["London","Manchester","Birmingham","Leeds","Liverpool","Bristol","Sheffield","Newcastle upon Tyne"],"Scotland":["Edinburgh","Glasgow","Aberdeen","Dundee"],"Wales":["Cardiff","Swansea","Newport"],"Northern Ireland":["Belfast","Derry","Lisburn"]};
  var USC={"Alabama":["Birmingham","Montgomery","Huntsville"],"Alaska":["Anchorage","Fairbanks"],"Arizona":["Phoenix","Tucson","Mesa"],"Arkansas":["Little Rock","Fayetteville"],"California":["Los Angeles","San Francisco","San Diego","Sacramento"],"Colorado":["Denver","Colorado Springs"],"Connecticut":["Hartford","New Haven"],"Delaware":["Wilmington","Dover"],"District of Columbia":["Washington"],"Florida":["Miami","Orlando","Tampa","Jacksonville"],"Georgia":["Atlanta","Savannah"],"Hawaii":["Honolulu"],"Idaho":["Boise"],"Illinois":["Chicago","Springfield"],"Indiana":["Indianapolis"],"Iowa":["Des Moines"],"Kansas":["Wichita","Topeka"],"Kentucky":["Louisville","Lexington"],"Louisiana":["New Orleans","Baton Rouge"],"Maine":["Portland"],"Maryland":["Baltimore"],"Massachusetts":["Boston","Worcester"],"Michigan":["Detroit","Grand Rapids"],"Minnesota":["Minneapolis","Saint Paul"],"Mississippi":["Jackson"],"Missouri":["Kansas City","Saint Louis"],"Montana":["Billings"],"Nebraska":["Omaha","Lincoln"],"Nevada":["Las Vegas","Reno"],"New Hampshire":["Manchester"],"New Jersey":["Newark","Jersey City"],"New Mexico":["Albuquerque","Santa Fe"],"New York":["New York City","Buffalo","Albany"],"North Carolina":["Charlotte","Raleigh"],"North Dakota":["Fargo","Bismarck"],"Ohio":["Columbus","Cleveland","Cincinnati"],"Oklahoma":["Oklahoma City","Tulsa"],"Oregon":["Portland","Eugene"],"Pennsylvania":["Philadelphia","Pittsburgh"],"Rhode Island":["Providence"],"South Carolina":["Charleston","Columbia"],"South Dakota":["Sioux Falls"],"Tennessee":["Nashville","Memphis"],"Texas":["Houston","Dallas","Austin","San Antonio"],"Utah":["Salt Lake City"],"Vermont":["Burlington"],"Virginia":["Richmond","Virginia Beach"],"Washington":["Seattle","Spokane"],"West Virginia":["Charleston"],"Wisconsin":["Milwaukee","Madison"],"Wyoming":["Cheyenne"]};
  function names(o){return Object.keys(o)}
  /* trunk: leading digit people type that is not part of the international number. len: digits after the country code. */
  var COUNTRIES={
    NG:{name:"Nigeria",dial:"234",trunk:"0",len:[10,10],ph:"801 234 5678",states:NG,cities:NGC,label:"State"},
    GH:{name:"Ghana",dial:"233",trunk:"0",len:[9,9],ph:"24 123 4567",states:names(GHC),cities:GHC,label:"Region"},
    KE:{name:"Kenya",dial:"254",trunk:"0",len:[9,9],ph:"712 345 678",states:names(KEC),cities:KEC,label:"County"},
    ZA:{name:"South Africa",dial:"27",trunk:"0",len:[9,9],ph:"82 123 4567",states:names(ZAC),cities:ZAC,label:"Province"},
    GB:{name:"United Kingdom",dial:"44",trunk:"0",len:[9,10],ph:"7400 123456",states:names(GBC),cities:GBC,label:"Nation"},
    US:{name:"United States",dial:"1",trunk:"",len:[10,10],ph:"415 555 2671",states:names(USC),cities:USC,label:"State"}
  };
  var TZ={"Africa/Lagos":"NG","Africa/Accra":"GH","Africa/Nairobi":"KE","Africa/Johannesburg":"ZA","Europe/London":"GB","America/New_York":"US","America/Chicago":"US","America/Denver":"US","America/Los_Angeles":"US","America/Phoenix":"US","America/Anchorage":"US","Pacific/Honolulu":"US"};
  var BANKS_NG=["Access Bank","Citibank Nigeria","Ecobank Nigeria","Fidelity Bank","First Bank of Nigeria","First City Monument Bank (FCMB)","Globus Bank","Guaranty Trust Bank (GTBank)","Heritage Bank","Jaiz Bank","Keystone Bank","Kuda Bank","Lotus Bank","Moniepoint MFB","OPay","PalmPay","Parallex Bank","Polaris Bank","Premium Trust Bank","Providus Bank","Stanbic IBTC Bank","Standard Chartered Bank","Sterling Bank","SunTrust Bank","Taj Bank","Titan Trust Bank","Union Bank of Nigeria","United Bank for Africa (UBA)","Unity Bank","Wema Bank","Zenith Bank"];
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function norm(s){return String(s||"").toLowerCase().replace(/\(.*?\)/g," ").replace(/\b(state|county|province|region|district)\b/g," ").replace(/[^a-z0-9]+/g," ").trim()}
  var G={countries:COUNTRIES,banks:{NG:BANKS_NG},
    list:function(){return names(COUNTRIES)},
    states:function(cc){return COUNTRIES[cc]?COUNTRIES[cc].states:[]},
    cities:function(cc,state){var c=COUNTRIES[cc];return c&&c.cities&&c.cities[state]||[]},
    stateLabel:function(cc){return COUNTRIES[cc]?COUNTRIES[cc].label:"State or region"},
    dial:function(cc){return COUNTRIES[cc]?"+"+COUNTRIES[cc].dial:""},
    /* Find the state in our list that a detected region name refers to, for example "Federal Capital Territory" or "Lagos State". */
    matchState:function(cc,name){var n=norm(name),L=G.states(cc);if(!n)return null;
      for(var i=0;i<L.length;i++){if(norm(L[i])===n)return L[i]}
      for(i=0;i<L.length;i++){var m=norm(L[i]);if(m&&(m.indexOf(n)>-1||n.indexOf(m)>-1))return L[i]}
      if(cc==="NG"&&/\b(abuja|fct|federal capital)\b/.test(String(name||"").toLowerCase()))return"Federal Capital Territory (Abuja)";return null},
    /* A phone number as people type it ("0801 234 5678", "801 234 5678", "+234 801 234 5678") to +2348012345678, or null if it cannot be valid. */
    e164:function(cc,input){var c=COUNTRIES[cc];if(!c)return null;var raw=String(input||"").trim(),d=raw.replace(/[^\d]/g,"");if(!d)return null;
      if(raw.charAt(0)==="+"&&d.indexOf(c.dial)===0)d=d.slice(c.dial.length);
      else if(d.indexOf("00"+c.dial)===0)d=d.slice(2+c.dial.length);
      if(c.trunk&&d.charAt(0)===c.trunk)d=d.slice(1);
      return d.length>=c.len[0]&&d.length<=c.len[1]?"+"+c.dial+d:null},
    /* +2348012345678 to {cc:"NG", national:"8012345678"}. Longest dial code wins so +233 is never read as +2. */
    split:function(e164){var s=String(e164||"").replace(/[^\d+]/g,"");if(s.charAt(0)!=="+")return null;var d=s.slice(1),best=null;
      G.list().forEach(function(cc){var x=COUNTRIES[cc].dial;if(d.indexOf(x)===0&&(!best||x.length>COUNTRIES[best].dial.length))best=cc});
      return best?{cc:best,national:d.slice(COUNTRIES[best].dial.length)}:null},
    placeholder:function(cc){return COUNTRIES[cc]?COUNTRIES[cc].ph:"Phone number"},
    /* Where is this person? Resolves to {country,state,city,source}. Never rejects, never asks permission. */
    detect:function(){if(G._d)return G._d;
      G._d=fetch("/api/geo",{cache:"no-store"}).then(function(r){return r.ok?r.json():{}}).catch(function(){return{}}).then(function(g){
        var cc=g&&COUNTRIES[g.country]?g.country:null,src=cc?"connection":null;
        if(!cc){try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(TZ[tz]){cc=TZ[tz];src="time zone"}}catch(e){}}
        if(!cc){var m=String(navigator.language||"").match(/-([A-Za-z]{2})$/);if(m&&COUNTRIES[m[1].toUpperCase()]){cc=m[1].toUpperCase();src="language"}}
        var st=cc&&g&&g.region?G.matchState(cc,g.region):null,city=cc&&g&&g.city&&st?String(g.city):null;
        return{country:cc,state:st,city:city,source:src}});return G._d},
    /* ----- markup ----- */
    countryOptions:function(sel){return G.list().map(function(k){return'<option value="'+k+'"'+(k===sel?" selected":"")+">"+esc(COUNTRIES[k].name)+"</option>"}).join("")},
    stateOptions:function(cc,sel){var L=G.states(cc),h='<option value="">Choose '+esc(G.stateLabel(cc).toLowerCase())+"</option>";if(sel&&L.indexOf(sel)<0)h+='<option value="'+esc(sel)+'" selected>'+esc(sel)+"</option>";return h+L.map(function(s){return'<option'+(s===sel?" selected":"")+">"+esc(s)+"</option>"}).join("")},
    cityOptions:function(cc,state){return G.cities(cc,state).map(function(c){return'<option value="'+esc(c)+'"></option>'}).join("")},
    /* Country, state or region, and city as one block. Call Geo.bind(form) after it is on the page. */
    locationFields:function(o){o=o||{};var cc=COUNTRIES[o.country]?o.country:"NG";
      return'<div data-geo-block><label class="lb">Country<select name="country" data-geo="country" autocomplete="country">'+G.countryOptions(cc)+'</select></label>'
        +'<label class="lb"><span data-geo="statelabel">'+esc(G.stateLabel(cc))+'</span><select name="state" data-geo="state" required>'+G.stateOptions(cc,o.state)+'</select></label>'
        +'<label class="lb">City or town<input name="city" data-geo="city" list="geo-cities" maxlength="60" autocomplete="address-level2" placeholder="Start typing, or pick a suggestion" value="'+esc(o.city||"")+'" required></label><datalist id="geo-cities">'+G.cityOptions(cc,o.state)+'</datalist>'
        +'<p class="geo-note" data-geo="note" hidden></p></div>'},
    /* The number is typed without a country code. The code sits beside it and follows the country. */
    phoneField:function(name,label,e164,cc,opt){opt=opt||{};var sp=G.split(e164),use=sp?sp.cc:(COUNTRIES[cc]?cc:"NG"),nat=sp?sp.national:"";
      return'<div class="lb"><span>'+esc(label)+'</span><div class="ph" data-phone="'+name+'"><select class="ph-cc" name="'+name+'_cc" aria-label="Country code">'+G.list().map(function(k){return'<option value="'+k+'"'+(k===use?" selected":"")+">"+k+" +"+COUNTRIES[k].dial+"</option>"}).join("")+'</select><input class="ph-no" name="'+name+'" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="18" placeholder="'+esc(G.placeholder(use))+'" value="'+esc(nat)+'"'+(opt.required?" required":"")+'></div></div>'},
    /* Read a phoneField back. Returns "+2348012345678", "" when left empty and not required, or null when it is not a valid number. */
    readPhone:function(d,name,required){var cc=d[name+"_cc"],v=String(d[name]||"").trim();if(!v)return required?null:"";return G.e164(cc,v)},
    /* Make the country, state, city and phone code work together. */
    bind:function(form,opt){opt=opt||{};var cs=form.querySelector('[data-geo="country"]'),ss=form.querySelector('[data-geo="state"]'),ci=form.querySelector('[data-geo="city"]'),dl=form.querySelector("#geo-cities"),note=form.querySelector('[data-geo="note"]'),lab=form.querySelector('[data-geo="statelabel"]'),
        phones=[].slice.call(form.querySelectorAll(".ph")),touched=false;
      function codes(cc){phones.forEach(function(p){var sel=p.querySelector(".ph-cc"),no=p.querySelector(".ph-no");if(sel&&!sel._own){sel.value=cc}if(no)no.placeholder=G.placeholder(sel&&sel.value||cc)})}
      function states(cc,pick){if(!ss)return;ss.innerHTML=G.stateOptions(cc,pick||"");if(lab)lab.textContent=G.stateLabel(cc);if(dl)dl.innerHTML=G.cityOptions(cc,pick||"")}
      if(cs)cs.addEventListener("change",function(){touched=true;states(cs.value);if(ci)ci.value="";codes(cs.value);if(note)note.hidden=true});
      if(ss)ss.addEventListener("change",function(){touched=true;if(dl)dl.innerHTML=G.cityOptions(cs?cs.value:"NG",ss.value);if(ci&&ci.value&&G.cities(cs.value,ss.value).indexOf(ci.value)<0&&opt.clearCity!==false){}});
      if(ci)ci.addEventListener("input",function(){touched=true});
      phones.forEach(function(p){var sel=p.querySelector(".ph-cc"),no=p.querySelector(".ph-no");if(sel)sel.addEventListener("change",function(){sel._own=true;if(no)no.placeholder=G.placeholder(sel.value)})});
      /* First visit to this form with nothing saved yet: fill in from where the person is. */
      if(opt.detect!==false&&cs&&!(ss&&ss.value)&&!(ci&&ci.value)){G.detect().then(function(g){if(touched||!g.country)return;cs.value=g.country;states(g.country,g.state||"");codes(g.country);if(g.city&&ci&&!ci.value)ci.value=g.city;
        if(note){note.textContent="We filled this in from your connection ("+COUNTRIES[g.country].name+(g.state?", "+g.state:"")+"). Please change anything that is wrong.";note.hidden=false}})}
      else if(cs){codes(cs.value)}}
  };
  window.Geo=G;
})();
