import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://nandqoilqwsepborxkrz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNTkwODAsImV4cCI6MjA2MDkzNTA4MH0.FU7khFN_ESgFTFETWcyTytqcaCQFQzDB6LB5CzVQiOg"
);

export default {
  async fetch(req) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers });
    }

    try {
      const body = await req.json();
      const { u, country, cm } = body;
      const _r = cm?._r;

      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data) {
        console.log("Supabase fetch error:", error);
        return new Response(JSON.stringify({ ad_url: null }), {
          status: 200,
          headers,
        });
      }

      console.log("Incoming URL:", u);
      console.log("Incoming country:", country);
      console.log("All campaigns:", JSON.stringify(data));

      let selected = null;

      for (const row of data) {
        if (row.status !== "active") continue;

        // Country check
        if (Array.isArray(row.countries) && row.countries.length > 0) {
          if (!country || !row.countries.includes(country)) continue;
        }

        selected = row;
        break;
      }

      if (!selected) {
        console.log("No campaign matched");
        return new Response(JSON.stringify({ ad_url: null }), {
          status: 200,
          headers,
        });
      }

      const adUrl = selected.ad_url.replace("{{_r}}", encodeURIComponent(_r));
      console.log("Matched ad_url:", adUrl);

      return new Response(JSON.stringify({ ad_url: adUrl }), {
        status: 200,
        headers,
      });
    } catch (err) {
      console.error("Serve error:", err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers,
      });
    }
  },
};
