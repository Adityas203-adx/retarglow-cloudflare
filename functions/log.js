import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  "https://nandqoilqwsepborxkrz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNTkwODAsImV4cCI6MjA2MDkzNTA4MH0.FU7khFN_ESgFTFETWcyTytqcaCQFQzDB6LB5CzVQiOg"
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
}

export async function onRequestPost(context) {
  const req = context.request
  const headers = req.headers
  const ip =
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0] ||
    "unknown"

  let country = headers.get("cf-ipcountry") || null

  try {
    const body = await req.json()
    const { cid, u, r, ua, dt, b, os, sr, cm } = body

    let region = null
    let city = null
    try {
      const res = await fetch(`https://ipinfo.io/${ip}?token=d9a93a74769916`)
      const geo = await res.json()
      country = geo.country || country
      region = geo.region || null
      city = geo.city || null
    } catch (geoErr) {
      console.warn("Geo lookup failed")
    }

    const { data, error } = await supabase.from("events").insert([
      {
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
        country,
        region,
        city,
        custom_metadata: cm || {},
        device_info: {
          device_type: dt === "M" ? "Mobile" : "Desktop",
          browser: b || null,
          os: os || null,
          screen_resolution: sr || null,
          ...cm
        },
        os_name: os || null,
        browser_name: b || null
      }
    ])

    if (error) {
      return new Response(
        JSON.stringify({ message: "Supabase insert error", error: error.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    try {
      const adRes = await fetch("https://retarglow.com/serve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ u, country, cm })
      })

      const { ad_url } = await adRes.json()
      if (ad_url) {
        await fetch(`https://retarglow.com/r?id=${encodeURIComponent(ad_url)}`)
      }
    } catch (e) {
      console.warn("Ad injection fallback failed")
    }

    return new Response(JSON.stringify({ message: "Logged", data }), {
      status: 200,
      headers: corsHeaders
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ message: "Invalid request", error: err.message }),
      { status: 400, headers: corsHeaders }
    )
  }
}

export async function onRequestOptions() {
  return new Response("", { status: 204, headers: corsHeaders })
}
