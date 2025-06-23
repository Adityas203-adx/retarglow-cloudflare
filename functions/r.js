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

    const url = new URL(request.url);
    const _r = url.searchParams.get("id");

    if (!_r) {
      return new Response("Missing ID", { status: 400, headers });
    }

    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || !data.length) {
        return Response.redirect("https://google.com", 302);
      }

      const match = data.find((c) => c.status === "active");
      if (!match) {
        return Response.redirect("https://google.com", 302);
      }

      const target = match.ad_url.replace("{{_r}}", encodeURIComponent(_r));

      fetch(`https://track.ordozen.com/event?id=${_r}`).catch(() => {});

      return Response.redirect(target, 302);
    } catch (err) {
      return Response.redirect("https://google.com", 302);
    }
  }
};
