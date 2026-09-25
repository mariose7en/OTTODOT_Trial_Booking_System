"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/Button";

interface StripePaymentFormProps {
  bookingId: string;
  clientSecret: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function StripePaymentForm({
  bookingId,
  clientSecret,
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/bookings/${bookingId}/confirmation`,
        },
      });

      if (submitError) {
        setError(submitError.message || "Payment failed");
        onError?.(submitError.message || "Payment failed");
      } else {
        onSuccess?.();
        router.refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setError(message);
      onError?.(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-2">
          Amount to pay: <span className="font-semibold text-gray-900">$20.00</span>
        </p>
        <p className="text-xs text-gray-500">
          Booking ID: {bookingId}
        </p>
      </div>

      <PaymentElement />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Processing...
          </span>
        ) : (
          "Pay $20.00"
        )}
      </Button>
    </form>
  );
}
