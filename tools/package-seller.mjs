#!/usr/bin/env node
/**
 * Stage the seller web workspace as a separate asset tree for Capacitor.
 * This intentionally does NOT activate seller routes yet: seller routes are root-relative
 * (/portal, /inbox, /me) and need the native route adapter before being launched safely.
 */
import fs from "node:fs";
import path from "node:path";

const src = "web";
const dest = "www/seller";
if (!fs.existsSync(path.join(src, "index.html"))) throw new Error("Seller workspace source web/index.html is missing");
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true, filter: (p) => !p.includes("/.git") && !p.includes("/node_modules") });

// A separate bootstrap lets the seller app share the shopper auth storage without
// leaking credentials into URLs. It is inert until the route adapter launches it.
const bootstrap = `/* Everneed native seller bundle bootstrap. */
window.EV_NATIVE_SELLER = true;
window.EV_SESSION_KEY = "en_sess";
`;
const sellerHtml = path.join(dest, "index.html");
let html = fs.readFileSync(sellerHtml, "utf8");
if (!html.includes("EV_NATIVE_SELLER")) {
  html = html.replace("</head>", "<script>" + bootstrap + "</script></head>");
}
fs.writeFileSync(sellerHtml, html);
console.log("Staged seller workspace at " + dest + " (not yet routable; route adapter is a separate step).");
