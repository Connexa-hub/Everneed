import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ninja-event, x-ninja-delivery, x-ninja-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

class NinjaApiError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "NinjaApiError";
    this.status = status;
    this.code = code;
  }
}

const env = (name: string) => Deno.env.get(name) ?? "";
const supabaseUrl = env("SUPABASE_URL");
const anonKey = env("SUPABASE_ANON_KEY");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
const ninjaBase = env("NINJA_ENV") === "live"
  ? "https://api.ninja.boucloud.io"
  : "https://api.sandbox.ninja.boucloud.io";

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ninjaPost(path: string, payload: Record<string, unknown>) {
  const secretKey = env("NINJA_SECRET_KEY");
  if (!secretKey) throw new Error("Ninja secret key is not configured.");
  const response = await fetch(`${ninjaBase}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  let result: any = {};
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    // Do not log raw provider response text; it may contain sensitive data.
    result = {};
  }
  if (!response.ok) {
    const providerError = result?.error && typeof result.error === "object"
      ? result.error
      : {};
    const safeString = (value: unknown, max = 300) =>
      typeof value === "string" ? value.slice(0, max) : null;
    const providerType = safeString(result?.type ?? providerError?.type, 100);
    const providerCode = safeString(result?.code ?? providerError?.code, 100);
    const providerMessage = safeString(
      result?.message ?? providerError?.message ?? (typeof result?.error === "string" ? result.error : null),
      300,
    );
    console.error("Ninja API rejected request", {
      status: response.status,
      path,
      type: providerType,
      code: providerCode,
      message: providerMessage,
    });
    if (providerType === "individual_scope") {
      throw new NinjaApiError(
        "Ninja hosted verification is unavailable on this individual account. Ninja requires a registered business account for hosted KYC/KYB flows. Complete Ninja business onboarding or use a verification provider that supports your current account type.",
        409,
        providerType,
      );
    }
    throw new NinjaApiError(
      "Ninja rejected the hosted verification request. Check the Ninja account's permissions and flow configuration.",
      response.status >= 400 && response.status < 500 ? response.status : 502,
      providerType ?? providerCode,
    );
  }
  return result;
}

async function isValidSignature(raw: Uint8Array, signature: string, secret: string) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, raw));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  const expected = `hmac-sha256=${hex}`;
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function sha256(raw: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleWebhook(req: Request) {
  const raw = new Uint8Array(await req.arrayBuffer());
  const eventType = req.headers.get("x-ninja-event") ?? "";
  const signature = req.headers.get("x-ninja-signature") ?? "";
  const deliveryId = req.headers.get("x-ninja-delivery");
  const isKyb = eventType === "kyb_verification.completed";
  const isKyc = eventType === "verification.completed";
  if (!isKyb && !isKyc) return json({ received: true, ignored: true });

  const secret = isKyb ? env("NINJA_KYB_WEBHOOK_SECRET") : env("NINJA_KYC_WEBHOOK_SECRET");
  if (!(await isValidSignature(raw, signature, secret))) {
    return json({ error: "Invalid webhook signature." }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  const data = payload?.data ?? {};
  const storeId = typeof data.customer_ref === "string" ? data.customer_ref : "";
  const eventId = typeof payload.event_id === "string" ? payload.event_id : "";
  const verificationId = typeof data.verification_id === "string" ? data.verification_id : "";
  if (!storeId || !eventId || !verificationId) return json({ error: "Missing event identifiers." }, 400);

  const { data: store, error: storeError } = await admin
    .from("stores").select("id").eq("id", storeId).maybeSingle();
  if (storeError) return json({ error: "Unable to resolve verification owner." }, 500);
  if (!store) return json({ received: true, ignored: true });

  const checkType = isKyb ? "business_registration" : "identity";
  const sandbox = data.sandbox === true;
  const hash = await sha256(raw);
  const { error: insertError } = await admin.from("ninja_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    delivery_id: deliveryId,
    verification_id: verificationId,
    check_type: checkType,
    store_id: storeId,
    payload_sha256: hash,
    is_sandbox: sandbox,
    processing_status: sandbox ? "ignored" : "received",
  });

  if (insertError?.code === "23505") return json({ received: true, duplicate: true });
  if (insertError) {
    console.error("Could not record Ninja webhook event");
    return json({ error: "Could not record webhook event." }, 500);
  }
  if (sandbox) return json({ received: true, sandbox: true, applied: false });

  const outcome = typeof data.outcome === "string" ? data.outcome : "unknown";
  const status = outcome === "verified" ? "verified" : outcome === "review" ? "review" : "needs_attention";
  const completedAt = typeof data.completed_at === "string" ? data.completed_at : new Date().toISOString();
  const baseRow = {
    store_id: storeId,
    status,
    provider: "ninja",
    provider_verification_id: verificationId,
    provider_outcome: outcome,
    is_sandbox: false,
    completed_at: completedAt,
    safe_note: `Ninja hosted ${isKyb ? "KYB" : "KYC"} result: ${outcome}.`,
    updated_at: new Date().toISOString(),
  };

  const rows = isKyb
    ? [{ ...baseRow, check_type: "business_registration" }]
    : [
        { ...baseRow, check_type: "identity" },
        { ...baseRow, check_type: "face_liveness" },
      ];

  const { error: upsertError } = await admin.from("store_verification_checks").upsert(rows, {
    onConflict: "store_id,check_type",
  });
  if (upsertError) {
    await admin.from("ninja_webhook_events")
      .update({ processing_status: "failed", safe_error: "Verification status update failed." })
      .eq("event_id", eventId);
    console.error("Ninja webhook status update failed");
    return json({ error: "Verification result could not be applied." }, 500);
  }

  await admin.from("ninja_webhook_events")
    .update({ processing_status: "processed", processed_at: new Date().toISOString() })
    .eq("event_id", eventId);
  return json({ received: true, applied: true });
}

async function handleUserAction(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Invalid session." }, 401);

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === "create_kyc_flow" || action === "create_kyb_flow") {
    if (env("NINJA_ENV") !== "sandbox") return json({ error: "Flow creation is restricted to Ninja sandbox." }, 403);
    const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin");
    if (adminError || isAdmin !== true) return json({ error: "Administrator access required." }, 403);

    const configuredFlowId = env(action === "create_kyc_flow" ? "NINJA_KYC_FLOW_ID" : "NINJA_KYB_FLOW_ID");
    if (configuredFlowId) {
      return json({ created: false, already_configured: true, type: action === "create_kyc_flow" ? "kyc" : "kyb", flow_id: configuredFlowId });
    }
    const webhookUrl = `${supabaseUrl}/functions/v1/ninja-verification`;
    const branding = { display_name: "Everneed", primary_color: "#087F5B" };
    const flow = action === "create_kyc_flow"
      ? await ninjaPost("/api/flows", {
          name: "Everneed Seller KYC - Sandbox",
          id_types: ["nin"],
          selfie_required: true,
          liveness_required: true,
          rules: {
            allow_transposed_names: true,
            accept_score: 0.9,
            review_score: 0.6,
            min_age: 18,
            fields: [
              { field: "first_name", match: "name", required: true, source: "customer" },
              { field: "last_name", match: "name", required: true, source: "customer" },
              { field: "date_of_birth", match: "date", required: true, source: "customer" },
            ],
          },
          branding,
          redirect_url: "https://web-portal.everneed.pages.dev/portal?verification=returned",
          webhook_url: webhookUrl,
        })
      : await ninjaPost("/api/kyb-flows", {
          name: "Everneed Seller KYB - Sandbox",
          require_documents: false,
          require_director_ids: false,
          require_otp: false,
          branding,
          redirect_url: "https://web-portal.everneed.pages.dev/portal?verification=returned",
          webhook_url: webhookUrl,
        });

    const flowId = flow?.id ?? flow?.data?.id;
    if (typeof flowId !== "string") return json({ error: "Ninja created no flow ID. Check the Ninja sandbox API response in the provider dashboard." }, 502);
    return json({
      created: true,
      type: action === "create_kyc_flow" ? "kyc" : "kyb",
      flow_id: flowId,
      webhook_secret: flow?.webhook_secret ?? flow?.signing_secret ?? flow?.data?.webhook_secret ?? null,
      note: "Save the flow ID and reveal its webhook signing secret in Ninja Sandbox if it was not returned.",
    });
  }

  if (action !== "create_kyc_link" && action !== "create_kyb_link") {
    return json({ error: "Unsupported action." }, 400);
  }
  if (env("NINJA_ENV") !== "sandbox") return json({ error: "This endpoint is restricted to Ninja sandbox." }, 403);

  const storeId = typeof body?.store_id === "string" ? body.store_id.trim() : "";
  if (!storeId || storeId.length > 128) return json({ error: "A valid store_id is required." }, 400);

  const { data: store, error: storeError } = await admin
    .from("stores").select("id,owner_id,name").eq("id", storeId).maybeSingle();
  if (storeError || !store) return json({ error: "Store not found." }, 404);
  if (store.owner_id !== authData.user.id) return json({ error: "You do not own this store." }, 403);

  const { data: subscription } = await admin
    .from("store_subscriptions").select("plan_id,status")
    .eq("store_id", storeId).in("status", ["trialing", "active", "past_due"])
    .order("current_period_start", { ascending: false }).limit(1).maybeSingle();
  if (!subscription?.plan_id) return json({ error: "Choose an eligible seller plan first." }, 409);

  const { data: entitlement } = await admin.from("seller_plan_entitlements")
    .select("verification_included,verification_required_to_activate")
    .eq("plan_id", subscription.plan_id).maybeSingle();
  if (entitlement?.verification_included !== true) {
    return json({ error: "Your current plan does not include commercial verification." }, 403);
  }

  const isKyb = action === "create_kyb_link";
  const flowId = env(isKyb ? "NINJA_KYB_FLOW_ID" : "NINJA_KYC_FLOW_ID");
  if (!flowId) return json({ error: "The required Ninja sandbox flow is not configured yet." }, 503);

  const link = isKyb
    ? await ninjaPost(`/api/kyb-flows/${encodeURIComponent(flowId)}/links`, {
        customer_ref: storeId,
        ...(typeof body?.expected_name === "string" && body.expected_name.trim()
          ? { expected_name: body.expected_name.trim().slice(0, 160) } : {}),
      })
    : await ninjaPost(`/api/flows/${encodeURIComponent(flowId)}/links`, {
        customer_ref: storeId,
      });

  const linkUrl = link?.url ?? link?.data?.url;
  if (typeof linkUrl !== "string" || !linkUrl.startsWith("https://")) {
    return json({ error: "Ninja did not return a valid hosted verification link." }, 502);
  }

  const checkType = isKyb ? "business_registration" : "identity";
  const { data: existingCheck } = await admin.from("store_verification_checks")
    .select("status,updated_at").eq("store_id", storeId).eq("check_type", checkType).maybeSingle();
  if (existingCheck?.status === "pending" && existingCheck.updated_at
    && Date.now() - new Date(existingCheck.updated_at).getTime() < 60_000) {
    return json({ error: "A verification link was just created. Wait briefly before requesting another." }, 429);
  }
  const { error: checkError } = await admin.from("store_verification_checks").upsert({
    store_id: storeId,
    check_type: checkType,
    status: "pending",
    provider: "ninja",
    provider_outcome: "link_issued",
    is_sandbox: true,
    safe_note: "Ninja sandbox hosted verification link issued.",
    updated_at: new Date().toISOString(),
  }, { onConflict: "store_id,check_type" });
  if (checkError) {
    console.error("Could not record pending Ninja check");
    return json({ error: "Verification link was created but its status could not be recorded. Contact support before creating another." }, 500);
  }

  return json({
    url: linkUrl,
    expires_at: link?.expires_at ?? link?.data?.expires_at ?? null,
    sandbox: true,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Supabase function configuration is incomplete." }, 500);

  const isWebhook = req.headers.has("x-ninja-signature");
  try {
    return isWebhook ? await handleWebhook(req) : await handleUserAction(req);
  } catch (error) {
    if (error instanceof NinjaApiError) {
      console.error("Ninja verification request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return json({
        error: error.message,
        provider: "ninja",
        provider_code: error.code,
      }, error.status);
    }
    console.error("Ninja verification request failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: error instanceof Error ? error.message : "Unexpected verification error." }, 500);
  }
});
