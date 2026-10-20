/* Data layer. Stage 2 replaces the internals with Supabase; the API stays the same. */
window.S=(function(){
  var K="en_",rp=[],rb=[];
  function g(k,d){try{var v=localStorage.getItem(K+k);return v?JSON.parse(v):d}catch(e){return d}}
  function s(k,v){try{localStorage.setItem(K+k,JSON.stringify(v));return true}catch(e){window.dispatchEvent(new CustomEvent("en-error",{detail:"Storage is full. Use a smaller image."}));return false}}
  function j(u){return fetch(u).then(function(r){return r.json()}).catch(function(){return[]})}
  return{
    get:g,set:s,
    load:function(){return Promise.all([j("data/products.json"),j("data/banners.json")]).then(function(a){rp=a[0];rb=a[1]})},
    products:function(){return rp.concat(g("p",[]))},
    banners:function(){return rb.concat(g("b",[]))},
    add:function(k,o){var l=g(k,[]);o.id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);o.at=Date.now();l.unshift(o);return s(k,l)?o:null},
    upd:function(k,id,patch){s(k,g(k,[]).map(function(x){if(x.id===id)for(var i in patch)x[i]=patch[i];return x}))},
    del:function(k,id){s(k,g(k,[]).filter(function(x){return x.id!==id}))}
  };
})();
