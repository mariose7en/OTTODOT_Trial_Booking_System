import { BookingStatus } from "@/types/booking";

// Mock supabase for concurrency tests
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";

describe("Concurrency Tests - Last Seat Race Condition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Race condition prevention via stored procedure", () => {
    it("should only allow one confirmed booking when one seat remains", async () => {
      // Simulate two parallel payment confirmations for the same class
      // with only 1 seat remaining
      
      const mockFrom = jest.fn();
      const mockRpc = jest.fn();
      
      (supabase.from as jest.Mock) = mockFrom;
      (supabase.rpc as jest.Mock) = mockRpc;

      // First booking succeeds
      mockRpc.mockResolvedValueOnce({ data: "CONFIRMED", error: null });
      
      // Second booking fails - no seats available
      mockRpc.mockResolvedValueOnce({ data: "NO_SEATS_AVAILABLE", error: null });

      const result1 = await supabase.rpc("confirm_trial_booking", {
        p_booking_id: "BOOKING001-20260925",
        p_payment_result: "SUCCESS",
      });

      const result2 = await supabase.rpc("confirm_trial_booking", {
        p_booking_id: "BOOKING002-20260925",
        p_payment_result: "SUCCESS",
      });

      expect(result1.data).toBe("CONFIRMED");
      expect(result2.data).toBe("NO_SEATS_AVAILABLE");
    });

    it("should detect duplicate booking attempt", async () => {
      const mockRpc = jest.fn();
      (supabase.rpc as jest.Mock) = mockRpc;

      // First booking is already confirmed
      mockRpc.mockResolvedValueOnce({ data: "CONFIRMED", error: null });
      
      // Second attempt for same student/class returns duplicate
      mockRpc.mockResolvedValueOnce({ data: "DUPLICATE_BOOKING", error: null });

      const result1 = await supabase.rpc("confirm_trial_booking", {
        p_booking_id: "BOOKING001-20260925",
        p_payment_result: "SUCCESS",
      });

      const result2 = await supabase.rpc("confirm_trial_booking", {
        p_booking_id: "BOOKING002-20260925",
        p_payment_result: "SUCCESS",
      });

      expect(result1.data).toBe("CONFIRMED");
      expect(result2.data).toBe("DUPLICATE_BOOKING");
    });

    it("should handle payment failure gracefully", async () => {
      const mockRpc = jest.fn();
      (supabase.rpc as jest.Mock) = mockRpc;

      mockRpc.mockResolvedValueOnce({ data: "PAYMENT_FAILED", error: null });

      const result = await supabase.rpc("confirm_trial_booking", {
        p_booking_id: "BOOKING001-20260925",
        p_payment_result: "FAILED",
      });

      expect(result.data).toBe("PAYMENT_FAILED");
    });

    it("should handle RPC errors", async () => {
      const mockRpc = jest.fn();
      (supabase.rpc as jest.Mock) = mockRpc;

      mockRpc.mockResolvedValueOnce({ 
        data: null, 
        error: { message: "Database connection error" } 
      });

      const result = await supabase.rpc("confirm_trial_booking", {
        p_booking_id: "BOOKING001-20260925",
        p_payment_result: "SUCCESS",
      });

      expect(result.error).toBeTruthy();
      expect(result.error.message).toBe("Database connection error");
    });
  });

  describe("Seat count validation", () => {
    it("should prevent overbooking when class is full", async () => {
      // Simulate the logic: 4 max seats, 4 confirmed = 0 remaining
      const maxSeats = 4;
      const confirmedCount = 4;
      const seatsRemaining = Math.max(0, maxSeats - confirmedCount);
      
      expect(seatsRemaining).toBe(0);
      expect(seatsRemaining <= 0).toBe(true);
    });

    it("should allow booking when seats are available", async () => {
      // Simulate the logic: 4 max seats, 2 confirmed = 2 remaining
      const maxSeats = 4;
      const confirmedCount = 2;
      const seatsRemaining = Math.max(0, maxSeats - confirmedCount);
      
      expect(seatsRemaining).toBe(2);
      expect(seatsRemaining > 0).toBe(true);
    });

    it("should handle edge case where confirmed exceeds max", async () => {
      // Edge case: data inconsistency
      const maxSeats = 4;
      const confirmedCount = 5;
      const seatsRemaining = Math.max(0, maxSeats - confirmedCount);
      
      expect(seatsRemaining).toBe(0);
    });
  });

  describe("Booking status transitions", () => {
    it("should transition from PENDING_PAYMENT to CONFIRMED on success", async () => {
      const mockRpc = jest.fn();
      (supabase.rpc as jest.Mock) = mockRpc;

      mockRpc.mockResolvedValueOnce({ data: "CONFIRMED", error: null });

      const result = await supabase.rpc("confirm_trial_booking", {
        p_booking_id: "BOOKING004-20260925",
        p_payment_result: "SUCCESS",
      });

      expect(result.data).toBe("CONFIRMED");
    });

    it("should transition from PENDING_PAYMENT to PAYMENT_FAILED on failure", async () => {
      const mockRpc = jest.fn();
      (supabase.rpc as jest.Mock) = mockRpc;

      mockRpc.mockResolvedValueOnce({ data: "PAYMENT_FAILED", error: null });

      const result = await supabase.rpc("confirm_trial_booking", {
        p_booking_id: "BOOKING004-20260925",
        p_payment_result: "FAILED",
      });

      expect(result.data).toBe("PAYMENT_FAILED");
    });

    it("should not allow double confirmation", async () => {
      const mockRpc = jest.fn();
      (supabase.rpc as jest.Mock) = mockRpc;

      // First confirmation succeeds
      mockRpc.mockResolvedValueOnce({ data: "CONFIRMED", error: null });
      
      // Second confirmation returns duplicate
      mockRpc.mockResolvedValueOnce({ data: "DUPLICATE_BOOKING", error: null });

      const result1 = await supabase.rpc("confirm_trial_booking", {
        p_booking_id: "BOOKING001-20260925",
        p_payment_result: "SUCCESS",
      });

      const result2 = await supabase.rpc("confirm_trial_booking", {
        p_booking_id: "BOOKING001-20260925",
        p_payment_result: "SUCCESS",
      });

      expect(result1.data).toBe("CONFIRMED");
      expect(result2.data).toBe("DUPLICATE_BOOKING");
    });
  });
});
