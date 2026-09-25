"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe-client";
import { StripePaymentForm } from "@/components/StripePaymentForm";
import { Button } from "@/components/Button";
import Link from "next/link";

interface PaymentData {
  client_secret: string;
  payment_intent_id: string;
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.classId as string;
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: bookingId }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to create payment");
        }

        setPaymentData(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment setup failed");
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-ottodot-blue border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Payment Setup Failed
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/bookings">
            <Button variant="outline">Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return null;
  }

  return (
    <div className="min-h-[60vh] py-8">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Complete Payment
          </h1>

          <Elements
            stripe={getStripe()}
            options={{
              clientSecret: paymentData.client_secret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#69cce1",
                  colorBackground: "#ffffff",
                  colorText: "#1a1a1a",
                  colorDanger: "#e7344a",
                  fontFamily: "system-ui, sans-serif",
                  borderRadius: "8px",
                },
              },
            }}
          >
            <StripePaymentForm
              bookingId={bookingId}
              clientSecret={paymentData.client_secret}
              onSuccess={() => {
                router.push(`/bookings/${bookingId}/confirmation`);
              }}
              onError={(err) => {
                setError(err);
              }}
            />
          </Elements>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Your payment is secured by Stripe. We never store your card details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
