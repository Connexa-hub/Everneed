#!/usr/bin/env node
/**
 * Check the assembled seller bundle (tools/assemble-seller-bundle.mjs). Owner: Claude 2.
 * Fails if the bundle would not boot, would use the wrong Supabase project, or would not share the session.
 * Usage: BUILD_BRANCH=<branch> node tools/check-seller-bundle.mjs [--out www/seller]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = process.argv.slice(2);
const OUT = args.indexOf("--out") >= 0 ? args[args.indexOf("--out") + 1] : "www/seller";
const PREFIX = "/seller";
const LIVE_REF = "zpgasfweaixwsktlueje", STAGING_REF = "vjiadqygpyebpisxslbx";
const branch = process.env.BUILD_BRANCH || "local";
const isMain = branch === "main";
const errors = [];
const fail = (m) => errors.push(m);
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(OUT, p));

if (!exists("index.html")) { console.error("No bundle at " + OUT + ". Run tools/assemble-seller-bundle.mjs first."); process.exit(1); }
const html = read("index.html");

// 1. Every local reference in index.html resolves inside the bundle (this is the check that was missing).
const refs = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map((m) => m[1]);
const ALLOWED_OUTSIDE = new Set(["/js/build.js"]); // stamped by CI into the shopper app; same origin at run time
for (const r of refs) {
  if (/^(https?:|data:|mailto:|tel:|#)/.test(r)) continue;
  if (ALLOWED_OUTSIDE.has(r)) continue;
  if (!r.startsWith(PREFIX + "/")) { fail("index.html reference escapes the seller prefix: " + r); continue; }
  if (!exists(r.slice(PREFIX.length + 1).split(/[?#]/)[0])) fail("index.html references a file that is not in the bundle: " + r);
}
if (!refs.length) fail("index.html has no script or stylesheet references");

// 2. The shared files the page needs are present, and fonts.css resolves its font files.
for (const f of ["assets/js/config.js", "assets/js/supa.js", "assets/js/icons.js", "assets/js/art.js", "assets/js/geo.js",
  "assets/js/turnstile.js", "assets/js/theme.js", "assets/css/tokens.css", "assets/css/fonts.css", "native-env.js"]) {
  if (!exists(f)) fail("missing from bundle: " + f);
}
if (exists("assets/css/fonts.css")) {
  for (const m of read("assets/css/fonts.css").matchAll(/url\(([^)]+)\)/g)) {
    const u = m[1].replace(/["']/g, "");
    if (!/^(data:|https?:)/.test(u) && !fs.existsSync(path.join(OUT, "assets/css", u))) fail("fonts.css references a missing font: " + u);
  }
}

// 3. Script order: stamped build, then native bootstrap, then config, then supa.
const order = ["/js/build.js", PREFIX + "/native-env.js", PREFIX + "/assets/js/config.js", PREFIX + "/assets/js/supa.js"].map((s) => html.indexOf('src="' + s + '"'));
if (order.some((i) => i < 0) || order.some((v, i) => i && v < order[i - 1])) fail("script order must be build.js, native-env.js, config.js, supa.js");

// 4. Environment. Run the real config.js in a sandbox with a hostile page address.
function run(hostname, build) {
  const win = { BUILD: build };
  const ctx = vm.createContext({ window: win, location: { hostname }, document: undefined });
  if (exists("native-env.js")) vm.runInContext(read("native-env.js"), ctx);
  try { vm.runInContext(read("assets/js/config.js"), ctx); } catch (e) { return { error: String(e) }; }
  return win;
}
const staged = run("everneed.pages.dev", { branch: "web-portal" });      // a production-looking host must not win
if (staged.error || !staged.CFG) fail("config.js did not run for a staging build: " + (staged.error || "no CFG"));
else {
  if (staged.CFG.env !== "staging") fail("a non-main build must be staging, got " + staged.CFG.env);
  if (!String(staged.CFG.supabase && staged.CFG.supabase.url).includes(STAGING_REF)) fail("a non-main build must target the staging project");
}
const noBuild = run("everneed.pages.dev", undefined);                      // missing stamp must fail safe
if (noBuild.CFG && noBuild.CFG.env !== "staging") fail("a missing build stamp must fall back to staging");
if (isMain) {
  const live = run("localhost", { branch: "main" });                       // localhost host must not force staging on a release
  if (!live.CFG || live.CFG.env !== "live" || !String(live.CFG.supabase.url).includes(LIVE_REF)) fail("a main build must target the live project");
} else {
  // Issue #34: the staging bundle must contain the staging ref and no live project reference anywhere.
  const stack = [OUT];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (/\.(js|html|css|json|svg|txt)$/.test(e.name) && fs.readFileSync(p, "utf8").includes(LIVE_REF)) fail("live project reference found in non-main bundle: " + p);
    }
  }
}

// 5. One shared session with the shopper app.
if (exists("native-env.js") && !read("native-env.js").includes('EV_SESSION_KEY="en_sess"')) fail("native-env.js must set EV_SESSION_KEY to en_sess");
const storeSrc = fs.readFileSync("js/store.js", "utf8");
if (!/var K="en_"/.test(storeSrc)) fail("js/store.js key prefix changed; the shared session key en_sess may no longer match");

if (errors.length) { console.error("Seller bundle check FAILED:\n - " + errors.join("\n - ")); process.exit(1); }
console.log("Seller bundle check passed (branch " + branch + ", " + refs.length + " references resolved).");
