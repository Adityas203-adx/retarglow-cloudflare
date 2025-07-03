export async function onRequestGet(context) {
  const SUPABASE_URL = "https://nandqoilqwsepborxkrz.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTM1OTA4MCwiZXhwIjoyMDYwOTM1MDgwfQ.qpDZpRJq2Tk48QgUwY1RGQwf2f89Mo4UyEbgek-AyNk";

  const { searchParams } = new URL(context.request.url);
  const encodedUrl = searchParams.get("u");

  if (!encodedUrl) {
    return new Response("Missing URL parameter", { status: 400 });
  }

  let targetUrl;
  try {
    targetUrl = atob(encodedUrl);
    if (!targetUrl.startsWith("https://site.pro")) {
      throw new Error("Invalid or disallowed target");
    }
  } catch {
    return new Response("Invalid or unsafe URL", { status: 400 });
  }

  // Fetch active campaigns from Supabase
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?status=eq.true`, { headers });
  const campaigns = await res.json();

  // Match by ad_url and domain
  const matched = campaigns.find(c => {
    const rules = c.audience_rules || {};
    const adUrl = c.ad_url || "";
    return rules.domain && targetUrl.includes(rules.domain) && adUrl === targetUrl;
  });

  const cid = matched?.id || "default";

  try {
    const upstream = await fetch(targetUrl);
    const contentType = upstream.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) return upstream;

    const originalHtml = await upstream.text();
    const injectedPixel = `<script src="https://retarglow.com/pixel?cid=${cid}" async></script>`;
    const modifiedHtml = originalHtml.replace(/<\/head>/i, `${injectedPixel}</head>`);

    return new Response(modifiedHtml, {
      status: upstream.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  } catch {
    return Response.redirect(targetUrl, 302); // fallback to raw page if injection fails
  }
}
