export default {
  async fetch(request) {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    try {
      const campaigns = await fetch(
        "https://nandqoilqwsepborxkrz.supabase.co/rest/v1/campaigns?select=name,ad_url",
        {
          headers: {
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNTkwODAsImV4cCI6MjA2MDkzNTA4MH0.FU7khFN_ESgFTFETWcyTytqcaCQFQzDB6LB5CzVQiOg",
            Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTM1OTA4MCwiZXhwIjoyMDYwOTM1MDgwfQ.qpDZpRJq2Tk48QgUwY1RGQwf2f89Mo4UyEbgek-AyNk",
          },
        }
      ).then((r) => r.json());

      const campaign = campaigns.find((c) => c.name === id);
      if (!campaign || !campaign.ad_url) return new Response("Not found", { status: 404 });

      const encodedUrl = Buffer.from(campaign.ad_url).toString("base64");

      return new Response(
        `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#000">
    <script>
      try {
        const url = atob("${encodedUrl}");
        const a = document.createElement("a");
        a.href = url;
        a.rel = "nofollow noopener";
        a.target = "_blank";
        a.style.display = "none";
        a.innerText = "click";
        document.body.appendChild(a);

        const evt = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        });

        const canceled = !a.dispatchEvent(evt);
        console.log("Dispatched synthetic click:", !canceled);
      } catch (e) {
        console.error("Click failed:", e);
      }
    </script>
  </body>
</html>`,
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
          status: 200,
        }
      );
    } catch (err) {
      return new Response("Server error", { status: 500 });
    }
  },
};
