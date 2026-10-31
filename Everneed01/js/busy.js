/* Loading overlay for network work, plus a short tap lock so buttons cannot be hit twice by accident. */
window.Busy=(function(){
  var n=0,t=null,last=0,B={mute:true};
  function el(){return document.getElementById("busy")}
  B.inc=function(){n++;if(!B.mute&&n===1){clearTimeout(t);t=setTimeout(function(){if(n>0&&el())el().className="on"},180)}};
  B.dec=function(){n=Math.max(0,n-1);if(n===0){clearTimeout(t);if(el())el().className=""}};
  document.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("button,[data-act],a.btn,.chip,.tl,.bk,.hs,.pick");
    if(!b||b.hasAttribute("data-step")||b.hasAttribute("data-tact"))return;
    var now=Date.now();if(now-last<450){e.stopPropagation();e.preventDefault();return}last=now;
  },true);
  setTimeout(function(){B.mute=false},8000);
  return B;
})();
