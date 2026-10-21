/* Data layer. With Supabase keys in config.js it reads and writes the shared database; without them it runs locally on the device. */
window.S=(function(){
  var K="en_",rp=[],rb=[],ro=[],rc=[],T={p:"products",b:"banners",o:"orders"};
  function g(k,d){try{var v=localStorage.getItem(K+k);return v?JSON.parse(v):d}catch(e){return d}}
  function s(k,v){try{localStorage.setItem(K+k,JSON.stringify(v));return true}catch(e){window.dispatchEvent(new CustomEvent("en-error",{detail:"Storage is full. Use a smaller image."}));return false}}
  function j(u){return fetch(u).then(function(r){return r.json()}).catch(function(){return[]})}
  var rem=function(){return!!(window.Supa&&Supa.on())};
  var nid=function(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5)};
  function out(k,o){var r=Object.assign({},o);if(k==="p"){r.descr=r.desc;delete r.desc}if(k==="b"){r.starts=r.from;r.ends=r.to;delete r.from;delete r.to}return r}
  function inn(k,r){if(k==="p")r.desc=r.descr;if(k==="b"){r.from=r.starts;r.to=r.ends}return r}
  function err(e){window.dispatchEvent(new CustomEvent("en-error",{detail:/fetch|network/i.test(e.message)?"No connection. Check your internet and try again.":e.message}));return null}
  function cache(k){return k==="p"?rp:k==="b"?rb:ro}
  function add(k,o){var l=g(k,[]);o.id=o.id||nid();o.at=o.at||Date.now();l.unshift(o);return s(k,l)?o:null}
  return{
    get:g,set:s,id:nid,
    load:function(){
      if(rem())return Supa.ready().then(function(){return Promise.all([Supa.list("products"),Supa.list("banners"),Supa.uid()?Supa.list("orders"):Promise.resolve([]),Supa.list("collections").catch(function(){return[]}),Supa.list("settings").catch(function(){return[]})])}).then(function(a){rp=a[0].map(function(r){return inn("p",r)});rb=a[1].map(function(r){return inn("b",r)});ro=a[2];rc=a[3];a[4].forEach(function(r){if(CFG.countries[r.id])Object.assign(CFG.countries[r.id],r.data)})}).catch(err);
      return Promise.all([j("data/products.json"),j("data/banners.json")]).then(function(a){rp=a[0];rb=a[1]});
    },
    products:function(){return rem()?rp:rp.concat(g("p",[]))},
    banners:function(){return rem()?rb:rb.concat(g("b",[]))},
    orders:function(){return rem()?ro:g("o",[])},
    mine:function(k){return rem()?cache(k):g(k,[])},
    collections:function(){return rc.slice().sort(function(a,b){return a.name.localeCompare(b.name)})},
    addCols:function(l){return Supa.upsert("collections",l,"name",true).then(function(r){(r||[]).forEach(function(x){rc.push(x)});return r||[]}).catch(err)},
    delCol:function(id){return Supa.del("collections",id).then(function(){rc=rc.filter(function(x){return x.id!==id})}).catch(err)},
    setSettings:function(cc,data){return Supa.upsert("settings",{id:cc,data:data},"id").then(function(){Object.assign(CFG.countries[cc],data);return true}).catch(err)},
    save:function(k,o){if(!rem())return Promise.resolve(add(k,o));return Supa.insert(T[k],out(k,o)).then(function(r){var x=inn(k,r[0]);cache(k).unshift(x);return x}).catch(err)},
    remove:function(k,id){if(!rem()){s(k,g(k,[]).filter(function(x){return x.id!==id}));return Promise.resolve()}return Supa.del(T[k],id).then(function(){var c=cache(k),i=c.findIndex(function(x){return x.id===id});if(i>-1)c.splice(i,1)}).catch(err)},
    patch:function(k,id,p){if(!rem()){s(k,g(k,[]).map(function(x){if(x.id===id)for(var i in p)x[i]=p[i];return x}));return Promise.resolve()}return Supa.patch(T[k],id,out(k,p)).then(function(){cache(k).forEach(function(x){if(x.id===id)for(var i in p)x[i]=p[i]})}).catch(err)}
  };
})();
