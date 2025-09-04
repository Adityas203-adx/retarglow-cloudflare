import { readFileSync } from "node:fs";

// Read the pixel asset at build time so deployment fails fast if missing
const js = readFileSync(new URL("../client/pixel.min.js", import.meta.url), "utf8");

export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    const url = new URL(request.url);
    const cid = url.searchParams.get("cid") || "default";

    try {
      if (typeof js !== "string") {
        throw new Error("Pixel script missing");
      }

      const body = js.replace("__CID__", cid);
      return new Response(body, { status: 200, headers });
    } catch (err) {
      const fallback = "console.error('Failed to load pixel script');";
      return new Response(fallback, { status: 500, headers });
    }
  }
};
