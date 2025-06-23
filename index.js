// Unified Worker Entry: index.js
import log from "./functions/log.js";
import serve from "./functions/serve.js";
import r from "./functions/r.js";
import pixel from "./functions/pixel.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/log") return log.fetch(request, env, ctx);
    if (path === "/serve") return serve.fetch(request, env, ctx);
    if (path === "/r") return r.fetch(request, env, ctx);

    // Handle both /pixel and /pixel.js
    if (path === "/pixel" || path === "/pixel.js") {
      return pixel.fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
