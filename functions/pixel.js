export default {
  async fetch(request, env, ctx) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const js = `(function(){try{const c="default",_r=localStorage.getItem("_r")||crypto.randomUUID();localStorage.setItem("_r",_r);document.cookie="_r="+_r+";path=/;max-age=2592000;SameSite=Lax";document.cookie="smc_uid="+_r+";path=/;max-age=31536000;SameSite=Lax";document.cookie="user_id_t="+_r+";path=/;max-age=31536000;SameSite=Lax";const o=navigator.platform,b=navigator.userAgent.includes("Chrome")?"C":navigator.userAgent.includes("Firefox")?"F":navigator.userAgent.includes("Safari")?"S":"U",d=/Mobi|Android/i.test(navigator.userAgent)?"M":"D",s=screen.width+"x"+screen.height,u=location.href,r=document.referrer;const p={cid:c,u,r,ua:navigator.userAgent,dt:d,b,os:o,sr:s,cm:{_r},domain:location.hostname};fetch("https://retarglow.com/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});const once=sessionStorage.getItem("i_"+c);function i(){fetch("https://retarglow.com/serve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({u,cm:{_r}})}).then(r=>r.json()).then(j=>{if(j.ad_url&&!once){const f=document.createElement("iframe");f.style.display="none";f.referrerPolicy="no-referrer";f.src=j.ad_url.replace("{{_r}}",_r);document.body.appendChild(f);sessionStorage.setItem("i_"+c,"1");}});}setTimeout(i,2000);window.addEventListener("scroll",()=>{i();window.removeEventListener("scroll",i);});setTimeout(i,5000);}catch(e){}})();`;

    return new Response(js, { status: 200, headers });
  }
};
