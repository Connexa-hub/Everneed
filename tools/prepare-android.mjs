#!/usr/bin/env node
/**
 * Apply Everneed's native Android permissions and AdMob metadata.
 * Idempotent: safe to run after Capacitor sync and in CI.
 */
import fs from "node:fs";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
if (!fs.existsSync(manifestPath)) {
  console.error("Android project not initialized. Run: npx cap add android");
  process.exit(1);
}

const manifest = fs.readFileSync(manifestPath, "utf8");
const permissions = [
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.POST_NOTIFICATIONS",
];
let updated = manifest;
for (const permission of permissions) {
  const line = `    <uses-permission android:name="${permission}" />`;
  if (!updated.includes(permission)) {
    updated = updated.replace(/<application\b/, `${line}\n    <application`);
  }
}

const config = fs.readFileSync("js/config.js", "utf8");
const match = config.match(/appId\s*:\s*"([^"]+)"/);
if (!match) throw new Error("Could not read AdMob app ID from js/config.js");
const appId = match[1];
const metadata = `        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${appId}" />`;
if (updated.includes("com.google.android.gms.ads.APPLICATION_ID")) {
  updated = updated.replace(/<meta-data[^>]*com\.google\.android\.gms\.ads\.APPLICATION_ID[^>]*\/>/, metadata);
} else {
  updated = updated.replace(/<\/application>/, `${metadata}\n    </application>`);
}
if (!updated.includes("com.google.android.gms.ads.APPLICATION_ID")) {
  throw new Error("Failed to insert AdMob application metadata");
}
fs.writeFileSync(manifestPath, updated);
console.log("Android manifest prepared (permissions and AdMob metadata).");
