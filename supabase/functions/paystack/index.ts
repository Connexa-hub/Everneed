import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
// Local Paystack currencies by country; everyone else is charged in USD (needs USD enabled on the Paystack account).
const CUR: Record<string, string> = { NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR" };
const curOf = (cc: string) => CUR[cc] || "USD";
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

// The amount is always recomputed on the server from product prices, delivery settings and today's rate.
async function total(o: any, cur: string) {
  const ids = (o.items || []).map((i: any) => i.id);
  const { data: rows } = await db.from("products").select("id,price").in("id", ids);
  const price = new Map((rows || []).map((p: any) => [p.id, Number(p.price)]));
  let sub = 0;
  for (const i of o.items || []) {
    const p = price.get(i.id);
    if (p == null) throw new Error("A product in this order is no longer available.");
    sub += p * Number(i.qty);
  }
  const { data: s } = await db.from("settings").select("data").eq("id", o.country).maybeSingle();
  const mk = 1 + Number(s?.data?.fxMarkup || 0) / 100;
  const conv = cur === "NGN" ? sub : sub * (await rate(cur)) * mk;
  const fee = Number(s?.data?.fee || 0), free = Number(s?.data?.freeFrom || 0);
  return Math.round((conv + (fee > 0 && !(free > 0 && conv >= free) ? fee : 0)) * 100) / 100;
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
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!SK) return json({ error: "Card payments are not set up yet." }, 500);
  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature");
  if (sig) {
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
    if (b.action === "init" || b.action === "charge") {
      const { data: o } = await db.from("orders").select("*").eq("id", b.order_id).eq("user_id", u.user.id).maybeSingle();
      if (!o) return json({ error: "Order not found." }, 404);
      if (o.status === "paid") return json({ paid: true });
      const cur = curOf(o.country);
      const amt = Math.round((await total(o, cur)) * 100);
      await db.from("orders").update({ total: amt / 100, currency: cur }).eq("id", o.id);
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
