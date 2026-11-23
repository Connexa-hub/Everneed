import fs from "node:fs";
import assert from "node:assert/strict";
assert.ok(fs.existsSync("www/seller/index.html"), "seller index staged");
assert.ok(fs.existsSync("www/seller/assets/js/ds-app.js"), "seller app shell asset staged");
assert.ok(fs.existsSync("www/seller/assets/css/ds.css"), "seller CSS staged");
const html=fs.readFileSync("www/seller/index.html","utf8");
assert.ok(html.includes('EV_SESSION_KEY = "en_sess"'), "shared session bootstrap present");
assert.ok(html.includes("EV_NATIVE_SELLER = true"), "native seller marker present");
console.log("Seller packaging checks passed");
