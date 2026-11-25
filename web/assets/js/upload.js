/* Seller photo upload (WEB-S23). Replaces the one-shot fetch in Supa.upload for product photos.
   Why: the old path sent the File straight to fetch with the browser-reported type. On phones that fails in ways the person cannot fix and
   the only message was the browser's "Failed to fetch". This module:
   - reads the photo into memory first (a gallery or cloud photo that cannot be read fails here with a clear message, not inside fetch),
   - decides the real image type from the first bytes (Android often reports "" or a wrong type) and refuses HEIC/AVIF with a clear message,
   - shrinks to 1600 px JPEG when needed and keeps the result under 4 MB,
   - uploads with a timeout, retries network and server failures twice with a pause, refreshes an expired session once,
   - throws errors with {code, retry, status} and a plain-language message, and records non-secret diagnostics in EVUpload.last and the console.
   It never changes Storage policy: a 403 is reported as "denied" with the evidence so it can go to the backend owner. */
(function(){
  var LIMIT=4e6,MAXPX=1600,EXT={"image/jpeg":"jpg","image/png":"png","image/gif":"gif","image/webp":"webp"};
  function err(code,msg,o){var e=new Error(msg);e.code=code;e.retry=!(o&&o.retry===false);e.status=(o&&o.status)||0;return e}
  function sniff(b){
    if(b.length>2&&b[0]===0xFF&&b[1]===0xD8)return"image/jpeg";
    if(b.length>4&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47)return"image/png";
    if(b.length>3&&b[0]===0x47&&b[1]===0x49&&b[2]===0x46)return"image/gif";
    if(b.length>12&&b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50)return"image/webp";
    if(b.length>12&&b[4]===0x66&&b[5]===0x74&&b[6]===0x79&&b[7]===0x70){var br=String.fromCharCode(b[8],b[9],b[10],b[11]);
      if(/^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(br))return"image/heic";if(br==="avif"||br==="avis")return"image/avif"}
    return"";
  }
  function read(file){
    return new Promise(function(ok,no){
      var bad=function(){no(err("read","We could not read this photo. Choose it again from your gallery.",{retry:false}))};
      try{var fr=new FileReader();fr.onload=function(){ok(fr.result)};fr.onerror=bad;fr.onabort=bad;fr.readAsArrayBuffer(file)}catch(x){bad()}
    });
  }
  function decode(blob){
    return new Promise(function(ok){
      var done=function(v){ok(v)};
      if(typeof createImageBitmap==="function"){createImageBitmap(blob).then(function(b){done({w:b.width,h:b.height,src:b,close:function(){try{b.close()}catch(e){}}})},function(){done(null)});return}
      var img=new Image(),u=URL.createObjectURL(blob);img.onload=function(){done({w:img.naturalWidth,h:img.naturalHeight,src:img,close:function(){URL.revokeObjectURL(u)}})};img.onerror=function(){URL.revokeObjectURL(u);done(null)};img.src=u;
    });
  }
  function toJpeg(d,k,q){
    return new Promise(function(ok){
      var cv=document.createElement("canvas");cv.width=Math.max(1,Math.round(d.w*k));cv.height=Math.max(1,Math.round(d.h*k));
      var cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(d.src,0,0,cv.width,cv.height);
      cv.toBlob(function(b){ok(b)},"image/jpeg",q);
    });
  }
  /* prepare(file) -> Blob (real type, under 4 MB) or an error with a clear message. */
  function prepare(file){
    return read(file).then(function(ab){
      var type=sniff(new Uint8Array(ab,0,Math.min(16,ab.byteLength))),blob;
      if(!type)throw err("format","This file is not a photo we can use. Choose a JPG, PNG or WebP image.",{retry:false});
      if(type==="image/heic"||type==="image/avif")throw err("format","This photo is in a format that browsers cannot upload (HEIC or AVIF). Choose another photo, or save it as JPG first.",{retry:false});
      blob=new Blob([ab],{type:type});
      if(type==="image/gif"&&blob.size<LIMIT)return blob;
      return decode(blob).then(function(d){
        if(!d){if(blob.size>LIMIT)throw err("size","This photo is larger than 4 MB. Choose a smaller one.",{retry:false});return blob}
        var k=Math.min(1,MAXPX/Math.max(d.w,d.h));
        if(k===1&&blob.size<1500000){d.close();return blob}
        var qs=[0.85,0.7,0.55],i=0;
        function next(){return toJpeg(d,k,qs[i]).then(function(b){
          if(!b){d.close();if(blob.size>LIMIT)throw err("size","This photo is larger than 4 MB. Choose a smaller one.",{retry:false});return blob}
          if(b.size>LIMIT&&++i<qs.length)return next();
          d.close();if(b.size>LIMIT)throw err("size","This photo is still larger than 4 MB after shrinking. Choose another one.",{retry:false});return b})}
        return next();
      });
    });
  }
  function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
  function msg(r){return r.text().then(function(t){try{var j=JSON.parse(t);return String(j.message||j.error||j.msg||t||"")}catch(e){return String(t||"")}},function(){return""})}
  /* put(blob, folder) -> public URL. opts.tries (default 3). */
  function put(blob,folder,opts){
    opts=opts||{};var cfg=(window.CFG&&CFG.supabase)||{},tries=opts.tries||3,path=folder+"/"+Date.now()+"-"+Math.random().toString(36).slice(2,7)+"."+(EXT[blob.type]||"jpg"),
      d={size:blob.size,type:blob.type,tries:0,online:typeof navigator==="undefined"?true:navigator.onLine!==false,net:(typeof navigator!=="undefined"&&navigator.connection&&navigator.connection.effectiveType)||""};
    function fin(e){d.code=e.code;d.status=e.status;EVUpload.last=d;try{console.warn("[upload]",JSON.stringify(d))}catch(x){}throw e}
    function once(refreshed){
      d.tries++;var ac=typeof AbortController==="function"?new AbortController():null,
        to=setTimeout(function(){d.timeout=1;if(ac)ac.abort()},20000+Math.ceil(blob.size/15000)*1000);
      return Supa.token().then(function(tok){
        if(!tok)throw err("auth","Your session ended. Sign in again, then retry. Your product details are kept.",{retry:false});
        return fetch(cfg.url+"/storage/v1/object/media/"+path,{method:"POST",headers:{apikey:cfg.key,Authorization:"Bearer "+tok,"Content-Type":blob.type,"Cache-Control":"max-age=31536000"},body:blob,signal:ac?ac.signal:undefined});
      }).then(function(r){
        clearTimeout(to);
        if(r.ok){EVUpload.last=Object.assign(d,{code:"ok",status:r.status});return cfg.url+"/storage/v1/object/public/media/"+path}
        return msg(r).then(function(m){
          d.detail=m.slice(0,160);
          if(r.status===401&&!refreshed)return Supa.get("profiles?select=id&limit=1").then(function(){return once(true)},function(){throw err("auth","Your session ended. Sign in again, then retry. Your product details are kept.",{retry:false,status:401})});
          if(r.status===401)throw err("auth","Your session ended. Sign in again, then retry. Your product details are kept.",{retry:false,status:401});
          if(r.status===403)throw err("denied","Everneed could not accept this upload for your store. Contact support so they can check your store's photo permission.",{retry:false,status:403});
          if(r.status===413)throw err("size","This photo is too large to upload. Choose a smaller one.",{retry:false,status:413});
          if(r.status===415||(r.status===400&&/mime|type|format/i.test(m)))throw err("format","This photo type is not accepted. Use a JPG, PNG or WebP image.",{retry:false,status:r.status});
          if(r.status===429||r.status>=500)throw err("server","Everneed is busy right now. Try again in a moment.",{status:r.status});
          throw err("upload","The photo did not upload (error "+r.status+"). Try again.",{status:r.status});
        });
      },function(e){
        clearTimeout(to);
        if(e&&typeof e.code==="string")throw e; /* our own errors; a browser AbortError has a numeric code */
        if(typeof navigator!=="undefined"&&navigator.onLine===false)throw err("offline","You are offline. Reconnect, then tap Try again. Your product details are kept.");
        if(d.timeout)throw err("timeout","The upload is too slow on this connection. Try again, or choose a smaller photo.");
        throw err("net","We could not reach Everneed. Check your signal and try again. Your product details are kept.");
      });
    }
    function loop(){
      return once(false).catch(function(e){
        if(e.retry&&e.code!=="offline"&&d.tries<tries){d.timeout=0;return wait(d.tries===1?700:2000).then(loop)}
        throw e;
      });
    }
    return loop().catch(fin);
  }
  window.EVUpload={prepare:prepare,put:put,sniff:sniff,last:null};
})();
