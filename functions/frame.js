import { supabase } from "./lib/supabase.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlToUint8Array(value = "") {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

async function importHmacKey(secret) {
  if (!secret) throw new Error("Missing HMAC secret");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign", "verify"]
  );
}

async function verifyToken(token, secret) {
  if (!token) {
    throw new Error("Missing token");
  }

  const segments = token.split(".");
  if (segments.length !== 2) {
    throw new Error("Malformed token");
  }

  const [payloadSegment, signatureSegment] = segments;
  if (!payloadSegment || !signatureSegment) {
    throw new Error("Malformed token");
  }

  const payloadBytes = base64UrlToUint8Array(payloadSegment);
  const signatureBytes = base64UrlToUint8Array(signatureSegment);

  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    payloadBytes
  );

  if (!valid) {
    throw new Error("Invalid signature");
  }

  const payloadJson = decoder.decode(payloadBytes);
  const payload = safeJsonParse(payloadJson);

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload");
  }

  const exp = Number(payload.exp);
  if (Number.isFinite(exp)) {
    const now = Date.now() / 1000;
    if (now > exp) {
      const err = new Error("Token expired");
      err.code = "TOKEN_EXPIRED";
      throw err;
    }
  }

  return payload;
}

function addOrigin(targetSet, value) {
  if (!value || typeof value !== "string") return;
  if (value === "*") {
    targetSet.add("*");
    return;
  }
  try {
    const { origin } = new URL(value);
    targetSet.add(origin);
  } catch (err) {
    // ignore invalid origin
  }
}

function buildSecurityHeaders(plan) {
  const frameSrc = new Set(["'self'"]);
  const imgSrc = new Set(["'self'", "data:"]);
  const connectSrc = new Set(["'self'"]);

  if (plan?.src) {
    addOrigin(frameSrc, plan.src);
    addOrigin(connectSrc, plan.src);
  }

  const analytics = plan?.analytics;
  if (analytics && typeof analytics === "object") {
    const pixelUrls = Array.isArray(analytics.pixels)
      ? analytics.pixels
      : analytics.pixel
        ? [analytics.pixel]
        : [];
    for (const url of pixelUrls) {
      addOrigin(imgSrc, url);
      addOrigin(connectSrc, url);
    }

    if (Array.isArray(analytics.beacons)) {
      for (const url of analytics.beacons) {
        addOrigin(imgSrc, url);
        addOrigin(connectSrc, url);
      }
    }
  }

  if (Array.isArray(plan?.allowedOrigins)) {
    for (const value of plan.allowedOrigins) {
      addOrigin(frameSrc, value);
      addOrigin(imgSrc, value);
      addOrigin(connectSrc, value);
    }
  }

  const directives = [
    "default-src 'none'",
    `frame-src ${Array.from(frameSrc).join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `img-src ${Array.from(imgSrc).join(" ")}`,
    `connect-src ${Array.from(connectSrc).join(" ")}`,
    "script-src 'self' 'unsafe-inline'"
  ];

  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": directives.join("; ")
  };
}

function serializePlan(plan) {
  if (!plan || typeof plan !== "object") return "null";
  return JSON.stringify(plan);
}

function escapeForInlineScript(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

async function logFrameImpression({ request, payload, plan }) {
  try {
    const entry = {
      event: "frame_impression",
      plan_src: plan?.src || null,
      plan_width: plan?.width ?? null,
      plan_height: plan?.height ?? null,
      campaign_id: payload?.campaign_id ?? payload?.campaignId ?? null,
      retarget_id: payload?.retarget_id ?? payload?.retargetId ?? null,
      analytics: plan?.analytics || null,
      user_agent: request.headers.get("user-agent") || null,
      referrer: request.headers.get("referer") || null,
      ip_address: request.headers.get("cf-connecting-ip") || null,
      country: request.headers.get("cf-ipcountry") || null,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from("frame_events").insert([entry]);
    if (error) {
      console.error("Supabase frame log error", error.message || error);
    }
  } catch (err) {
    console.error("logFrameImpression error", err);
  }
}

async function hydratePlan(plan) {
  if (!plan || typeof plan !== "object") return null;
  let hydrated = plan;

  const creativeId = plan.creative_id || plan.creativeId;
  const needsCreativeLookup =
    !plan.src && !plan.html && !plan.markup && typeof creativeId !== "undefined";

  if (needsCreativeLookup && creativeId != null) {
    try {
      const { data, error } = await supabase
        .from("creatives")
        .select("iframe_url, html, markup, width, height, analytics, allowed_origins")
        .eq("id", creativeId)
        .maybeSingle();

      if (!error && data) {
        let allowedOrigins = plan.allowedOrigins ?? data.allowed_origins ?? null;
        if (typeof allowedOrigins === "string") {
          try {
            const parsed = JSON.parse(allowedOrigins);
            if (Array.isArray(parsed)) {
              allowedOrigins = parsed;
            }
          } catch (err) {
            allowedOrigins = allowedOrigins.split(/[,\s]+/).filter(Boolean);
          }
        }

        let analytics = plan.analytics ?? data.analytics ?? null;
        if (typeof analytics === "string") {
          try {
            const parsed = JSON.parse(analytics);
            if (parsed && typeof parsed === "object") {
              analytics = parsed;
            }
          } catch (err) {
            // keep original string
          }
        }

        hydrated = {
          ...plan,
          src: data.iframe_url || plan.src || null,
          html: data.html ?? data.markup ?? plan.html ?? plan.markup ?? null,
          markup: data.markup ?? plan.markup ?? null,
          width: plan.width ?? data.width ?? null,
          height: plan.height ?? data.height ?? null,
          analytics,
          allowedOrigins: Array.isArray(allowedOrigins) ? allowedOrigins : plan.allowedOrigins ?? null
        };
      }
    } catch (err) {
      console.error("hydratePlan error", err);
    }
  }

  return hydrated;
}

function sanitizeFallback(value) {
  if (typeof value !== "string") return '<div role="presentation" style="display:none"></div>';
  return value;
}

function renderDocument(plan, options = {}) {
  const analytics = plan?.analytics || null;
  const serializedPlan = escapeForInlineScript(serializePlan(plan));
  const serializedAnalytics = escapeForInlineScript(JSON.stringify(analytics || null));

  const fallbackMarkup = sanitizeFallback(options.fallbackHtml);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ad Frame</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      width: 100%;
      height: 100%;
    }
    #ad-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    iframe[data-ad-frame] {
      border: 0;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="ad-container">${fallbackMarkup}</div>
  <script type="module">
    const plan = ${serializedPlan};
    const analytics = ${serializedAnalytics};

    function createIframe(doc, details) {
      if (!details || typeof details.src !== 'string') return null;
      const iframe = doc.createElement('iframe');
      iframe.setAttribute('data-ad-frame', '');
      iframe.src = details.src;
      if (details.width != null) iframe.width = String(details.width);
      if (details.height != null) iframe.height = String(details.height);
      if (details.style) iframe.setAttribute('style', details.style);
      const attributes = details.attributes || {};
      for (const [key, value] of Object.entries(attributes)) {
        if (value == null) continue;
        iframe.setAttribute(key, String(value));
      }
      if (!iframe.hasAttribute('referrerpolicy')) {
        iframe.setAttribute('referrerpolicy', 'no-referrer');
      }
      if (!iframe.hasAttribute('sandbox') && details.sandbox) {
        iframe.setAttribute('sandbox', details.sandbox);
      }
      return iframe;
    }

    function renderMarkup(container, details) {
      const markup = typeof details.html === 'string' ? details.html
        : typeof details.markup === 'string' ? details.markup
        : null;
      if (!markup) return false;
      container.innerHTML = markup;
      return true;
    }

    function firePixel(url) {
      try {
        const img = new Image();
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.src = url;
      } catch (err) {
        console.warn('pixel error', err);
      }
    }

    function fireBeacon(url) {
      if (!url) return;
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([], { type: 'application/octet-stream' });
          navigator.sendBeacon(url, blob);
        } else {
          firePixel(url);
        }
      } catch (err) {
        firePixel(url);
      }
    }

    function fireAnalytics(config) {
      if (!config || typeof config !== 'object') return;
      const pixels = Array.isArray(config.pixels) ? config.pixels : [];
      for (const url of pixels) {
        if (typeof url === 'string' && url) {
          firePixel(url);
        }
      }
      if (typeof config.pixel === 'string' && config.pixel) {
        firePixel(config.pixel);
      }
      if (Array.isArray(config.beacons)) {
        for (const url of config.beacons) {
          if (typeof url === 'string' && url) {
            fireBeacon(url);
          }
        }
      }
    }

    (function bootstrap() {
      const container = document.getElementById('ad-container');
      if (!container) return;
      if (!plan) {
        container.innerHTML = '';
        return;
      }
      if (!renderMarkup(container, plan)) {
        const iframe = createIframe(document, plan);
        if (iframe) {
          container.innerHTML = '';
          container.appendChild(iframe);
        }
      }
      fireAnalytics(analytics);
    })();
  </script>
  <noscript>${fallbackMarkup}</noscript>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const secret = env?.FRAME_TOKEN_SECRET || env?.BOOTSTRAP_TOKEN_SECRET || env?.TOKEN_SECRET;

    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    };

    if (!token) {
      return new Response("Missing token", {
        status: 400,
        headers
      });
    }

    if (!secret) {
      return new Response("Server misconfiguration", {
        status: 500,
        headers
      });
    }

    let payload;
    try {
      payload = await verifyToken(token, secret);
    } catch (err) {
      if (err && err.code === "TOKEN_EXPIRED") {
        return new Response("Token expired", {
          status: 403,
          headers
        });
      }
      return new Response("Invalid token", {
        status: 403,
        headers
      });
    }

    let plan = payload && typeof payload.plan === "object" ? payload.plan : null;
    plan = await hydratePlan(plan);
    if (plan && typeof payload?.analytics === "object" && plan.analytics == null) {
      plan = { ...plan, analytics: payload.analytics };
    }
    const responseHeaders = buildSecurityHeaders(plan);

    const logPromise = logFrameImpression({ request, payload, plan });
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(logPromise);
    } else {
      logPromise.catch(() => {});
    }

    const fallbackHtml = typeof payload?.fallback_html === "string" ? payload.fallback_html : undefined;
    const body = renderDocument(plan, { fallbackHtml });
    return new Response(body, { status: 200, headers: responseHeaders });
  }
};
