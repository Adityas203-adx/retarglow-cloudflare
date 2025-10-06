import assert from "node:assert/strict";
import { test } from "node:test";

import { verifyToken } from "../lib/token.js";

const supabaseModule = await import("../lib/supabase.js");
const workerModule = await import("../b.js");

async function withSupabaseStub(stub, fn) {
  const originalFrom = supabaseModule.supabase.from;
  supabaseModule.supabase.from = stub;
  try {
    await fn();
  } finally {
    supabaseModule.supabase.from = originalFrom;
  }
}

test("bootstrap response includes frame_src with token when ad plan found", { concurrency: false }, async () => {
  const eventsLogged = [];

  await withSupabaseStub((table) => {
    if (table === "campaigns") {
      return {
        select: () => ({
          order: async () => ({
            data: [
              {
                id: "cmp-123",
                status: true,
                ad_url: "https://ads.example.com/render?rid={{_r}}",
                iframe_width: 320,
                iframe_height: 50,
                iframe_style: "border:0;",
                iframe_attributes: { allow: "autoplay" }
              }
            ],
            error: null
          })
        })
      };
    }

    if (table === "events") {
      return {
        insert: async (rows) => {
          eventsLogged.push(...rows);
          return { error: null };
        }
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }, async () => {
    const request = new Request("https://bootstrap.example.com/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://bootstrap.example.com",
        Cookie: "",
        "user-agent": "Mozilla/5.0",
        "cf-connecting-ip": "203.0.113.1",
        "cf-ipcountry": "US"
      },
      body: JSON.stringify({})
    });

    const env = { SIGNING_SECRET: "test-secret" };

    const response = await workerModule.default.fetch(request, env, {
      waitUntil: () => {}
    });

    assert.equal(response.status, 200);
    const json = await response.json();

    assert.equal(json.success, true);
    assert.equal(typeof json.token, "string");
    assert(json.token.length > 0);
    assert.equal(typeof json.frame_src, "string");
    assert(json.frame_src.includes("?token="));

    const frameUrl = new URL(json.frame_src);
    assert.equal(frameUrl.origin, "https://bootstrap.example.com");
    assert.equal(frameUrl.pathname, "/frame");
    assert.equal(frameUrl.searchParams.get("token"), json.token);

    assert(eventsLogged.length > 0);
  });
});

test("bootstrap default iframe style keeps frame hidden when not provided", { concurrency: false }, async () => {
  await withSupabaseStub((table) => {
    if (table === "campaigns") {
      return {
        select: () => ({
          order: async () => ({
            data: [
              {
                id: "cmp-hidden",
                status: true,
                ad_url: "https://ads.example.com/render?rid={{_r}}",
                iframe_width: null,
                iframe_height: null,
                iframe_style: null,
                iframe_attributes: null
              }
            ],
            error: null
          })
        })
      };
    }

    if (table === "events") {
      return {
        insert: async () => ({ error: null })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }, async () => {
    const request = new Request("https://bootstrap.example.com/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://bootstrap.example.com",
        Cookie: ""
      },
      body: JSON.stringify({})
    });

    const env = { SIGNING_SECRET: "test-secret" };

    const response = await workerModule.default.fetch(request, env, {
      waitUntil: () => {}
    });

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(typeof json.token, "string");

    const decoded = await verifyToken(env, json.token);
    assert.equal(
      decoded?.plan?.style.includes("visibility:hidden"),
      true,
      "default iframe style keeps the bootstrap frame hidden"
    );
  });
});

test("bootstrap matches campaigns by domain rule on subdomains", { concurrency: false }, async () => {
  await withSupabaseStub((table) => {
    if (table === "campaigns") {
      return {
        select: () => ({
          order: async () => ({
            data: [
              {
                id: "cmp-789",
                status: true,
                audience_rules: { domain: "publisher.example" },
                ad_url: "https://ads.example.com/render?rid={{_r}}",
                iframe_width: 728,
                iframe_height: 90,
                iframe_style: null,
                iframe_attributes: null
              }
            ],
            error: null
          })
        })
      };
    }

    if (table === "events") {
      return {
        insert: async () => ({ error: null })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }, async () => {
    const payload = { u: "https://sub.publisher.example/articles?id=1" };
    const request = new Request("https://bootstrap.example.com/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://bootstrap.example.com"
      },
      body: JSON.stringify(payload)
    });

    const env = { SIGNING_SECRET: "test-secret" };
    const response = await workerModule.default.fetch(request, env, {
      waitUntil: () => {}
    });

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.success, true);
    assert.equal(typeof json.token, "string");

    const decoded = await verifyToken(env, json.token);
    assert.equal(decoded?.plan?.src.startsWith("https://ads.example.com"), true);
  });
});

test("bootstrap respects path segment in domain rule", { concurrency: false }, async () => {
  await withSupabaseStub((table) => {
    if (table === "campaigns") {
      return {
        select: () => ({
          order: async () => ({
            data: [
              {
                id: "cmp-path",
                status: true,
                audience_rules: { domain: "publisher.example/offers" },
                ad_url: "https://ads.example.com/path?rid={{_r}}",
                iframe_width: 160,
                iframe_height: 600,
                iframe_style: null,
                iframe_attributes: null
              }
            ],
            error: null
          })
        })
      };
    }

    if (table === "events") {
      return {
        insert: async () => ({ error: null })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }, async () => {
    const payload = { u: "https://publisher.example/offers/welcome" };
    const request = new Request("https://bootstrap.example.com/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://bootstrap.example.com"
      },
      body: JSON.stringify(payload)
    });

    const env = { SIGNING_SECRET: "test-secret" };
    const response = await workerModule.default.fetch(request, env, {
      waitUntil: () => {}
    });

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.success, true);
    assert.equal(typeof json.token, "string");

    const decoded = await verifyToken(env, json.token);
    assert.equal(decoded?.plan?.src.includes("path?rid="), true);
  });
});

test("bootstrap locates signing secret stored inside nested secrets bag", { concurrency: false }, async () => {
  await withSupabaseStub((table) => {
    if (table === "campaigns") {
      return {
        select: () => ({
          order: async () => ({
            data: [
              {
                id: "cmp-123",
                status: true,
                ad_url: "https://ads.example.com/render?rid={{_r}}",
                iframe_width: 300,
                iframe_height: 250,
                iframe_style: "border:0;",
                iframe_attributes: { allow: "autoplay" }
              }
            ],
            error: null
          })
        })
      };
    }

    if (table === "events") {
      return {
        insert: async () => ({ error: null })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }, async () => {
    const request = new Request("https://bootstrap.example.com/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://bootstrap.example.com",
        Cookie: ""
      },
      body: JSON.stringify({})
    });

    const env = { secrets: { SIGNING_SECRET: "test-secret" } };

    const response = await workerModule.default.fetch(request, env, {
      waitUntil: () => {}
    });

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.success, true);
    assert.equal(typeof json.token, "string");
    assert(json.token.length > 0);
  });
});

test("bootstrap response omits frame_src when token is not generated", { concurrency: false }, async () => {
  await withSupabaseStub((table) => {
    if (table === "campaigns") {
      return {
        select: () => ({
          order: async () => ({
            data: [],
            error: null
          })
        })
      };
    }

    if (table === "events") {
      return {
        insert: async () => ({ error: null })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }, async () => {
    const request = new Request("https://bootstrap.example.com/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://bootstrap.example.com",
        Cookie: "",
        "user-agent": "Mozilla/5.0",
        "cf-connecting-ip": "203.0.113.1",
        "cf-ipcountry": "US"
      },
      body: JSON.stringify({})
    });

    const env = { SIGNING_SECRET: "test-secret" };

    const response = await workerModule.default.fetch(request, env, {
      waitUntil: () => {}
    });

    assert.equal(response.status, 200);
    const json = await response.json();

    assert.equal(json.success, true);
    assert.equal(json.token, null);
    assert.equal("frame_src" in json, false);
  });
});

test("bootstrap gracefully falls back when signing secret is missing", { concurrency: false }, async () => {
  await withSupabaseStub((table) => {
    if (table === "campaigns") {
      return {
        select: () => ({
          order: async () => ({
            data: [
              {
                id: "cmp-456",
                status: true,
                ad_url: "https://ads.example.com/render?rid={{_r}}",
                iframe_width: 300,
                iframe_height: 250,
                iframe_style: "border:0;",
                iframe_attributes: { allow: "autoplay" }
              }
            ],
            error: null
          })
        })
      };
    }

    if (table === "events") {
      return {
        insert: async () => ({ error: null })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }, async () => {
    const request = new Request("https://bootstrap.example.com/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://bootstrap.example.com",
        Cookie: ""
      },
      body: JSON.stringify({})
    });

    const env = {}; // intentionally missing signing secret

    const response = await workerModule.default.fetch(request, env, {
      waitUntil: () => {}
    });

    assert.equal(response.status, 200);
    const json = await response.json();

    assert.equal(json.success, true);
    assert.equal(json.token, null);
    assert.equal("frame_src" in json, false);
  });
});

test("bootstrap token payload normalizes bigint values", { concurrency: false }, async () => {
  await withSupabaseStub((table) => {
    if (table === "campaigns") {
      return {
        select: () => ({
          order: async () => ({
            data: [
              {
                id: 987654321n,
                status: true,
                ad_url: "https://ads.example.com/render?rid={{_r}}",
                iframe_width: 728n,
                iframe_height: 90n,
                iframe_style: "border:0;",
                iframe_attributes: {
                  allow: "autoplay",
                  "data-campaign": 555n
                }
              }
            ],
            error: null
          })
        })
      };
    }

    if (table === "events") {
      return {
        insert: async () => ({ error: null })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }, async () => {
    const request = new Request("https://bootstrap.example.com/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://bootstrap.example.com",
        Cookie: ""
      },
      body: JSON.stringify({})
    });

    const env = { SIGNING_SECRET: "test-secret" };

    const response = await workerModule.default.fetch(request, env, {
      waitUntil: () => {}
    });

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.success, true);
    assert.equal(typeof json.token, "string");

    const payload = await verifyToken(env, json.token);
    assert.equal(payload.plan.campaignId, "987654321");
    assert.equal(payload.plan.width, 728);
    assert.equal(payload.plan.height, 90);
    assert.equal(payload.plan.attributes["data-campaign"], "555");
  });
});
