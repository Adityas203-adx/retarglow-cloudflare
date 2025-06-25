export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "text/html",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      const url = new URL(request.url);
      const _r = url.searchParams.get("id");
      const t = url.searchParams.get("t");

      if (!_r || !t) {
        return new Response("<!-- missing id or target -->", { status: 200, headers });
      }

      const target = new URL(decodeURIComponent(t));
      target.searchParams.set("utm_source", "retarglow");
      target.searchParams.set("utm_medium", "pixel");
      target.searchParams.set("utm_campaign", "default"); // optional: dynamic per campaign
      target.searchParams.set("subid", _r);

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#fff;height:100%;}</style>
</head><body>
<iframe src="${target.toString()}" style="width:0;height:0;border:0;opacity:0;" referrerpolicy="no-referrer"></iframe>
</body></html>`;

      return new Response(html, { status: 200, headers });
    } catch (err) {
      return new Response("<!-- error -->", { status: 200, headers });
    }
  }
};
