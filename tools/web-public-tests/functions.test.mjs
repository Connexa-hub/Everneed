// WEB-M07: entry points behave (Node has Response but not HTMLRewriter, which also exercises the fail-safe path).
import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as robots } from "../../functions/robots.txt.js";
import { onRequestGet as sitemap } from "../../functions/sitemap.xml.js";
import { onRequest as middleware } from "../../functions/_middleware.js";

const PROD = { PUBLIC_SITE_ORIGIN: "https://shop.example.com" };
const req = (u, method = "GET") => new Request(u, { method });

test("robots.txt: Disallow everything without a production origin", async () => {
  const r = robots({ request: req("https://everneed.pages.dev/robots.txt"), env: {} });
  assert.equal(r.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(await r.text(), "User-agent: *\nDisallow: /\n");
});

test("sitemap.xml: 404 + noindex without a production origin, XML on production", async () => {
  const none = sitemap({ request: req("https://everneed.pages.dev/sitemap.xml"), env: {} });
  assert.equal(none.status, 404);
  assert.equal(none.headers.get("x-robots-tag"), "noindex");
  const ok = sitemap({ request: req("https://shop.example.com/sitemap.xml"), env: PROD });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.match(await ok.text(), /<urlset/);
});

test("middleware: non-HTML and non-GET responses pass through untouched", async () => {
  const js = new Response("x", { headers: { "content-type": "application/javascript" } });
  assert.equal(await middleware({ request: req("https://a.dev/assets/x.js"), env: {}, next: async () => js }), js);
  const html = new Response("<html></html>", { headers: { "content-type": "text/html" } });
  assert.equal(await middleware({ request: req("https://a.dev/sell", "POST"), env: {}, next: async () => html }), html);
});

test("middleware fail-safe: if HTML rewriting is unavailable the original response is returned", async () => {
  assert.equal(typeof globalThis.HTMLRewriter, "undefined");
  const html = new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
  const out = await middleware({ request: req("https://a.dev/sell"), env: {}, next: async () => html });
  assert.equal(out, html);
});
