/* Me: one full-screen page for account, plan, alerts, appearance and sign out.
   Sellers see their store and plan (from the backend). Admins see their console tools. Shoppers go to their account page.
   Only things that exist are listed; nothing is shown as a placeholder. */
(function(){
  var C=Core,V=C.V,A=C.A,esc=C.esc,AX=window.AX,enc=encodeURIComponent;
  function soft(){return[]}
  function unwrap(r){return r&&r.data!==undefined?r.data:r}
  function inner(icon,title,sub,right){return'<span class="me-ic">'+AX.icon(icon,20)+'</span><span class="me-tx"><b>'+esc(title)+"</b>"+(sub?"<small>"+esc(sub)+"</small>":"")+'</span><span class="me-rt">'+(right||AX.icon("chev",18))+"</span>"}
  function row(href,icon,title,sub,right){return'<a class="me-row" href="'+href+'">'+inner(icon,title,sub,right)+"</a>"}
  function btn(attrs,icon,title,sub,right){return'<button type="button" class="me-row" '+attrs+">"+inner(icon,title,sub,right)+"</button>"}
  var STATUS={approved:["Approved","info"],pending:["In review","info"],draft:["Draft","info"],rejected:["Needs changes","bad"],suspended:["Suspended","bad"]};
  function pill(l,c){return'<span class="pill '+(c||"")+'">'+esc(l)+"</span>"}
  function alerts(){return btn('data-act="notifperm"',"bell","Alerts on this device",null,'<span class="me-alert">'+esc(Notify.alertState())+"</span>")}
  V.me=function(){
    if(!Supa.uid())return{redirect:"/sign-in"};
    var me=C.me()||{},role=String(me.role||"customer").toLowerCase();
    if(role==="admin"){
      var h='<div class="me-hd"><span class="me-av">'+esc((me.name||me.email||"A").charAt(0).toUpperCase())+'</span><div><h1>'+esc(me.name||"Admin")+"</h1><p>"+esc(me.email||"")+"</p></div></div>"
        +'<div class="me-grp"><h2>Console</h2>'+row("/admin/waitlist","users","Waitlist","Early-access signups")+row("/supportset","sliders","Support settings","Reply targets and triage rules")+row("/admin/appearance","palette","Appearance","Light, dark and colour")+"</div>"
        +'<div class="me-grp"><h2>This device</h2>'+alerts()+"</div>"
        +'<div class="me-grp">'+btn('data-act="out"',"exit","Sign out")+"</div>";
      return{layout:"admin",active:"me",title:"Me",html:h};
    }
    if(role!=="merchant"&&role!=="seller")return{redirect:"/account"};
    return Supa.get("stores?select=*&owner_id=eq."+enc(Supa.uid())).catch(soft).then(function(r){
      var s=r&&r[0]||null;if(!s)return{redirect:"/portal"};
      var ent=s.status==="approved"?Supa.rpc("my_store_entitlements",{}).then(unwrap,function(){return null}):Promise.resolve(null);
      return ent.then(function(e){
        var plan=e&&e.configured===true?e:null,st=s.status==="approved"&&s.activation_status==="live"?["Live","ok"]:s.status==="approved"?["Approved, not live","info"]:(STATUS[s.status]||[s.status,""]);
        var feats=plan?Supa.get("store_plans?select=features&id=eq."+enc(plan.plan_id)).catch(soft):Promise.resolve([]);
        return feats.then(function(f){
          var list=(f&&f[0]&&f[0].features)||[],usage=plan?(plan.active_products_unlimited?(plan.active_products||0)+" products":(plan.active_products||0)+" of "+plan.active_product_limit+" products"):"";
          var h='<div class="me-hd"><span class="me-av">'+(s.logo_url?'<img alt="" src="'+esc(s.logo_url)+'">':esc((s.name||"S").charAt(0).toUpperCase()))+'</span><div><h1>'+esc(s.name)+"</h1><p>"+pill(st[0],st[1])+"</p></div></div>"
            +(plan?'<div class="me-grp"><h2>Your plan</h2>'+row("/portal/plan","card",plan.plan_name||"Plan",usage)
              +(list.length?'<ul class="me-feat">'+list.slice(0,6).map(function(x){return"<li>"+esc(x)+"</li>"}).join("")+"</ul>":"")+"</div>":"")
            +'<div class="me-grp"><h2>Help</h2>'+row("/inbox","chat","Messages","Customers and Everneed")+"</div>"
            +'<div class="me-grp"><h2>Preferences</h2>'+row("/portal/appearance","palette","Appearance","Light, dark and colour")+alerts()+"</div>"
            +'<div class="me-grp">'+btn('data-act="out"',"exit","Sign out")+"</div>";
          return{layout:"portal",active:"me",title:"Me",html:h};
        });
      });
    });
  };
})();
