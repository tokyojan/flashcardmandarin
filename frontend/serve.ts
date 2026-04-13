import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { compress } from "hono/compress";
import { readFileSync } from "fs";

const app = new Hono();
app.use("*", compress());
const API_URL = process.env.API_URL || "http://server:3000";
const indexHtml = readFileSync("./dist/index.html", "utf-8");

// Proxy /api/* to backend (preserves cookies for auth)
app.all("/api/*", async (c) => {
  const url = new URL(c.req.url);
  const target = `${API_URL}${url.pathname}${url.search}`;

  const headers = new Headers();
  c.req.raw.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "host") headers.set(key, value);
  });

  const init: RequestInit = { method: c.req.method, headers };
  if (!["GET", "HEAD"].includes(c.req.method)) {
    init.body = await c.req.text();
  }

  const resp = await fetch(target, init);
  const respHeaders = new Headers(resp.headers);
  // Node fetch auto-decompresses; drop encoding headers so the browser doesn't try to decode again.
  respHeaders.delete("content-encoding");
  respHeaders.delete("content-length");
  return new Response(resp.body, { status: resp.status, headers: respHeaders });
});

// Static files from Vite build
app.use("/*", serveStatic({ root: "./dist" }));

// SPA fallback
app.get("/*", (c) => c.html(indexHtml));

serve({ fetch: app.fetch, port: 3888 }, () => {
  console.log("Frontend serving on http://localhost:3888");
});
