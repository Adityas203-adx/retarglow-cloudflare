const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://nandqoilqwsepborxkrz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNTkwODAsImV4cCI6MjA2MDkzNTA4MH0.FU7khFN_ESgFTFETWcyTytqcaCQFQzDB6LB5CzVQiOg"
);

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { u, country, cm } = body;
    const _r = cm?._r;

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ad_url: null })
      };
    }

    let selected = null;
    for (const row of data) {
      if (row.countries?.length && !row.countries.includes(country)) continue;
      if (row.status !== "active") continue;
      selected = row;
      break;
    }

    if (!selected) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ad_url: null })
      };
    }

    const adUrl = selected.ad_url.replace("{{_r}}", encodeURIComponent(_r));
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ad_url: adUrl })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
