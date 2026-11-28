// WEB-M07 tests for functions/_lib/seo.mjs. Run: node --test tools/web-public-tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_PAGES, PRIVATE_PREFIXES, normalizePath, productionOrigin, isProductionHost, pageMeta, robotsTxt, sitemapXml,
} from "../../functions/_lib/seo.mjs";

const U = (s) => new URL(s);
const PROD = { PUBLIC_SITE_ORIGIN: "https://shop.example.com" };

test("normalizePath", () => {
  assert.equal(normalizePath("/pricing/"), "/pricing");
  assert.equal(normalizePath(""), "/");
  assert.equal(normalizePath("//x//"), "/x");
  assert.equal(normalizePath("/"), "/");
});

test("productionOrigin accepts only a bare https origin", () => {
  assert.equal(productionOrigin(PROD), "https://shop.example.com");
  assert.equal(productionOrigin({ PUBLIC_SITE_ORIGIN: "https://shop.example.com/" }), "https://shop.example.com");
  for (const bad of [undefined, "", "http://shop.example.com", "https://shop.example.com/path", "https://a:b@shop.example.com", "https://shop.example.com?x=1", "not a url"]) {
    assert.equal(productionOrigin({ PUBLIC_SITE_ORIGIN: bad }), null, String(bad));
  }
  assert.equal(productionOrigin(undefined), null);
});

test("no production origin: every page on every host is noindex", () => {
  for (const host of ["https://everneed.pages.dev", "https://web-portal.everneed.pages.dev", "https://shop.example.com"]) {
    for (const path of Object.keys(PUBLIC_PAGES)) {
      const m = pageMeta(U(host + path), {});
      assert.equal(m.indexable, false);
      assert.equal(m.robots, "noindex,nofollow");
      assert.equal(m.xRobotsTag, "noindex, nofollow");
      assert.equal(m.canonical, null);
    }
    assert.equal(robotsTxt(U(host + "/robots.txt"), {}), "User-agent: *\nDisallow: /\n");
    assert.equal(sitemapXml(U(host + "/sitemap.xml"), {}), null);
  }
});

test("production host: public pages are indexable with their own canonical", () => {
  const m = pageMeta(U("https://shop.example.com/pricing/"), PROD);
  assert.equal(m.indexable, true);
  assert.equal(m.robots, "index,follow");
  assert.equal(m.xRobotsTag, null);
  assert.equal(m.canonical, "https://shop.example.com/pricing");
  assert.equal(m.title, PUBLIC_PAGES["/pricing"].title);
  assert.equal(pageMeta(U("https://shop.example.com/"), PROD).canonical, "https://shop.example.com/");
});

test("production host: private, unknown and look-alike routes stay noindex", () => {
  for (const path of ["/portal", "/portal/products", "/admin", "/account", "/sign-in", "/create-account", "/inbox/1", "/no-such-page", "/pricing/x"]) {
    const m = pageMeta(U("https://shop.example.com" + path), PROD);
    assert.equal(m.indexable, false, path);
    assert.equal(m.canonical, null, path);
    assert.equal(m.robots, "noindex,nofollow", path);
  }
});

test("a preview host never becomes indexable, and og tags use the request origin", () => {
  const m = pageMeta(U("https://web-portal.everneed.pages.dev/sell"), PROD);
  assert.equal(m.indexable, false);
  assert.equal(m.ogUrl, "https://web-portal.everneed.pages.dev/sell");
  assert.equal(m.ogImage, "https://web-portal.everneed.pages.dev/og-image.png");
  assert.equal(isProductionHost(U("https://web-portal.everneed.pages.dev/"), PROD), false);
});

test("robots.txt on production disallows private routes and links the sitemap", () => {
  const t = robotsTxt(U("https://shop.example.com/robots.txt"), PROD);
  assert.match(t, /^User-agent: \*\nAllow: \/\n/);
  for (const p of PRIVATE_PREFIXES) assert.ok(t.includes("Disallow: " + p + "\n"), p);
  assert.match(t, /Sitemap: https:\/\/shop\.example\.com\/sitemap\.xml\n/);
  assert.equal(robotsTxt(U("https://other.example.com/robots.txt"), PROD), "User-agent: *\nDisallow: /\n");
});

test("sitemap lists exactly the public pages and nothing private", () => {
  const x = sitemapXml(U("https://shop.example.com/sitemap.xml"), PROD);
  const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, Object.keys(PUBLIC_PAGES).length);
  assert.ok(locs.includes("https://shop.example.com/"));
  assert.ok(locs.includes("https://shop.example.com/shop"));
  for (const l of locs) for (const p of PRIVATE_PREFIXES) assert.ok(!l.includes(p), l);
  assert.equal(sitemapXml(U("https://other.example.com/sitemap.xml"), PROD), null);
});

test("every public page has a unique title and a description of sensible length", () => {
  const titles = new Set();
  for (const [p, page] of Object.entries(PUBLIC_PAGES)) {
    assert.ok(page.title.length > 0 && page.title.length <= 70, p + " title length " + page.title.length);
    assert.ok(page.description.length >= 40 && page.description.length <= 200, p + " description length " + page.description.length);
    assert.ok(!titles.has(page.title), "duplicate title " + p);
    titles.add(page.title);
  }
});
