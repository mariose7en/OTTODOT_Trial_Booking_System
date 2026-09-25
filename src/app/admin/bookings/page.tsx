"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";

interface Booking {
  id: string;
  status: string;
  registered_at: string;
  students: {
    first_name: string;
    last_name: string;
    email: string;
  };
  trial_classes: {
    class_name: string;
    subject: string;
    start_time: string;
  };
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/bookings");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch bookings");
      }

      setBookings(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchesFilter = filter === "all" || booking.status === filter;
    const matchesSearch =
      search === "" ||
      booking.students.first_name.toLowerCase().includes(search.toLowerCase()) ||
      booking.students.last_name.toLowerCase().includes(search.toLowerCase()) ||
      booking.id.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to cancel booking");
      }

      fetchBookings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel booking");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-ottodot-blue border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Bookings
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchBookings}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
            Booking Management
          </h1>
          <Link href="/admin">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by name or booking ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                {["all", "CONFIRMED", "PENDING_PAYMENT", "PAYMENT_FAILED", "CANCELLED"].map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filter === status
                          ? "bg-ottodot-blue text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {status === "all" ? "All" : status.replace("_", " ")}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Booking ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Booked On
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No bookings found
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm text-gray-900">
                          {booking.id.substring(0, 12)}...
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {booking.students.first_name}{" "}
                            {booking.students.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {booking.students.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {booking.trial_classes.class_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {booking.trial_classes.subject}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={booking.status as any} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(booking.registered_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="text-ottodot-blue hover:underline mr-4"
                        >
                          View
                        </Link>
                        {booking.status === "CONFIRMED" && (
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            className="text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Showing {filteredBookings.length} of {bookings.length} bookings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
