import { z } from "zod";
import { bookingIdSchema } from "@/lib/validations/ids";
import type { PaymentResult } from "@/lib/payments/contracts";

export const CreateBookingSchema = z.object({
  trial_class_id: z
    .string()
    .min(1, "Trial class ID is required")
    .regex(/^[A-Z]{2}-[A-Z]-\d{8}T\d{4}-\d+$/, "Invalid trial class ID format"),
  
  parent: z.object({
    first_name: z
      .string()
      .min(1, "First name is required")
      .max(100, "First name too long")
      .transform((val) => val.toUpperCase().trim()),
    
    last_name: z
      .string()
      .min(1, "Last name is required")
      .max(100, "Last name too long")
      .transform((val) => val.toUpperCase().trim()),
    
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .toLowerCase()
      .trim(),
    
    phone: z
      .string()
      .min(1, "Phone number is required")
      .regex(/^\+?[\d\s-]{8,15}$/, "Invalid phone number format"),
  }),
  
  student: z.object({
    first_name: z
      .string()
      .min(1, "First name is required")
      .max(100, "First name too long")
      .transform((val) => val.toUpperCase().trim()),
    
    last_name: z
      .string()
      .min(1, "Last name is required")
      .max(100, "Last name too long")
      .transform((val) => val.toUpperCase().trim()),
    
    grade: z
      .number()
      .int("Grade must be an integer")
      .min(1, "Grade must be between 1 and 6")
      .max(6, "Grade must be between 1 and 6"),
  }),
});

export const ConfirmPaymentSchema = z.object({
  booking_id: bookingIdSchema,

  // D1: canonical SUCCESS | FAILED (what the UI sends and what the RPC SQL
  // compares). The lowercase spellings are tolerated for one release and
  // normalised here so server, UI and RPC share a single casing — note the
  // legacy pair was ("success","failure"), which maps to SUCCESS|FAILED.
  payment_result: z
    .enum(["SUCCESS", "FAILED", "success", "failure"])
    .transform((value): PaymentResult =>
      value.toLowerCase() === "success" ? "SUCCESS" : "FAILED"
    ),
});

export const TrialClassQuerySchema = z.object({
  available: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

export const BookingQuerySchema = z.object({
  status: z
    .enum(["PENDING_PAYMENT", "CONFIRMED", "PAYMENT_FAILED", "CANCELLED", "REFUNDED", "COMPLETED"])
    .optional(),
  
  trial_class_id: z
    .string()
    .regex(/^[A-Z]{2}-[A-Z]-\d{8}T\d{4}-\d+$/)
    .optional(),
  
  parent_email: z
    .string()
    .email()
    .optional(),
});

export const RosterParamsSchema = z.object({
  class_id: z
    .string()
    .min(1, "Class ID is required")
    .regex(/^[A-Z]{2}-[A-Z]-\d{8}T\d{4}-\d+$/, "Invalid class ID format"),
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentSchema>;
export type TrialClassQueryInput = z.infer<typeof TrialClassQuerySchema>;
export type BookingQueryInput = z.infer<typeof BookingQuerySchema>;
export type RosterParamsInput = z.infer<typeof RosterParamsSchema>;
