import { PIXEL_CLIENT_SOURCE } from "./client/pixel-client.js";

export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };
    const url = new URL(request.url);
    const cid = url.searchParams.get("cid") || "default";
    const bootstrap = `window.__RETARGLOW_PIXEL__ = ${JSON.stringify({ cid })};`;
    const body = `${bootstrap}\n${PIXEL_CLIENT_SOURCE}`;

    return new Response(body, { status: 200, headers });
  }
};
