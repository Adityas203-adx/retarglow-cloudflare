(function () {
  const g = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : undefined;
  if (!g) return;

  const config = g.__RETARGLOW_PIXEL__ || {};
  const doc = g.document;

  function resolveBaseEndpoint() {
    if (config.endpoint) {
      try {
        const url = new URL(config.endpoint, g.location ? g.location.href : undefined);
        return url.origin;
      } catch (err) {
        // fall through to default
      }
    }
    try {
      if (g.location && g.location.origin) {
        return g.location.origin;
      }
    } catch (err) {
      // ignore
    }
    return "https://retarglow.com";
  }

  const baseEndpoint = resolveBaseEndpoint().replace(/\/$/, "");
  const endpoint = baseEndpoint + "/b";

  function resolveFrameSrc(frameSrc) {
    if (typeof frameSrc === "string" && frameSrc) {
      return frameSrc;
    }
    return null;
  }

  function injectIframeWithSrc(src) {
    if (!doc || !src) return;

    const frame = doc.createElement("iframe");
    frame.src = src;
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "display:none;width:0;height:0;border:0;";

    const target = doc.body || doc.documentElement;
    if (target) {
      target.appendChild(frame);
    }
  }

  function currentUrl() {
    if (typeof config.url === "string") return config.url;
    try {
      if (doc && doc.location && typeof doc.location.href === "string") {
        return doc.location.href;
      }
      if (g.location && typeof g.location.href === "string") {
        return g.location.href;
      }
    } catch (err) {
      // ignore
    }
    return null;
  }

  function screenResolution() {
    if (!g.screen) return null;
    const width = Number(g.screen.width) || 0;
    const height = Number(g.screen.height) || 0;
    if (!width || !height) return null;
    return width + "x" + height;
  }

  const payload = {
    cid: typeof config.cid === "string" ? config.cid : null,
    u: currentUrl(),
    sr: screenResolution()
  };

  function handleResponse(result) {
    if (!result) return;

    let frameSrc = null;

    if (typeof result === "object" && result !== null) {
      if (typeof result.frame_src === "string" && result.frame_src) {
        frameSrc = result.frame_src;
      }
    }

    const src = resolveFrameSrc(frameSrc);
    if (!src) return;

    const execute = () => injectIframeWithSrc(src);
    if (!doc || doc.readyState === "complete" || doc.readyState === "interactive") {
      execute();
    } else {
      doc.addEventListener("DOMContentLoaded", execute, { once: true });
    }
  }

  function sendRequest() {
    try {
      const body = JSON.stringify(payload);
      return g.fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body
      });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  sendRequest()
    .then(response => {
      if (!response || !response.ok) return null;
      return response
        .json()
        .catch(() => null);
    })
    .then(handleResponse)
    .catch(() => {
      // swallow errors to avoid breaking host pages
    });
})();
