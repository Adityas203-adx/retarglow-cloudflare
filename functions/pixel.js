import js from "../client/pixel.min.js?raw";

export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const url = new URL(request.url);
    const cid = url.searchParams.get("cid") || "default";

    return new Response(js.replace("__CID__", cid), { status: 200, headers });
  }
};
