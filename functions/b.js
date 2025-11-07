import { supabase } from "./lib/supabase.js";
import { base64UrlEncode } from "./lib/token.js";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

function normalizeDimension(value) {
  if (value == null) return 0;

  if (typeof value === "bigint") {
    const asNumber = Number(value);
    if (Number.isSafeInteger(asNumber)) return asNumber;
    return Number.parseInt(value.toString(), 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function normalizeAttributes(attributes) {
  if (!attributes || typeof attributes !== "object") {
    return {};
  }

  const normalized = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!key) continue;
    if (value == null) continue;

    if (typeof value === "bigint") {
      normalized[key] = value.toString();
    } else if (typeof value === "boolean" || typeof value === "number") {
      normalized[key] = String(value);
    } else {
      normalized[key] = String(value);
    }
  }

  return normalized;
}

function isActiveStatus(value) {
  if (value === true) return true;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;

    if (["true", "t", "1", "yes", "y"].includes(normalized)) {
      return true;
    }

    if (["active", "enabled", "enable", "live", "running"].includes(normalized)) {
      return true;
    }

    if (["false", "f", "0", "no", "n", "inactive", "disabled", "paused", "stopped"].includes(normalized)) {
      return false;
    }

    return false;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return false;
    return value > 0;
  }

  if (typeof value === "bigint") {
    return value > 0n;
  }

  return false;
}

function parseCookies(header = "") {
  return header.split(";").reduce((acc, part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return acc;
    acc[name] = rest.join("=");
    return acc;
  }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`];
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    Vary: "Origin"
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

function generateRetargetId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function inferDeviceType(ua = "") {
  return /mobile|android|iphone|ipad|ipod/i.test(ua) ? "Mobile" : "Desktop";
}

function tryParseUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    return new URL(value);
  } catch (err) {
    return null;
  }
}

function normalizePath(path = "") {
  if (typeof path !== "string") return "";
  let normalized = path.trim();
  if (!normalized || normalized === "/") return "";
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/+$/, "");
  return normalized === "" ? "" : normalized;
}

function normalizeDomainRule(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidates = [];
  if (/^https?:\/\//i.test(trimmed)) {
    candidates.push(trimmed);
  } else {
    candidates.push(`https://${trimmed}`);
    candidates.push(trimmed);
  }

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      const hostname = parsed.hostname?.toLowerCase();
      if (!hostname) continue;
      const path = normalizePath(parsed.pathname || "");
      return { hostname, path };
    } catch (err) {
      // try next candidate
    }
  }

  const withoutProtocol = trimmed.replace(/^[^/]*:\/\//, "");
  const [hostPart = "", ...pathParts] = withoutProtocol.split("/");
  const hostname = hostPart.toLowerCase();
  if (!hostname) return null;
  const path = normalizePath(pathParts.join("/"));
  return { hostname, path };
}

function matchesDomainRule(pageUrl, domainRule) {
  const normalizedRule = normalizeDomainRule(domainRule);
  if (!normalizedRule) return false;

  const parsedPage = tryParseUrl(pageUrl);
  if (!parsedPage) {
    if (typeof pageUrl === "string" && pageUrl.trim() !== "") {
      return pageUrl.startsWith(domainRule);
    }
    return false;
  }

  const pageHostname = parsedPage.hostname?.toLowerCase();
  if (!pageHostname) return false;

  const { hostname: ruleHost, path: rulePath } = normalizedRule;
  const hostMatches =
    pageHostname === ruleHost || pageHostname.endsWith(`.${ruleHost}`);
  if (!hostMatches) return false;

  if (rulePath) {
    const pagePath = parsedPage.pathname || "/";
    if (!(pagePath === rulePath || pagePath.startsWith(`${rulePath}/`))) {
      return false;
    }
  }

  return true;
}

async function selectAdPlan(pageUrl = "", retargetId) {
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) {
      return null;
    }

    const url = pageUrl || "";
    for (const row of data) {
      if (!row || !isActiveStatus(row.status)) continue;

      const rules = row.audience_rules || {};
      const regexRule = rules.regex;
      const domainRule = rules.domain;

      if (regexRule) {
        try {
          const regex = new RegExp(regexRule);
          if (!regex.test(url)) continue;
        } catch (err) {
          continue;
        }
      } else if (domainRule && typeof domainRule === "string") {
        if (!matchesDomainRule(url, domainRule)) continue;
      }

      const adUrl = typeof row.ad_url === "string"
        ? row.ad_url.replace("{{_r}}", encodeURIComponent(retargetId))
        : null;
      if (!adUrl) continue;

      let campaignId = null;
      if (row?.id != null) {
        try {
          campaignId = String(row.id);
        } catch (err) {
          campaignId = null;
        }
      }

      return {
        campaignId,
        src: adUrl,
        width: normalizeDimension(row.iframe_width),
        height: normalizeDimension(row.iframe_height),
        style:
          typeof row.iframe_style === "string" && row.iframe_style.length > 0
            ? row.iframe_style
            : "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;border:0;",
        attributes: {
          referrerpolicy: "no-referrer",
          scrolling: "no",
          frameborder: "0",
          ...normalizeAttributes(row.iframe_attributes)
        }
      };
    }
  } catch (err) {
    console.error("selectAdPlan error", err);
  }

  return null;
}

async function logVisit({ request, cid, pageUrl, screenResolution, visitCount, retargetId, campaignId }) {
  try {
    const headers = request.headers;
    const ip = headers.get("cf-connecting-ip") || "unknown";
    const country = headers.get("cf-ipcountry") || null;
    const userAgent = headers.get("user-agent") || "";
    const referrer = headers.get("referer") || null;
    const deviceType = inferDeviceType(userAgent);

    const entry = {
      event: "bootstrap",
      page_url: pageUrl || referrer || null,
      referrer,
      user_agent: userAgent,
      ip_address: ip,
      custom_id: cid || null,
      device_type: deviceType,
      browser: null,
      os: null,
      screen_resolution: screenResolution || null,
      country,
      region: null,
      city: null,
      custom_metadata: {
        visit_count: visitCount,
        screen_resolution: screenResolution || null,
        retarget_id: retargetId,
        campaign_id: campaignId
      },
      device_info: {
        device_type: deviceType,
        screen_resolution: screenResolution || null
      },
      os_name: null,
      browser_name: null
    };

    const { error } = await supabase.from("events").insert([entry]);
    if (error) {
      console.error("Supabase log error", error.message);
    }
  } catch (err) {
    console.error("logVisit error", err);
  }
}

export default {
  async fetch(request, _env, ctx) {
    const origin = request.headers.get("Origin");
    const baseHeaders = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: baseHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: baseHeaders });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...baseHeaders, "Content-Type": "application/json" }
      });
    }

    const cookies = parseCookies(request.headers.get("Cookie") || "");
    let retargetId = cookies["_r"] || generateRetargetId();
    let visitCount = parseInt(cookies["visit_ct"], 10);
    if (!Number.isFinite(visitCount) || visitCount < 0) visitCount = 0;
    visitCount += 1;

    const cid = typeof payload.cid === "string" ? payload.cid : null;
    const pageUrl = typeof payload.u === "string" ? payload.u : null;
    const screenResolution = typeof payload.sr === "string" ? payload.sr : null;

    const adPlan = await selectAdPlan(pageUrl, retargetId);

    const logPromise = logVisit({
      request,
      cid,
      pageUrl,
      screenResolution,
      visitCount,
      retargetId,
      campaignId: adPlan?.campaignId || null
    });
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(logPromise);
    }

    const headers = new Headers({
      ...baseHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    });
    headers.append(
      "Set-Cookie",
      serializeCookie("_r", retargetId, {
        maxAge: COOKIE_MAX_AGE,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None"
      })
    );
    headers.append(
      "Set-Cookie",
      serializeCookie("visit_ct", String(visitCount), {
        maxAge: COOKIE_MAX_AGE,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None"
      })
    );

    const responseBody = {
      success: true,
      token: null
    };

    if (adPlan) {
      const { campaignId, ...framePlan } = adPlan;
      responseBody.ad_url = framePlan.src;
      if (campaignId != null) {
        responseBody.campaign_id = campaignId;
      }

      try {
        const encodedPlan = base64UrlEncode(JSON.stringify({ plan: framePlan }));
        const frameUrl = new URL("/frame", request.url);
        frameUrl.protocol = "https:";
        frameUrl.port = "";
        frameUrl.searchParams.set("plan", encodedPlan);

        responseBody.plan = encodedPlan;
        responseBody.frame_src = frameUrl.toString();
      } catch (err) {
        console.error("Failed to encode campaign plan", err);
      }
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers
    });
  }
};
