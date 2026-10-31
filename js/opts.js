/* Product options: colour and size axes, availability, and the labels used in carts and orders. */
window.Opts=(function(){
  var SZ=/^(\d{1,3}(\.\d)?|[2-6]?x{1,3}[sl]|[2-6]xl|xs|xxs|s|m|l|xl|xxl|xxxl|one size|free size|os)$/i;
  function split(l){var m=String(l).split("-");if(m.length<2)return null;var last=m[m.length-1],head=m.slice(0,-1).join("-");if(SZ.test(last)&&!SZ.test(head))return[head,last];var first=m[0],rest=m.slice(1).join("-");if(SZ.test(first)&&!SZ.test(rest))return[rest,first];return null}
  function parse(p){var ls=p.sizes||[],sp=ls.map(split),ax=p.axes||[];
    if(ls.length&&sp.every(Boolean)){var o={two:true,axes:ax.length===2?ax:["Color","Size"],colors:[],sizes:[],labels:ls,map:{}};
      ls.forEach(function(l,i){var c=sp[i][0],z=sp[i][1];if(o.colors.indexOf(c)<0)o.colors.push(c);if(o.sizes.indexOf(z)<0)o.sizes.push(z);o.map[l]={c:c,s:z}});return o}
    return{two:false,axes:[ax[0]||"Option"],colors:[],sizes:[],labels:ls,map:{}}}
  function find(o,c,s){for(var l in o.map)if(o.map[l].c===c&&o.map[l].s===s)return l;return""}
  function ok(p,l){if(!l)return false;var known=(p.sizes||[]).indexOf(l)>-1;if(!known)return false;var st=p.stocks;return!(st&&st[l]!=null&&Number(st[l])<=0)}
  function pair(p,o,c,s){var l=find(o,c,s);return!!l&&ok(p,l)}
  return{parse:parse,find:find,ok:ok,pair:pair,split:split};
})();
