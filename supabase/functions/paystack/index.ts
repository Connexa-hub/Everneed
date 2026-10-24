import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
// Currencies Paystack charges locally; everyone else is charged in USD (needs USD enabled on the Paystack account).
const CUR: Record<string, string> = { NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR" };
const curOf = (cc: string) => CUR[cc] || "USD";
// Currency shoppers see in each country.
const DISPLAY: Record<string, string> = { NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR", GB: "GBP", US: "USD" };
const SK = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function ps(path: string, body?: unknown) {
  const r = await fetch("https://api.paystack.co" + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + SK, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

// Product prices are stored in the base currency (NGN). Rates are fetched here, never trusted from the app.
let FX: { t: number; rates: Record<string, number> } | null = null;
async function rate(cur: string) {
  if (cur === "NGN") return 1;
  if (!FX || Date.now() - FX.t > 36e5) {
    const r = await fetch("https://open.er-api.com/v6/latest/NGN");
    const j = await r.json();
    if (!j?.rates) throw new Error("Currency rates are unavailable. Try again shortly.");
    FX = { t: Date.now(), rates: j.rates };
  }
  const x = FX.rates[cur];
  if (!x) throw new Error("That currency is not supported.");
  return x;
}

// Offers that apply right now: automatic ones, plus the coupon the customer entered.
async function offersFor(country: string, coupon: string) {
  const { data: auto } = await db.from("offers").select("*").is("code", null).eq("active", true);
  let list: any[] = auto || [];
  if (coupon) {
    const { data: c } = await db.from("offers").select("*").eq("code", coupon).eq("active", true).maybeSingle();
    if (c && (c.limit_uses == null || c.used < c.limit_uses)) list = list.concat([c]);
  }
  const now = Date.now();
  return list.filter((o) =>
    (!o.starts || now >= Date.parse(o.starts)) && (!o.ends || now <= Date.parse(o.ends) + 864e5) &&
    (!o.cty?.length || o.cty.includes(country)));
}
// One offer applies per order: whichever saves the customer most.
function best(lines: { col: string; base: number }[], offers: any[]) {
  const sub = lines.reduce((a, l) => a + l.base, 0);
  let amount = 0, offer: any = null;
  for (const o of offers) {
    if (sub < Number(o.min_total || 0)) continue;
    const el = o.scope === "collection" ? lines.filter((l) => l.col === o.target).reduce((a, l) => a + l.base, 0) : sub;
    if (el <= 0) continue;
    const d = o.kind === "percent" ? el * Number(o.value) / 100 : Math.min(Number(o.value), el);
    if (d > amount) { amount = d; offer = o; }
  }
  return { amount: Math.round(amount * 100) / 100, offer };
}

// The price is always computed here from product prices, offers, delivery settings and today's rate.
async function price(o: any, cur: string) {
  const ids = (o.items || []).map((i: any) => i.id);
  const { data: rows } = await db.from("products").select("id,price,col").in("id", ids);
  const by = new Map((rows || []).map((p: any) => [p.id, p]));
  const lines: { col: string; base: number }[] = [];
  let sub = 0;
  for (const i of o.items || []) {
    const p: any = by.get(i.id);
    if (!p) throw new Error("A product in this order is no longer available.");
    const b = Number(p.price) * Number(i.qty);
    sub += b;
    lines.push({ col: p.col, base: b });
  }
  const { amount, offer } = best(lines, await offersFor(o.country, o.coupon || ""));
  const { data: s } = await db.from("settings").select("data").eq("id", o.country).maybeSingle();
  const k = cur === "NGN" ? 1 : (await rate(cur)) * (1 + Number(s?.data?.fxMarkup || 0) / 100);
  const net = (sub - amount) * k, fee = Number(s?.data?.fee || 0), free = Number(s?.data?.freeFrom || 0);
  const total = Math.round((net + (fee > 0 && !(free > 0 && net >= free) ? fee : 0)) * 100) / 100;
  return { total, discount: Math.round(amount * k * 100) / 100, offer, k };
}

async function settle(tx: any) {
  if (!tx || tx.status !== "success") return false;
  const oid = tx.metadata?.order_id;
  if (!oid) return false;
  const { data: o } = await db.from("orders").select("*").eq("id", oid).maybeSingle();
  if (!o) return false;
  if (o.status === "paid") return true;
  // o.total and o.currency were set by this function when the payment was started.
  if (!o.currency || tx.currency !== o.currency || tx.amount < Math.round(Number(o.total) * 100)) return false;
  await db.from("orders").update({ status: "paid", ref: tx.reference, paid_at: Date.now() }).eq("id", oid);
  const a = tx.authorization;
  if (a && a.reusable && a.authorization_code && o.user_id) {
    await db.from("cards").upsert({
      user_id: o.user_id, email: tx.customer?.email, brand: a.brand, last4: a.last4,
      exp: a.exp_month + "/" + a.exp_year, bank: a.bank, code: a.authorization_code,
    }, { onConflict: "code" });
  }
  // If the admin turned on automatic sending, hand the paid order to the CJ function.
  try {
    const { data: s } = await db.from("settings").select("data").eq("id", "cj").maybeSingle();
    if (s?.data?.auto) {
      await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/cj", {
        method: "POST",
        headers: { Authorization: "Bearer " + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forward", order_id: oid }),
      });
    }
  } catch (_) { /* the admin can still send the order by hand */ }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature");
  if (sig) {
    if (!SK) return json({ error: "not set up" }, 500);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SK), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex !== sig) return json({ error: "bad signature" }, 401);
    const ev = JSON.parse(raw);
    if (ev.event === "charge.success") await settle(ev.data);
    return json({ ok: true });
  }
  try {
    const tok = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await db.auth.getUser(tok);
    if (!u?.user) return json({ error: "Please sign in again." }, 401);
    const b = JSON.parse(raw || "{}");

    if (b.action === "create") {
      // Orders are created here so prices, offers and totals come from the server, not the app.
      const items = (b.items || []).map((i: any) => ({ id: String(i.id), size: String(i.size || ""), qty: Math.floor(Number(i.qty)) }));
      if (!items.length || items.some((i: any) => !(i.qty > 0 && i.qty <= 50))) return json({ error: "Your cart is empty or has an invalid quantity." }, 400);
      const country = String(b.country || ""), cur = DISPLAY[country];
      if (!cur) return json({ error: "We do not deliver to that country yet." }, 400);
      const cust = b.cust || {};
      if (!cust.name || !cust.phone || !cust.street || !cust.city || !cust.state) return json({ error: "Please complete the delivery address." }, 400);
      const status = ({ card: "awaiting_payment", bank: "awaiting_transfer", whatsapp: "sent" } as any)[String(b.pm || "")];
      if (!status) return json({ error: "Choose a payment method." }, 400);
      const draft = { country, items, coupon: String(b.coupon || "").trim().toUpperCase() };
      const { data: rows } = await db.from("products").select("id,name,price,stock,cty").in("id", items.map((i: any) => i.id));
      for (const i of items) {
        const p: any = (rows || []).find((x: any) => x.id === i.id);
        if (!p) return json({ error: "A product in your cart is no longer available." }, 400);
        if (p.cty?.length && !p.cty.includes(country)) return json({ error: p.name + " is not sold in your country." }, 400);
        if (p.stock != null && i.qty > p.stock) return json({ error: "Only " + p.stock + " of " + p.name + " left." }, 400);
      }
      const pr = await price(draft, cur);
      const dg = cur === "NGN" || cur === "KES" ? 0 : 2, unit = (base: number) => Math.round(base * pr.k * 10 ** dg) / 10 ** dg;
      const order = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), user_id: u.user.id,
        items: items.map((i: any) => { const p: any = (rows || []).find((x: any) => x.id === i.id); return { id: i.id, name: p.name, size: i.size, price: unit(Number(p.price)), qty: i.qty }; }),
        total: pr.total, discount: pr.discount, coupon: pr.offer?.code ? draft.coupon : null,
        offer: pr.offer ? { name: pr.offer.name, kind: pr.offer.kind, value: pr.offer.value } : null,
        country, currency: cur, pm: String(b.pm), cust: { ...cust, email: cust.email || u.user.email }, status, at: Date.now(),
      };
      const { error } = await db.from("orders").insert(order);
      if (error) return json({ error: error.message }, 400);
      if (pr.offer?.code) await db.from("offers").update({ used: Number(pr.offer.used || 0) + 1 }).eq("id", pr.offer.id);
      return json({ order });
    }

    if (!SK) return json({ error: "Card payments are not set up yet." }, 500);
    if (b.action === "init" || b.action === "charge") {
      const { data: o } = await db.from("orders").select("*").eq("id", b.order_id).eq("user_id", u.user.id).maybeSingle();
      if (!o) return json({ error: "Order not found." }, 404);
      if (o.status === "paid") return json({ paid: true });
      const cur = curOf(o.country);
      const pr = await price(o, cur);
      const amt = Math.round(pr.total * 100);
      await db.from("orders").update({ total: amt / 100, currency: cur, discount: pr.discount }).eq("id", o.id);
      const reference = "en_" + o.id + "_" + Date.now();
      const metadata = { order_id: o.id, user_id: u.user.id };
      if (b.action === "init") {
        const r = await ps("/transaction/initialize", { email: u.user.email, amount: amt, currency: cur, reference, metadata });
        if (!r.status) return json({ error: r.message }, 400);
        return json({ url: r.data.authorization_url, access_code: r.data.access_code, reference });
      }
      const { data: c } = await db.from("cards").select("*").eq("id", b.card_id).eq("user_id", u.user.id).maybeSingle();
      if (!c) return json({ error: "Card not found." }, 404);
      const r = await ps("/transaction/charge_authorization", { email: u.user.email, amount: amt, currency: cur, authorization_code: c.code, reference, metadata });
      if (!r.status) return json({ error: r.message }, 400);
      return json({ paid: await settle(r.data), status: r.data.status, message: r.data.gateway_response });
    }
    if (b.action === "verify") {
      const r = await ps("/transaction/verify/" + encodeURIComponent(b.reference));
      if (!r.status) return json({ error: r.message }, 400);
      if ((r.data.metadata || {}).user_id !== u.user.id) return json({ error: "Not your payment." }, 403);
      return json({ paid: await settle(r.data), status: r.data.status });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
