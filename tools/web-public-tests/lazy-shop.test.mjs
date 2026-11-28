// WEB-M10: the /shop handoff page is loaded on demand by ds-lazy.js, never in the eager bundle.
// Runs the REAL ds-lazy.js and the REAL app-handoff.js in one sandbox, the way the browser does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const LAZY = read("web/assets/js/ds-lazy.js");
const HANDOFF = read("web/assets/js/app-handoff.js");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* fail: "" | "js" | "css". Elements are completed asynchronously, like a network load. */
function setup({ fail = "", src = "/assets/js/ds-lazy.js", withShop = true } = {}) {
  const appended = [];
  const ctx = { URL, setTimeout, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { search: "" } };
  ctx.window = ctx;
  ctx.Core = { V: { portal: async (p) => ({ html: "plain:" + p[0] }) }, esc, me: () => null };
  if (withShop) ctx.Core.V.shop = () => ({ layout: "pub", html: "PLAIN SHOP", title: "Shop" });
  ctx.document = {
    currentScript: { src },
    createElement: (tag) => ({ tag }),
    head: {
      appendChild(el) {
        appended.push(el);
        setTimeout(() => {
          const isCss = el.tag === "link";
          if ((isCss && fail === "css") || (!isCss && fail === "js")) return el.onerror();
          if (!isCss) vm.runInContext(HANDOFF, ctx); // the browser would execute the downloaded script here
          el.onload();
        }, 0);
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(LAZY, ctx);
  return { ctx, appended };
}

test("without a shop view, ds-lazy.js registers nothing extra and does not throw", async () => {
  const { ctx, appended } = setup({ withShop: false });
  assert.equal(ctx.Core.V.shop, undefined);
  assert.equal((await ctx.Core.V.portal(["orders"])).html, "plain:orders");
  assert.equal(appended.length, 0);
});

test("other pages never load the handoff files", async () => {
  const { ctx, appended } = setup();
  await ctx.Core.V.portal(["orders"]);
  assert.equal(appended.length, 0);
});

test("/shop loads the stylesheet and script once, then renders the handoff page", async () => {
  const { ctx, appended } = setup();
  const r = await ctx.Core.V.shop();
  assert.match(r.html, /Not published yet/);
  assert.equal(r.title, "Shop in the app");
  assert.deepEqual(appended.map((e) => e.href || e.src).sort(), ["/assets/css/app-handoff.css", "/assets/js/app-handoff.js"]);
  const again = await ctx.Core.V.shop();
  assert.match(again.html, /Not published yet/);
  assert.equal(appended.length, 2, "files are not fetched twice");
});

test("a failed script download leaves the plain /shop page working", async () => {
  const { ctx } = setup({ fail: "js" });
  assert.equal((await ctx.Core.V.shop()).html, "PLAIN SHOP");
});

test("a failed stylesheet download also falls back to the plain /shop page", async () => {
  const { ctx } = setup({ fail: "css" });
  assert.equal((await ctx.Core.V.shop()).html, "PLAIN SHOP");
});

test("files load from the same folder as ds-lazy.js (works under /seller/assets/)", async () => {
  const { ctx, appended } = setup({ src: "/seller/assets/js/ds-lazy.js" });
  await ctx.Core.V.shop();
  assert.deepEqual(appended.map((e) => e.href || e.src).sort(), ["/seller/assets/css/app-handoff.css", "/seller/assets/js/app-handoff.js"]);
});

test("index.html never loads the handoff files eagerly (eager budget)", () => {
  const html = read("web/index.html");
  assert.doesNotMatch(html, /app-handoff/);
  assert.match(html, /ds-lazy\.js/);
});
