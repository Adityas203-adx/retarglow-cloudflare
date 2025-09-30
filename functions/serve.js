import { supabase } from "./lib/supabase.js";

export default {
  async fetch(req, env, ctx) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers });
    }

    try {
      const body = await req.json();
      const { u, cm } = body;
      const _r = cm?._r || "";

      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data) {
        return new Response(JSON.stringify({ ad_url: null }), { status: 200, headers });
      }

      let selected = null;

      for (const row of data) {
        if (row.status !== true) continue;

        const url = u || "";
        const domainRule = row.audience_rules?.domain;
        const regexRule = row.audience_rules?.regex;

        // Use regex if defined
        if (regexRule && !(new RegExp(regexRule).test(url))) continue;

        // Fallback to startsWith check if regex not defined
        if (!regexRule && domainRule && !url.startsWith(domainRule)) continue;

        selected = row;
        break;
      }

      if (!selected) {
        return new Response(JSON.stringify({ ad_url: null }), { status: 200, headers });
      }

      const finalUrl = selected.ad_url.replace("{{_r}}", encodeURIComponent(_r));
      return new Response(JSON.stringify({ ad_url: finalUrl }), { status: 200, headers });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers
      });
    }
  }
};
