/**
 * PayMock id wrappers (payment_mockup §5.1): `pi_mock_<seq>_<yyyymmdd>` and
 * `re_mock_<seq>_<yyyymmdd>`, from the shared deterministic sequence factories.
 */
import { generateIntentId, generateRefundId } from "@/lib/payments/id";

export const MOCK_INTENT_PREFIX = "pi_mock";
export const MOCK_REFUND_PREFIX = "re_mock";

export function mockIntentId(at: Date = new Date()): string {
  return generateIntentId(at, MOCK_INTENT_PREFIX);
}

export function mockRefundId(at: Date = new Date()): string {
  return generateRefundId(at, MOCK_REFUND_PREFIX);
}

export function mockClientSecret(intentId: string, seq: number): string {
  return `${intentId}_secret_${seq}`;
}
