"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Booking,
  BookingStatus,
  ApiResponse,
} from "@/types/booking";
import { BookingStats } from "@/components/BookingStats";
import { RecentActivity, Activity } from "@/components/RecentActivity";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";

export default function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/bookings");
      const result: ApiResponse<Booking[]> = await response.json();

      if (result.success && result.data) {
        setBookings(result.data);
      } else {
        setError(result.error || "Failed to load bookings");
      }
    } catch (err) {
      setError("Failed to load bookings");
    } finally {
      setIsLoading(false);
    }
  };

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === BookingStatus.Confirmed)
      .length,
    pending: bookings.filter(
      (b) => b.status === BookingStatus.PendingPayment
    ).length,
    failed: bookings.filter((b) => b.status === BookingStatus.PaymentFailed)
      .length,
  };

  const activities: Activity[] = bookings.slice(0, 5).map((booking) => ({
    id: booking.id,
    type:
      booking.status === BookingStatus.Confirmed
        ? "payment"
        : booking.status === BookingStatus.PaymentFailed
        ? "cancellation"
        : "booking",
    message: `Booking ${booking.id} - ${booking.status}`,
    timestamp: booking.registered_at,
  }));

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 font-heading">
            Admin Dashboard
          </h1>
          <p className="text-gray-600">
            Manage bookings and monitor trial class activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 justify-center mb-8">
          <Link href="/admin/bookings">
            <Button variant="outline">Manage Bookings</Button>
          </Link>
          <Link href="/admin/classes">
            <Button variant="outline">Manage Classes</Button>
          </Link>
          <Link href="/admin/students">
            <Button variant="outline">View Students</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-ottodot-blue border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading data...</p>
          </div>
        ) : error ? (
          <div className="card-playful text-center py-12">
            <p className="text-ottodot-red mb-4">{error}</p>
            <button
              onClick={fetchBookings}
              className="btn-ottodot btn-ottodot-blue"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Booking Statistics
              </h2>
              <BookingStats {...stats} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Recent Activity
              </h2>
              <RecentActivity activities={activities} />
            </div>

            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  All Bookings
                </h2>
                <Link href="/admin/bookings">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
              <div className="card-playful overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                          Booking ID
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                          Student ID
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                          Class ID
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.slice(0, 10).map((booking) => (
                        <tr
                          key={booking.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4 font-mono text-sm">
                            {booking.id.substring(0, 12)}...
                          </td>
                          <td className="py-3 px-4 font-mono text-sm">
                            {booking.student_id.substring(0, 8)}...
                          </td>
                          <td className="py-3 px-4 font-mono text-sm">
                            {booking.trial_class_id.substring(0, 12)}...
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={booking.status} />
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {new Date(
                              booking.registered_at
                            ).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {bookings.length > 10 && (
                  <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
                    <Link href="/admin/bookings" className="text-ottodot-blue hover:underline">
                      View all {bookings.length} bookings
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
