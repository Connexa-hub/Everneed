import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const API = "https://developers.cjdropshipping.com/api2.0/v1";
const KEY = Deno.env.get("CJ_API_KEY") || "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(Deno.env.get("SUPABASE_URL")!, SVC);
const NAME: Record<string, string> = { NG: "Nigeria", GH: "Ghana", KE: "Kenya", ZA: "South Africa", GB: "United Kingdom", US: "United States" };

// CJ access token: cached in memory and in a private table (CJ limits how often tokens can be requested).
let mem: { t: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (mem && mem.exp > Date.now() + 6e4) return mem.t;
  const { data } = await db.from("kv").select("value").eq("key", "cj_token").maybeSingle();
  if (data?.value?.exp > Date.now() + 6e4) { mem = data.value; return mem!.t; }
  const r = await fetch(API + "/authentication/getAccessToken", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: KEY }) });
  const j = await r.json();
  if (!j?.data?.accessToken) throw new Error("CJ sign-in failed: " + (j?.message || "check the CJ API key"));
  mem = { t: j.data.accessToken, exp: Date.now() + 14 * 864e5 };
  await db.from("kv").upsert({ key: "cj_token", value: mem });
  return mem.t;
}
async function cj(path: string, body?: unknown) {
  const r = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: { "CJ-Access-Token": await token(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!(j.result === true || j.code === 200)) throw new Error("CJ: " + (j.message || "request failed"));
  return j.data;
}

let FX: { t: number; rates: Record<string, number> } | null = null;
async function perUsd(cur: string) {
  if (cur === "USD") return 1;
  if (!FX || Date.now() - FX.t > 36e5) {
    const j = await (await fetch("https://open.er-api.com/v6/latest/USD")).json();
    if (!j?.rates) throw new Error("Currency rates are unavailable. Try again shortly.");
    FX = { t: Date.now(), rates: j.rates };
  }
  const x = FX.rates[cur];
  if (!x) throw new Error("That currency is not supported.");
  return x;
}

const clean = (h: unknown) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const label = (s: unknown) => String(s || "").replace(/[|~"'<>\\]/g, "").trim();

// Search the CJ catalogue.
async function search(q: string, page: number) {
  const d = await cj("/product/listV2?keyWord=" + encodeURIComponent(q) + "&page=" + page + "&size=20");
  const l = d?.content?.[0]?.productList || d?.list || [];
  return l.map((p: any) => ({ pid: p.id, name: clean(p.nameEn), img: p.bigImage, price: Number(p.sellPrice), listed: p.listedNum }));
}

// Imports one CJ product into the store: price = (cost + shipping to Nigeria) x USD/NGN x (1 + margin).
async function importOne(pid: string, col: string) {
  const { data: ex } = await db.from("products").select("id").eq("supplier", "cj").eq("sup_pid", pid).maybeSingle();
  if (ex) throw new Error("That product is already imported.");
  const d = await cj("/product/query?pid=" + encodeURIComponent(pid));
  const vs = (d.variants || []).slice(0, 40);
  if (!vs.length) throw new Error("This product has no variants.");
  const fr = await cj("/logistic/freightCalculate", { startCountryCode: "CN", endCountryCode: "NG", products: [{ vid: vs[0].vid, quantity: 1 }] });
  const ship = (Array.isArray(fr) ? fr : []).filter((x: any) => x.logisticName).sort((a: any, b: any) => a.logisticPrice - b.logisticPrice)[0];
  if (!ship) throw new Error("CJ has no shipping to Nigeria for this product.");
  const cost = Math.min(...vs.map((v: any) => Number(v.variantSellPrice)));
  const { data: pr } = await db.from("settings").select("data").eq("id", "pricing").maybeSingle();
  const margin = Number(pr?.data?.margin ?? 50), step = Number(pr?.data?.round || 500), ngn = await perUsd("NGN");
  const price = Math.max(step, Math.ceil((cost + Number(ship.logisticPrice)) * ngn * (1 + margin / 100) / step) * step);
  let imgs: string[] = [];
  try { imgs = JSON.parse(d.productImage || "[]"); } catch (_) { /* single image */ }
  if (!imgs.length && d.bigImage) imgs = [d.bigImage];
  const multi = vs.length > 1;
  const row = {
    name: clean(d.productNameEn).slice(0, 90), col, price, old: 0, stock: null, cty: ["NG"], img: imgs[0] || "", images: imgs.slice(0, 8),
    descr: clean(d.description).slice(0, 600), supplier: "cj", sup_pid: pid, sup_cost: cost, sup_ship: Number(ship.logisticPrice),
    variants: vs.map((v: any) => ({ label: label(v.variantKey || v.variantNameEn || v.vid), vid: v.vid, sku: v.variantSku, cost: Number(v.variantSellPrice) })),
    opt: multi ? "Option" : null, sizes: multi ? vs.map((v: any) => label(v.variantKey || v.variantNameEn || v.vid)) : [], ship_days: ship.logisticAging || null,
  };
  const { data, error } = await db.from("products").insert(row).select("id,name,price").single();
  if (error) throw new Error(error.message);
  return data;
}

// Sends a paid order to CJ with the buyer's delivery address. Supplier cost and profit go to an admin-only table.
async function forward(o: any) {
  if (o.track?.cjOrderId) return o.track;
  const c = o.cust || {};
  if (!c.street || !c.city || !c.state) throw new Error("The delivery address needs a street, city and state.");
  const ids = [...new Set((o.items || []).map((i: any) => i.id))];
  const { data: ps } = await db.from("products").select("id,supplier,variants").in("id", ids);
  const lines: { vid: string; quantity: number }[] = [];
  for (const i of o.items || []) {
    const p = (ps || []).find((x: any) => x.id === i.id);
    if (!p || p.supplier !== "cj") continue;
    const vs = p.variants || [];
    const v = vs.find((x: any) => x.label === i.size) || (vs.length === 1 ? vs[0] : null);
    if (!v) throw new Error("No CJ variant matches " + i.name + (i.size ? " (" + i.size + ")" : "") + ".");
    lines.push({ vid: v.vid, quantity: Number(i.qty) });
  }
  if (!lines.length) throw new Error("This order has no CJ products.");
  const { data: s } = await db.from("settings").select("data").eq("id", "cj").maybeSingle();
  const pay = !!s?.data?.pay;
  const fr = await cj("/logistic/freightCalculate", { startCountryCode: "CN", endCountryCode: o.country, products: lines });
  const list = (Array.isArray(fr) ? fr : []).filter((x: any) => x.logisticName).sort((a: any, b: any) => a.logisticPrice - b.logisticPrice);
  if (!list.length) throw new Error("CJ has no shipping method to " + (NAME[o.country] || o.country) + " for these items.");
  const r = await cj("/shopping/order/createOrderV2", {
    orderNumber: o.id, shippingCountryCode: o.country, shippingCountry: NAME[o.country] || o.country,
    shippingProvince: c.state, shippingCity: c.city, shippingAddress: c.street, shippingCustomerName: c.name,
    shippingPhone: c.phone, shippingZip: c.zip || "", email: c.email || "", logisticName: list[0].logisticName,
    fromCountryCode: "CN", platform: "api", payType: pay ? 2 : 3,
    products: lines.map((l) => ({ ...l, storeLineItemId: o.id + "-" + l.vid })),
  });
  const costUsd = Number(r.actualPayment ?? r.orderAmount ?? 0) || Number(r.productAmount || 0) + Number(r.postageAmount || 0);
  const profit = Math.round((Number(o.total) - costUsd * (await perUsd(o.currency || "NGN"))) * 100) / 100;
  const track = { cjOrderId: r.orderId, cjStatus: r.orderStatus || (pay ? "UNSHIPPED" : "CREATED"), carrier: list[0].logisticName, paid: pay, sentAt: Date.now() };
  await db.from("orders").update({ track }).eq("id", o.id);
  await db.from("order_costs").upsert({ order_id: o.id, data: { costUsd, profit, currency: o.currency, productAmount: r.productAmount, postageAmount: r.postageAmount } });
  return track;
}

// Pulls the latest CJ status and tracking number, and moves the order to shipped or delivered.
async function refresh(o: any) {
  const t = o.track || {};
  if (!t.cjOrderId) throw new Error("This order has not been sent to CJ yet.");
  const d = await cj("/shopping/order/getOrderDetail?orderId=" + encodeURIComponent(t.cjOrderId));
  const next: any = { ...t, cjStatus: d.orderStatus, trackNumber: d.trackNumber || t.trackNumber, trackingUrl: d.trackingUrl || t.trackingUrl, carrier: d.logisticName || t.carrier, checkedAt: Date.now() };
  if (next.trackNumber) {
    try {
      const e = await cj("/logistic/trackInfo?trackNumber=" + encodeURIComponent(next.trackNumber));
      const arr = Array.isArray(e) ? (e[0]?.trackDetails || e) : (e?.trackDetails || []);
      next.events = (arr || []).slice(0, 15);
    } catch (_) { /* tracking events are optional */ }
  }
  const patch: any = { track: next };
  if (d.orderStatus === "SHIPPED" && o.status === "paid") patch.status = "shipped";
  if (d.orderStatus === "DELIVERED" && ["paid", "shipped"].includes(o.status)) patch.status = "delivered";
  await db.from("orders").update(patch).eq("id", o.id);
  return { track: next, status: patch.status || o.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!KEY) return json({ error: "CJ is not connected yet. Add CJ_API_KEY in the Supabase function secrets." }, 500);
  try {
    const raw = await req.text();
    const b = raw ? JSON.parse(raw) : {};
    if (new URL(req.url).searchParams.get("hook")) {
      // CJ webhook: find the order the message is about and refresh it. Nothing in the message is trusted.
      const num = b?.params?.orderNumber || b?.orderNumber || b?.params?.orderNum || b?.orderNum || b?.params?.cjOrderId || b?.orderId;
      if (num) {
        const { data: o } = await db.from("orders").select("*").or("id.eq." + num + ",track->>cjOrderId.eq." + num).limit(1).maybeSingle();
        if (o?.track?.cjOrderId) await refresh(o);
      }
      return json({ ok: true });
    }
    const tok = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const system = tok === SVC;
    let uid: string | null = null, admin = system;
    if (!system) {
      const { data: u } = await db.auth.getUser(tok);
      if (!u?.user) return json({ error: "Please sign in again." }, 401);
      uid = u.user.id;
      const { data: p } = await db.from("profiles").select("role").eq("id", uid).maybeSingle();
      admin = p?.role === "admin";
    }
    if (b.action === "search" || b.action === "import") {
      if (!admin) return json({ error: "Only the store admin can import products." }, 403);
      if (b.action === "search") return json({ items: await search(String(b.q || ""), Number(b.page || 1)) });
      return json({ product: await importOne(String(b.pid), String(b.col || "")) });
    }
    const { data: o } = await db.from("orders").select("*").eq("id", b.order_id).maybeSingle();
    if (!o) return json({ error: "Order not found." }, 404);
    if (b.action === "forward") {
      if (!admin) return json({ error: "Only the store admin can send orders to CJ." }, 403);
      if (o.status !== "paid") return json({ error: "Mark the order paid before sending it to CJ." }, 400);
      return json({ track: await forward(o) });
    }
    if (b.action === "refresh") {
      if (!admin && o.user_id !== uid) return json({ error: "That is not your order." }, 403);
      return json(await refresh(o));
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
