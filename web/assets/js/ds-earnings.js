/* Seller earnings (WEB-S08): a READ-ONLY view of the legacy seller ledger. Loaded on demand by ds-lazy.js for /portal/earnings.
   Data it reads (existing on staging, checked 25 Nov 2026):
   - rpc store_balance(p_store) -> numeric, or null when the caller is not the store owner or an admin.
   - table ledger_entries (id, store_id, order_id, seller_order_id, kind, amount, currency, status, note, created_at). RLS: owner or admin.
     kind: sale, commission, rental, refund, payout, adjustment. status: pending, available, paid, reversed.
   Rules this file keeps:
   - No writes, no withdraw or payout action. Nothing is presented as a bank balance or a wallet.
   - No totals are calculated here. The only balance shown is the number the server returns, and only when every ledger row is in the base currency.
   - Each amount is shown in its own currency and is never added to another currency.
   - Failures say so. A missing balance shows "Not available", never 0.
   Later, the journal-based projection (finance.project_store_balance, contract 027) replaces this source; see docs/WORKFLOW/SHARED_FINANCIAL_JOURNAL_027_CONTRACT.md. */
(function(){
  var C=window.Core,D=window.DS,V=C&&C.V,A=C&&C.A,old=V&&V.portal;
  if(!C||!D||!old)return;
  var esc=C.esc,enc=encodeURIComponent,PAGE=50,CHUNK=500,CAP=5000;
  var BASE=(typeof CFG!=="undefined"&&CFG.baseCurrency)||"NGN";
  var COLS="id,created_at,kind,status,amount,currency,order_id,seller_order_id,note";
  var KIND={sale:["Sale","receipt"],commission:["Commission","list"],rental:["Rental","list"],refund:["Refund","alert"],payout:["Payout","wallet"],adjustment:["Adjustment","info"]};
  var ST={pending:["Pending","warn","clock"],available:["Available","ok","okc"],paid:["Paid out","brand","okc"],reversed:["Reversed","bad","alert"]};
  var TABS=[["all","All"],["pending","Pending"],["available","Available"],["paid","Paid out"],["reversed","Reversed"]];
  var E={store:null,tab:"all",rows:[],more:false,req:0,busy:false};

  function out(html,title){return{layout:"portal",active:"portal/earnings",html:html,title:title||"Earnings"}}
  function okTab(t){return TABS.some(function(x){return x[0]===t})}
  function fmt(n,cur,sign){
    n=Number(n);if(!isFinite(n))return"";
    try{return new Intl.NumberFormat("en-NG",{style:"currency",currency:cur,minimumFractionDigits:n%1===0?0:2,maximumFractionDigits:2,signDisplay:sign?"exceptZero":"auto"}).format(n)}
    catch(e){return(sign&&n>0?"+":"")+String(cur||"")+" "+n}
  }
  function short(id,max,keep){id=String(id);return id.length>max?id.slice(0,keep)+"…"+id.slice(-4):id}
  function query(store,tab,limit,off){
    return"ledger_entries?select="+COLS+"&store_id=eq."+enc(store)+(tab!=="all"?"&status=eq."+enc(tab):"")+"&order=created_at.desc,id.desc&limit="+limit+"&offset="+off;
  }
  function problem(e){
    var s=e&&e.status;
    if(s===401||s===403)return"You do not have access to this store's earnings. Sign in with the account that owns the store.";
    return"Earnings could not load. Check your connection and try again.";
  }

  /* ---------- markup ---------- */
  function rowHtml(r){
    var k=KIND[r.kind]||[String(r.kind||"Entry"),"info"],s=ST[r.status]||[String(r.status||"Unknown"),"","info"],ref=r.seller_order_id||r.order_id,sub=[C.when(r.created_at)];
    if(ref)sub.push("Order "+short(ref,14,6));
    if(r.note)sub.push(String(r.note).length>80?String(r.note).slice(0,80)+"…":r.note);
    return D.row({icon:k[1],title:k[0],sub:sub.filter(Boolean).join(" · "),tone:r.status==="reversed"?"bad":r.status==="pending"?"warn":r.status==="available"?"ok":"",
      end:'<span class="ds-odr"><b>'+esc(fmt(r.amount,r.currency||BASE,true))+"</b>"+D.chip(s[0],s[1],s[2])+"</span>"});
  }
  function listHtml(){
    if(!E.rows.length)return E.tab==="all"
      ?D.empty({icon:"wallet",title:"No earnings yet",text:"Entries appear here after your first sale. Sales become available after delivery and the holding period."})
      :D.empty({icon:"search",title:"Nothing here",text:"No entries have this status."});
    return'<div class="ds-rows" aria-label="Ledger entries">'+E.rows.map(rowHtml).join("")+"</div>"
      +(E.more?'<button type="button" class="ds-btn o w" data-act="ds-ern-more" style="margin-top:12px">Show more</button>':"");
  }
  function tabsHtml(){
    return'<div class="ds-chips ds-pf" role="group" aria-label="Filter by status">'+TABS.map(function(t){
      var on=t[0]===E.tab;return'<button type="button" class="ds-chip'+(on?" on":"")+'" data-act="ds-ern-f" data-id="'+t[0]+'" aria-pressed="'+on+'">'+esc(t[1])+"</button>"}).join("")+"</div>";
  }
  function pageHtml(bal,other){
    var show=other===false&&bal!==null&&bal!==undefined&&isFinite(Number(bal));
    return'<div class="ds-headrow"><h1 class="ds-title">Earnings</h1><button type="button" class="ds-btn o s" data-act="ds-ern-csv">'+D.icon("download",18)+"Export CSV</button></div>"
      +D.banner("info","Seller ledger (legacy)","This is not a bank balance. Sales become available after delivery and the holding period, and payouts are recorded by the Everneed team. Withdrawals are not available yet.")
      +(other===true?D.banner("warning","More than one currency","Your ledger has entries in more than one currency, so no combined balance is shown. Each entry below shows its own currency."):"")
      +'<div class="ds-stats" style="margin-top:12px">'+D.stat({icon:"wallet",value:show?fmt(bal,BASE):"Not available",label:"Available balance"})+"</div>"
      +'<div style="margin-top:12px">'+tabsHtml()+'</div><div id="ds-ern-list" aria-live="polite">'+listHtml()+"</div>";
  }

  /* ---------- page ---------- */
  function load(){
    return Supa.get("stores?select=id,name,status&owner_id=eq."+enc(Supa.uid())).then(function(s){
      s=s&&s[0];if(!s||s.status!=="approved")return{redirect:"/portal"};
      E.store=s.id;E.tab="all";E.req++;E.busy=false;
      return Promise.all([
        Supa.rpc("store_balance",{p_store:s.id}).then(function(v){return v},function(){return undefined}),
        Supa.get("ledger_entries?select=id&store_id=eq."+enc(s.id)+"&currency=neq."+enc(BASE)+"&limit=1").then(function(r){return!!(r&&r.length)},function(){return null}),
        Supa.get(query(s.id,"all",PAGE+1,0))
      ]).then(function(a){
        var r=a[2]||[];E.more=r.length>PAGE;E.rows=r.slice(0,PAGE);
        return out(pageHtml(a[0],a[1]));
      });
    }).catch(function(e){
      return out(D.empty({icon:"alert",title:"Earnings could not load",text:problem(e),action:{label:"Try again",act:"ds-reload"}}));
    });
  }
  V.portal=function(p){
    if(p[0]!=="earnings"||!Supa.uid())return old(p);
    return load();
  };
  A["ds-reload"]=A["ds-reload"]||function(){C.go(location.pathname,true)};

  /* ---------- filter and paging ---------- */
  function paint(extra){var el=document.getElementById("ds-ern-list");if(el)el.innerHTML=(extra||"")+listHtml()}
  function listError(e,retry){
    var el=document.getElementById("ds-ern-list");if(!el)return;
    el.innerHTML=D.banner("error","Could not load entries",problem(e),{label:"Try again",act:retry})+(E.rows.length?listHtml():"");
  }
  A["ds-ern-f"]=function(b){
    var t=b.getAttribute("data-id");if(!okTab(t)||!E.store)return;
    E.tab=t;var req=++E.req;
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="ds-ern-f"]'),function(c){var on=c===b;c.classList.toggle("on",on);c.setAttribute("aria-pressed",on?"true":"false")});
    var el=document.getElementById("ds-ern-list");if(el)el.innerHTML=D.skel("card",3);
    Supa.get(query(E.store,t,PAGE+1,0)).then(function(r){
      if(req!==E.req)return;r=r||[];E.more=r.length>PAGE;E.rows=r.slice(0,PAGE);paint();
    },function(e){if(req!==E.req)return;E.rows=[];E.more=false;listError(e,"ds-ern-retry")});
  };
  A["ds-ern-retry"]=function(){var b=document.querySelector('[data-act="ds-ern-f"][aria-pressed="true"]');if(b)A["ds-ern-f"](b)};
  A["ds-ern-more"]=function(b){
    if(!E.store||E.busy)return;E.busy=true;var req=E.req,off=E.rows.length;if(b)b.disabled=true;
    Supa.get(query(E.store,E.tab,PAGE+1,off)).then(function(r){
      E.busy=false;if(req!==E.req)return;r=r||[];E.more=r.length>PAGE;E.rows=E.rows.concat(r.slice(0,PAGE));paint();
    },function(e){E.busy=false;if(b)b.disabled=false;C.toast(problem(e),true)});
  };

  /* ---------- CSV export (all rows for the current filter, newest first, up to CAP) ---------- */
  function cell(v,text){
    if(v===null||v===undefined)return"";
    v=String(v);
    if(text&&/^[=+\-@\t\r]/.test(v))v="'"+v; /* stop spreadsheet formulas in free text; numbers are written as they are */
    return/[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
  }
  function toCsv(rows){
    var head=["entry_id","created_at","kind","status","amount","currency","order_id","seller_order_id","note"];
    return"\ufeff"+[head.join(",")].concat(rows.map(function(r){
      return[cell(r.id,1),cell(r.created_at,1),cell(r.kind,1),cell(r.status,1),cell(r.amount,0),cell(r.currency,1),cell(r.order_id,1),cell(r.seller_order_id,1),cell(r.note,1)].join(",");
    })).join("\r\n")+"\r\n";
  }
  function fetchAll(store,tab){
    var all=[];
    function next(){
      return Supa.get(query(store,tab,CHUNK,all.length)).then(function(r){
        r=r||[];all=all.concat(r);
        if(r.length<CHUNK)return{rows:all,capped:false};
        if(all.length>=CAP)return{rows:all.slice(0,CAP),capped:true};
        return next();
      });
    }
    return next();
  }
  function save(name,text){
    var blob=new Blob([text],{type:"text/csv;charset=utf-8"}),file=null;
    try{file=new File([blob],name,{type:"text/csv"})}catch(e){}
    if(window.EV_NATIVE_SELLER){
      if(file&&navigator.canShare&&navigator.canShare({files:[file]}))return navigator.share({files:[file],title:name}).then(function(){return true},function(){return false});
      return Promise.resolve(null); /* inside the app and no share sheet: be honest, do not pretend a file was saved */
    }
    var u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;a.rel="noopener";document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(u);if(a.parentNode)a.parentNode.removeChild(a)},4000);
    return Promise.resolve(true);
  }
  A["ds-ern-csv"]=function(b){
    if(!E.store||E.busy)return;E.busy=true;if(b)b.disabled=true;
    var tab=E.tab,store=E.store;
    C.toast("Preparing your export…");
    fetchAll(store,tab).then(function(res){
      if(!res.rows.length){C.toast("There are no entries to export for this filter.",true);return}
      var name="everneed-earnings-"+String(store).replace(/[^A-Za-z0-9_-]/g,"")+"-"+(tab==="all"?"all":tab)+"-"+new Date().toISOString().slice(0,10)+".csv";
      return save(name,toCsv(res.rows)).then(function(done){
        if(done===null)C.toast("Saving files is not available in the app yet. Open your seller workspace in a browser to export.",true);
        else if(done)C.toast(res.capped?"Exported the latest "+CAP+" entries.":"Exported "+res.rows.length+(res.rows.length===1?" entry.":" entries."));
      });
    }).catch(function(e){C.toast(problem(e),true)}).then(function(){E.busy=false;if(b)b.disabled=false});
  };

  /* Test hooks (pure functions only). */
  window.EVEarnings={csv:toCsv,fmt:fmt,query:query};
})();
