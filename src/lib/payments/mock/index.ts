/**
 * PayMock provider (payment_mockup §5): implements the shared
 * `PaymentProvider` port on top of the in-process store, plus the mock-only
 * control surface (`MockControls`) used by the dev control plane and tests.
 */
import type {
  ChargeResult,
  CreateIntentInput,
  PaymentIntent,
  PaymentProvider,
  RefundResult,
} from "@/lib/payments/contracts";
import {
  buildEmitRequests,
  type EmitInput,
  type EmitResult,
} from "@/lib/payments/mock/emit";
import {
  mockStore,
  toContractIntent,
  type OutcomeScript,
  type PlanInput,
} from "@/lib/payments/mock/store";
import { verifySignature, webhookSecret } from "@/lib/payments/mock/signer";
import { resetIdSequences } from "@/lib/payments/id";

export const mockProvider: PaymentProvider = {
  name: "mock",

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    return toContractIntent(mockStore.createIntent(input));
  },

  async refund(input): Promise<RefundResult> {
    return mockStore.refund(input.paymentIntentId, {
      reason: input.reason,
      metadata: input.metadata,
    });
  },

  verifySignature(payload: string, header: string): boolean {
    return verifySignature(payload, header, webhookSecret());
  },
};

export interface MockControls {
  charge(intentId: string): ChargeResult;
  plan(key: string, input: PlanInput): OutcomeScript;
  emit(input: EmitInput): EmitResult;
  reset(): void;
  state(): ReturnType<typeof mockStore.snapshot>;
}

export const mockControls: MockControls = {
  charge: (intentId) => mockStore.charge(intentId),
  plan: (key, input) => mockStore.plan(key, input),
  emit: (input) => buildEmitRequests(input),
  reset: () => {
    mockStore.reset();
    resetIdSequences();
  },
  state: () => mockStore.snapshot(),
};
