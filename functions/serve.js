// serve.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://nandqoilqwsepborxkrz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNTkwODAsImV4cCI6MjA2MDkzNTA4MH0.FU7khFN_ESgFTFETWcyTytqcaCQFQzDB6LB5CzVQiOg"
);

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

      // Parse rules if stored as strings
      data.forEach(row => {
        if (typeof row.audience_rules === 'string') {
          try {
            row.audience_rules = JSON.parse(row.audience_rules);
          } catch (e) {
            row.audience_rules = {};
          }
        }
      });

      // Normalize domain hostname for loose matching
      const normalize = url => {
        try {
          return new URL(url).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      };

      const currentDomain = normalize(u);
      let selected = null;

      for (const row of data) {
        if (!row.status) continue;

        const domainRule = row.audience_rules?.domain;
        if (domainRule) {
          const ruleDomain = normalize(domainRule);
          if (!ruleDomain || ruleDomain !== currentDomain) continue;
        }

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
