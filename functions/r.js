const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://nandqoilqwsepborxkrz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNTkwODAsImV4cCI6MjA2MDkzNTA4MH0.FU7khFN_ESgFTFETWcyTytqcaCQFQzDB6LB5CzVQiOg"
);

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  const _r = event.queryStringParameters?.id;

  if (!_r) {
    return {
      statusCode: 400,
      headers,
      body: "Missing ID"
    };
  }

  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data || !data.length) {
      return {
        statusCode: 302,
        headers: { Location: "https://google.com", ...headers },
        body: ""
      };
    }

    const match = data.find(c => c.status === "active");
    if (!match) {
      return {
        statusCode: 302,
        headers: { Location: "https://google.com", ...headers },
        body: ""
      };
    }

    const target = match.ad_url.replace("{{_r}}", encodeURIComponent(_r));
    
    fetch(`https://track.ordozen.com/event?id=${_r}`).catch(() => {});

    return {
      statusCode: 302,
      headers: {
        Location: target,
        ...headers
      },
      body: ""
    };

  } catch (err) {
    return {
      statusCode: 302,
      headers: { Location: "https://google.com", ...headers },
      body: ""
    };
  }
};
