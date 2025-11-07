import { getSupabaseClient } from "./lib/supabase.js"

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": "application/json"
  }
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() })
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors() })
    }

    let supabase
    try {
      supabase = getSupabaseClient(env)
    } catch (err) {
      return new Response(JSON.stringify({ error: "Supabase not configured" }), {
        status: 500,
        headers: cors()
      })
    }

    try {
      const body = await req.json()
      const { cid, u, r, ua, dt, b, os, sr, cm } = body

      const ip = req.headers.get("cf-connecting-ip") || "unknown"
      const geo = {
        country: req.headers.get("cf-ipcountry") || null,
        region: null,
        city: null
      }

      const insert = {
        event: "viewPage",
        page_url: u,
        referrer: r,
        user_agent: ua,
        ip_address: ip,
        custom_id: cid || null,
        device_type: dt === "M" ? "Mobile" : "Desktop",
        browser: b || null,
        os: os || null,
        screen_resolution: sr || null,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        custom_metadata: cm || {},
        device_info: {
          device_type: dt === "M" ? "Mobile" : "Desktop",
          browser: b,
          os,
          screen_resolution: sr,
          ...cm
        },
        os_name: os,
        browser_name: b
      }

      const { data, error } = await supabase.from("events").insert([insert])
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: cors()
        })
      }

      return new Response(JSON.stringify({ message: "Logged", data }), {
        status: 200,
        headers: cors()
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: cors()
      })
    }
  }
}
