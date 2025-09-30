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

  function injectIframe(plan) {
    if (!doc || !plan || !plan.src) return;

    const frame = doc.createElement("iframe");
    frame.src = plan.src;

    if (plan.width != null) frame.width = String(plan.width);
    if (plan.height != null) frame.height = String(plan.height);

    if (plan.style) {
      frame.setAttribute("style", plan.style);
    } else {
      frame.style.cssText = "display:none;width:0;height:0;border:0;";
    }

    const attributes = plan.attributes || {};
    if (attributes && typeof attributes === "object") {
      for (const [key, value] of Object.entries(attributes)) {
        if (value != null) {
          frame.setAttribute(key, String(value));
        }
      }
    }

    if (!frame.hasAttribute("referrerpolicy")) {
      frame.setAttribute("referrerpolicy", "no-referrer");
    }
    if (!frame.hasAttribute("scrolling")) {
      frame.setAttribute("scrolling", "no");
    }
    if (!frame.hasAttribute("frameborder")) {
      frame.setAttribute("frameborder", "0");
    }
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("tabindex", "-1");
    frame.style.pointerEvents = "none";

    const target = doc.body || doc.documentElement;
    if (target) {
      target.appendChild(frame);
    }
  }

  function handlePlan(result) {
    if (!result) return;
    const plan = result.iframe || result.plan;
    if (!plan || !plan.src) return;

    const execute = () => injectIframe(plan);
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
    .then(handlePlan)
    .catch(() => {
      // swallow errors to avoid breaking host pages
    });
})();
