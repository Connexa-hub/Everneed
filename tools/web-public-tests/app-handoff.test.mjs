// WEB-M10 tests for web/assets/js/app-handoff.js (loaded with a stub Core, as in the browser).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(new URL("../../web/assets/js/app-handoff.js", import.meta.url), "utf8");
// Values built inside the vm sandbox have that realm's Array prototype; compare plain JSON copies.
const plain = (x) => JSON.parse(JSON.stringify(x));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function load({ me = () => null, origShop } = {}) {
  const original = origShop || (() => ({ layout: "pub", html: "ORIGINAL", title: "Shop" }));
  const win = { Core: { V: { shop: original }, esc, me } };
  vm.runInNewContext(SRC, { window: win, URL, Array, Object, Boolean, RegExp, String });
  return { win, original };
}
const PLAY = { id: "play", url: "https://play.google.com/store/apps/details?id=com.everneed.store", verified: "2026-12-01" };
const GH = { id: "github", url: "https://github.com/Connexa-hub/Everneed/releases/tag/v1", verified: "2026-12-01" };

test("does nothing if Core.V.shop is missing", () => {
  const win = { Core: { V: {}, esc } };
  vm.runInNewContext(SRC, { window: win, URL });
  assert.equal(win.EVAppHandoff, undefined);
});

test("no destinations: honest 'not published yet' page, no external links, no cart or checkout", () => {
  const { win } = load();
  const p = win.Core.V.shop();
  assert.equal(p.layout, "pub");
  assert.match(p.html, /Not published yet/);
  assert.match(p.html, /href="\/early-access"/);
  assert.doesNotMatch(p.html, /target="_blank"/);
  assert.doesNotMatch(p.html, /Google Play|play\.google\.com|github\.com/);
  assert.doesNotMatch(p.html, /href="[^"]*(cart|checkout)/i);
});

test("visible(): Google Play first regardless of input order, one entry per platform", () => {
  const { win } = load();
  const v = win.EVAppHandoff.visible([GH, PLAY, { ...PLAY, url: PLAY.url + "&hl=en" }]);
  assert.deepEqual(plain(v.map((d) => d.id)), ["play", "github"]);
});

test("visible(): rejects everything that is not a verified, allow-listed https destination", () => {
  const { win } = load();
  const bad = [
    { ...PLAY, url: PLAY.url.replace("https:", "http:") },
    { ...PLAY, url: "https://play.google.com.evil.example/store/apps/details?id=com.everneed.store" },
    { ...PLAY, url: "https://play.google.com/store/apps/details?id=com.other.app" },
    { ...PLAY, url: "https://play.google.com/store/apps/details" },
    { ...PLAY, url: "https://user:pw@play.google.com/store/apps/details?id=com.everneed.store" },
    { ...PLAY, verified: undefined },
    { ...PLAY, verified: "yesterday" },
    { ...GH, url: "https://github.com/evil/Everneed/releases/tag/v1" },
    { ...GH, url: "https://github.com/Connexa-hub/Everneed" },
    { ...GH, url: "javascript:alert(1)" },
    { id: "appstore", url: "https://apps.apple.com/app/id1", verified: "2026-12-01" },
    { id: "__proto__", url: PLAY.url, verified: "2026-12-01" },
    { ...PLAY, url: PLAY.url + "&x=" + "a".repeat(400) },
    null, "https://play.google.com", 42,
  ];
  for (const b of bad) assert.deepEqual(plain(win.EVAppHandoff.visible([b])), [], JSON.stringify(b));
  assert.deepEqual(plain(win.EVAppHandoff.visible(undefined)), []);
  assert.deepEqual(plain(win.EVAppHandoff.visible("nope")), []);
});

test("page with verified destinations: Play is the primary button, links open safely, no 'not published' note", () => {
  const { win } = load();
  const html = win.EVAppHandoff.page([GH, PLAY]).html;
  assert.doesNotMatch(html, /Not published yet/);
  const links = [...html.matchAll(/<a class="btn ah-dl([^"]*)" data-ah="(\w+)" href="([^"]+)" target="_blank" rel="noopener noreferrer">([^<]+)<\/a>/g)];
  assert.deepEqual(links.map((m) => m[2]), ["play", "github"]);
  assert.equal(links[0][1], "");
  assert.equal(links[1][1], " o");
  assert.equal(links[0][3], PLAY.url);
});

test("signed-out visitors see Create an account; signed-in people see My account", () => {
  assert.match(load().win.Core.V.shop().html, /Create an account/);
  const signedIn = load({ me: () => ({ id: "u" }) }).win.Core.V.shop().html;
  assert.match(signedIn, /My account/);
  assert.doesNotMatch(signedIn, /Create an account/);
});

test("any error falls back to the original /shop page", () => {
  const { win, original } = load({ me: () => { throw new Error("boom"); } });
  assert.deepEqual(win.Core.V.shop(), original());
});

test("the page links to sellers and is decorative-art only (svg is aria-hidden)", () => {
  const html = load().win.Core.V.shop().html;
  assert.match(html, /href="\/sell"/);
  assert.match(html, /<svg class="ah-scene" viewBox="0 0 360 240" aria-hidden="true"/);
});
