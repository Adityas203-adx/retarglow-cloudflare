import { getSupabaseClient } from "./lib/supabase.js";
import { base64UrlEncode, encodeToken } from "./lib/token.js";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year
const TOKEN_TTL_SECONDS = 60 * 5; // five minutes
const CAMPAIGN_CACHE_TTL_MS = 60 * 1000;
const CLICK_ID_PARAMS = ["irclickid", "gclid", "msclkid", "fbclid", "ttclid", "yclid"];

let cachedCampaigns = null;
let cachedCampaignExpiry = 0;

function normalizeForJson(value) {
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForJson);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    const normalized = {};
    for (const [key, val] of entries) {
      if (val === undefined) continue;
      normalized[key] = normalizeForJson(val);
    }
    return normalized;
  }

  return value;
}

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

function parseAudienceRules(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function toArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function extractRuleValues(source, keys) {
  if (!source || typeof source !== "object") return [];

  const values = [];
  for (const key of keys) {
    if (!(key in source)) continue;
    const raw = source[key];
    const queue = [...toArray(raw)];
    while (queue.length > 0) {
      const entry = queue.shift();
      if (entry == null) continue;
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (trimmed) values.push(trimmed);
        continue;
      }
      if (Array.isArray(entry)) {
        queue.push(...entry);
        continue;
      }
      if (typeof entry === "object") {
        const nested = extractRuleValues(entry, [
          "value",
          "pattern",
          "regex",
          "domain",
          "url"
        ]);
        if (nested.length > 0) values.push(...nested);
      }
    }
  }

  return values;
}

function normalizeAudienceRuleCollection(rules) {
  if (!rules || typeof rules !== "object") {
    return { regex: [], domain: [] };
  }

  const regexValues = new Set();
  const domainValues = new Set();

  const addRegex = value => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    regexValues.add(trimmed);
  };

  const addDomain = value => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    domainValues.add(trimmed);
  };

  const regexEntries = extractRuleValues(rules, ["regex", "regexes", "pattern", "patterns"]);
  for (const value of regexEntries) addRegex(value);

  const domainEntries = extractRuleValues(rules, ["domain", "domains", "host", "hosts"]);
  for (const value of domainEntries) addDomain(value);

  if (Array.isArray(rules.rules)) {
    for (const entry of rules.rules) {
      if (!entry || typeof entry !== "object") continue;
      const type = typeof entry.type === "string" ? entry.type.trim().toLowerCase() : "";
      if (type === "regex" || type === "pattern") {
        extractRuleValues(entry, ["value", "pattern", "regex"]).forEach(addRegex);
      } else if (type === "domain" || type === "host") {
        extractRuleValues(entry, ["value", "domain", "url", "host"]).forEach(addDomain);
      }
    }
  }

  return {
    regex: Array.from(regexValues),
    domain: Array.from(domainValues)
  };
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
    return ["true", "t", "1", "yes", "y"].includes(normalized);
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "bigint") {
    return value === 1n;
  }

  return false;
}

function generateNonce() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
  }
  return base64UrlEncode(Math.random().toString(36).slice(2));
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

function deriveFrameOrigin(request, env) {
  for (const key of ["FRAME_ORIGIN", "BOOTSTRAP_FRAME_ORIGIN", "APP_ORIGIN"]) {
    const candidate = env?.[key];
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate.replace(/\/$/, "");
    }
  }

  try {
    const url = new URL(request.url);
    if (url.origin) {
      return url.origin.replace(/\/$/, "");
    }
  } catch (err) {
    console.error("deriveFrameOrigin error", err);
  }

  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin) {
    return requestOrigin.replace(/\/$/, "");
  }

  return "https://retarglow.com";
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
  const hostMatches = pageHostname === ruleHost || pageHostname.endsWith(`.${ruleHost}`);
  if (!hostMatches) return false;

  if (rulePath) {
    const pagePath = parsedPage.pathname || "/";
    if (!(pagePath === rulePath || pagePath.startsWith(`${rulePath}/`))) {
      return false;
    }
  }

  return true;
}

async function loadCampaigns(supabase) {
  if (!supabase) return [];
  const now = Date.now();
  if (cachedCampaigns && cachedCampaignExpiry > now) {
    return cachedCampaigns;
  }

  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id,status,audience_rules,ad_url,iframe_width,iframe_height,iframe_style,iframe_attributes")
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) {
      console.error("campaign fetch error", error?.message || "unknown error");
      cachedCampaigns = [];
    } else {
      cachedCampaigns = data;
    }
  } catch (err) {
    console.error("loadCampaigns error", err);
    cachedCampaigns = [];
  }

  cachedCampaignExpiry = now + CAMPAIGN_CACHE_TTL_MS;
  return cachedCampaigns;
}

async function selectAdPlan({ pageUrl = "", retargetId, supabase }) {
  const campaigns = await loadCampaigns(supabase);
  if (!campaigns.length) return null;

  const url = pageUrl || "";
  for (const row of campaigns) {
    if (!row || !isActiveStatus(row.status)) continue;

    const rules = normalizeAudienceRuleCollection(parseAudienceRules(row.audience_rules));

    if (rules.regex.length > 0) {
      let regexMatched = false;
      for (const pattern of rules.regex) {
        try {
          const regex = new RegExp(pattern);
          if (regex.test(url)) {
            regexMatched = true;
            break;
          }
        } catch (err) {
          // ignore malformed pattern
        }
      }
      if (!regexMatched) continue;
    } else if (rules.domain.length > 0) {
      let domainMatched = false;
      for (const domainRule of rules.domain) {
        if (matchesDomainRule(url, domainRule) || (typeof url === "string" && url.startsWith(domainRule))) {
          domainMatched = true;
          break;
        }
      }
      if (!domainMatched) continue;
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

  return null;
}

function decodeLastClick(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const decoded = atob(value);
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (err) {
    // ignore malformed cookie
  }
  return null;
}

function encodeLastClickCookie(value) {
  try {
    return btoa(JSON.stringify(value));
  } catch (err) {
    return null;
  }
}

function extractLastClick({ pageUrl, referer }) {
  const page = tryParseUrl(pageUrl);
  const ref = tryParseUrl(referer);
  const params = page?.searchParams;
  let clickId = null;
  let clickKey = null;

  if (params) {
    for (const key of CLICK_ID_PARAMS) {
      const candidate = params.get(key);
      if (candidate) {
        clickId = candidate;
        clickKey = key;
        break;
      }
    }
  }

  const utmSource = params?.get("utm_source") || null;
  const utmMedium = params?.get("utm_medium") || null;
  const utmCampaign = params?.get("utm_campaign") || null;

  if (!clickId && ref && page && ref.hostname !== page.hostname) {
    clickId = ref.hostname;
    clickKey = "referer";
  }

  if (!clickId) return null;

  return {
    id: clickId,
    key: clickKey,
    source: utmSource || (ref?.hostname || null),
    medium: utmMedium,
    campaign: utmCampaign,
    ts: Date.now()
  };
}

function shouldReplaceLastClick(existing, candidate) {
  if (!candidate) return false;
  if (!existing) return true;
  if (!existing.id) return true;
  if (candidate.id !== existing.id) return true;
  if (typeof existing.ts !== "number" || candidate.ts > existing.ts) return true;
  return false;
}

async function logVisit({ supabase, request, cid, pageUrl, screenResolution, visitCount, retargetId, campaignId, events, lastClick }) {
  if (!supabase) return;
  try {
    const headers = request.headers;
    const ip = headers.get("cf-connecting-ip") || "unknown";
    const country = headers.get("cf-ipcountry") || null;
    const userAgent = headers.get("user-agent") || "";
    const referrer = headers.get("referer") || null;
    const deviceType = inferDeviceType(userAgent);

    const baseEvent = events && events.length > 0 ? events[0] : null;

    const entry = {
      event: baseEvent?.type || "pixel",
      page_url: baseEvent?.url || pageUrl || referrer || null,
      referrer: baseEvent?.referrer || referrer,
      user_agent: userAgent,
      ip_address: ip,
      custom_id: cid || null,
      device_type: deviceType,
      browser: null,
      os: null,
      screen_resolution: screenResolution || baseEvent?.screen || null,
      country,
      region: null,
      city: null,
      custom_metadata: {
        visit_count: visitCount,
        screen_resolution: screenResolution || baseEvent?.screen || null,
        retarget_id: retargetId,
        campaign_id: campaignId,
        last_click: lastClick || null
      },
      device_info: {
        device_type: deviceType,
        screen_resolution: screenResolution || baseEvent?.screen || null
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

function sanitizeEvents(events) {
  if (!Array.isArray(events)) return [];
  const sanitized = [];
  for (const item of events) {
    if (!item || typeof item !== "object") continue;
    const type = typeof item.type === "string" ? item.type : "event";
    const url = typeof item.url === "string" ? item.url : null;
    const referrer = typeof item.referrer === "string" ? item.referrer : null;
    const title = typeof item.title === "string" ? item.title : null;
    const ts = typeof item.ts === "number" ? item.ts : Date.now();
    const extra = typeof item.extra === "object" && item.extra !== null ? item.extra : {};
    const screen = typeof item.screen === "string" ? item.screen : null;
    sanitized.push({ type, url, referrer, title, ts, extra, screen });
  }
  return sanitized;
}

export default {
  async fetch(request, env, ctx) {
    const frameOrigin = deriveFrameOrigin(request, env);
    const origin = request.headers.get("Origin") || frameOrigin;
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

    const supabase = (() => {
      try {
        return getSupabaseClient(env);
      } catch (err) {
        console.error("supabase init error", err);
        return null;
      }
    })();

    const cookies = parseCookies(request.headers.get("Cookie") || "");
    let retargetId = cookies["_r"] || generateRetargetId();
    let visitCount = parseInt(cookies["visit_ct"], 10);
    if (!Number.isFinite(visitCount) || visitCount < 0) visitCount = 0;
    visitCount += 1;

    const cid = typeof payload.cid === "string" ? payload.cid : null;
    const events = sanitizeEvents(payload.events || []);
    const primaryEvent = events[0] || null;
    const pageUrl = typeof payload.url === "string" ? payload.url : primaryEvent?.url || null;
    const screenResolution = typeof payload.screen === "string" ? payload.screen : primaryEvent?.screen || null;

    const refererHeader = request.headers.get("referer") || primaryEvent?.referrer || null;
    const lastClickCandidate = extractLastClick({ pageUrl, referer: refererHeader });
    const existingLastClick = decodeLastClick(cookies["lc"]);
    const shouldSetLastClick = shouldReplaceLastClick(existingLastClick, lastClickCandidate);
    const activeLastClick = shouldSetLastClick ? lastClickCandidate : existingLastClick;

    const adPlan = await selectAdPlan({ pageUrl, retargetId, supabase });

    const logPromise = logVisit({
      supabase,
      request,
      cid,
      pageUrl,
      screenResolution,
      visitCount,
      retargetId,
      campaignId: adPlan?.campaignId || null,
      events,
      lastClick: activeLastClick
    });
    if (ctx && typeof ctx.waitUntil === "function" && logPromise) {
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
        sameSite: "Lax"
      })
    );
    headers.append(
      "Set-Cookie",
      serializeCookie("visit_ct", String(visitCount), {
        maxAge: COOKIE_MAX_AGE,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax"
      })
    );

    if (activeLastClick && shouldSetLastClick) {
      const encoded = encodeLastClickCookie(activeLastClick);
      if (encoded) {
        headers.append(
          "Set-Cookie",
          serializeCookie("lc", encoded, {
            maxAge: COOKIE_MAX_AGE,
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "Lax"
          })
        );
      }
    }

    let token = null;
    if (adPlan) {
      try {
        const payload = normalizeForJson({
          nonce: generateNonce(),
          exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
          plan: {
            campaignId: adPlan.campaignId,
            src: adPlan.src,
            width: adPlan.width,
            height: adPlan.height,
            style: adPlan.style,
            attributes: adPlan.attributes
          }
        });
        token = await encodeToken(env, payload);
      } catch (err) {
        console.error("token signing error", err);
        token = null;
      }
    }

    const responseBody = {
      success: true,
      token,
      plan_applied: Boolean(adPlan),
      events_processed: events.length
    };

    if (token) {
      responseBody.frame_src = `${frameOrigin}/frame?token=${encodeURIComponent(token)}`;
    }

    if (activeLastClick) {
      responseBody.last_click = {
        id: activeLastClick.id,
        source: activeLastClick.source,
        medium: activeLastClick.medium,
        campaign: activeLastClick.campaign
      };
    }

    if (pageUrl) {
      responseBody.page = pageUrl;
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers
    });
  }
};
