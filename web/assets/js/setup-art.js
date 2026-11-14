/* Animated scenes for the seller setup steps. Plain SVG and CSS, no libraries, no images to download.
   Colours come from the active palette (var(--brand), var(--accent), surfaces), so they follow the person's colour and light or dark mode.
   The animation classes (a-*) live in setup.css and are switched off for people who ask for reduced motion.
   SetupArt.scene(n) returns the scene for step n (1 to 6). */
window.SetupArt=(function(){
  function wrap(inner){return'<svg class="sa" viewBox="0 0 640 190" aria-hidden="true" focusable="false">'+inner+"</svg>"}
  var BLOBS='<circle class="b a-blob" cx="64" cy="44" r="48" opacity=".12"/><circle class="ac a-blob d2" cx="586" cy="148" r="58" opacity=".14"/>';
  /* Four-point sparkles that twinkle one after another */
  function stars(pts){return pts.map(function(p,i){var x=p[0],y=p[1];return'<path class="ac a-twinkle" style="animation-delay:'+(i*.5)+'s" d="M'+x+" "+(y-8)+"L"+(x+2)+" "+(y-2)+"L"+(x+8)+" "+y+"L"+(x+2)+" "+(y+2)+"L"+x+" "+(y+8)+"L"+(x-2)+" "+(y+2)+"L"+(x-8)+" "+y+"L"+(x-2)+" "+(y-2)+'Z"/>'}).join("")}
  function bag(x,y,cls,delay){return'<g class="a-pop" style="animation-delay:'+delay+'s"><rect class="'+cls+'" x="'+x+'" y="'+y+'" width="18" height="20" rx="4"/><path class="ln nf" d="M'+(x+5)+" "+y+"v-4a4 4 0 0 1 8 0v4"+'"/></g>'}

  /* 1. Your store: a shop front whose door opens while products pop into the windows */
  function store(){
    var scallops="";for(var i=0;i<8;i++){scallops+='<circle class="b" cx="'+(212+i*31)+'" cy="76" r="12"/>'}
    return wrap(BLOBS+'<ellipse class="s2" cx="320" cy="179" rx="216" ry="8"/>'
      +'<rect class="s1 ln" x="208" y="76" width="224" height="96" rx="6"/>'
      +'<path class="b" d="M196 76h248l-16-40H212z"/><path fill="#fff" opacity=".25" d="M246 36l-6 40h22l2-40zM300 36l-2 40h22V36zM354 36l2 40h22l8-40z"/>'+scallops
      +'<g class="a-sway"><rect class="s1 ln" x="270" y="8" width="100" height="26" rx="7"/><text x="320" y="26" text-anchor="middle" class="tx" font-size="13" font-weight="700">Your store</text></g>'
      +'<rect class="s2 ln" x="226" y="102" width="66" height="52" rx="5"/><rect class="s2 ln" x="348" y="102" width="66" height="52" rx="5"/>'
      +'<rect class="s2" x="300" y="112" width="40" height="60" rx="4"/><rect class="b a-door" x="300" y="112" width="40" height="60" rx="4"/><circle class="ac" cx="333" cy="144" r="2.6"/>'
      +bag(238,124,"b",0)+bag(262,128,"ac",.35)+bag(366,124,"ac",.7)+bag(390,128,"b",1.05)
      +stars([[116,64],[536,72],[150,140],[500,146]]));
  }

  /* 2. About you and location: a map pin drops, ripples spread, category tiles float around it */
  function place(){
    return wrap(BLOBS+'<rect class="s2" x="130" y="12" width="380" height="166" rx="18"/>'
      +'<path class="ln nf" d="M130 66h380M130 122h380M214 12v166M298 12v166M382 12v166M466 12v166"/>'
      +'<path class="bs nf" stroke-width="10" stroke-opacity=".16" stroke-linecap="round" d="M130 152C224 100 296 176 394 112S492 66 510 54"/>'
      +'<ellipse class="bs nf a-ripple" stroke-width="2.5" cx="320" cy="132" rx="14" ry="6"/><ellipse class="bs nf a-ripple d2" stroke-width="2.5" cx="320" cy="132" rx="14" ry="6"/>'
      +'<ellipse class="tx" opacity=".12" cx="320" cy="132" rx="14" ry="5"/>'
      +'<g class="a-drop"><path class="b" d="M320 34c-19 0-31 14-31 30 0 24 31 62 31 62s31-38 31-62c0-16-12-30-31-30z"/><circle class="s1" cx="320" cy="64" r="12"/></g>'
      +'<g class="a-float"><rect class="s1 ln" x="152" y="40" width="42" height="42" rx="12"/><rect class="b" x="163" y="54" width="20" height="16" rx="4"/><path class="ln nf" d="M168 54a5 5 0 0 1 10 0"/></g>'
      +'<g class="a-float d2"><rect class="s1 ln" x="446" y="50" width="42" height="42" rx="12"/><path class="ac" d="M467 83c-12-8-17-13-17-19a8 8 0 0 1 17-2 8 8 0 0 1 17 2c0 6-5 11-17 19z"/></g>'
      +'<g class="a-float d3"><rect class="s1 ln" x="172" y="112" width="42" height="42" rx="12"/><path class="b" d="M183 128l11-6h12l4 4v10l-11 8h-12z"/><circle class="s1" cx="203" cy="131" r="2.6"/></g>'
      +stars([[110,40],[552,120],[512,24]]));
  }

  /* 3. Store page details: a phone shows the store page filling in; a clock ticks for opening hours */
  function page(){
    var rows="";for(var i=0;i<3;i++){var y=100+i*27;rows+='<g class="a-slide" style="animation-delay:'+(.4+i*.4)+'s"><rect class="s2" x="264" y="'+y+'" width="112" height="22" rx="6"/><rect class="b" x="270" y="'+(y+5)+'" width="12" height="12" rx="3"/><rect class="t2" opacity=".45" x="290" y="'+(y+6)+'" width="54" height="4" rx="2"/><rect class="t2" opacity=".28" x="290" y="'+(y+13)+'" width="34" height="3" rx="1.5"/></g>'}
    return wrap(BLOBS+'<rect class="s1 ln" x="248" y="6" width="144" height="180" rx="20"/><rect class="b" x="256" y="14" width="128" height="48" rx="12" opacity=".9"/><circle class="s1 ln" cx="288" cy="64" r="14"/><circle class="ac" cx="288" cy="64" r="8"/>'
      +'<rect class="t2" opacity=".5" x="310" y="58" width="58" height="7" rx="3"/><rect class="t2" opacity=".28" x="310" y="70" width="38" height="5" rx="2.5"/>'+rows
      +'<g transform="translate(150 98)"><circle class="s1 ln" r="40"/><path class="ln nf" d="M0-34v6M34 0h-6M0 34v-6M-34 0h6"/><rect class="tx a-spin slow" x="-1.5" y="-24" width="3" height="24" rx="1.5"/><rect class="b a-spin" x="-1" y="-31" width="2" height="31" rx="1"/><circle class="b" r="3.5"/></g>'
      +'<g class="a-pulse"><rect class="b" x="432" y="56" width="112" height="36" rx="18"/><text x="488" y="79" text-anchor="middle" class="onb" font-size="13" font-weight="700">Open today</text></g>'
      +'<g class="a-float d2"><rect class="s1 ln" x="452" y="112" width="74" height="34" rx="17"/><path class="ac a-twinkle" d="M474 134l-6-6 8-1 3-7 3 7 8 1-6 6 1 8-6-4-6 4z"/><rect class="t2" opacity=".4" x="492" y="124" width="26" height="4" rx="2"/><rect class="t2" opacity=".25" x="492" y="132" width="18" height="3" rx="1.5"/></g>'
      +stars([[110,40],[560,28],[118,160]]));
  }

  /* 4. Pickup and delivery: a truck drives along the road carrying bouncing parcels */
  function delivery(){
    return wrap(BLOBS+'<g class="a-cloud"><ellipse class="s1" cx="120" cy="44" rx="34" ry="12"/><ellipse class="s1" cx="146" cy="38" rx="22" ry="11"/></g><g class="a-cloud d2"><ellipse class="s1" cx="470" cy="34" rx="30" ry="10"/><ellipse class="s1" cx="492" cy="29" rx="18" ry="9"/></g>'
      +'<rect class="s2" x="0" y="140" width="640" height="38"/><path class="ln nf a-road" stroke-width="3" stroke-dasharray="20 16" d="M0 160h640"/>'
      +'<g class="a-pin2"><path class="b" d="M566 62c-14 0-23 10-23 22 0 18 23 46 23 46s23-28 23-46c0-12-9-22-23-22z"/><circle class="s1" cx="566" cy="84" r="9"/></g>'
      +'<g class="a-drive"><g class="a-jiggle"><rect class="b" x="0" y="86" width="88" height="52" rx="8"/><path class="b" d="M88 106h24l16 20v12H88z"/><path class="s1" d="M96 112h14l10 13H96z"/>'
      +'<g class="a-bounce"><rect class="ac" x="10" y="64" width="22" height="22" rx="4"/><path class="ln nf" d="M21 64v22M10 75h22"/></g><g class="a-bounce d2"><rect class="s1 ln" x="42" y="70" width="18" height="16" rx="3"/></g><g class="a-bounce d3"><rect class="ac" x="64" y="72" width="16" height="14" rx="3"/></g></g>'
      +'<g class="a-wheel"><circle class="tx" cx="24" cy="140" r="12"/><circle class="s1" cx="24" cy="140" r="5"/></g><g class="a-wheel"><circle class="tx" cx="100" cy="140" r="12"/><circle class="s1" cx="100" cy="140" r="5"/></g></g>'
      +stars([[250,50],[400,88],[540,30]]));
  }

  /* 5. Payout: coins drop into a wallet beside a bank */
  function payout(){
    var coins="";for(var i=0;i<4;i++){var x=402+i*22;coins+='<g class="a-coin" style="animation-delay:'+(i*.55)+'s"><circle class="ac" cx="'+x+'" cy="26" r="11"/><circle class="ln nf" stroke-width="2" cx="'+x+'" cy="26" r="6.5"/></g>'}
    return wrap(BLOBS+'<ellipse class="s2" cx="320" cy="179" rx="236" ry="8"/>'
      +'<path class="b" d="M168 76l70-38 70 38z"/><rect class="s1 ln" x="176" y="76" width="124" height="14" rx="3"/><rect class="s1 ln" x="188" y="92" width="16" height="60"/><rect class="s1 ln" x="222" y="92" width="16" height="60"/><rect class="s1 ln" x="256" y="92" width="16" height="60"/><rect class="s1 ln" x="170" y="152" width="136" height="14" rx="3"/><circle class="s1" cx="238" cy="58" r="8"/>'
      +'<g class="a-flip"><circle class="ac" cx="352" cy="96" r="22"/><circle class="ln nf" stroke-width="3" cx="352" cy="96" r="14"/></g>'
      +coins+'<g class="a-float"><rect class="s1 ln" x="392" y="96" width="96" height="66" rx="14"/><path class="b" d="M392 118h96"/><circle class="ac" cx="468" cy="140" r="7"/></g>'
      +stars([[118,60],[540,60],[514,150]]));
  }

  /* 6. Business and policies: a shield draws its tick while documents slide in */
  function policy(){
    return wrap(BLOBS+'<g class="a-slide l"><rect class="s1 ln" x="130" y="52" width="100" height="116" rx="10" transform="rotate(-6 180 110)"/><rect class="t2" opacity=".4" x="146" y="76" width="64" height="5" rx="2.5" transform="rotate(-6 180 110)"/><rect class="t2" opacity=".25" x="146" y="90" width="48" height="4" rx="2" transform="rotate(-6 180 110)"/><rect class="b" x="146" y="106" width="30" height="8" rx="4" transform="rotate(-6 180 110)"/></g>'
      +'<g class="a-slide r"><rect class="s1 ln" x="410" y="52" width="100" height="116" rx="10" transform="rotate(6 460 110)"/><rect class="t2" opacity=".4" x="426" y="76" width="64" height="5" rx="2.5" transform="rotate(6 460 110)"/><rect class="t2" opacity=".25" x="426" y="90" width="48" height="4" rx="2" transform="rotate(6 460 110)"/><rect class="ac" x="426" y="106" width="30" height="8" rx="4" transform="rotate(6 460 110)"/></g>'
      +'<g class="a-float"><path class="b" opacity=".16" d="M320 14l56 20v44c0 42-27 68-56 84-29-16-56-42-56-84V34z"/><path class="bs nf" stroke-width="4" d="M320 14l56 20v44c0 42-27 68-56 84-29-16-56-42-56-84V34z"/>'
      +'<path class="bs nf a-draw" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="110" stroke-dashoffset="110" d="M292 88l22 22 40-46"/></g>'
      +stars([[110,40],[552,42],[112,160],[540,150]]));
  }
  var ALL=[null,store,place,page,delivery,payout,policy];
  return{scene:function(n){var f=ALL[n];return f?f():""}};
})();
