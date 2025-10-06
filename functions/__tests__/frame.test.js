import assert from "node:assert/strict";
import { test } from "node:test";

import frame from "../frame.js";
import { encodeToken } from "../lib/token.js";

test("frame handler renders iframe when token is valid", { concurrency: false }, async () => {
  const env = { SIGNING_SECRET: "frame-secret" };
  const token = await encodeToken(env, {
    exp: Math.floor(Date.now() / 1000) + 60,
    plan: {
      src: "https://ads.example.com/banner",
      width: 300,
      height: 250,
      style: "border:0;",
      attributes: {
        title: "Ad Frame",
        allow: "autoplay"
      }
    }
  });

  const request = new Request(`https://retarglow.com/frame?token=${encodeURIComponent(token)}`);
  const response = await frame.fetch(request, env);

  assert.equal(response.status, 200);
  const html = await response.text();
  assert(html.includes("<iframe"));
  assert(html.includes("src=\"https://ads.example.com/banner\""));
  assert(html.includes("width=\"300\""));
  assert(html.includes("height=\"250\""));
  assert(html.includes("style=\"border:0;\""));
  assert(html.includes("allow=\"autoplay\""));
});

test("frame handler returns 400 when token is missing", { concurrency: false }, async () => {
  const env = { SIGNING_SECRET: "frame-secret" };
  const request = new Request("https://retarglow.com/frame");
  const response = await frame.fetch(request, env);

  assert.equal(response.status, 400);
  const html = await response.text();
  assert(html.includes("Token query parameter is required"));
});
