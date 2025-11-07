import { PIXEL_RUNTIME_FILENAME } from "./client/pixel-runtime.artifact.js";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cid = url.searchParams.get("cid") || "default";
    const origin = `${url.protocol}//${url.host}`;
    const runtimeUrl = `${origin}/${PIXEL_RUNTIME_FILENAME}`;

    const config = { cid, endpoint: origin };
    const bootstrap = `<!DOCTYPE html><meta charset=\"utf-8\"><script>(function(){var c=${JSON.stringify(config)};var w=window;w.__RETARGLOW_PIXEL__=c;var d=document;function l(){var s=d.createElement(\"script\");s.src=${JSON.stringify(runtimeUrl)};s.async=true;s.defer=true;s.crossOrigin=\"anonymous\";var t=d.head||d.documentElement;t&&t.appendChild(s);}if(d.readyState===\"loading\"){d.addEventListener(\"DOMContentLoaded\",l,{once:true});}else{l();}})();</script>`;

    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*"
    };

    return new Response(bootstrap, { status: 200, headers });
  }
};
