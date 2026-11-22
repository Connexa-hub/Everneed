import { assertEquals } from "jsr:@std/assert@1";
import { paymentContextMatches } from "./payment-context.ts";

const metadata = { order_id: "order-1", user_id: "user-1", payment_attempt_id: "attempt-1" };
const context = { order_id: "order-1", user_id: "user-1", attempt_id: "attempt-1", amount_minor: 12500, currency: "NGN" };

Deno.test("verified provider transaction matches persisted attempt exactly", () => {
  assertEquals(paymentContextMatches(metadata, 12500, "ngn", context), true);
});
Deno.test("rejects order identity mismatch", () => {
  assertEquals(paymentContextMatches({ ...metadata, order_id: "other" }, 12500, "NGN", context), false);
});
Deno.test("rejects user identity mismatch", () => {
  assertEquals(paymentContextMatches({ ...metadata, user_id: "other" }, 12500, "NGN", context), false);
});
Deno.test("rejects attempt identity mismatch", () => {
  assertEquals(paymentContextMatches({ ...metadata, payment_attempt_id: "other" }, 12500, "NGN", context), false);
});
Deno.test("rejects amount mismatch", () => {
  assertEquals(paymentContextMatches(metadata, 12499, "NGN", context), false);
});
Deno.test("rejects non-safe integer provider amount", () => {
  assertEquals(paymentContextMatches(metadata, Number.MAX_SAFE_INTEGER + 1, "NGN", context), false);
});
Deno.test("rejects currency mismatch", () => {
  assertEquals(paymentContextMatches(metadata, 12500, "GHS", context), false);
});
Deno.test("rejects absent context and metadata", () => {
  assertEquals(paymentContextMatches(metadata, 12500, "NGN", null), false);
  assertEquals(paymentContextMatches(null, 12500, "NGN", context), false);
});
