#!/usr/bin/env node
/**
 * Stage the seller workspace under /seller with native-only path isolation.
 * The public web source remains unchanged; the adapter is injected into the packaged copy.
 */
import fs from "node:fs";
import path from "node:path";

const src = "web";
const dest = "www/seller";
if (!fs.existsSync(path.join(src, "index.html"))) throw new Error("Seller workspace source web/index.html is missing");
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true, filter: (p) => !p.includes("/.git") && !p.includes("/node_modules") });

const bootstrap = `/* Native seller isolation adapter. */
window.EV_NATIVE_SELLER = true;
window.EV_SESSION_KEY = "en_sess";
`;
const sellerHtml = path.join(dest, "index.html");
let html = fs.readFileSync(sellerHtml, "utf8");
if (!html.includes("EV_NATIVE_SELLER")) html = html.replace("</head>", "<script>" + bootstrap + "</script></head>");

// Keep seller assets isolated from shopper assets. Rewrite only asset URL namespaces,
// not API paths or arbitrary root-relative routes.
for (const ext of [".html", ".css", ".js"]) {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(ext)) {
      let t = p === sellerHtml ? html : fs.readFileSync(p, "utf8");
      t = t.replace(/(["'(\\])\/?assets\//g, "$1/seller/assets/")
           .replace(/(["\'])\/?favicon\.(svg|png)/g, "$1/seller/favicon.$2");
      if (p === sellerHtml) html = t;
      fs.writeFileSync(p, t);
    }
  });
  walk(dest);
}
// Prefix seller-owned route links while keeping API and asset paths untouched.
const core = path.join(dest, "assets/js/core.js");
let c = fs.readFileSync(core, "utf8");
c = c.replace('function curPath(){return location.pathname.replace(/\\/+$/,"")||"/"}',
'function curPath(){var p=location.pathname.replace(/\\/+$/,"")||"/";return window.EV_NATIVE_SELLER&&p.indexOf("/seller")===0?(p.slice(7)||"/"):p}')
.replace('function norm(to){to=String(to||"/");if(to.indexOf("#/")===0)to=to.slice(1);if(to.charAt(0)!=="/")to="/"+to;return to}',
'function norm(to){to=String(to||"/");if(to.indexOf("#/")===0)to=to.slice(1);if(to.charAt(0)!=="/")to="/"+to;if(window.EV_NATIVE_SELLER&&to.indexOf("/seller/")!==0&&to!=="/seller")to="/seller"+(to==="/"?"":to);return to}')
.replace('function fixLinks(root){(root||document).querySelectorAll(\'a[href^="#/"]\').forEach(function(a){a.setAttribute("href",a.getAttribute("href").slice(1))})}',
'function fixLinks(root){(root||document).querySelectorAll(\'a[href]\').forEach(function(a){var h=a.getAttribute("href")||"";if(h.indexOf("#/")===0)h=h.slice(1);if(window.EV_NATIVE_SELLER&&h.charAt(0)==="/"&&h.indexOf("//")!==0&&!/^\\/(assets|seller\\/assets|fonts|rest|auth|storage|functions)\\//.test(h)&&!/[.][a-z0-9]{2,5}(?:[?#]|$)/i.test(h)&&h.indexOf("/seller/")!==0&&h!=="/seller")h="/seller"+(h==="/"?"":h);a.setAttribute("href",h)})}');
if (!c.includes('window.EV_NATIVE_SELLER&&p.indexOf("/seller")')) throw new Error("Could not inject route path adapter");
fs.writeFileSync(core, c);
fs.writeFileSync(sellerHtml, html);
console.log("Staged seller workspace under /seller with native-only asset and route prefix adapter.");
