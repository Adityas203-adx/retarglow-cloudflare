import js from "../client/pixel.min.js";

export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const url = new URL(request.url);
    const cid = url.searchParams.get("cid") || "default";

    try {
      const body = js.replace("__CID__", cid);
      return new Response(body, { status: 200, headers });
    } catch (err) {
      return new Response("Failed to load pixel script", { status: 500, headers });
    }
  }
};
