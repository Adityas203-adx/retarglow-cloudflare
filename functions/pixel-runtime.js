import { PIXEL_RUNTIME_FILENAME, PIXEL_RUNTIME_SOURCE } from "./client/pixel-runtime.artifact.js";

const CACHE_HEADERS = {
  "Content-Type": "application/javascript",
  "Cache-Control": "public, max-age=31536000, immutable",
  "Access-Control-Allow-Origin": "*"
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.endsWith(`/${PIXEL_RUNTIME_FILENAME}`) && url.pathname !== `/${PIXEL_RUNTIME_FILENAME}`) {
      return new Response("Not Found", { status: 404 });
    }

    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers: CACHE_HEADERS });
    }

    return new Response(PIXEL_RUNTIME_SOURCE, { status: 200, headers: CACHE_HEADERS });
  }
};
