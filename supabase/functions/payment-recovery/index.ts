import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PAYSTACK_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
const db = createClient(URL, SERVICE_KEY);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function verifyPaystack(reference: string) {
  const r = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), {
    method: "GET",
    headers: { Authorization: "Bearer " + PAYSTACK_KEY, Accept: "application/json" },
  });
  if (!r.ok) throw new Error("Paystack verification returned HTTP " + r.status);
  const body = await r.json();
  if (body?.status !== true || body?.data?.status !== "success") return null;
  const tx = body.data;
  if (String(tx.reference || "") !== reference) throw new Error("Paystack returned a different transaction reference.");
  if (!Number.isSafeInteger(Number(tx.amount)) || Number(tx.amount) <= 0) {
    throw new Error("Paystack returned an invalid transaction amount.");
  }
  if (!/^[A-Z]{3}$/.test(String(tx.currency || "").toUpperCase())) {
    throw new Error("Paystack returned an invalid transaction currency.");
  }
  return tx;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "Method not allowed." }, 405);
  if (!URL || !SERVICE_KEY || !PAYSTACK_KEY) return response({ error: "Recovery worker is not configured." }, 500);

  // Supabase's gateway validates this service-role JWT before the function runs.
  // Requiring the same configured credential here is defense in depth.
  if (req.headers.get("Authorization") !== "Bearer " + SERVICE_KEY) {
    return response({ error: "Unauthorized." }, 401);
  }

  let batchSize = 20;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.batch_size !== undefined) batchSize = Number(body.batch_size);
  } catch {
    return response({ error: "Invalid request body." }, 400);
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) {
    return response({ error: "batch_size must be an integer from 1 to 50." }, 400);
  }

  const { data: events, error: claimError } = await db.rpc("claim_provider_event_recovery", {
    p_batch_size: batchSize,
    p_lease_seconds: 180,
    p_max_attempts: 8,
  });
  if (claimError) {
    console.error("Recovery claim failed:", claimError.message);
    return response({ error: "Could not claim recovery events." }, 500);
  }

  const summary = { claimed: (events || []).length, processed: 0, quarantined: 0, retry: 0, lease_lost: 0 };

  for (const event of events || []) {
    let status: "processed" | "retry" | "quarantined" = "retry";
    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    try {
      if (event.signature_verified !== true) {
        status = "quarantined";
        errorCode = "unverified_inbox_event";
        errorMessage = "Recovery worker refused an event without a verified provider signature.";
      } else if (event.event_type !== "charge.success") {
        status = "processed";
      } else if (!event.provider_reference) {
        status = "quarantined";
        errorCode = "missing_provider_reference";
        errorMessage = "Successful-charge event has no provider reference.";
      } else {
        const tx = await verifyPaystack(String(event.provider_reference));
        if (!tx) {
          status = "retry";
          errorCode = "provider_transaction_not_yet_successful";
          errorMessage = "Paystack verification has not yet confirmed a successful transaction.";
        } else if (
          event.provider_transaction_id &&
          String(tx.id) !== String(event.provider_transaction_id)
        ) {
          status = "quarantined";
          errorCode = "provider_transaction_id_mismatch";
          errorMessage = "Verified transaction ID differs from the signed webhook event.";
        } else {
          const { data: context, error: contextError } = await db.rpc("get_payment_attempt_recovery_context", {
            p_provider_reference: String(tx.reference),
          });
          if (contextError) throw new Error(contextError.message);
          if (
            !context ||
            String(tx.metadata?.order_id || "") !== String(context.order_id) ||
            String(tx.metadata?.user_id || "") !== String(context.user_id) ||
            String(tx.metadata?.payment_attempt_id || "") !== String(context.attempt_id) ||
            Number(tx.amount) !== Number(context.amount_minor) ||
            String(tx.currency || "").toUpperCase() !== String(context.currency || "").toUpperCase()
          ) {
            status = "quarantined";
            errorCode = "provider_attempt_context_mismatch";
            errorMessage = "Verified Paystack metadata or amount does not match the persisted payment attempt.";
          } else {
            const { data: settlement, error: settleError } = await db.rpc("settle_verified_payment_attempt", {
              p_provider_reference: String(tx.reference),
              p_provider_transaction_id: String(tx.id),
              p_amount_minor: Number(tx.amount),
              p_currency: String(tx.currency).toUpperCase(),
            });
            if (settleError) throw new Error(settleError.message);
            const result = String(settlement?.result || "");
            if (["paid", "already", "already_settled"].includes(result)) {
              status = "processed";
            } else {
              status = "quarantined";
              errorCode = "settlement_" + (result || "unconfirmed");
              errorMessage = "Verified provider payment requires manual reconciliation.";
            }
          }
        }
      }
    } catch (error) {
      status = "retry";
      errorCode = "recovery_processing_error";
      errorMessage = String((error as Error)?.message || error).slice(0, 240);
    }

    const { data: completed, error: finishError } = await db.rpc("finish_provider_event_recovery", {
      p_event_id: event.event_id,
      p_lease_token: event.lease_token,
      p_processing_status: status,
      p_error_code: errorCode,
      p_error_message: errorMessage,
      p_max_attempts: 8,
    });
    if (finishError || completed !== true) {
      summary.lease_lost++;
      console.error("Could not finish recovery lease:", finishError?.message || "lease no longer owned");
      continue;
    }
    summary[status]++;
  }

  return response({ ok: true, ...summary });
});
