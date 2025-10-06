import { verifyToken } from "./lib/token.js";

/**
 * HTML-escapes a string to prevent attribute/body injection when we echo
 * content from the campaign plan back into the HTML response.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts a verified campaign plan into an iframe element string. Only a
 * whitelisted set of values are copied across and every attribute is escaped.
 *
 * @param {Record<string, any>} plan
 * @returns {string}
 */
function buildIframeHtml(plan) {
  const src = typeof plan?.src === "string" ? plan.src : "";
  if (!src) {
    throw new Error("Missing campaign source");
  }

  const iframeAttributes = [
    `src="${escapeHtml(src)}"`
  ];

  const width = plan?.width;
  if (width != null) {
    const value = typeof width === "number" && Number.isFinite(width)
      ? String(width)
      : typeof width === "string"
        ? width.trim()
        : "";
    if (value) {
      iframeAttributes.push(`width="${escapeHtml(value)}"`);
    }
  }

  const height = plan?.height;
  if (height != null) {
    const value = typeof height === "number" && Number.isFinite(height)
      ? String(height)
      : typeof height === "string"
        ? height.trim()
        : "";
    if (value) {
      iframeAttributes.push(`height="${escapeHtml(value)}"`);
    }
  }

  const style = typeof plan?.style === "string" ? plan.style.trim() : "";
  if (style) {
    iframeAttributes.push(`style="${escapeHtml(style)}"`);
  }

  const attributes = plan?.attributes && typeof plan.attributes === "object" ? plan.attributes : {};
  for (const [key, rawValue] of Object.entries(attributes)) {
    if (!key || !/^[a-zA-Z][a-zA-Z0-9:-]*$/.test(key)) continue;

    if (typeof rawValue === "boolean") {
      if (rawValue) {
        iframeAttributes.push(key);
      }
      continue;
    }

    if (rawValue == null) continue;
    const value = String(rawValue).trim();
    iframeAttributes.push(`${key}="${escapeHtml(value)}"`);
  }

  const attributesString = iframeAttributes.join(" ");
  return `<iframe ${attributesString}></iframe>`;
}

/**
 * Wraps the supplied body content in a minimal HTML scaffold to make sure the
 * response renders predictably across browsers while keeping the markup small.
 *
 * @param {string} bodyContent
 * @returns {string}
 */
function buildHtml(bodyContent) {
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Retarglow Frame</title>",
    "<style>html,body{margin:0;padding:0;background:transparent;}</style>",
    "</head>",
    `<body>${bodyContent}</body>`,
    "</html>"
  ].join("");
}

/**
 * Validates the signed token and returns the embedded campaign plan if the
 * token is authentic, has not expired, and contains a plan payload.
 *
 * @param {Env} env
 * @param {string} token
 * @returns {Promise<Record<string, any>>}
 */
async function validatePlanToken(env, token) {
  const payload = await verifyToken(env, token);
  const exp = payload?.exp;
  const now = Math.floor(Date.now() / 1000);
  if (typeof exp !== "number") {
    throw new Error("Token missing expiration");
  }
  if (exp < now) {
    throw new Error("Token expired");
  }

  if (!payload?.plan || typeof payload.plan !== "object") {
    throw new Error("Token missing campaign plan");
  }

  return payload.plan;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const tokenParam = url.searchParams.get("token");
    const headers = new Headers({
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store"
    });

    let plan = null;
    let errorMessage = null;

    if (tokenParam) {
      try {
        plan = await validatePlanToken(env, tokenParam);
      } catch (err) {
        errorMessage = err?.message || "Invalid token";
      }
    } else {
      errorMessage = "Token query parameter is required";
    }

    if (!plan) {
      const body = buildHtml(`<p>${escapeHtml(errorMessage || "Invalid or expired token.")}</p>`);
      return new Response(body, { status: 400, headers });
    }

    try {
      const iframeHtml = buildIframeHtml(plan);
      const body = buildHtml(iframeHtml);
      return new Response(body, { status: 200, headers });
    } catch (err) {
      const fallback = buildHtml(`<p>${escapeHtml(err?.message || "Unable to display campaign.")}</p>`);
      return new Response(fallback, { status: 400, headers });
    }
  }
};
