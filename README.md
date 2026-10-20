# EverNeed (Stage 1): Android app

Minimalist store app for groceries, electricals, accessories, skincare and more. Starts empty: no sample products.

## Get the app
1. Push this folder's contents to a GitHub repo (the `.github` folder must be at the repo root).
2. Open the **Actions** tab. The "Build Android app" run starts on every push (about 5-8 minutes).
3. When it is green, open the run, scroll to **Artifacts**, download **everneed-apk**, unzip it and install `app-debug.apk` on your phone (allow "install unknown apps" when asked).

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
2 Supabase accounts and shared data · 3 Paystack · 4 CJdropshipping/EPROLO sync · 5 admin dashboard · 6 signed release build for Google Play
