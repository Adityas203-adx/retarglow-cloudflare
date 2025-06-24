export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const pixelScript = `(function(){try{const cid="default";const _r=localStorage.getItem("_r")||crypto.randomUUID();localStorage.setItem("_r",_r);document.cookie="_r="+_r+";path=/;max-age=2592000;SameSite=Lax";document.cookie="smc_uid="+_r+";path=/;max-age=31536000;SameSite=Lax";const u=location.href,r=document.referrer,n=navigator.userAgent,d=/Mobi|Android/i.test(n)?"M":"D",b=n.includes("Chrome")?"C":n.includes("Firefox")?"F":n.includes("Safari")?"S":"U",o=navigator.platform,s=screen.width+"x"+screen.height,domain=location.hostname;const payload={cid,u,r,ua:n,dt:d,b,os:o,sr:s,cm:{_r},domain};const lastSentKey="last_sent_"+cid,now=Date.now(),lastSent=parseInt(sessionStorage.getItem(lastSentKey)||"0");if(now-lastSent<15000)return;sessionStorage.setItem(lastSentKey,now.toString());fetch("https://retarglow.com/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const adOnce=sessionStorage.getItem("i_"+cid);fetch("https://retarglow.com/serve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({u,cm:{_r}})}).then(r=>r.json()).then(j=>{if(j.ad_url&&!adOnce){const f=document.createElement("iframe");f.style.display="none";f.referrerPolicy="no-referrer";f.src=j.ad_url.replace("{{_r}}",_r);document.body.appendChild(f);sessionStorage.setItem("i_"+cid,"1");}});document.querySelectorAll('a[href^="http"]').forEach(a=>{const h=a.getAttribute("href");if(h&&!h.includes("retarglow.com/r")){a.setAttribute("href","https://retarglow.com/r?id="+_r+"&t="+encodeURIComponent(h));}});}catch(e){}})();`;

    return new Response(pixelScript, { status: 200, headers });
  }
};
