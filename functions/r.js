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

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const { searchParams } = new URL(request.url);
    const _r = searchParams.get("id");
    const t = searchParams.get("t");

    if (!_r || !t) return new Response("Missing ID or target", { status: 400, headers });

    try {
      const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      const match = data.find(c => c.status === true);

      if (!match) return Response.redirect("https://google.com", 302);

      const target = new URL(decodeURIComponent(t));
      target.searchParams.set("utm_source", "retarglow");
      target.searchParams.set("utm_medium", "pixel");
      target.searchParams.set("utm_campaign", match.name || "retarglow");
      target.searchParams.set("subid", _r);

      fetch(`https://track.ordozen.com/event?id=${_r}`).catch(() => {});
      return Response.redirect(target.toString(), 302);

    } catch {
      return Response.redirect("https://google.com", 302);
    }
  }
};
