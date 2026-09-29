/**
 * Single writer for booking/payment transitions (payment_mockup D7, R12).
 *
 * Both `POST /api/payments/confirm` and `POST /api/payments/webhook` land here,
 * so there is exactly one place that holds the rules:
 *
 *   PENDING_PAYMENT + SUCCESS → CONFIRMED        (via confirm_trial_booking)
 *   PENDING_PAYMENT + FAILED  → PAYMENT_FAILED
 *   CONFIRMED                 → never demoted    (I5 / API-028)
 *   CANCELLED / REFUNDED      → never resurrected (RC-017)
 *
 * The webhook side is idempotent (duplicate and out-of-order deliveries are
 * acknowledged with 200 and zero writes); the HTTP side reports a conflict
 * (409) for anything that is not PENDING_PAYMENT, matching its contract.
 *
 * The attempt ledger (D8) is written in the same unit of work: INITIATED
 * before the RPC, then the terminal status — and any ledger failure surfaces
 * as a 5xx instead of being swallowed by `console.error`.
 */
import { supabase } from "@/lib/supabase";
import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  rethrowIfDatabaseError,
} from "@/lib/errors";
import { BookingStatus, PaymentAttemptStatus } from "@/types/booking";
import type { PaymentResult } from "@/lib/payments/contracts";
import { generateAttemptId, generateTxnId } from "@/lib/payments/id";

export type ConfirmSource = "http" | "webhook";

export type ConfirmOutcome =
  | { kind: "applied"; booking_id: string; status: string; rpc_code: string }
  | {
      kind: "ignored";
      booking_id: string;
      status: string;
      reason: "already_confirmed" | "not_bookable" | "not_pending";
    };

export interface ConfirmBookingInput {
  booking_id: string;
  result: PaymentResult;
  source: ConfirmSource;
  /** Payment intent id (`pi_…`) recorded on the attempt — D9. */
  txn_id?: string;
}

/**
 * One writer per booking *within the process*: concurrent deliveries for the
 * same booking queue up instead of racing the read-check-then-write, so
 * duplicate/out-of-order bursts stay idempotent (I8/RC-010). The
 * cross-instance guarantee belongs to the database (row locks inside
 * `confirm_trial_booking`) — booking_testing L5, still ⛔ E2.
 */
const inFlight = new Map<string, Promise<ConfirmOutcome>>();

export function confirmBooking(
  input: ConfirmBookingInput
): Promise<ConfirmOutcome> {
  const previous = inFlight.get(input.booking_id) ?? Promise.resolve();
  const run = () => executeConfirmBooking(input);
  const queued = previous.then(run, run);
  const tracked = queued.finally(() => {
    if (inFlight.get(input.booking_id) === tracked) {
      inFlight.delete(input.booking_id);
    }
  });
  inFlight.set(input.booking_id, tracked);
  return tracked;
}

async function executeConfirmBooking(
  input: ConfirmBookingInput
): Promise<ConfirmOutcome> {
  const { booking_id, result, source } = input;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", booking_id)
    .single();

  rethrowIfDatabaseError(bookingError);
  if (bookingError || !booking) {
    throw new NotFoundError("Booking", booking_id);
  }

  const status = String(booking.status);

  if (source === "http") {
    if (status !== BookingStatus.PendingPayment) {
      throw new ConflictError(
        `Booking is not in pending payment status. Current status: ${status}`
      );
    }
  } else {
    if (status === BookingStatus.Confirmed) {
      return { kind: "ignored", booking_id, status, reason: "already_confirmed" };
    }
    if (
      status !== BookingStatus.PendingPayment &&
      status !== BookingStatus.PaymentFailed
    ) {
      return { kind: "ignored", booking_id, status, reason: "not_bookable" };
    }
  }

  const attemptId = generateAttemptId();
  const txnId = input.txn_id ?? generateTxnId();

  const { error: attemptInsertError } = await supabase
    .from("payment_attempts")
    .insert({
      id: attemptId,
      booking_id,
      status: PaymentAttemptStatus.Initiated,
      txn_id: txnId,
    });

  if (attemptInsertError) {
    // D8: bookkeeping is part of the unit of work — fail loudly.
    throw new DatabaseError(
      "Failed to record payment attempt",
      attemptInsertError as unknown as Error
    );
  }

  const { data: rpcCode, error: rpcError } = await supabase.rpc(
    "confirm_trial_booking",
    {
      p_booking_id: booking_id,
      p_payment_result: result,
    }
  );

  if (rpcError) {
    await supabase
      .from("payment_attempts")
      .update({ status: PaymentAttemptStatus.Failed })
      .eq("id", attemptId);
    throw new DatabaseError("Payment processing failed", rpcError as unknown as Error);
  }

  const code = String(rpcCode);
  const terminalStatus =
    code === "CONFIRMED"
      ? PaymentAttemptStatus.Success
      : PaymentAttemptStatus.Failed;

  const { error: attemptUpdateError } = await supabase
    .from("payment_attempts")
    .update({ status: terminalStatus })
    .eq("id", attemptId);

  if (attemptUpdateError) {
    throw new DatabaseError(
      "Failed to record payment attempt result",
      attemptUpdateError as unknown as Error
    );
  }

  return { kind: "applied", booking_id, status: code, rpc_code: code };
}
