import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const ALLOWED_HOST = (host: string) => host === "everneed.pages.dev" || host.endsWith(".everneed.pages.dev");
const json = (body: unknown, status: number, origin: string | null) => {
  const headers: Record<string,string> = { ...CORS_HEADERS, "Content-Type": "application/json" };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
};

async function verifyTurnstile(token: string, action: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY") || "";
  if (!secret) throw new Error("TURNSTILE_NOT_CONFIGURED");
  if (!token || token.length > 2048) return false;
  const form = new URLSearchParams({
    secret,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("TURNSTILE_UNAVAILABLE");
  const result = await response.json();
  return !!result.success && result.action === action &&
    typeof result.hostname === "string" && ALLOWED_HOST(result.hostname);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  let originAllowed = false;
  if (origin) {
    try { originAllowed = ALLOWED_HOST(new URL(origin).hostname); } catch { originAllowed = false; }
    if (!originAllowed) return json({ error: "Origin not allowed." }, 403, null);
  }
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: { ...CORS_HEADERS, ...(originAllowed && origin ? { "Access-Control-Allow-Origin": origin } : {}) },
  });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, originAllowed ? origin : null);

  try {
    const length = Number(req.headers.get("content-length") || "0");
    if (length > 8192) return json({ error: "Request too large." }, 413, originAllowed ? origin : null);
    const body = await req.json();
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400, originAllowed ? origin : null);

    // Supabase's API gateway supplies this forwarded client address. The database's existing
    // rate limiter consumes it from PostgREST request.headers; fail closed if it is unavailable.
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    if (!forwardedFor.trim()) return json({ error: "Request origin could not be validated." }, 400, originAllowed ? origin : null);

    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !serviceKey) return json({ error: "Service is not configured." }, 503, originAllowed ? origin : null);
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-forwarded-for": forwardedFor } },
    });

    const action = String(body.action || "");
    let rpc = "";
    let args: Record<string, unknown> = {};

    if (action === "waitlist") {
      const valid = await verifyTurnstile(String(body.token || ""), "waitlist");
      if (!valid) return json({ error: "Security check failed. Please try again." }, 403, originAllowed ? origin : null);
      rpc = "join_waitlist";
      args = {
        p_email: body.p_email, p_name: body.p_name ?? null, p_role: body.p_role ?? "shopper",
        p_country: body.p_country ?? null, p_interest: body.p_interest ?? null,
        p_source: body.p_source ?? "website",
      };
    } else if (action === "guest_open") {
      const valid = await verifyTurnstile(String(body.token || ""), "guest_open");
      if (!valid) return json({ error: "Security check failed. Please try again." }, 403, originAllowed ? origin : null);
      rpc = "support_guest_open";
      args = { p_id: body.p_id, p_name: body.p_name ?? null, p_topic: body.p_topic ?? null, p_page: body.p_page ?? null };
    } else if (action === "guest_ping") {
      rpc = "support_guest_ping";
      args = { p_id: body.p_id };
    } else if (action === "guest_close") {
      rpc = "support_guest_close";
      args = { p_id: body.p_id };
    } else {
      return json({ error: "Unknown action." }, 400, originAllowed ? origin : null);
    }

    const { data, error } = await db.rpc(rpc, args);
    if (error) {
      const limited = /too many attempts/i.test(error.message || "");
      return json({ error: limited ? "Too many attempts. Please wait and try again." : "We could not complete that request. Please try again." },
        limited ? 429 : 400, originAllowed ? origin : null);
    }
    return json({ ok: true, data }, 200, originAllowed ? origin : null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "TURNSTILE_NOT_CONFIGURED") return json({ error: "Security check is being configured. Please try again later." }, 503, originAllowed ? origin : null);
    if (message === "TURNSTILE_UNAVAILABLE") return json({ error: "Security check is temporarily unavailable. Please try again." }, 503, originAllowed ? origin : null);
    return json({ error: "We could not complete that request. Please try again." }, 500, originAllowed ? origin : null);
  }
});
