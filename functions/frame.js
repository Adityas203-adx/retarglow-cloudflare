import { base64UrlDecodeToString } from "./lib/token.js";

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
 * Decodes the plan query parameter and extracts the embedded campaign plan.
 *
 * @param {string} planParam
 * @returns {Record<string, any>}
 */
function extractPlanFromParam(planParam) {
  if (typeof planParam !== "string" || planParam.length === 0) {
    throw new Error("Plan query parameter is required");
  }

  let decoded;
  try {
    decoded = base64UrlDecodeToString(planParam);
  } catch (err) {
    throw new Error("Invalid plan encoding");
  }

  let envelope;
  try {
    envelope = JSON.parse(decoded);
  } catch (err) {
    throw new Error("Invalid plan payload");
  }

  const plan = envelope?.plan && typeof envelope.plan === "object"
    ? envelope.plan
    : envelope;

  if (!plan || typeof plan !== "object") {
    throw new Error("Plan payload missing campaign plan");
  }

  return plan;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const planParam = url.searchParams.get("plan");
    const headers = new Headers({
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store"
    });

    let plan = null;
    let errorMessage = null;

    try {
      plan = extractPlanFromParam(planParam);
    } catch (err) {
      errorMessage = err?.message || "Invalid plan";
    }

    if (!plan) {
      const body = buildHtml(`<p>${escapeHtml(errorMessage || "Invalid or expired plan.")}</p>`);
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
