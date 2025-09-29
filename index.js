import log from "./functions/log.js";
import serve from "./functions/serve.js";
import r from "./functions/r.js";
import pixel from "./functions/pixel.js";
import pixelRuntime from "./functions/pixel-runtime.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Fixed route handlers
    if (path === "/log") return log.fetch(request, env, ctx);
    if (path === "/serve") return serve.fetch(request, env, ctx);
    if (path.startsWith("/pixel-runtime")) return pixelRuntime.fetch(request, env, ctx);

    // Dynamic campaign handlers
    if (path.startsWith("/pixel")) return pixel.fetch(request, env, ctx);
    if (path.startsWith("/r")) return r.fetch(request, env, ctx);

    return new Response("Not found", { status: 404 });
  },
};
