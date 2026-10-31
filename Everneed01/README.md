> **Everneed01**: marketplace rebuild of EverNeed. The build plan is in `docs/EVERNEED_MARKETPLACE_PROMPT.md` (paste Part A plus one Phase block per session).
> Push to GitHub and get an APK: see `docs/GITHUB_SETUP.md`.

# EverNeed (Stage 1): Android app

Minimalist store app for groceries, electricals, accessories, skincare and more. Starts empty: no sample products.

## Get the app
1. Push this folder's contents to a GitHub repo (the `.github` folder must be at the repo root).
2. Open the **Actions** tab. The "Build Android app" run starts on every push (about 5-8 minutes).
3. When it is green, open the repo's **Releases** page, tap the newest build and download **EverNeed.apk** (a plain APK, no zip). Install it and allow "install unknown apps" when asked. The zipped copy is still under the run's **Artifacts**.

## Set up (js/config.js)
`adminEmail`, `whatsapp`, `bank`, `fee`, `freeFrom`, `collections`. Empty values hide that feature.

## Products and banners
- In the app: sign in with your admin email, then Me, then Manage store. Stage 1 saves these on that phone only.
- For every customer now, commit items to `data/products.json` and `data/banners.json`.
  Product: `{"id":"a1","name":"","col":"Skincare","price":0,"old":0,"stock":null,"img":"","desc":"","at":0}`
  Banner: `{"id":"b1","title":"","text":"","type":"event|promo|announcement","scope":"all|<collection>","priority":1,"from":"YYYY-MM-DD","to":"YYYY-MM-DD","link":"","img":""}`

## Banner logic (js/banners.js)
Home: every live admin banner plus one generated banner per collection. Collection screen: only that collection's banners. Admin priority 1-5 outranks all; ties go event, promo, notice.

## Payments (js/payments.js)
Bank transfer and WhatsApp work now. Card is a registered provider slot: Stage 3 adds Paystack (tokenized cards, automatic charging from the server).

## Roadmap
2 Supabase accounts and shared data · 3 Paystack · 4 multi-merchant marketplace (see docs/EVERNEED_MARKETPLACE_PROMPT.md) · 5 admin dashboard · 6 signed release build for Google Play

## Countries (Stage 1.1)
`js/config.js` holds one block per country: currency, locale, delivery fee, bank and WhatsApp, sign-in options and Terms/Privacy links. The country is guessed from the device region and timezone, confirmed at sign-up, and changeable in Settings. Products and banners can be limited with `"cty":["NG","GH"]` (empty = everywhere). Phone-code, Google and NIN sign-in are listed per country and go live with Supabase and a verification provider in Stage 2.

## Stage 2: shared backend (Supabase)
1. supabase.com, New project. In **SQL Editor**, run `supabase/schema.sql`.
2. Project Settings, API: copy the **Project URL** and **anon public key** into `supabase:{url,key}` in `js/config.js`. (The anon key is meant to be public; the database rules protect your data.)
3. Authentication, Providers, Email: for testing, turn off "Confirm email". For SMS sign-in, enable Phone and connect an SMS provider (e.g. Twilio).
4. Open the app, create your account, then run in SQL Editor: `update public.profiles set role='admin' where email='YOU@EXAMPLE.COM';`
5. Sign in again: Settings now shows Manage store, and products, banners and images you add are live for every customer. Orders are saved to the database and you see all of them.

Without keys the app still runs in local mode. Google and NIN sign-in are Stage 2b (they need a Google OAuth client and a verification provider account).

## Stage 3: card payments (Paystack)
The `paystack` function (supabase/functions/paystack) is already deployed. To switch it on:
1. paystack.com, create an account. Copy your **Secret key** (test key `sk_test_...` first) from Settings, API Keys.
2. Supabase, Edge Functions, Secrets: add `PAYSTACK_SECRET_KEY` with that key.
3. Paystack, Settings, API Keys & Webhooks: set the webhook URL to `https://zpgasfweaixwsktlueje.supabase.co/functions/v1/paystack`.
4. In the app: Manage store, Store setup, choose your country, turn **Cards (Paystack)** On, Save.
Customers then see "Card, bank or USSD" at checkout. The server recomputes every amount from your product prices, saves reusable cards as tokens only, and marks the order paid from Paystack's signed webhook.

## Regions, currency and checkout
- Prices are entered in the base currency (`baseCurrency` in js/config.js, NGN) and converted to each shopper's currency using daily rates from open.er-api.com. In Store setup you can add a markup % per country. If rates cannot be fetched, the app shows the base currency rather than a wrong price.
- Switching country changes currency, delivery rules and the payment methods on offer (bank transfer needs bank details for that country, cards need Paystack turned on for it).
- Checkout is two bottom sheets: confirm the delivery address (with the country), then review and pay. A saved address from another country is not reused.
- Card payments open Paystack's secure pop-up inside the app. Local currencies are NGN, GHS, KES and ZAR; other countries are charged in USD, which Paystack must enable on your account. The server recomputes every amount from product prices, delivery settings and its own exchange rate.

## Regulated goods
Before selling skincare or other regulated goods in Nigeria, check NAFDAC registration and import rules.

## Updating the app from GitHub
Every build is signed with the same key (keystore/debug.keystore) and gets a higher version number, so a new APK installs over the old one and keeps its data. Android will not update an app signed with a different key. If your phone still has an older EverNeed build, uninstall it once before installing this one.

## Home feed and ads
The home screen is a mixed two-column product feed ranked on the device from what the shopper views, adds to the cart and searches, plus closeness (products made in or shipped from their country or region rank higher). A promo or sponsored slot appears after every 8 products. Nothing leaves the phone and no advertising ID is read.
Google ads (AdMob): create an AdMob account, add the app, then set `ads` in js/config.js (appId, bannerId, enabled:true, test:false) and push. Until then the app uses Google's test ids and shows no ads. AdMob shows a small banner above the tab bar on Home and Shop only; AdMob cannot place ads inside the product grid in this kind of app, so the in-grid slots are your own promos.

## Options, size guide and payment flow
- Products can have colours and sizes. The shopper picks both; sizes that do not exist for the chosen colour (or are out of stock) are greyed out and disabled, and the same goes for colours. Cart lines can be edited from the cart (colour, size, quantity) and keep their options through sign-in and checkout. Stock is tracked per option for products you add yourself.
- Size charts have a type (clothing, shoes, bracelet, necklace, utensils or other). The guide draws a matching diagram, updates its callouts when a size is tapped, switches cm and inches, and shows EU, US and UK sizes when the chart has EU, US or UK columns.
- Card payments: the cart is only cleared once payment succeeds. Cancelling returns to the cart with a "Payment not finished" card (Continue payment or Cancel order). Cancelling an unpaid order puts its stock back. The postal code is optional; a default is filled in for carriers.
