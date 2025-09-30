import { supabase } from "./lib/supabase.js";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

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
    "Access-Control-Allow-Headers": "content-type"
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
      if (!row || row.status !== true) continue;

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
        if (!url.startsWith(domainRule)) continue;
      }

      const adUrl = typeof row.ad_url === "string"
        ? row.ad_url.replace("{{_r}}", encodeURIComponent(retargetId))
        : null;
      if (!adUrl) continue;

      return {
        campaignId: row.id || null,
        src: adUrl,
        width: row.iframe_width ?? 0,
        height: row.iframe_height ?? 0,
        style:
          row.iframe_style ||
          "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;border:0;",
        attributes: {
          referrerpolicy: "no-referrer",
          scrolling: "no",
          frameborder: "0",
          ...(row.iframe_attributes || {})
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
  async fetch(request, env, ctx) {
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

    const body = {
      success: true,
      iframe: adPlan
        ? {
            src: adPlan.src,
            width: adPlan.width,
            height: adPlan.height,
            style: adPlan.style,
            attributes: adPlan.attributes
          }
        : null,
      meta: {
        visit_ct: visitCount,
        campaign_id: adPlan?.campaignId || null
      }
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers
    });
  }
};
