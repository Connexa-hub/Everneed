/* Customer side of stores: the seller chip on product cards, "Sold by" on the product page, and the store page. */
window.Stores=(function(){
  var esc=A.esc,ico=A.ico,notify=A.notify,WEEK=7*864e5;
  function initials(n){var w=String(n||"").trim().split(/\s+/);return((w[0]||"").charAt(0)+(w[1]||"").charAt(0)).toUpperCase()||"S"}
  function mine(s){return S.products().filter(function(p){return p.store_id===s.id&&(p.status==null||p.status==="published")})}
  function fresh(s){return mine(s).some(function(p){return Date.now()-(p.at||0)<WEEK})}
  function avatar(s,cls){return'<span class="store-ring'+(fresh(s)?" new":"")+(cls?" "+cls:"")+'"><span>'+(s.logo_url?'<img alt="" src="'+esc(s.logo_url)+'">':esc(initials(s.name)))+"</span></span>"}
  function tick(s){return s.is_official?' <i class="verified" role="img" aria-label="Official store">✓</i>':""}
  function rating(s){var n=0,t=0;mine(s).forEach(function(p){var r=S.rating(p.id);if(r){n+=r.n;t+=r.avg*r.n}});return n?{avg:Math.round(t/n*10)/10,n:n}:null}
  /* Small seller row for product cards. A span with data-act, because the card itself is a link. */
  function chip(p){var s=p&&p.store_id?S.storeById(p.store_id):null;if(!s)return"";
    return'<span class="seller-row" role="link" tabindex="0" data-act="store" data-slug="'+esc(s.slug)+'"><i class="mini">'+esc(initials(s.name))+"</i><span>"+esc(s.name)+"</span>"+tick(s)+"</span>"}
  function where(s){return[s.city,s.state].filter(Boolean).join(", ")}
  function soldBy(p){var s=p&&p.store_id?S.storeById(p.store_id):null;if(!s)return"";var r=rating(s);
    return'<a class="rw soldby" href="#/store/'+encodeURIComponent(s.slug)+'">'+avatar(s,"sm")+'<span><small class="m">Sold by</small><b>'+esc(s.name)+tick(s)+"</b><small>"+esc(where(s)||"Nigeria")+(r?" · ★ "+r.avg+" ("+r.n+")":"")+"</small></span><span>›</span></a>"}
  function page(slug){
    var s=S.storeBySlug(decodeURIComponent(slug||""));
    if(!s)return A.empty("Store not found","This store is not available right now.");
    var l=mine(s),r=rating(s),since=s.created_at?new Date(s.created_at).getFullYear():null;
    return'<div class="storehd"><div class="cover"'+(s.cover_url?' style="background-image:url(\''+esc(s.cover_url).replace(/'/g,"%27")+'\')"':"")+'></div><div class="sbody">'+avatar(s,"lg")
      +'<h1>'+esc(s.name)+tick(s)+"</h1>"+(where(s)?'<p class="m">'+esc(where(s))+"</p>":"")+(s.tagline?'<p class="tg">'+esc(s.tagline)+"</p>":"")
      +'<div class="facts"><span><b>'+l.length+"</b> product"+(l.length===1?"":"s")+"</span>"+(r?"<span><b>★ "+r.avg+"</b> ("+r.n+")</span>":"")+(since?"<span>Since <b>"+since+"</b></span>":"")+"</div>"
      +'<div class="acts"><button class="btn o s" type="button" data-act="sshare" data-slug="'+esc(s.slug)+'">Share</button></div></div></div>'
      +(s.about?'<div class="sec"><h3>About</h3></div><p class="about">'+esc(s.about)+"</p>":"")
      +'<div class="sec"><h3>Products</h3></div>'+A.grid(l.map(function(p){return A.byId(p.id)}).filter(Boolean),"No products here yet")}
  function act(k,d,a,e){
    if(k==="store"){if(e){e.preventDefault&&e.preventDefault()}location.hash="#/store/"+encodeURIComponent(d.slug);return true}
    if(k==="sshare"){var s=S.storeBySlug(d.slug);if(!s)return true;var t=s.name+" on EverNeed";
      if(navigator.share){navigator.share({title:t,text:"Take a look at "+t}).catch(function(){})}else notify("Sharing is not available on this device.","err");return true}
    return false}
  document.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&e.target&&e.target.getAttribute&&e.target.getAttribute("data-act")==="store"){e.preventDefault();location.hash="#/store/"+encodeURIComponent(e.target.getAttribute("data-slug"))}});
  return{chip:chip,soldBy:soldBy,page:page,act:act,avatar:avatar,initials:initials}
})();
