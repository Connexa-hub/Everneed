/* Size guide: a diagram with live measurements, regional sizes (EU, US, UK) and a cm/inch switch.
   Works for clothing, shoes, bracelets, necklaces and kitchenware; the numbers come from the size chart the admin edits. */
window.Guide=(function(){
  var esc=A.esc,$=A.$,sheet=A.sheet,st=null;
  var X='<button class="x" data-act="gclose" aria-label="Close">✕</button>',REG=["EU","US","UK"];
  var SLOT={clothing:[["chest",/chest|bust/i],["waist",/waist/i],["hip",/hip/i],["shoulder",/shoulder/i]],shoes:[["len",/length/i],["wid",/width/i]],bracelet:[["circ",/circ|wrist/i],["dia",/diam/i]],necklace:[["len",/length/i],["neck",/neck/i]],utensil:[["len",/length/i],["wid",/width/i],["hei",/height/i],["dia",/diam/i],["cap",/capac|volume|ml/i]]};
  var isLen=function(h){return!/^(EU|US|UK|ROW)$/i.test(h)&&!/(ml|capacity|volume|weight|\bg\b|qty|pcs|count)/i.test(h)};
  var cv=function(v,u){return u==="cm"?v:String(v).replace(/\d+(\.\d+)?/g,function(m){return String(Math.round(+m/2.54*10)/10)})};
  function vals(c,row,u){var m={};c.cols.forEach(function(h,i){var s=(SLOT[c.kind]||[]).filter(function(x){return x[1].test(h)})[0],un=(h.match(/\(([^)]+)\)/)||[])[1];if(s&&m[s[0]]==null)m[s[0]]=isLen(h)?cv(row[i+1],u)+" "+u:row[i+1]+(un?" "+un:"")});return m}
  function co(x,y,n,v,side){if(!v)return"";var a=side==="r"?"end":"start",lx=side==="r"?x-6:x+6;return'<text x="'+lx+'" y="'+(y-3)+'" text-anchor="'+a+'" class="gn">'+esc(n)+'</text><text x="'+lx+'" y="'+(y+13)+'" text-anchor="'+a+'" class="gv">'+esc(v||"—")+"</text>"}
  function ct(x,y,n,v){if(!v)return"";return'<text x="'+x+'" y="'+y+'" text-anchor="middle" class="gn">'+esc(n)+'</text><text x="'+x+'" y="'+(y+16)+'" text-anchor="middle" class="gv">'+esc(v||"—")+"</text>"}
  var D={
    clothing:function(m){return'<g class="gb"><circle cx="160" cy="44" r="23"/><path d="M118 84Q160 70 202 84L212 110 202 206Q160 220 118 206L108 110Z"/><path d="M108 110L82 200 98 206 120 130Z"/><path d="M212 110L238 200 222 206 200 130Z"/><path d="M122 210L128 330 152 330 160 228Z"/><path d="M198 210L192 330 168 330 160 228Z"/></g><g class="gl"><line x1="116" y1="92" x2="204" y2="92"/><line x1="110" y1="122" x2="210" y2="122"/><line x1="118" y1="166" x2="202" y2="166"/><line x1="116" y1="204" x2="204" y2="204"/></g><g class="gc"><line x1="210" y1="122" x2="250" y2="122"/><line x1="204" y1="204" x2="250" y2="204"/><line x1="116" y1="92" x2="74" y2="92"/><line x1="118" y1="166" x2="74" y2="166"/></g>'+co(314,122,"Chest",m.chest,"r")+co(314,204,"Hip",m.hip,"r")+co(6,92,"Shoulder",m.shoulder,"l")+co(6,166,"Waist",m.waist,"l")},
    shoes:function(m){return'<g class="gb"><path d="M132 36C108 36 100 76 106 128 112 186 112 250 150 300 176 310 206 292 208 246 210 196 214 148 206 98 200 56 176 34 132 36Z"/></g><g class="gl"><line x1="236" y1="36" x2="236" y2="304"/><line x1="100" y1="150" x2="212" y2="150"/></g>'+co(314,176,"Foot length",m.len,"r")+co(6,128,"Foot width",m.wid,"l")},
    bracelet:function(m){return'<g class="gb"><circle class="st" cx="160" cy="150" r="78"/></g><g class="gl"><line x1="92" y1="150" x2="228" y2="150"/></g>'+ct(160,36,"Wrist circumference",m.circ)+ct(160,276,"Inner diameter",m.dia)},
    necklace:function(m){return'<g class="gb"><circle cx="160" cy="66" r="24"/><path class="st" d="M70 74Q160 310 250 74"/></g><g class="gl"><path d="M70 74Q160 310 250 74"/></g>'+ct(160,262,"Necklace length",m.len)+ct(160,296,"Fits neck",m.neck)},
    utensil:function(m){var rd=m.dia&&!m.len;return(rd?'<g class="gb"><circle cx="160" cy="150" r="80"/></g><g class="gl"><line x1="80" y1="150" x2="240" y2="150"/></g>':'<g class="gb"><rect x="70" y="86" width="180" height="120" rx="16"/></g><g class="gl"><line x1="70" y1="226" x2="250" y2="226"/><line x1="270" y1="86" x2="270" y2="206"/></g>')+ct(160,268,rd?"Diameter":"Length",rd?m.dia:m.len)+(m.wid?co(314,140,"Width",m.wid,"r"):"")+(m.hei?co(6,140,"Height",m.hei,"l"):"")+(m.cap?ct(160,304,"Capacity",m.cap):"")}
  };
  function draw(){var c=st.c,cols=c.cols,row=c.rows[st.ri],k=c.kind||"clothing",regs=REG.filter(function(g){return cols.some(function(h){return h.toUpperCase()===g})}),o=Opts.parse(st.p);
    var cell=function(r){if(st.reg==="base")return r[0];var i=cols.findIndex(function(h){return h.toUpperCase()===st.reg});return r[i+1]||r[0]};
    var offered=function(r){if(!st.p.sizes||!st.p.sizes.length)return true;return st.p.sizes.some(function(l){var z=o.two&&o.map[l]?o.map[l].s:l;return String(z).toLowerCase()===String(r[0]).toLowerCase()})};
    var base=k==="shoes"?"EU":"Standard",sv=D[k]?'<svg viewBox="0 0 320 340" class="gsv" role="img" aria-label="Measurement diagram">'+D[k](vals(c,row,st.u))+"</svg>":"";
    var t='<div class="tw"><table class="tbl"><tr><th>Size</th>'+cols.map(function(h){return"<th>"+esc(h)+"</th>"}).join("")+"</tr>"+c.rows.map(function(r,i){return'<tr class="'+(i===st.ri?"on ":"")+(offered(r)?"":"na")+'">'+r.map(function(v,j){return"<td>"+esc(j>0&&isLen(cols[j-1])?cv(v,st.u):v)+"</td>"}).join("")+"</tr>"}).join("")+"</table></div>";
    $("#gdraw").innerHTML=(regs.length?'<div class="seg">'+["base"].concat(regs).map(function(g){return'<button type="button" class="chip'+(st.reg===g?" on":"")+'" data-act="grg" data-v="'+g+'">'+(g==="base"?base:g==="UK"?"UK / Rest of world":g)+"</button>"}).join("")+"</div>":"")+'<div class="seg"><button type="button" class="chip'+(st.u==="cm"?" on":"")+'" data-act="gun" data-v="cm">cm</button><button type="button" class="chip'+(st.u==="in"?" on":"")+'" data-act="gun" data-v="in">inches</button></div><div class="chips wrap">'+c.rows.map(function(r,i){return'<button type="button" class="chip'+(i===st.ri?" on":"")+(offered(r)?"":" na")+'" data-act="gsz" data-i="'+i+'">'+esc(cell(r))+"</button>"}).join("")+"</div>"+sv+t}
  function open(p,label){var c=S.chart(p.chart);if(!c){A.notify("No size guide for this product yet.","err");return}
    c=Object.assign({},c,{kind:c.kind||"clothing"});var o=Opts.parse(p),z=o.two&&o.map[label]?o.map[label].s:label,ri=c.rows.findIndex(function(r){return String(r[0]).toLowerCase()===String(z).toLowerCase()});
    st={c:c,p:p,ri:Math.max(0,ri),reg:"base",u:"cm"};
    sheet(X+'<h3>Size guide</h3><p class="m">'+esc(c.name)+'. Tap a size to see its measurements.</p><div id="gdraw"></div><p class="m sm">Measurements are a guide and can vary slightly.</p>',1);draw()}
  function act(k,d){
    if(k==="gclose"){sheet(null,1);return true}
    if(!st)return false;
    if(k==="gsz"){st.ri=+d.i;draw();return true}
    if(k==="grg"){st.reg=d.v;draw();return true}
    if(k==="gun"){st.u=d.v;draw();return true}
    return false}
  return{open:open,act:act};
})();
