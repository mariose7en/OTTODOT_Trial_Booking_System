"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  TrialClassWithSeats,
  BookingStatus,
  CreateBookingRequest,
  ConfirmPaymentRequest,
  ApiResponse,
  BookingResponse,
} from "@/types/booking";
import { BookingForm, BookingFormData } from "@/components/BookingForm";
import { MockPaymentForm } from "@/components/MockPaymentForm";
import { BookingStatusDialog } from "@/components/BookingStatusDialog";
import { BookingConfirmation } from "@/components/BookingConfirmation";
import Link from "next/link";

type BookingStep = "form" | "payment" | "confirmation";

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  const [trialClass, setTrialClass] = useState<TrialClassWithSeats | null>(
    null
  );
  const [currentStep, setCurrentStep] = useState<BookingStep>("form");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<BookingStatus | null>(
    null
  );
  const [studentName, setStudentName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    fetchTrialClass();
  }, [classId]);

  const fetchTrialClass = async () => {
    try {
      const response = await fetch("/api/trial-classes");
      const result: ApiResponse<TrialClassWithSeats[]> = await response.json();

      if (result.success && result.data) {
        const found = result.data.find((c) => c.id === classId);
        if (found) {
          setTrialClass(found);
        } else {
          setError("Class not found");
        }
      } else {
        setError(result.error || "Failed to load class details");
      }
    } catch (err) {
      setError("Failed to load class details");
    }
  };

  const handleBookingSubmit = async (formData: BookingFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      const request: CreateBookingRequest = {
        parent_first_name: formData.parent_first_name,
        parent_last_name: formData.parent_last_name,
        parent_email: formData.parent_email,
        parent_residential_id: formData.parent_residential_id,
        student_first_name: formData.student_first_name,
        student_last_name: formData.student_last_name,
        student_residential_id: formData.student_residential_id,
        trial_class_id: classId,
      };

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const result: ApiResponse<BookingResponse> = await response.json();

      if (result.success && result.data) {
        setBookingId(result.data.booking_id);
        setBookingStatus(result.data.status);
        setStudentName(`${formData.student_first_name} ${formData.student_last_name}`);
        setCurrentStep("payment");
      } else {
        setError(result.error || "Failed to create booking");
      }
    } catch (err) {
      setError("Failed to create booking. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentResult = async (paymentResult: "SUCCESS" | "FAILED") => {
    try {
      setIsLoading(true);
      setError(null);

      const request: ConfirmPaymentRequest = {
        booking_id: bookingId!,
        payment_result: paymentResult,
      };

      const response = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const result: ApiResponse<BookingResponse> = await response.json();

      if (result.success && result.data) {
        setBookingStatus(result.data.status);
        setCurrentStep("confirmation");
        setShowDialog(true);
      } else {
        setError(result.error || "Failed to confirm payment");
      }
    } catch (err) {
      setError("Failed to process payment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (error && !trialClass) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="card-playful text-center py-12">
            <p className="text-ottodot-red mb-4">{error}</p>
            <Link
              href="/bookings"
              className="btn-ottodot btn-ottodot-blue inline-block"
            >
              Back to Classes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {trialClass && currentStep === "form" && (
          <div className="mb-8">
            <div className="card-playful mb-6">
              <div className="flex items-center gap-4">
                <span className="text-4xl">
                  {trialClass.subject === "MATH" ? "🔢" : "🔬"}
                </span>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {trialClass.class_name}
                  </h2>
                  <p className="text-gray-600">{trialClass.subject}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-semibold">
                    {new Date(trialClass.start_time).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Time</p>
                  <p className="font-semibold">
                    {new Date(trialClass.start_time).toLocaleTimeString(
                      "en-US",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === "form" && (
          <BookingForm onSubmit={handleBookingSubmit} isLoading={isLoading} />
        )}

        {currentStep === "payment" && (
          <MockPaymentForm
            amount="FREE"
            onPaymentResult={handlePaymentResult}
            isLoading={isLoading}
          />
        )}

        {currentStep === "confirmation" && bookingId && bookingStatus && (
          <BookingConfirmation
            bookingId={bookingId}
            studentName={studentName}
            className={trialClass?.class_name || ""}
            subject={trialClass?.subject || ""}
            startTime={trialClass?.start_time || ""}
            status={bookingStatus}
          />
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>

      <BookingStatusDialog
        isOpen={showDialog}
        status={bookingStatus || BookingStatus.PendingPayment}
        bookingId={bookingId || ""}
        studentName={studentName}
        className={trialClass?.class_name}
        onClose={() => setShowDialog(false)}
      />
    </div>
  );
}
