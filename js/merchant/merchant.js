/* Seller side: apply for a store, see the review status, a small dashboard, and manage products.
   Every write goes through Supabase with the signed-in seller's session; row rules and triggers in the database decide what is allowed. */
window.Merchant=(function(){
  var esc=A.esc,notify=A.notify,sheet=A.sheet,bar=A.bar;
  var M={uid:null,loaded:false,loading:false,at:0,err:"",store:null,priv:null,app:null,prods:[],pnotes:{},notes:[]};
  var W={step:1};
  var STEPS=["Your store","About and location","Delivery","Payout","Business"];
  var PST={draft:"Draft",pending_review:"In review",published:"Live",rejected:"Needs changes",archived:"Archived"};
  var IDTYPES=["NIN","Driver's licence","International passport","Voter's card","CAC registration"];
  function q(p,m,quiet){return Supa.q(p,m,quiet)}
  function enc(v){return encodeURIComponent(v)}
  function ago(t){var s=Math.max(1,Math.round((Date.now()-new Date(t).getTime())/1000));if(s<60)return"just now";if(s<3600)return Math.round(s/60)+" min ago";if(s<86400)return Math.round(s/3600)+" h ago";return Math.round(s/86400)+" d ago"}
  function clean(v,max){return String(v==null?"":v).replace(/\s+/g," ").trim().slice(0,max||200)}
  function area(v,max){return String(v==null?"":v).replace(/\r/g,"").trim().slice(0,max||2000)}
  function need(list){for(var i=0;i<list.length;i++){if(!list[i][0]){notify(list[i][1],"err");return true}}return false}

  /* Loading ------------------------------------------------------------------------------------------------ */
  function load(){
    if(M.loading)return Promise.resolve();M.loading=true;var uid=Supa.uid();
    return q("/rest/v1/stores?select=*&owner_id=eq."+enc(uid),"GET",true).then(function(r){
      M.store=(r&&r[0])||null;M.priv=null;M.app=null;M.prods=[];M.pnotes={};
      if(!M.store)return;var id=enc(M.store.id);
      return Promise.all([q("/rest/v1/store_private?select=*&store_id=eq."+id,"GET",true),q("/rest/v1/store_applications?select=*&store_id=eq."+id,"GET",true),
        q("/rest/v1/products?select=*&store_id=eq."+id+"&order=at.desc","GET",true),q("/rest/v1/product_private?select=product_id,review_note,compliance_ref","GET",true)]).then(function(a){
        M.priv=(a[0]&&a[0][0])||null;M.app=(a[1]&&a[1][0])||null;M.prods=a[2]||[];(a[3]||[]).forEach(function(x){M.pnotes[x.product_id]=x})});
    }).then(function(){return q("/rest/v1/notifications?select=*&order=created_at.desc&limit=15","GET",true)}).then(function(n){M.notes=n||[];M.err=""},function(e){M.err=e.message||"Could not load"})
      .then(function(){M.loaded=true;M.loading=false;M.at=Date.now()});
  }
  function kick(){if(M.loading)return;load().then(function(){A.refresh()})}
  function reset(){M={uid:null,loaded:false,loading:false,at:0,err:"",store:null,priv:null,app:null,prods:[],pnotes:{},notes:[]};W={step:1}}

  /* Views ---------------------------------------------------------------------------------------------------- */
  function skeleton(){return'<div class="skel-card" style="aspect-ratio:3/1;margin:16px 0"></div><div class="skel-card" style="aspect-ratio:3/1;margin:16px 0"></div>'}
  function view(arg){
    if(!Supa.on())return A.empty("Not connected","Add your Supabase keys to use seller tools.");
    if(!A.user())return'<div class="c"><h2>Sell on EverNeed</h2><p class="m">Sign in or create an account to open your store.</p></div><a class="btn w" href="#/login">Sign in or create account</a>';
    if(M.uid!==Supa.uid()){reset();M.uid=Supa.uid()}
    var p=(arg||"").split("/");
    if(!M.loaded){kick();return skeleton()}
    if(Date.now()-M.at>30000&&!M.loading){kick()}
    if(M.err&&!M.store)return A.empty("Could not load your store",esc(M.err))+'<button class="btn w" data-act="mretry">Try again</button>';
    if(p[0]==="apply")return wizard();
    if(!M.store)return intro();
    if(p[0]==="products"&&M.store.status==="approved")return prodList();
    if(p[0]==="product"&&M.store.status==="approved")return prodForm(p[1]);
    return home();
  }
  function intro(){
    return'<div class="hero2"><h2>Open your store on EverNeed</h2><p class="m">Reach shoppers across Nigeria. We handle payments and delivery; you bring the products.</p>'
      +'<ul class="ticks"><li>Free trial for new stores</li><li>You only pay commission when you sell</li><li>We collect from our hub, or you deliver locally</li></ul>'
      +'<button class="btn w" data-act="mstart">Start your application</button><p class="m sm">It takes about five minutes. You can stop and continue later.</p></div>'}
  function chipS(label,cls){return'<i class="pill '+(cls||"")+'">'+esc(label)+"</i>"}
  function home(){
    var s=M.store,st=s.status;
    if(st==="draft")return'<div class="note"><span class="ni">!</span><span class="nt"><b>Your application is not finished</b><br>'+esc(s.name)+" is saved as a draft.</span></div><button class=\"btn w\" data-act=\"mstart\">Continue your application</button>";
    if(st==="pending")return'<div class="note"><span class="ni">…</span><span class="nt"><b>Under review</b><br>We are checking '+esc(s.name)+". We will message you here as soon as there is a decision.</span></div>"+notesHtml();
    if(st==="rejected")return'<div class="note err"><span class="ni">!</span><span class="nt"><b>Your application needs changes</b><br>'+esc((M.priv&&M.priv.status_note)||"Please review your details and send it again.")+'</span></div><button class="btn w" data-act="mstart">Edit and resubmit</button>'+notesHtml();
    if(st==="suspended")return'<div class="note err"><span class="ni">!</span><span class="nt"><b>Your store is suspended</b><br>'+esc((M.priv&&M.priv.status_note)||"Please contact EverNeed support.")+"</span></div>"+notesHtml();
    var c={published:0,pending_review:0,draft:0,rejected:0};M.prods.forEach(function(p){if(c[p.status]!=null)c[p.status]++});
    var kp=function(n,l){return'<div class="stat"><b>'+n+"</b><small>"+l+"</small></div>"};
    var fix=M.prods.filter(function(p){return p.status==="rejected"}).map(function(p){var n=M.pnotes[p.id];
      return'<a class="rw" href="#/m/product/'+enc(p.id)+'"><span><b>'+esc(p.name)+"</b><small>"+esc((n&&n.review_note)||"Needs changes")+"</small></span><span>Fix ›</span></a>"}).join("");
    return'<div class="shd">'+Stores.avatar(s,"sm")+'<span><b>'+esc(s.name)+"</b><br>"+chipS("Live","ok")+'</span><a class="btn o s" href="#/store/'+enc(s.slug)+'">View store</a></div>'
      +'<div class="kpis">'+kp(c.published,"Live products")+kp(c.pending_review,"In review")+kp(c.draft,"Drafts")+kp(c.rejected,"Need changes")+"</div>"
      +(fix?'<div class="sec"><h3>Needs your attention</h3></div>'+fix:"")
      +'<div class="two"><a class="btn w" href="#/m/product/new">Add product</a><a class="btn o w" href="#/m/products">All products</a></div>'+notesHtml();
  }
  function notesHtml(){
    if(!M.notes.length)return"";
    return'<div class="sec"><h3>Messages</h3></div>'+M.notes.map(function(n){return'<div class="rw nt'+(n.read_at?"":" unread")+'"><span><b>'+esc(n.title)+"</b><small>"+esc(n.body||"")+"</small></span><small>"+ago(n.created_at)+"</small></div>"}).join("")}

  /* Application wizard ---------------------------------------------------------------------------------------------- */
  function wizard(){
    var s=M.store;
    if(s&&s.status!=="draft"&&s.status!=="rejected")return'<div class="note"><span class="ni">✓</span><span class="nt">Your application has already been sent.</span></div><a class="btn w" href="#/m">Back to your store</a>';
    var n=Math.min(Math.max(W.step,1),5),dots=STEPS.map(function(x,i){return'<i class="'+(i+1<n?"done":i+1===n?"on":"")+'"></i>'}).join("");
    var head='<div class="wz"><div class="dots3" role="img" aria-label="Step '+n+" of 5\">"+dots+'</div><p class="m sm">Step '+n+" of 5 · "+esc(STEPS[n-1])+"</p></div>";
    return head+["","step1","step2","step3","step4","step5"].map(function(_,i){return i===n?[null,s1,s2,s3,s4,s5][i]():""}).join("");
  }
  function inp(name,label,val,o){o=o||{};return'<label class="lb" for="w-'+name+'">'+label+'</label><input id="w-'+name+'" name="'+name+'" value="'+esc(val||"")+'"'+(o.max?' maxlength="'+o.max+'"':"")+(o.ph?' placeholder="'+esc(o.ph)+'"':"")+(o.type?' inputmode="'+o.type+'"':"")+(o.ac?' autocomplete="'+o.ac+'"':"")+(o.req?" required":"")+">"}
  function ta(name,label,val,max){return'<label class="lb" for="w-'+name+'">'+label+'</label><textarea id="w-'+name+'" name="'+name+'" rows="4" maxlength="'+max+'">'+esc(val||"")+"</textarea>"}
  function navBtns(last){return'<div class="two" style="margin-top:18px">'+(W.step>1?'<button class="btn o w" type="button" data-act="mback">Back</button>':"<span></span>")+'<button class="btn w" type="submit">'+(last?"Send application":"Save and continue")+"</button></div>"}
  function s1(){var s=M.store;
    return'<form data-form="mw1" novalidate><h2 class="h2">Tell shoppers about your store</h2>'+inp("name","Store name",s&&s.name,{max:80,req:1,ac:"organization"})
      +'<p class="m sm" id="mslug">'+(s?"Your store link: <b>/store/"+esc(s.slug)+"</b>":"Your store link will appear here.")+"</p>"
      +inp("tagline","Short tagline (optional)",s&&s.tagline,{max:120,ph:"For example: Handmade bags from Lagos"})+ta("about","About your store",s&&s.about,2000)
      +'<label class="lb" for="w-logo">Logo (optional)</label><input id="w-logo" type="file" name="logo" accept="image/*">'+(s&&s.logo_url?'<p class="m sm">A logo is saved. Choose a file to replace it.</p>':"")
      +'<label class="lb" for="w-cover">Cover photo (optional)</label><input id="w-cover" type="file" name="cover" accept="image/*">'+(s&&s.cover_url?'<p class="m sm">A cover is saved. Choose a file to replace it.</p>':"")
      +navBtns()+"</form>"}
  function s2(){var s=M.store,have=(s&&s.categories)||[],groups=[],seen={};S.collections().forEach(function(c){var g=c.grp||c.name;if(!seen[g]){seen[g]=1;groups.push(g)}});
    var cc=groups.map(function(g,i){return'<span class="cc"><input type="checkbox" id="w-cat'+i+'" name="cat" value="'+esc(g)+'"'+(have.indexOf(g)>-1?" checked":"")+'><label for="w-cat'+i+'" class="chip">'+esc(g)+"</label></span>"}).join("");
    var cs=Object.keys(CFG.countries||{}).map(function(k){return'<option value="'+esc(k)+'"'+((s&&s.country||"NG")===k?" selected":"")+">"+esc(CFG.countries[k].name||k)+"</option>"}).join("");
    return'<form data-form="mw2" novalidate><h2 class="h2">What do you sell, and where are you?</h2><label class="lb">Categories (pick up to 6)</label><div class="chips wrap">'+(cc||'<small class="m">No categories yet.</small>')+"</div>"
      +'<label class="lb" for="w-country">Country</label><select id="w-country" name="country">'+cs+"</select>"+inp("state","State",s&&s.state,{max:60,req:1})+inp("city","City or town",s&&s.city,{max:60,req:1})
      +inp("phone","Phone number for EverNeed to reach you",M.priv&&M.priv.phone,{type:"tel",max:20,req:1,ac:"tel"})+navBtns()+"</form>"}
  function s3(){var p=M.priv||{},z=(p.delivery_zones||[]).join(", ");
    return'<form data-form="mw3" novalidate><h2 class="h2">Pickup and delivery</h2><p class="m">Orders with several sellers are collected by EverNeed. For a single-seller order you can deliver yourself to areas you list.</p>'
      +ta("pickup","Address where your items are kept",p.pickup_address,300)
      +'<div class="sw"><span><b>I can deliver myself</b><small class="m" style="display:block">Offer direct delivery to the areas below.</small></span><span class="cc"><input type="checkbox" id="w-direct" name="direct" value="1"'+(p.direct_delivery_enabled?" checked":"")+'><label for="w-direct" class="chip">Yes</label></span></div>'
      +inp("zones","Areas you deliver to (states or cities, separated by commas)",z,{max:300,ph:"Lagos, Ikeja, Lekki"})+navBtns()+"</form>"}
  function s4(){var a=M.app||{};
    return'<form data-form="mw4" novalidate><h2 class="h2">Where should we pay you?</h2><p class="m">We pay your earnings to this bank account. Only the EverNeed team can see it.</p>'
      +inp("bank","Bank name",a.bank_name,{max:80,req:1})+inp("acct","Account number",a.account_number,{type:"numeric",max:20,req:1})+inp("acname","Account name",a.account_name,{max:120,req:1})+navBtns()+"</form>"}
  function s5(){var a=M.app||{},s=M.store||{},o=IDTYPES.map(function(t){return'<option'+(a.id_type===t?" selected":"")+">"+esc(t)+"</option>"}).join("");
    return'<form data-form="mw5" novalidate><h2 class="h2">Confirm your business</h2><p class="m">We check every seller before the store goes live. Your ID details stay private.</p>'
      +inp("biz","Business or trading name",a.business_name||s.name,{max:120,req:1})+'<label class="lb" for="w-idt">ID type</label><select id="w-idt" name="idt">'+o+"</select>"+inp("idref","ID number",a.id_ref,{max:60,req:1})
      +'<div class="sw"><span><b>I agree to the seller terms</b><small class="m" style="display:block">I sell genuine items, I will pack orders on time, and EverNeed may remove listings that break the rules.</small></span><span class="cc"><input type="checkbox" id="w-agree" name="agree" value="1"><label for="w-agree" class="chip">Agree</label></span></div>'
      +navBtns(true)+"</form>"}

  /* Saving each step ---------------------------------------------------------------------------------------------------- */
  function upsertRow(table,key,exists,row){
    return exists?Supa.patchBy(table,key,row[key],stripKey(row,key)).then(function(r){return(r&&r[0])||row}):Supa.insert(table,row).then(function(r){return(r&&r[0])||row})}
  function stripKey(o,k){var c={};Object.keys(o).forEach(function(x){if(x!==k)c[x]=o[x]});return c}
  function uploadImage(file,max,folder){return new Promise(function(res,rej){A.shrink(file,max,function(u){Supa.upload(u,folder).then(res,rej)})})}
  function step1(f,d){
    var name=clean(d.name,80);if(need([[name.length>=2,"Enter your store name (at least 2 characters)."]]))return;
    var body={name:name,tagline:clean(d.tagline,120)||null,about:area(d.about,2000)||null},logo=f.logo&&f.logo.files[0],cover=f.cover&&f.cover.files[0];
    var p=M.store?Supa.patch("stores",M.store.id,body).then(function(r){return(r&&r[0])||Object.assign({},M.store,body)}):Supa.insert("stores",Object.assign({owner_id:Supa.uid(),status:"draft"},body)).then(function(r){return r[0]});
    p.then(function(s){M.store=Object.assign({},M.store||{},s);var jobs=[];
      if(logo)jobs.push(uploadImage(logo,512,"stores/"+s.id).then(function(u){return Supa.patch("stores",s.id,{logo_url:u}).then(function(){M.store.logo_url=u})}));
      if(cover)jobs.push(uploadImage(cover,1200,"stores/"+s.id).then(function(u){return Supa.patch("stores",s.id,{cover_url:u}).then(function(){M.store.cover_url=u})}));
      return Promise.all(jobs)}).then(function(){W.step=2;A.refresh()}).catch(A.netErr)}
  function step2(f,d){
    var cats=new FormData(f).getAll("cat").slice(0,6),state=clean(d.state,60),city=clean(d.city,60),phone=clean(d.phone,20);
    if(need([[cats.length>0,"Pick at least one category."],[state,"Enter your state."],[city,"Enter your city or town."],[/^[0-9+()\s-]{7,20}$/.test(phone),"Enter a phone number we can call."]]))return;
    Supa.patch("stores",M.store.id,{categories:cats,country:d.country||"NG",state:state,city:city}).then(function(r){Object.assign(M.store,(r&&r[0])||{categories:cats,state:state,city:city});
      return upsertRow("store_private","store_id",!!M.priv,{store_id:M.store.id,phone:phone})}).then(function(r){M.priv=Object.assign(M.priv||{},r);W.step=3;A.refresh()}).catch(A.netErr)}
  function step3(f,d){
    var pick=area(d.pickup,300),direct=!!d.direct,zones=clean(d.zones,300).split(",").map(function(x){return x.trim()}).filter(Boolean).slice(0,30);
    if(need([[pick,"Enter the address where your items are kept."],[!direct||zones.length,"List the areas you deliver to, or untick direct delivery."]]))return;
    upsertRow("store_private","store_id",!!M.priv,{store_id:M.store.id,pickup_address:pick,direct_delivery_enabled:direct,delivery_zones:zones}).then(function(r){M.priv=Object.assign(M.priv||{},r);W.step=4;A.refresh()}).catch(A.netErr)}
  function step4(f,d){
    var bank=clean(d.bank,80),acct=String(d.acct||"").replace(/\s+/g,""),name=clean(d.acname,120);
    if(need([[bank,"Enter your bank name."],[/^[0-9]{8,20}$/.test(acct),"Enter your account number (digits only)."],[name,"Enter the account name."]]))return;
    upsertRow("store_applications","store_id",!!M.app,{store_id:M.store.id,bank_name:bank,account_number:acct,account_name:name}).then(function(r){M.app=Object.assign(M.app||{},r);W.step=5;A.refresh()}).catch(A.netErr)}
  function step5(f,d){
    var biz=clean(d.biz,120),idt=d.idt||"",idr=clean(d.idref,60);
    if(need([[biz,"Enter your business or trading name."],[idr,"Enter your ID number."],[d.agree,"Please agree to the seller terms."]]))return;
    upsertRow("store_applications","store_id",!!M.app,{store_id:M.store.id,business_name:biz,id_type:idt,id_ref:idr}).then(function(r){M.app=Object.assign(M.app||{},r);return Supa.rpcAuth("submit_store",{p_store:M.store.id})})
      .then(function(){notify("Application sent. We will message you here.");M.loaded=false;W.step=1;location.hash="#/m";A.refresh()}).catch(function(e){notify(e.message||"Could not send your application","err")})}

  /* Products --------------------------------------------------------------------------------------------------------------- */
  function prodList(){
    var l=M.prods.map(function(p){var n=M.pnotes[p.id],cls=p.status==="published"?"ok":p.status==="rejected"?"bad":p.status==="pending_review"?"info":"";
      var acts=(p.status==="draft"||p.status==="rejected"?'<button class="btn s" data-act="msubmit" data-id="'+esc(p.id)+'">Submit for review</button>':"")+(p.status!=="archived"?'<button class="btn o s" data-act="marchive" data-id="'+esc(p.id)+'">Archive</button>':'<button class="btn o s" data-act="mrestore" data-id="'+esc(p.id)+'">Restore</button>');
      return'<div class="prow"><a class="pth" href="#/m/product/'+enc(p.id)+'">'+(p.img?'<img alt="" loading="lazy" src="'+esc(p.img)+'">':'<span>'+esc(p.name.slice(0,2))+"</span>")+'</a><div class="pin"><a href="#/m/product/'+enc(p.id)+'"><b>'+esc(p.name)+"</b></a><small>"+A.base(p.price)+" · "+(p.stock==null?"No limit":p.stock+" in stock")+"</small>"
        +chipS(PST[p.status]||p.status,cls)+(p.status==="rejected"&&n&&n.review_note?'<small class="why">'+esc(n.review_note)+"</small>":"")+'<div class="acts">'+acts+"</div></div></div>"}).join("");
    return'<div class="sec"><h3>Your products</h3><a class="btn s" href="#/m/product/new">Add product</a></div>'+(l||A.empty("No products yet","Add your first product. It goes live after the EverNeed team approves it."))}
  function prodForm(id){
    var p=id&&id!=="new"?M.prods.filter(function(x){return x.id===id})[0]:null;
    if(id&&id!=="new"&&!p)return A.empty("Product not found","It may have been removed.");
    var cols=S.collections().map(function(c){return c.name}),cur=p?p.col:"",opts=(cols.indexOf(cur)>-1||!cur?"":'<option selected>'+esc(cur)+"</option>")+cols.map(function(c){return"<option"+(c===cur?" selected":"")+">"+esc(c)+"</option>"}).join("");
    var note=p&&M.pnotes[p.id]&&p.status==="rejected"?'<div class="note err"><span class="ni">!</span><span class="nt"><b>Changes needed</b><br>'+esc(M.pnotes[p.id].review_note||"")+"</span></div>":"";
    var pn=p&&M.pnotes[p.id]||{};
    return note+'<form data-form="mprod" novalidate><h2 class="h2">'+(p?"Edit product":"Add a product")+'</h2><input type="hidden" name="id" value="'+esc(p?p.id:"")+'">'
      +inp("pname","Product name",p&&p.name,{max:160,req:1})+'<label class="lb" for="w-pcol">Category</label><select id="w-pcol" name="pcol">'+opts+"</select>"
      +inp("pprice","Price (₦)",p?p.price:"",{type:"decimal",max:12,req:1})+inp("pold","Old price to show as a discount (optional)",p&&p.old?p.old:"",{type:"decimal",max:12})
      +inp("pstock","Stock (leave empty for no limit)",p&&p.stock!=null?p.stock:"",{type:"numeric",max:6})+ta("pdesc","Description",p&&p.desc||(p&&p.descr)||"",3000)
      +'<label class="lb" for="w-pimg">Photo</label><input id="w-pimg" type="file" name="photo" accept="image/*">'+(p&&p.img?'<img class="pprev" alt="" src="'+esc(p.img)+'">':"")
      +inp("pcomp","Registration number, if your product needs one (for example NAFDAC)",pn.compliance_ref,{max:80})
      +'<div class="two" style="margin-top:18px"><button class="btn o w" type="submit" value="draft">Save draft</button><button class="btn w" type="submit" value="review">Submit for review</button></div></form>'}
  function saveProduct(f,d,e){
    var action=(e&&e.submitter&&e.submitter.value)||"draft",name=clean(d.pname,160),price=Number(String(d.pprice).replace(/,/g,"")),old=d.pold?Number(String(d.pold).replace(/,/g,"")):0,stockRaw=String(d.pstock||"").trim(),stock=stockRaw===""?null:Number(stockRaw);
    if(need([[name.length>=2,"Enter the product name."],[price>0&&isFinite(price),"Enter a price above zero."],[!d.pold||(old>0&&isFinite(old)),"The old price must be a number."],[stock===null||(Number.isInteger(stock)&&stock>=0),"Stock must be a whole number, or empty."],[d.pcol,"Pick a category."]]))return;
    var file=f.photo&&f.photo.files[0],existing=d.id?M.prods.filter(function(x){return x.id===d.id})[0]:null;
    var body={name:name,col:d.pcol,price:price,old:old||0,stock:stock,descr:area(d.pdesc,3000)||null};
    var up=file?uploadImage(file,900,"stores/"+M.store.id):Promise.resolve(null);
    up.then(function(u){if(u){body.img=u;body.images=[u]}
      return existing?Supa.patch("products",existing.id,body):Supa.insert("products",Object.assign({store_id:M.store.id,cty:[],status:"draft"},body))}).then(function(r){
      var row=(r&&r[0])||existing,comp=clean(d.pcomp,80);if(!row)throw new Error("Could not save the product");
      var pn=M.pnotes[row.id],next=comp||pn?upsertRow("product_private","product_id",!!pn,{product_id:row.id,compliance_ref:comp||null}):Promise.resolve();
      return next.then(function(){return action==="review"?Supa.patch("products",row.id,{status:"pending_review"}):null})}).then(function(){
      notify(action==="review"?"Sent for review":"Saved");M.loaded=false;location.hash="#/m/products";A.refresh()}).catch(function(e){notify(e.message||"Could not save the product","err")})}
  function setStatus(id,status,msg){Supa.patch("products",id,{status:status}).then(function(){notify(msg);M.loaded=false;A.refresh()}).catch(function(e){notify(e.message||"Could not update the product","err")})}

  /* Dispatch ---------------------------------------------------------------------------------------------------------------- */
  function act(k,d,a,e){
    if(k==="mstart"){W.step=1;if(M.store&&M.store.status!=="draft"&&M.store.status!=="rejected"){location.hash="#/m";return true}location.hash="#/m/apply";A.refresh();return true}
    if(k==="mback"){W.step=Math.max(1,W.step-1);A.refresh();return true}
    if(k==="mretry"){M.loaded=false;A.refresh();return true}
    if(k==="msubmit"){setStatus(d.id,"pending_review","Sent for review");return true}
    if(k==="marchive"){setStatus(d.id,"archived","Archived");return true}
    if(k==="mrestore"){setStatus(d.id,"draft","Moved back to drafts");return true}
    return false}
  function submit(k,f,d,e){
    if(k==="mw1"){step1(f,d);return true}if(k==="mw2"){step2(f,d);return true}if(k==="mw3"){step3(f,d);return true}
    if(k==="mw4"){step4(f,d);return true}if(k==="mw5"){step5(f,d);return true}if(k==="mprod"){saveProduct(f,d,e);return true}
    return false}
  var slugT=null;
  document.addEventListener("input",function(e){var t=e.target;if(!t||t.id!=="w-name"||M.store||!Supa.uid())return;clearTimeout(slugT);
    slugT=setTimeout(function(){var n=clean(t.value,80),el=document.getElementById("mslug");if(!el)return;if(n.length<2){el.textContent="Your store link will appear here.";return}
      Supa.rpcAuth("next_slug",{p_name:n}).then(function(s){var el2=document.getElementById("mslug");if(el2)el2.innerHTML="Your store link: <b>/store/"+esc(s)+"</b>"}).catch(function(){})},350)});
  window.addEventListener("hashchange",function(){if(location.hash.indexOf("#/m")!==0&&M.loaded&&Date.now()-M.at>60000){M.loaded=false}});
  return{view:view,act:act,submit:submit,reset:reset}
})();
