(function () {
  const g = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : undefined;
  if (!g) return;

  const config = g.__RETARGLOW_PIXEL__ || {};
  const doc = g.document;
  const nav = g.navigator;
  const history = g.history;

  function resolveBaseEndpoint() {
    if (config.endpoint) {
      try {
        return new URL(config.endpoint, g.location ? g.location.href : undefined).origin.replace(/\/$/, "");
      } catch (err) {
        // ignore and use fallback
      }
    }
    try {
      if (g.location && g.location.origin) {
        return g.location.origin.replace(/\/$/, "");
      }
    } catch (err) {
      // ignore
    }
    return "https://retarglow.com";
  }

  const baseEndpoint = resolveBaseEndpoint();
  const endpoint = baseEndpoint + "/b";

  function resolveCid() {
    if (typeof config.cid === "string" && config.cid) return config.cid;
    return null;
  }

  function currentUrl() {
    if (typeof config.url === "string") return config.url;
    try {
      if (doc && doc.location && typeof doc.location.href === "string") return doc.location.href;
      if (g.location && typeof g.location.href === "string") return g.location.href;
    } catch (err) {
      // ignore
    }
    return null;
  }

  function documentReferrer() {
    try {
      if (doc && typeof doc.referrer === "string" && doc.referrer) return doc.referrer;
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

  function viewportSize() {
    if (!doc) return null;
    const el = doc.documentElement;
    const width = Number(g.innerWidth || (el && el.clientWidth) || 0);
    const height = Number(g.innerHeight || (el && el.clientHeight) || 0);
    if (!width || !height) return null;
    return width + "x" + height;
  }

  function nowTs() {
    return Date.now();
  }

  function shallowMerge(target, extra) {
    if (!extra || typeof extra !== "object") return target;
    for (const key of Object.keys(extra)) {
      const value = extra[key];
      if (value === undefined) continue;
      target[key] = value;
    }
    return target;
  }

  const state = {
    pending: [],
    flushing: false,
    timer: null,
    backoff: 1000,
    currentUrl: null,
    previousUrl: null,
    lastToken: null
  };

  function scheduleFlush(delay) {
    const ms = typeof delay === "number" && delay > 0 ? delay : 250;
    if (state.timer) return;
    state.timer = g.setTimeout(() => {
      state.timer = null;
      flushQueue();
    }, ms);
  }

  function enqueueEvent(type, extra) {
    const url = state.currentUrl || currentUrl();
    const referrer = state.previousUrl && state.previousUrl !== url ? state.previousUrl : documentReferrer();
    const event = {
      type: typeof type === "string" ? type : "event",
      url: url,
      referrer: referrer || null,
      title: doc && typeof doc.title === "string" ? doc.title : null,
      ts: nowTs(),
      screen: screenResolution(),
      extra: {
        viewport: viewportSize()
      }
    };
    shallowMerge(event.extra, extra);
    state.pending.push(event);
    scheduleFlush();
  }

  function applyResponse(result) {
    if (!result || typeof result !== "object") return;

    if (result.token && typeof result.token === "string" && result.token !== state.lastToken) {
      state.lastToken = result.token;
      const src = typeof result.frame_src === "string" && result.frame_src
        ? result.frame_src
        : baseEndpoint + "/frame?token=" + encodeURIComponent(result.token);
      injectFrame(src);
    }
  }

  function injectFrame(src) {
    if (!doc || !src) return;
    const frame = doc.createElement("iframe");
    frame.src = src;
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "display:none;width:0;height:0;border:0;";
    const target = doc.body || doc.documentElement;
    if (target) target.appendChild(frame);
  }

  function flushQueue(options) {
    if (!state.pending.length) return;

    const useBeacon = options && options.forceBeacon && nav && typeof nav.sendBeacon === "function";
    const batch = state.pending.splice(0, state.pending.length);
    const payload = {
      cid: resolveCid(),
      url: state.currentUrl || currentUrl(),
      screen: screenResolution(),
      events: batch
    };

    const body = JSON.stringify(payload);

    if (useBeacon) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        if (nav.sendBeacon(endpoint, blob)) {
          state.backoff = 1000;
          return;
        }
      } catch (err) {
        // fall through to fetch retry logic
      }
      state.pending = batch.concat(state.pending);
      scheduleFlush(state.backoff);
      return;
    }

    if (state.flushing) {
      state.pending = batch.concat(state.pending);
      return;
    }

    state.flushing = true;
    g.fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body
    })
      .then(response => {
        if (!response || !response.ok) return null;
        return response.json().catch(() => null);
      })
      .then(result => {
        state.backoff = 1000;
        applyResponse(result);
      })
      .catch(() => {
        state.pending = batch.concat(state.pending);
        state.backoff = Math.min(state.backoff * 2, 30000);
      })
      .finally(() => {
        state.flushing = false;
        if (state.pending.length) {
          scheduleFlush(state.backoff);
        }
      });
  }

  function handleNavigation(force) {
    const url = currentUrl();
    if (!url) return;
    if (!force && state.currentUrl === url) return;
    state.previousUrl = state.currentUrl;
    state.currentUrl = url;
    const referrer = state.previousUrl && state.previousUrl !== url ? state.previousUrl : documentReferrer();
    enqueueEvent("pageview", { referrer });
  }

  function wrapHistory(method) {
    if (!history || typeof history[method] !== "function") return;
    const original = history[method];
    history[method] = function wrappedHistoryMethod() {
      const result = original.apply(this, arguments);
      Promise.resolve().then(() => handleNavigation(true));
      return result;
    };
  }

  function setupNavigationHooks() {
    wrapHistory("pushState");
    wrapHistory("replaceState");
    if (g.addEventListener) {
      g.addEventListener("popstate", () => handleNavigation(true));
      g.addEventListener("hashchange", () => handleNavigation(true));
    }
  }

  const seenViews = new WeakSet();
  const tracked = new WeakSet();
  let intersectionObserver = null;

  function emitViewOnce(element) {
    if (seenViews.has(element)) return;
    seenViews.add(element);
    enqueueEvent("view", {
      target: element.getAttribute("data-track") || null,
      id: element.id || null
    });
  }

  function ensureIntersectionObserver() {
    if (intersectionObserver || !g.IntersectionObserver) return;
    intersectionObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          emitViewOnce(entry.target);
          intersectionObserver.unobserve(entry.target);
        }
      }
    }, { threshold: 0.2 });
  }

  function bindTrackedElement(element) {
    if (!element || tracked.has(element)) return;
    tracked.add(element);

    const label = element.getAttribute("data-track") || element.id || element.tagName.toLowerCase();

    element.addEventListener("click", () => {
      enqueueEvent("interaction", {
        target: label,
        id: element.id || null,
        role: element.getAttribute("role") || null
      });
    }, { passive: true });

    ensureIntersectionObserver();
    if (intersectionObserver) {
      intersectionObserver.observe(element);
    }
  }

  function scanTrackedElements() {
    if (!doc || !doc.querySelectorAll) return;
    const nodes = doc.querySelectorAll("[data-track]");
    for (const node of nodes) {
      bindTrackedElement(node);
    }
  }

  function observeDom() {
    if (!doc || !doc.querySelectorAll || !g.MutationObserver) {
      scanTrackedElements();
      return;
    }

    scanTrackedElements();

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (!mutation.addedNodes) continue;
        for (const node of mutation.addedNodes) {
          if (!(node instanceof g.Element)) continue;
          if (node.matches && node.matches("[data-track]")) {
            bindTrackedElement(node);
          }
          if (node.querySelectorAll) {
            const nested = node.querySelectorAll("[data-track]");
            for (const el of nested) bindTrackedElement(el);
          }
        }
      }
    });

    observer.observe(doc.documentElement || doc.body, { childList: true, subtree: true });
  }

  function setupLifecycle() {
    if (!doc) return;
    if (doc.readyState === "complete" || doc.readyState === "interactive") {
      handleNavigation(true);
      observeDom();
    } else {
      doc.addEventListener("DOMContentLoaded", () => {
        handleNavigation(true);
        observeDom();
      }, { once: true });
    }

    if (g.addEventListener) {
      g.addEventListener("visibilitychange", () => {
        if (doc.visibilityState === "hidden") {
          flushQueue({ forceBeacon: true });
        }
      });
      g.addEventListener("pagehide", () => {
        flushQueue({ forceBeacon: true });
      });
      g.addEventListener("beforeunload", () => {
        flushQueue({ forceBeacon: true });
      });
    }
  }

  setupNavigationHooks();
  setupLifecycle();
})();
