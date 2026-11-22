export type VerifiedPaymentMetadata = {
  order_id?: unknown;
  user_id?: unknown;
  payment_attempt_id?: unknown;
};
export type PersistedPaymentAttemptContext = {
  order_id?: unknown;
  user_id?: unknown;
  attempt_id?: unknown;
  amount_minor?: unknown;
  currency?: unknown;
};

/** Strict binding between Paystack's verified transaction and Everneed's persisted attempt. */
export function paymentContextMatches(
  metadata: VerifiedPaymentMetadata | null | undefined,
  verifiedAmount: unknown,
  verifiedCurrency: unknown,
  context: PersistedPaymentAttemptContext | null | undefined,
): boolean {
  const amount = Number(verifiedAmount);
  const expectedAmount = Number(context?.amount_minor);
  if (!metadata || !context || !Number.isSafeInteger(amount) || !Number.isSafeInteger(expectedAmount)) return false;
  return String(metadata.order_id ?? "") === String(context.order_id ?? "") &&
    String(metadata.user_id ?? "") === String(context.user_id ?? "") &&
    String(metadata.payment_attempt_id ?? "") === String(context.attempt_id ?? "") &&
    amount === expectedAmount &&
    String(verifiedCurrency ?? "").toUpperCase() === String(context.currency ?? "").toUpperCase();
}
