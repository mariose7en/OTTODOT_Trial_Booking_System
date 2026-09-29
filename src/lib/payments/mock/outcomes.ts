/**
 * Outcome vocabulary for PayMock (payment_mockup R2): a script decides what a
 * charge does and which webhook event carries it.
 */
import type {
  PaymentIntentStatus,
  PaymentEventType,
  PaymentResult,
} from "@/lib/payments/contracts";

export type MockOutcome = "success" | "failure" | `declined:${string}`;

export function parseOutcome(value: string): MockOutcome {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "success") return "success";
  if (lower === "failure" || lower === "failed") return "failure";
  if (lower.startsWith("declined:")) {
    const code = trimmed.slice(trimmed.indexOf(":") + 1).trim();
    if (!code) throw new Error("declined:<code> requires a decline code");
    return `declined:${code}`;
  }
  throw new Error(`Unsupported payment outcome: ${value}`);
}

export function outcomeToResult(outcome: MockOutcome): PaymentResult {
  return outcome === "success" ? "SUCCESS" : "FAILED";
}

export function outcomeToIntentStatus(
  outcome: MockOutcome
): PaymentIntentStatus {
  return outcome === "success" ? "succeeded" : "canceled";
}

export function outcomeToEventTypes(
  outcome: MockOutcome
): PaymentEventType[] {
  return outcome === "success"
    ? ["payment_intent.succeeded"]
    : ["payment_intent.payment_failed"];
}
