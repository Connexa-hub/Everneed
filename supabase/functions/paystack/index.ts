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

// Per-user rate limit backed by the rate_hit() SQL function (service role only).
async function allowed(uid: string, action: string, max: number, secs: number) {
  const { data, error } = await db.rpc("rate_hit", { p_user: uid, p_action: action, p_max: max, p_window_seconds: secs });
  return !error && data === true;
}

async function isAdmin(id: string) {
  const { data } = await db.from("profiles").select("role").eq("id", id).maybeSingle();
  return data?.role === "admin";
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
async function offersFor(country: string, coupon: string, existing = false) {
  const { data: auto } = await db.from("offers").select("*").is("code", null).eq("active", true);
  let list: any[] = auto || [];
  if (coupon) {
    const { data: c } = await db.from("offers").select("*").eq("code", coupon).eq("active", true).maybeSingle();
    // An order that already redeemed its code keeps the discount even when that was the last use.
    if (c && (existing || c.limit_uses == null || c.used < c.limit_uses)) list = list.concat([c]);
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
  const { amount, offer } = best(lines, await offersFor(o.country, o.coupon || "", !!o.id));
  const { data: s } = await db.from("settings").select("data").eq("id", o.country).maybeSingle();
  const k = cur === "NGN" ? 1 : (await rate(cur)) * (1 + Number(s?.data?.fxMarkup || 0) / 100);
  const net = (sub - amount) * k, fee = Number(s?.data?.fee || 0), free = Number(s?.data?.freeFrom || 0);
  const applied = fee > 0 && !(free > 0 && net >= free) ? fee : 0;
  const total = Math.round((net + applied) * 100) / 100;
  return { total, discount: Math.round(amount * k * 100) / 100, offer, k, base: amount, fee: applied };
}

async function settle(tx: any) {
  if (!tx || tx.status !== "success") return false;
  const oid = tx.metadata?.order_id;
  if (!oid) return false;
  const { data: o } = await db.from("orders").select("*").eq("id", oid).maybeSingle();
  if (!o) return false;
  if (o.status === "paid" || o.paid_at) return true;
  // o.total and o.currency were set by this function when the payment was started.
  if (!o.currency || tx.currency !== o.currency || tx.amount < Math.round(Number(o.total) * 100)) return false;
  const { error: ce } = await db.rpc("confirm_payment", { p_order: oid, p_reference: tx.reference, p_actor: null });
  if (ce) throw new Error(ce.message);
  const a = tx.authorization;
  if (a && a.reusable && a.authorization_code && o.user_id) {
    await db.from("cards").upsert({
      user_id: o.user_id, email: tx.customer?.email, brand: a.brand, last4: a.last4,
      exp: a.exp_month + "/" + a.exp_year, bank: a.bank, code: a.authorization_code,
    }, { onConflict: "code" });
  }
  return true;
}

// Charges the card the customer saved for pay-on-delivery orders.
async function chargeSaved(o: any) {
  if (!SK) throw new Error("Card payments are not set up yet.");
  const { data: c } = await db.from("cards").select("*").eq("id", o.card_id).eq("user_id", o.user_id).maybeSingle();
  if (!c) throw new Error("The saved card was not found.");
  const cur = curOf(o.country), pr = await price(o, cur), amt = Math.round(pr.total * 100);
  await db.from("orders").update({ total: amt / 100, currency: cur, discount: pr.discount }).eq("id", o.id);
  const { data: au } = await db.auth.admin.getUserById(o.user_id);
  const r = await ps("/transaction/charge_authorization", {
    email: au?.user?.email, amount: amt, currency: cur, authorization_code: c.code,
    reference: "en_" + o.id + "_" + Date.now(), metadata: { order_id: o.id, user_id: o.user_id },
  });
  if (!r.status) throw new Error(r.message);
  return await settle(r.data);
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

    if (b.action === "coupon") {
      if (!(await allowed(u.user.id, "coupon", 10, 60))) return json({ error: "Too many attempts. Please wait a minute." }, 429);
      const code = String(b.code || "").trim().toUpperCase().slice(0, 40);
      if (!code) return json({ offer: null });
      const { data: c } = await db.from("offers").select("*").eq("code", code).eq("active", true).maybeSingle();
      if (!c || (c.limit_uses != null && c.used >= c.limit_uses)) return json({ offer: null });
      const { code: _c, used: _u, at: _a, limit_uses: _l, ...pub } = c;
      return json({ offer: pub });
    }

    if (b.action === "create") {
      // Orders are created here so prices, offers, stock and totals come from the server, not the app.
      const items = (b.items || []).map((i: any) => ({ id: String(i.id), size: String(i.size || ""), qty: Math.floor(Number(i.qty)) }));
      if (!items.length || items.some((i: any) => !(i.qty > 0 && i.qty <= 50))) return json({ error: "Your cart is empty or has an invalid quantity." }, 400);
      const country = String(b.country || ""), cur = DISPLAY[country];
      if (!cur) return json({ error: "We do not deliver to that country yet." }, 400);
      const cust = b.cust || {};
      if (!cust.name || !cust.phone || !cust.street || !cust.city || !cust.state) return json({ error: "Please complete the delivery address." }, 400);
      const pm = String(b.pm || "");
      const status = ({ card: "awaiting_payment", bank: "awaiting_transfer", whatsapp: "sent", card_later: "awaiting_delivery" } as any)[pm];
      if (!status) return json({ error: "Choose a payment method." }, 400);
      const draft = { country, items, coupon: String(b.coupon || "").trim().toUpperCase().slice(0, 40) };
      if (draft.coupon && !(await allowed(u.user.id, "coupon", 10, 60))) return json({ error: "Too many attempts. Please wait a minute." }, 429);
      let card_id: string | null = null;
      if (pm === "card_later") {
        const { data: c } = await db.from("cards").select("id").eq("id", String(b.card_id || "")).eq("user_id", u.user.id).maybeSingle();
        if (!c) return json({ error: "Choose a saved card." }, 400);
        card_id = c.id;
      }
      const pr = await price(draft, cur);
      const { data: order, error } = await db.rpc("create_order", {
        p_user: u.user.id, p_items: items, p_country: country, p_pm: pm, p_cust: { ...cust, email: cust.email || u.user.email },
        p_k: pr.k, p_cur: cur, p_discount_base: pr.base,
        p_offer: pr.offer ? { id: pr.offer.id, code: pr.offer.code || null, name: pr.offer.name, kind: pr.offer.kind, value: pr.offer.value } : null,
        p_fee: pr.fee, p_card_id: card_id,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ order });
    }

    if (b.action === "received" || b.action === "charge_later" || b.action === "cancel") {
      const { data: o } = await db.from("orders").select("*").eq("id", b.order_id).maybeSingle();
      if (!o) return json({ error: "Order not found." }, 404);
      if (b.action === "received") {
        if (o.user_id !== u.user.id) return json({ error: "That is not your order." }, 403);
        if (!["shipped", "out_for_delivery"].includes(o.status)) return json({ error: "You can confirm delivery once the order is on its way." }, 400);
        const { error: re } = await db.rpc("confirm_received_for", { p_order: o.id, p_user: u.user.id });
        if (re) return json({ error: re.message }, 400);
        let charge: any = null;
        if (o.pm === "card_later" && !o.paid_at) {
          try { charge = { paid: await chargeSaved({ ...o, status: "delivered" }) }; } catch (e) { charge = { paid: false, error: String((e as Error).message || e) }; }
        }
        return json({ status: "delivered", received_at: Date.now(), charge });
      }
      if (!(await isAdmin(u.user.id))) return json({ error: "Admins only." }, 403);
      if (b.action === "charge_later") {
        if (o.pm !== "card_later") return json({ error: "This order is not pay-on-delivery." }, 400);
        return json({ paid: await chargeSaved(o) });
      }
      const { error: xe } = await db.rpc("cancel_order_for", { p_order: o.id, p_actor: u.user.id, p_reason: String(b.reason || "Cancelled by admin").slice(0, 300), p_admin: true });
      if (xe && o.status !== "cancelled") return json({ error: xe.message }, 400);
      return json({ status: "cancelled" });
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
