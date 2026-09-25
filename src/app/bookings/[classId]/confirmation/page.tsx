"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";

interface BookingDetails {
  id: string;
  status: string;
  registered_at: string;
  students: {
    first_name: string;
    last_name: string;
  };
  trial_classes: {
    class_name: string;
    subject: string;
    start_time: string;
    end_time: string;
    location: string;
  };
}

export default function BookingConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.classId as string;
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await fetch(`/api/bookings/${bookingId}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch booking");
        }

        setBooking(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load booking");
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-ottodot-blue border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Booking Not Found
          </h2>
          <p className="text-gray-600 mb-6">{error || "Booking not found"}</p>
          <Link href="/bookings">
            <Button>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  const student = booking.students;
  const trialClass = booking.trial_classes;
  const classDate = new Date(trialClass.start_time).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const classTime = new Date(trialClass.start_time).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-[60vh] py-8">
      <div className="max-w-lg mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 bg-green-50 border-b border-green-100">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Booking Confirmed!
            </h1>
            <p className="text-center text-gray-600">
              Your trial class has been successfully booked.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">
                Booking Reference
              </h3>
              <p className="text-lg font-mono font-semibold text-gray-900">
                {booking.id}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">
                Status
              </h3>
              <StatusBadge status={booking.status as any} />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Student Details
              </h3>
              <p className="text-gray-900">
                {student.first_name} {student.last_name}
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Class Details
              </h3>
              <div className="space-y-2">
                <p className="font-semibold text-gray-900">
                  {trialClass.class_name}
                </p>
                <p className="text-gray-600">{trialClass.subject}</p>
                <p className="text-gray-600">
                  {classDate} at {classTime}
                </p>
                {trialClass.location && (
                  <p className="text-gray-600">{trialClass.location}</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Booking Date
              </h3>
              <p className="text-gray-600">
                {new Date(booking.registered_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/bookings" className="flex-1">
                <Button variant="outline" className="w-full">
                  Book Another Class
                </Button>
              </Link>
              <Link href="/roster" className="flex-1">
                <Button className="w-full">View Roster</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
