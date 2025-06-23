import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://nandqoilqwsepborxkrz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNTkwODAsImV4cCI6MjA2MDkzNTA4MH0.FU7khFN_ESgFTFETWcyTytqcaCQFQzDB6LB5CzVQiOg"
);

export default {
  async fetch(request) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      const { searchParams } = new URL(request.url);
      const _r = searchParams.get("id");
      const t = searchParams.get("t");

      if (!_r || !t) {
        return new Response("Missing ID or target", { status: 400, headers });
      }

      // Fetch active campaign from Supabase
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || !data.length) {
        return Response.redirect("https://google.com", 302);
      }

      const match = data.find(c => c.status === "TRUE");
      if (!match) {
        return Response.redirect("https://google.com", 302);
      }

      // Construct redirect target with hijacked UTM
      const targetUrl = new URL(decodeURIComponent(t));
      targetUrl.searchParams.set("utm_source", "retarglow");
      targetUrl.searchParams.set("utm_medium", "pixel");
      targetUrl.searchParams.set("utm_campaign", match.name || "default");
      targetUrl.searchParams.set("subid", _r);

      // Optional: fire competitor beacon (e.g. Ordozen)
      fetch(`https://track.ordozen.com/event?id=${_r}`).catch(() => {});

      return Response.redirect(targetUrl.toString(), 302);
    } catch (err) {
      return Response.redirect("https://google.com", 302);
    }
  }
};
