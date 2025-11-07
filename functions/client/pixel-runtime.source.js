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

  function canonicalizeUrl(value) {
    if (typeof value !== "string" || !value) return null;

    try {
      if (g.location && typeof g.location.href === "string") {
        return new URL(value, g.location.href).href;
      }
    } catch (err) {
      // fall through to absolute parsing
    }

    try {
      return new URL(value).href;
    } catch (err) {
      // return the raw value as the best available identifier
    }

    return value;
  }

  const lastAdKey = "__retarglow_last_ad_url__";

  function getLastAdUrl() {
    try {
      if (g.sessionStorage && typeof g.sessionStorage.getItem === "function") {
        return g.sessionStorage.getItem(lastAdKey);
      }
    } catch (err) {
      // ignore storage errors
    }

    return null;
  }

  function rememberAdUrl(url) {
    try {
      if (g.sessionStorage && typeof g.sessionStorage.setItem === "function") {
        g.sessionStorage.setItem(lastAdKey, url);
      }
    } catch (err) {
      // ignore storage errors
    }
  }

  function navigateToAd(url) {
    if (typeof url !== "string" || !url) return;

    rememberAdUrl(url);

    try {
      if (g.location && typeof g.location.assign === "function") {
        g.location.assign(url);
        return;
      }
    } catch (err) {
      // fallback below
    }

    try {
      if (g.location) {
        g.location.href = url;
      }
    } catch (err) {
      // swallow navigation errors
    }
  }

  function handleResponse(result) {
    if (!result) return;

    let adUrl = null;

    if (typeof result === "object" && result !== null) {
      if (typeof result.ad_url === "string" && result.ad_url) {
        adUrl = result.ad_url;
      }
    }

    if (!adUrl) return;

    const normalizedTarget = canonicalizeUrl(adUrl);
    const normalizedCurrent = canonicalizeUrl(currentUrl());
    const lastAdUrl = canonicalizeUrl(getLastAdUrl());

    if (normalizedTarget && normalizedCurrent && normalizedTarget === normalizedCurrent) {
      rememberAdUrl(normalizedTarget);
      return;
    }

    if (normalizedTarget && lastAdUrl && normalizedTarget === lastAdUrl) {
      return;
    }

    navigateToAd(normalizedTarget || adUrl);
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
