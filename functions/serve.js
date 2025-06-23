import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://nandqoilqwsepborxkrz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNTkwODAsImV4cCI6MjA2MDkzNTA4MH0.FU7khFN_ESgFTFETWcyTytqcaCQFQzDB6LB5CzVQiOg"
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const body = await request.json();
    const { u, country, cm } = body;
    const _r = cm?._r;

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return new Response(JSON.stringify({ ad_url: null }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    let selected = null;
    for (const row of data) {
      if (row.status !== "active") continue;
      if (row.countries?.length && !row.countries.includes(country)) continue;
      selected = row;
      break;
    }

    const adUrl = selected?.ad_url?.replace("{{_r}}", encodeURIComponent(_r)) || null;

    return new Response(JSON.stringify({ ad_url: adUrl }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
}
