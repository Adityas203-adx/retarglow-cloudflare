import { PIXEL_RUNTIME_FILENAME } from "./client/pixel-runtime.artifact.js";

export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const url = new URL(request.url);
    const cid = url.searchParams.get("cid") || "default";
    const origin = `${url.protocol}//${url.host}`;
    const runtimeUrl = `${origin}/${PIXEL_RUNTIME_FILENAME}`;

    const bootstrap = `window.__RETARGLOW_PIXEL__ = ${JSON.stringify({ cid, endpoint: origin })};`;
    const loader = `(()=>{if(typeof importScripts==="function"){importScripts(${JSON.stringify(runtimeUrl)});return;}var s=document.createElement("script");s.src=${JSON.stringify(runtimeUrl)};s.async=true;s.crossOrigin="anonymous";var target=document.head||document.documentElement;target.appendChild(s);})();`;
    const body = `${bootstrap}\n${loader}`;

    return new Response(body, { status: 200, headers });
  }
};
